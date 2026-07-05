"""白云山森林巡护管理系统 — Flask 后端入口"""
import json
import time
import datetime
import threading
import queue
import os
from io import BytesIO
from functools import wraps

from flask import Flask, request, jsonify, Response, stream_with_context, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required, get_jwt_identity
)
from werkzeug.security import generate_password_hash, check_password_hash

from config import Config
from models import (db, User, Role, Permission, Ranger, Drone, PatrolTeam,
    RangerTrack, DroneTrack, PatrolTask, PatrolRoute, PatrolLog,
    FireEvent, PestEvent, AbnormalEvent, AlertWarning, AiImage, SystemLog)

# 加载林区巡护路线 + 边界约束（兼容旧版无此文件）
try:
    from patrol_routes import PATROL_ROUTES
except ImportError:
    PATROL_ROUTES = {}
try:
    from compartment_bounds import COMPARTMENT_POLYGONS, RANGER_MAP
except ImportError:
    COMPARTMENT_POLYGONS = {}
    RANGER_MAP = {}
try:
    from baiyunshan_boundary import BAIYUNSHAN_BOUNDARY
except ImportError:
    BAIYUNSHAN_BOUNDARY = None

# ========== App 初始化 ==========

app = Flask(__name__)
app.config.from_object(Config)
CORS(app, resources={r"/api/*": {"origins": "*"}})
jwt = JWTManager(app)
db.init_app(app)

# 前端原型目录（用于静态文件服务 + 灾害图片存储）
PROTOTYPE_DIR = os.path.abspath(os.path.join(
    os.path.dirname(os.path.abspath(__file__)), '..'
))

# SSE 消息队列（线程安全）
sse_queues: list[queue.Queue] = []


# ========== 工具函数 ==========

def role_required(role):
    """角色权限装饰器"""
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            current_user = get_jwt_identity()
            try:
                identity = json.loads(current_user)
                if identity.get('role') != role and identity.get('role') != 'admin':
                    return jsonify({'success': False, 'error': '权限不足'}), 403
            except (json.JSONDecodeError, TypeError):
                return jsonify({'success': False, 'error': '身份验证失败'}), 401
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def broadcast_sse(event_type, data):
    """向所有SSE客户端广播消息"""
    msg = json.dumps({'type': event_type, 'data': data}, ensure_ascii=False)
    dead = []
    for q in sse_queues:
        try:
            q.put_nowait(msg)
        except queue.Full:
            dead.append(q)
    for q in dead:
        sse_queues.remove(q)


# ========== 认证路由 ==========

@app.route('/api/auth/login', methods=['POST'])
def login():
    """用户登录"""
    data = request.get_json()
    username = data.get('username', '')
    password = data.get('password', '')

    user = User.query.filter_by(username=username).first()
    if user and check_password_hash(user.password_hash, password):
        user.status = '在线'
        user.last_login = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        db.session.commit()
        identity = json.dumps({'id': user.id, 'username': user.username, 'role': user.role, 'name': user.name})
        token = create_access_token(identity=identity)
        return jsonify({
            'success': True,
            'data': {'username': user.username, 'role': user.role, 'name': user.name},
            'token': token
        })
    return jsonify({'success': False, 'data': None})


@app.route('/api/auth/logout', methods=['POST'])
@jwt_required()
def logout():
    """用户登出"""
    try:
        identity = json.loads(get_jwt_identity())
        user = User.query.get(identity.get('id'))
        if user:
            user.status = '离线'
            db.session.commit()
    except Exception:
        pass
    return jsonify({'success': True})


@app.route('/api/auth/me', methods=['GET'])
@jwt_required()
def get_me():
    """获取当前用户信息"""
    try:
        identity = json.loads(get_jwt_identity())
        user = User.query.get(identity.get('id'))
        if user:
            return jsonify({'success': True, 'data': user.to_dict()})
    except Exception:
        pass
    return jsonify({'success': False}), 401


# ========== 森林数据路由（GeoServer 代理） ==========

@app.route('/api/forest/config', methods=['GET'])
@jwt_required()
def get_forest_config():
    """获取林场基础配置"""
    return jsonify({
        'center': Config.FOREST_CENTER,
        'bbox': Config.FOREST_BBOX,
        'geoserverUrl': Config.GEOSERVER_URL,
        'workspace': Config.GEOSERVER_WORKSPACE,
        'boundary': [],  # 由前端从GeoServer WMS加载
    })


@app.route('/api/forest/compartments', methods=['GET'])
@jwt_required()
def get_compartments():
    """获取小班数据 — 通过GeoServer WFS"""
    # 前端可直连GeoServer WFS，这里返回配置信息
    return jsonify({
        'wfsUrl': f'{Config.GEOSERVER_URL}/{Config.GEOSERVER_WORKSPACE}/ows',
        'layerName': f'{Config.GEOSERVER_WORKSPACE}:forest_compartment',
    })


@app.route('/api/forest/compartments/colors', methods=['GET'])
@jwt_required()
def get_compartment_colors():
    """小班颜色方案"""
    return jsonify(['#00bcd4', '#009688', '#00acc1', '#26a69a', '#00897b'])


# ========== 驾驶舱路由 ==========

@app.route('/api/stats/overview', methods=['GET'])
@jwt_required()
def get_stats_overview():
    """驾驶舱态势总览统计"""
    today = datetime.date.today().strftime('%Y-%m-%d')
    online_rangers = Ranger.query.filter_by(status='在线').count()
    online_drones = Drone.query.filter_by(status='巡航中').count()
    fire_count = FireEvent.query.count()
    pest_count = PestEvent.query.count()
    abnormal_count = AbnormalEvent.query.count()
    unhandled = AbnormalEvent.query.filter(~AbnormalEvent.status.in_(['已处置', '已解除'])).count()

    return jsonify({
        'patrolCount': Ranger.query.count(),
        'onlineRangers': online_rangers,
        'onlineDrones': online_drones,
        'patrolDistance': round(sum(r.speed_kmh or 0 for r in Ranger.query.all()) * 5.7, 1),
        'patrolDuration': round(online_rangers * 2.7, 1),
        'taskCount': PatrolTask.query.filter_by(status='进行中').count(),
        'fireCount': fire_count,
        'pestCount': pest_count,
        'abnormalCount': abnormal_count,
        'unhandledCount': unhandled,
    })


@app.route('/api/dashboard/warnings', methods=['GET'])
@jwt_required()
def get_dashboard_warnings():
    """驾驶舱实时告警"""
    warnings = AlertWarning.query.order_by(AlertWarning.created_at.desc()).limit(20).all()
    return jsonify([w.to_dict() for w in warnings])


@app.route('/api/dashboard/online-units', methods=['GET'])
@jwt_required()
def get_online_units():
    """在线巡护人员列表"""
    rangers = Ranger.query.filter_by(status='在线').limit(10).all()
    drones = Drone.query.filter_by(status='巡航中').limit(10).all()
    return jsonify({
        'rangers': [r.to_dict() for r in rangers],
        'drones': [d.to_dict() for d in drones],
    })


# ========== 巡护力量路由 ==========

@app.route('/api/rangers', methods=['GET'])
@jwt_required()
def get_rangers():
    """获取护林员列表"""
    rangers = Ranger.query.all()
    return jsonify([r.to_dict() for r in rangers])


@app.route('/api/rangers/<int:id>', methods=['GET'])
@jwt_required()
def get_ranger(id):
    """获取单个护林员"""
    ranger = Ranger.query.get_or_404(id)
    return jsonify(ranger.to_dict())


@app.route('/api/rangers/<int:id>/tracks', methods=['GET'])
@jwt_required()
def get_ranger_tracks(id):
    """获取护林员历史轨迹（前端按timestamp筛选日期）"""
    tracks = RangerTrack.query.filter_by(ranger_id=id)\
        .order_by(RangerTrack.timestamp.asc()).limit(50000).all()
    return jsonify([t.to_dict() for t in tracks])


@app.route('/api/patrol/rangers/realtime', methods=['GET'])
@jwt_required()
def get_rangers_realtime():
    """护林员最新位置"""
    rangers = Ranger.query.filter_by(status='在线').all()
    return jsonify([r.to_dict() for r in rangers])


@app.route('/api/drones', methods=['GET'])
@jwt_required()
def get_drones():
    """获取无人机列表"""
    drones = Drone.query.all()
    return jsonify([d.to_dict() for d in drones])


@app.route('/api/drones/<int:id>', methods=['GET'])
@jwt_required()
def get_drone(id):
    """获取单个无人机"""
    drone = Drone.query.get_or_404(id)
    return jsonify(drone.to_dict())


@app.route('/api/drones/<int:id>/tracks', methods=['GET'])
@jwt_required()
def get_drone_tracks(id):
    """获取无人机历史轨迹，支持日期筛选"""
    start = request.args.get('start', '')
    end = request.args.get('end', '')
    query = DroneTrack.query.filter_by(drone_id=id)
    if start:
        try:
            st = datetime.datetime.strptime(start, '%Y-%m-%d')
            query = query.filter(DroneTrack.timestamp >= st)
        except ValueError:
            pass
    if end:
        try:
            et = datetime.datetime.strptime(end, '%Y-%m-%d') + datetime.timedelta(days=1)
            query = query.filter(DroneTrack.timestamp < et)
        except ValueError:
            pass
    tracks = query.order_by(DroneTrack.timestamp.asc()).limit(50000).all()
    return jsonify([t.to_dict() for t in tracks])


@app.route('/api/patrol/drones/realtime', methods=['GET'])
@jwt_required()
def get_drones_realtime():
    """无人机最新位置"""
    drones = Drone.query.filter_by(status='巡航中').all()
    return jsonify([d.to_dict() for d in drones])


# ========== 无人机任务 ==========

# 无人机任务状态跟踪
drone_missions = {}  # {drone_id: {task_id, waypoints, current_idx, status}}

@app.route('/api/drones/<int:id>/mission', methods=['POST'])
@jwt_required()
def assign_drone_mission(id):
    """给无人机派发任务：读取任务路线，按12m/s飞行"""
    drone = Drone.query.get_or_404(id)
    data = request.get_json()
    task_id = data.get('taskId')

    # 从任务读取规划路线
    waypoints = []
    if task_id:
        task = PatrolTask.query.filter_by(task_number=task_id).first() or PatrolTask.query.get(int(task_id) if str(task_id).isdigit() else 0)
    else:
        task = PatrolTask.query.filter_by(drone_id=id, status='待执行').first()

    if task and task.route_geometry:
        try:
            geojson = json.loads(task.route_geometry)
            coords = geojson.get('coordinates', [])
            waypoints = [(c[1], c[0]) for c in coords]  # [lng,lat] → (lat,lng)
        except Exception:
            waypoints = _generate_drone_mission_waypoints(28.520, 119.920)
    else:
        area = data.get('area', '全场区')
        bl = {'一号林区':(28.520,119.910),'二号林区':(28.500,119.930),'三号林区':(28.540,119.890),
              '四号林区':(28.485,119.950),'五号林区':(28.560,119.870),'六号林区':(28.510,119.900)}.get(area,(28.520,119.920))
        waypoints = _generate_drone_mission_waypoints(bl[0], bl[1])

    # 返航点：管理中心
    home = (28.500, 119.920)
    waypoints.append(home)

    drone_missions[id] = {
        'task_id': task.task_number if task else str(task_id),
        'waypoints': waypoints,
        'current_idx': 0,
        'status': 'en_route',
        '_frac': 0.0,
        'speed_mps': 12.0,  # 12m/s
        'started_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }

    drone.status = '任务飞行中'
    if task:
        task.status = '进行中'
    db.session.commit()

    broadcast_sse('drone_mission_start', {'droneCode': drone.code, 'waypoints': waypoints})
    return jsonify({'success': True, 'mission': {'droneId': drone.code, 'waypoints': waypoints, 'waypointCount': len(waypoints), 'speed': '12m/s'}})


def _generate_drone_mission_waypoints(lat, lng):
    """生成无人机回型扫描航线"""
    import random
    span = 0.025
    rows = 5
    waypoints = []
    for row in range(rows):
        rlat = lat + (span / (rows - 1)) * row if rows > 1 else lat
        if row % 2 == 0:
            waypoints.append((round(rlat, 6), round(lng, 6)))
            waypoints.append((round(rlat, 6), round(lng + span, 6)))
        else:
            waypoints.append((round(rlat, 6), round(lng + span, 6)))
            waypoints.append((round(rlat, 6), round(lng, 6)))
    return waypoints


@app.route('/api/drones/<int:id>/mission', methods=['GET'])
@jwt_required()
def get_drone_mission(id):
    """获取无人机当前任务状态"""
    mission = drone_missions.get(id)
    drone = Drone.query.get_or_404(id)
    return jsonify({
        'success': True,
        'droneCode': drone.code,
        'mission': mission,
        'droneStatus': drone.status,
    })


# ========== 巡护任务 CRUD（增强版） ==========

def _gen_task_number():
    """生成任务编号 XH20260703-001"""
    today = datetime.date.today().strftime('%Y%m%d')
    count = PatrolTask.query.filter(PatrolTask.task_number.like(f'XH{today}-%')).count()
    return f'XH{today}-{count+1:03d}'

def _gen_route_geometry(area):
    """根据巡护区域生成规划路线 GeoJSON LineString"""
    import random as _rnd
    base = {
        '一号林区': (28.520, 119.910), '二号林区': (28.500, 119.930),
        '三号林区': (28.540, 119.890), '四号林区': (28.485, 119.950),
        '五号林区': (28.560, 119.870), '六号林区': (28.510, 119.900),
        '全场区': (28.520, 119.920),
    }
    bl = base.get(area, (28.520, 119.920))
    coords = []
    for i in range(20):
        lat = bl[0] + _rnd.uniform(-0.012, 0.012)
        lng = bl[1] + _rnd.uniform(-0.012, 0.012)
        coords.append([round(lng, 6), round(lat, 6)])
    return json.dumps({"type": "LineString", "coordinates": coords})


@app.route('/api/patrol/tasks', methods=['GET', 'POST'])
@jwt_required()
def patrol_tasks():
    if request.method == 'GET':
        tasks = PatrolTask.query.order_by(PatrolTask.created_at.desc()).all()
        return jsonify([t.to_dict() for t in tasks])
    else:
        data = request.get_json()
        task = PatrolTask(
            task_number=_gen_task_number(),
            name=data.get('name', ''),
            type=data.get('type', '日常巡护'),
            time_start=data.get('timeStart', ''),
            time_end=data.get('timeEnd', ''),
            area=data.get('area', ''),
            ranger_id=data.get('rangerId'),
            drone_id=data.get('droneId'),
            route_geometry=data.get('routeGeometry') or _gen_route_geometry(data.get('area', '')),
            status='草稿',
            progress=0,
            creator=data.get('creator', '管理员'),
            description=data.get('description', ''),
        )
        db.session.add(task)
        db.session.commit()
        return jsonify({'success': True, 'data': task.to_dict()})


@app.route('/api/patrol/tasks/<int:id>', methods=['GET', 'PUT', 'DELETE'])
@jwt_required()
def patrol_task(id):
    task = PatrolTask.query.get_or_404(id)
    if request.method == 'GET':
        return jsonify(task.to_dict())
    elif request.method == 'PUT':
        data = request.get_json()
        for key, col in [
            ('name', 'name'), ('type', 'type'), ('status', 'status'),
            ('progress', 'progress'), ('description', 'description'),
            ('area', 'area'), ('timeStart', 'time_start'), ('timeEnd', 'time_end'),
            ('rangerId', 'ranger_id'), ('droneId', 'drone_id'),
            ('routeGeometry', 'route_geometry'),
        ]:
            if key in data and data[key] is not None:
                setattr(task, col, data[key])
        db.session.commit()
        return jsonify({'success': True, 'data': task.to_dict()})
    else:
        db.session.delete(task)
        db.session.commit()
        return jsonify({'success': True})


# ========== 任务派发（SSE推送） ==========

@app.route('/api/patrol/tasks/<int:id>/dispatch', methods=['POST'])
@jwt_required()
def dispatch_task(id):
    """派发任务：状态→待执行，SSE推送通知移动端和无人机"""
    task = PatrolTask.query.get_or_404(id)
    task.status = '待执行'
    db.session.commit()

    # SSE推送通知
    broadcast_sse('task_dispatched', task.to_dict())

    return jsonify({'success': True, 'message': f'任务 {task.task_number} 已派发', 'data': task.to_dict()})


# ========== GPS 追踪（护林员手机端每5秒上传） ==========

@app.route('/api/patrol/tasks/<int:id>/gps', methods=['POST'])
def upload_gps(id):
    """护林员手机端上传GPS位置"""
    data = request.get_json()
    track = GpsTrack(
        task_id=id,
        lat=data.get('lat', 0),
        lng=data.get('lng', 0),
        speed=data.get('speed', 0),
        accuracy=data.get('accuracy', 0),
        timestamp=datetime.datetime.now(datetime.timezone.utc),
    )
    db.session.add(track)

    # 更新任务实际轨迹
    task = PatrolTask.query.get(id)
    if task:
        try:
            existing = json.loads(task.actual_track) if task.actual_track else {"type": "LineString", "coordinates": []}
            existing['coordinates'].append([data.get('lng', 0), data.get('lat', 0)])
            task.actual_track = json.dumps(existing)
        except Exception:
            pass

    db.session.commit()

    # SSE推送最新位置
    broadcast_sse('ranger_gps', {'taskId': id, 'lat': data.get('lat'), 'lng': data.get('lng'),
                                  'timestamp': datetime.datetime.now(datetime.timezone.utc).strftime('%H:%M:%S')})

    return jsonify({'success': True})


@app.route('/api/patrol/tasks/<int:id>/gps', methods=['GET'])
@jwt_required()
def get_task_gps(id):
    """获取任务的GPS轨迹"""
    tracks = GpsTrack.query.filter_by(task_id=id).order_by(GpsTrack.timestamp.asc()).all()
    return jsonify([t.to_dict() for t in tracks])


# ========== 移动端 - 我的任务 ==========

@app.route('/api/mobile/tasks', methods=['GET'])
def mobile_tasks():
    """移动端获取任务列表（无需JWT，用ranger_id参数）"""
    ranger_id = request.args.get('ranger_id', type=int)
    if not ranger_id:
        return jsonify([])
    tasks = PatrolTask.query.filter_by(ranger_id=ranger_id).filter(
        PatrolTask.status.in_(['待执行', '进行中'])
    ).order_by(PatrolTask.created_at.desc()).all()
    return jsonify([t.to_dict() for t in tasks])


# ========== 巡护路线 CRUD ==========

@app.route('/api/patrol/routes', methods=['GET', 'POST'])
@jwt_required()
def patrol_routes():
    if request.method == 'GET':
        routes = PatrolRoute.query.order_by(PatrolRoute.created_at.desc()).all()
        return jsonify([r.to_dict() for r in routes])
    else:
        data = request.get_json()
        route = PatrolRoute(
            name=data.get('name', ''),
            route_type=data.get('type', ''),
            length_km=data.get('lengthKm', 0),
            status=data.get('status', '启用'),
            creator=data.get('creator', ''),
            geometry_json=data.get('geometry', ''),
        )
        db.session.add(route)
        db.session.commit()
        return jsonify({'success': True, 'data': route.to_dict()})


@app.route('/api/patrol/routes/<int:id>', methods=['PUT', 'DELETE'])
@jwt_required()
def patrol_route(id):
    route = PatrolRoute.query.get_or_404(id)
    if request.method == 'PUT':
        data = request.get_json()
        for key, col in [('name', 'name'), ('status', 'status'), ('creator', 'creator')]:
            if key in data:
                setattr(route, col, data[key])
        db.session.commit()
        return jsonify({'success': True, 'data': route.to_dict()})
    else:
        db.session.delete(route)
        db.session.commit()
        return jsonify({'success': True})


# ========== 巡护日志 ==========

@app.route('/api/patrol/logs', methods=['GET', 'POST'])
@jwt_required()
def patrol_logs():
    if request.method == 'GET':
        logs = PatrolLog.query.order_by(PatrolLog.created_at.desc()).all()
        return jsonify([l.to_dict() for l in logs])
    else:
        data = request.get_json()
        log = PatrolLog(
            ranger_name=data.get('rangerName', ''),
            date=data.get('date', ''),
            area=data.get('area', ''),
            duration_min=data.get('durationMin', 0),
            distance_km=data.get('distanceKm', 0),
            findings=data.get('findings', ''),
        )
        db.session.add(log)
        db.session.commit()
        return jsonify({'success': True, 'data': log.to_dict()})


# ========== 巡护队伍 ==========

@app.route('/api/patrol/teams', methods=['GET'])
@jwt_required()
def get_patrol_teams():
    teams = PatrolTeam.query.all()
    return jsonify([t.to_dict() for t in teams])


# ========== 火情事件 ==========

@app.route('/api/fires', methods=['GET', 'POST'])
@jwt_required()
def fires():
    if request.method == 'GET':
        fires = FireEvent.query.order_by(FireEvent.reported_at.desc()).all()
        return jsonify([f.to_dict() for f in fires])
    else:
        data = request.get_json()
        fire = FireEvent(
            name=data.get('name', ''),
            lat=data.get('lat', 28.510), lng=data.get('lng', 119.910),
            risk_level=data.get('riskLevel', '中'),
            status=data.get('status', '监测中'),
            temperature_c=data.get('temperatureC', 0),
            area_mu=data.get('areaMu', 0),
            description=data.get('description', ''),
            reported_by=data.get('reportedBy', ''),
            reported_at=datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        )
        db.session.add(fire)
        broadcast_sse('fire_new', fire.to_dict())
        # 创建告警
        w = AlertWarning(type='火情', level=fire.risk_level, description=fire.name,
                         related_event_id=fire.to_dict().get('id'),
                         created_at=datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
        db.session.add(w)
        db.session.commit()
        return jsonify({'success': True, 'data': fire.to_dict()})


@app.route('/api/fires/<int:id>', methods=['GET'])
@jwt_required()
def get_fire(id):
    fire = FireEvent.query.get_or_404(id)
    return jsonify(fire.to_dict())


@app.route('/api/fires/points', methods=['GET'])
@jwt_required()
def get_fire_points():
    """所有火情点(用于地图)"""
    fires = FireEvent.query.all()
    result = {}
    for f in fires:
        result[f.to_dict().get('id')] = f.to_dict()
    return jsonify(result)


# ========== 火情/疫情 图片上传 + 派发 + 处理状态 ==========

# 图片存储目录
DISASTER_IMG_DIR = os.path.join(PROTOTYPE_DIR, 'static', 'images', 'disasters')
os.makedirs(DISASTER_IMG_DIR, exist_ok=True)


def _save_uploaded_image(file_storage):
    """保存上传的图片，返回相对URL路径"""
    if not file_storage or not file_storage.filename:
        return ''
    import uuid
    ext = os.path.splitext(file_storage.filename)[1] or '.jpg'
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(DISASTER_IMG_DIR, filename)
    file_storage.save(filepath)
    return f'/static/images/disasters/{filename}'


def _sync_disasters_to_geoserver():
    """把火情点 + 疫情点同步到 GeoServer（通过 REST API 发布 GeoJSON）
    发布两个图层：baiyunshan:fire_events / baiyunshan:pest_events
    """
    import requests as req
    base = Config.GEOSERVER_URL.rstrip('/')
    auth = (Config.GEOSERVER_USER, Config.GEOSERVER_PASSWORD)
    ws = Config.GEOSERVER_WORKSPACE
    headers_json = {'Content-Type': 'application/json'}

    # 1. 确保 workspace 存在
    try:
        r = req.get(f'{base}/rest/workspaces/{ws}.json', auth=auth, timeout=8)
        if r.status_code == 404:
            payload = {'workspace': {'name': ws}}
            req.post(f'{base}/rest/namespaces', auth=auth, json=payload, timeout=8)
    except req.RequestException as e:
        print(f'[GeoSync] workspace检查失败: {e}')

    def _publish(layer_name, features):
        """把 features (GeoJSON Feature list) 发布为 datastore 图层"""
        if not features:
            print(f'[GeoSync] {layer_name} 无数据，跳过')
            return False
        geojson = {'type': 'FeatureCollection', 'features': features}
        url = f'{base}/rest/workspaces/{ws}/datastores/{layer_name}/file/geojson'
        try:
            # PUT 方式会自动创建 datastore + feature type
            resp = req.put(url, auth=auth, headers=headers_json,
                           data=json.dumps(geojson, ensure_ascii=False).encode('utf-8'),
                           timeout=15)
            if resp.status_code in (200, 201, 202):
                print(f'[GeoSync] {layer_name} 已同步 {len(features)} 个要素')
                return True
            print(f'[GeoSync] {layer_name} 同步失败: {resp.status_code} {resp.text[:200]}')
        except req.RequestException as e:
            print(f'[GeoSync] {layer_name} 异常: {e}')
        return False

    # 火情点
    fire_features = []
    for f in FireEvent.query.all():
        d = f.to_dict()
        fire_features.append({
            'type': 'Feature',
            'geometry': {'type': 'Point', 'coordinates': [d.get('lng', 0), d.get('lat', 0)]},
            'properties': {
                'id': d.get('id'), 'name': d.get('name'),
                'riskLevel': d.get('riskLevel'), 'status': d.get('status'),
                'temperatureC': d.get('temperatureC'), 'areaMu': d.get('areaMu'),
                'reportedBy': d.get('reportedBy'), 'reportedAt': d.get('reportedAt'),
                'description': d.get('description'), 'imagePath': d.get('imagePath'),
            }
        })
    _publish('fire_events', fire_features)

    # 疫情点
    pest_features = []
    for p in PestEvent.query.all():
        d = p.to_dict()
        pest_features.append({
            'type': 'Feature',
            'geometry': {'type': 'Point', 'coordinates': [d.get('lng', 0), d.get('lat', 0)]},
            'properties': {
                'id': d.get('id'), 'name': d.get('name'),
                'diseaseType': d.get('diseaseType'), 'confidence': d.get('confidence'),
                'affectedAreaMu': d.get('affectedAreaMu'), 'status': d.get('status'),
                'reportedAt': d.get('reportedAt'), 'imagePath': d.get('imagePath'),
            }
        })
    _publish('pest_events', pest_features)
    return True


@app.route('/api/disasters/upload', methods=['POST'])
@jwt_required()
def upload_disaster():
    """上传带坐标的火情/疫情图片
    Form fields: type(fire/pest), lat, lng, name, reportedBy, description,
                 riskLevel(fire) / diseaseType(pest), temperatureC(fire), areaMu
    File: image
    """
    data = request.form
    dtype = data.get('type', 'fire')
    try:
        lat = float(data.get('lat', 28.467))
        lng = float(data.get('lng', 119.922))
    except ValueError:
        return jsonify({'success': False, 'error': '坐标格式错误'}), 400

    image_file = request.files.get('image')
    image_path = _save_uploaded_image(image_file)
    now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    if dtype == 'fire':
        event = FireEvent(
            name=data.get('name', ''),
            lat=lat, lng=lng,
            risk_level=data.get('riskLevel', '中'),
            status=data.get('status', '监测中'),
            temperature_c=float(data.get('temperatureC', 0) or 0),
            area_mu=float(data.get('areaMu', 0) or 0),
            description=data.get('description', ''),
            image_path=image_path,
            reported_by=data.get('reportedBy', ''),
            reported_at=now_str,
        )
        db.session.add(event)
        db.session.commit()
        # 同步 GeoServer
        _sync_disasters_to_geoserver()
        # 创建告警
        w = AlertWarning(type='火情', level=event.risk_level, description=event.name or '火情',
                         related_event_id=event.to_dict().get('id'), created_at=now_str)
        db.session.add(w)
        db.session.commit()
        # SSE 推送
        broadcast_sse('fire_new', event.to_dict())
        return jsonify({'success': True, 'data': event.to_dict()})
    else:
        event = PestEvent(
            name=data.get('name', ''),
            lat=lat, lng=lng,
            disease_type=data.get('diseaseType', '松材线虫病'),
            confidence=float(data.get('confidence', 0) or 0),
            affected_area_mu=float(data.get('affectedAreaMu', 0) or 0),
            status=data.get('status', '待处理'),
            description=data.get('description', ''),
            image_path=image_path,
            reported_at=now_str,
        )
        db.session.add(event)
        db.session.commit()
        _sync_disasters_to_geoserver()
        broadcast_sse('pest_new', event.to_dict())
        return jsonify({'success': True, 'data': event.to_dict()})


@app.route('/api/disasters/<string:dtype>/<int:id>/dispatch', methods=['POST'])
@jwt_required()
def dispatch_disaster(dtype, id):
    """派发处理任务：标记为已派发，可指定处理人"""
    Model = FireEvent if dtype == 'fire' else PestEvent
    event = Model.query.get_or_404(id)
    data = request.get_json() or {}
    handler = data.get('handler', '')
    if dtype == 'fire':
        event.status = '已派发'
        event.description = (event.description or '') + f' [派发处理人:{handler}]'
    else:
        event.status = '已派发'
        event.description = (event.description or '') + f' [派发处理人:{handler}]'
    db.session.commit()
    _sync_disasters_to_geoserver()
    broadcast_sse(f'{dtype}_update', event.to_dict())
    return jsonify({'success': True, 'data': event.to_dict()})


@app.route('/api/disasters/<string:dtype>/<int:id>/status', methods=['PUT'])
@jwt_required()
def update_disaster_status(dtype, id):
    """更新处理情况"""
    Model = FireEvent if dtype == 'fire' else PestEvent
    event = Model.query.get_or_404(id)
    data = request.get_json() or {}
    new_status = data.get('status')
    if new_status:
        event.status = new_status
    if 'description' in data:
        event.description = data.get('description')
    db.session.commit()
    _sync_disasters_to_geoserver()
    broadcast_sse(f'{dtype}_update', event.to_dict())
    return jsonify({'success': True, 'data': event.to_dict()})


@app.route('/api/geoserver/sync', methods=['POST'])
@jwt_required()
def manual_sync_geoserver():
    """手动触发 GeoServer 同步"""
    try:
        _sync_disasters_to_geoserver()
        return jsonify({'success': True, 'message': '已同步火情/疫情点到 GeoServer'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/static/images/disasters/<path:filename>')
def serve_disaster_image(filename):
    """灾害图片访问"""
    return send_from_directory(DISASTER_IMG_DIR, filename)


# ========== 疫情事件 ==========

@app.route('/api/pests', methods=['GET', 'POST'])
@jwt_required()
def pests():
    if request.method == 'GET':
        pests = PestEvent.query.order_by(PestEvent.reported_at.desc()).all()
        return jsonify([p.to_dict() for p in pests])
    else:
        data = request.get_json()
        pest = PestEvent(
            name=data.get('name', ''),
            lat=data.get('lat', 28.510), lng=data.get('lng', 119.910),
            disease_type=data.get('diseaseType', '松材线虫病'),
            confidence=data.get('confidence', 0),
            affected_area_mu=data.get('affectedAreaMu', 0),
            status=data.get('status', '待处理'),
            description=data.get('description', ''),
            reported_at=datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        )
        db.session.add(pest)
        broadcast_sse('pest_new', pest.to_dict())
        db.session.commit()
        return jsonify({'success': True, 'data': pest.to_dict()})


# ========== 异常事件 ==========

@app.route('/api/abnormal-events', methods=['GET', 'POST'])
@jwt_required()
def abnormal_events():
    if request.method == 'GET':
        type_filter = request.args.get('type', '')
        query = AbnormalEvent.query
        if type_filter and type_filter != 'all':
            query = query.filter_by(type=type_filter)
        events = query.order_by(AbnormalEvent.time.desc()).all()
        return jsonify([e.to_dict() for e in events])
    else:
        data = request.get_json()
        event = AbnormalEvent(
            type=data.get('type', 'fire'),
            area=data.get('area', ''),
            desc=data.get('desc', ''),
            level=data.get('level', '中'),
            time=datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            status=data.get('status', '处置中'),
            handler=data.get('handler', ''),
            source=data.get('source', data.get('reportedBy', '')),
            measure=data.get('measure', ''),
            lat=data.get('lat', 28.510), lng=data.get('lng', 119.910),
        )
        db.session.add(event)
        db.session.commit()
        # 创建告警 + SSE 广播
        broadcast_sse('abnormal_new', event.to_dict())
        w = AlertWarning(type='异常事件', level=event.level, description=event.desc[:60],
                         related_event_id=event.to_dict().get('id'),
                         created_at=datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
        db.session.add(w)
        db.session.commit()
        return jsonify({'success': True, 'data': event.to_dict()})


# ========== AI 识别影像 ==========

@app.route('/api/recognition/fire', methods=['GET'])
@jwt_required()
def get_fire_recognition():
    """火情AI识别影像"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 6, type=int)
    source = request.args.get('source', 'all')
    status = request.args.get('status', 'all')

    query = AiImage.query.filter_by(detection_type='fire')
    if source != 'all':
        query = query.filter_by(source_type=source)
    if status != 'all':
        query = query.filter_by(status=status)
    total = query.count()
    images = query.order_by(AiImage.created_at.desc()).offset(
        (page-1)*per_page).limit(per_page).all()
    return jsonify({
        'images': [img.to_dict() for img in images],
        'total': total,
        'page': page,
        'perPage': per_page,
    })


@app.route('/api/recognition/pest', methods=['GET'])
@jwt_required()
def get_pest_recognition():
    """疫情AI识别影像"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 6, type=int)
    source = request.args.get('source', 'all')
    status = request.args.get('status', 'all')

    query = AiImage.query.filter_by(detection_type='pest')
    if source != 'all':
        query = query.filter_by(source_type=source)
    if status != 'all':
        query = query.filter_by(status=status)
    total = query.count()
    images = query.order_by(AiImage.created_at.desc()).offset(
        (page-1)*per_page).limit(per_page).all()
    return jsonify({
        'images': [img.to_dict() for img in images],
        'total': total,
        'page': page,
        'perPage': per_page,
    })


# ========== 空间分析 ==========

@app.route('/api/spatial/fvc', methods=['GET'])
@jwt_required()
def get_fvc_analysis():
    """FVC植被覆盖度分析结果"""
    return jsonify({
        'areas': [
            {'name': '一号林区', 'fvc': 0.72, 'level': '中高覆盖', 'areaHigh': 1850, 'areaMid': 920, 'areaLow': 380, 'areaBare': 150, 'trend': '稳定'},
            {'name': '二号林区', 'fvc': 0.58, 'level': '中覆盖', 'areaHigh': 1120, 'areaMid': 860, 'areaLow': 520, 'areaBare': 200, 'trend': '下降'},
            {'name': '三号林区', 'fvc': 0.81, 'level': '高覆盖', 'areaHigh': 2100, 'areaMid': 680, 'areaLow': 180, 'areaBare': 40, 'trend': '上升'},
            {'name': '四号林区', 'fvc': 0.43, 'level': '低覆盖', 'areaHigh': 680, 'areaMid': 540, 'areaLow': 860, 'areaBare': 120, 'trend': '下降'},
            {'name': '五号林区', 'fvc': 0.65, 'level': '中高覆盖', 'areaHigh': 1070, 'areaMid': 450, 'areaLow': 290, 'areaBare': 50, 'trend': '稳定'},
        ],
        'degradedAreas': [],
    })


@app.route('/api/spatial/fvc/analyze', methods=['POST'])
@jwt_required()
def run_fvc_analysis():
    """执行 FVC 分析 — 从 GeoServer WCS 下载栅格计算真实统计值"""
    data = request.get_json() or {}
    year = data.get('year', '2021')
    compartment = data.get('compartment', '全部林区')

    # 年份 → WCS coverage ID 映射及偏差值
    # GeoServer 上暂无 2022 FVC WCS coverage，通过对 2021 数据施加偏移模拟年份差异
    year_config = {
        '2021': {'coverage': 'baiyunshan__fvc-2', 'bias': 0.0},
        '2022': {'coverage': 'baiyunshan__fvc-2', 'bias': 0.04},  # +4% 改善
    }
    cfg = year_config.get(year)
    if not cfg:
        return jsonify({'success': False, 'message': f'不支持的年份: {year}'}), 400

    # FVC 分级阈值 — 支持用户自定义
    custom = data.get('thresholds', {})
    high_th = float(custom.get('high', 0.75))
    mid_th  = float(custom.get('mid', 0.45))
    low_th  = float(custom.get('low', 0.15))
    thresholds = [
        ('high', high_th, None),
        ('mid_high', (high_th + mid_th) / 2, high_th),
        ('mid', mid_th, (high_th + mid_th) / 2),
        ('low', low_th, mid_th),
        ('bare', -999.0, low_th),
    ]

    # 解析林区裁剪几何
    clip_geom = None
    if compartment and compartment != '全部林区':
        from compartment_bounds import COMPARTMENT_POLYGONS
        clip_geom = COMPARTMENT_POLYGONS.get(compartment)
        if clip_geom is None:
            return jsonify({'success': False, 'message': f'未知林区: {compartment}'}), 400

    try:
        stats = _compute_raster_stats(cfg['coverage'], thresholds, pixel_bias=cfg['bias'], clip_geom=clip_geom)

        # 组装各林区数据
        if clip_geom is not None:
            # 仅返回选中林区
            areas = [_make_single_area_fvc(stats['mean'], compartment, high_th, mid_th, low_th)]
        else:
            areas = _generate_per_area_fvc(stats['mean'], high_th, mid_th, low_th)

        return jsonify({
            'success': True,
            'data': {
                'year': year,
                'compartment': compartment,
                'avgFvc': stats['mean'],
                'minFvc': stats['min'],
                'maxFvc': stats['max'],
                'totalAreaMu': stats['total_area_mu'],
                'highArea': stats['classes'][0]['area_mu'],
                'midHighArea': stats['classes'][1]['area_mu'],
                'midArea': stats['classes'][2]['area_mu'],
                'lowArea': stats['classes'][3]['area_mu'],
                'bareArea': stats['classes'][4]['area_mu'],
                'degradedCount': max(1, int(stats['classes'][3]['count'] / 800)),
                'areas': areas,
                'thresholds': {'high': high_th, 'mid': mid_th, 'low': low_th},
                'source': 'GeoServer WCS 实时计算' if year == '2021' else 'GeoServer WCS 实时计算(年际变化模拟)',
            }
        })
    except Exception as e:
        year_data = {
            '2021': {'avg': 0.69, 'high': 6461, 'mid': 2966, 'low': 1311, 'bare': 643},
            '2022': {'avg': 0.73, 'high': 7820, 'mid': 2550, 'low': 980, 'bare': 510},
        }
        yd = year_data.get(year, year_data['2021'])
        fallback_areas = [_make_single_area_fvc(yd['avg'], compartment, high_th, mid_th, low_th)] if clip_geom is not None else _generate_per_area_fvc(yd['avg'], high_th, mid_th, low_th)
        return jsonify({
            'success': True,
            'data': {
                'year': year,
                'compartment': compartment,
                'avgFvc': yd['avg'],
                'totalAreaMu': 12060,
                'highArea': yd['high'],
                'midArea': yd['mid'],
                'lowArea': yd['low'],
                'bareArea': yd['bare'],
                'degradedCount': 4 if year == '2022' else 2,
                'areas': fallback_areas,
                'thresholds': {'high': high_th, 'mid': mid_th, 'low': low_th},
                'source': f'离线估算 (WCS错误: {str(e)[:100]})',
            }
        })


def _generate_per_area_fvc(avg_fvc, high_th=0.75, mid_th=0.45, low_th=0.15):
    """根据整体 FVC 均值生成 5 个林区的合理估算值"""
    import random
    area_names = ['一号林区', '二号林区', '三号林区', '四号林区', '五号林区']
    base = avg_fvc
    variations = [0.06, -0.10, 0.13, -0.15, -0.02]
    mid_high_th = (high_th + mid_th) / 2
    levels = []
    for i, name in enumerate(area_names):
        val = round(max(0.03, min(0.98, base + variations[i] + random.uniform(-0.03, 0.03))), 2)
        if val >= high_th:
            level = '高覆盖'
        elif val >= mid_high_th:
            level = '中高覆盖'
        elif val >= mid_th:
            level = '中覆盖'
        elif val >= low_th:
            level = '低覆盖'
        else:
            level = '裸地'
        levels.append({'name': name, 'fvc': val, 'level': level})
    return levels


def _make_single_area_fvc(avg_fvc, area_name, high_th=0.75, mid_th=0.45, low_th=0.15):
    """为单个林区生成FVC条目"""
    mid_high_th = (high_th + mid_th) / 2
    val = round(avg_fvc, 2)
    if val >= high_th:
        level = '高覆盖'
    elif val >= mid_high_th:
        level = '中高覆盖'
    elif val >= mid_th:
        level = '中覆盖'
    elif val >= low_th:
        level = '低覆盖'
    else:
        level = '裸地'
    return {'name': area_name, 'fvc': val, 'level': level}


def _make_single_area_ndvi(avg_ndvi, area_name, high_th=0.70, mid_th=0.40, low_th=0.15):
    """为单个林区生成NDVI条目"""
    mid_high_th = (high_th + mid_th) / 2
    val = round(avg_ndvi, 2)
    if val >= high_th:
        level = '高植被'
    elif val >= mid_high_th:
        level = '中高植被'
    elif val >= mid_th:
        level = '中植被'
    elif val >= low_th:
        level = '低植被'
    else:
        level = '裸地'
    return {'name': area_name, 'ndvi': val, 'level': level}


# ========== WCS 栅格统计辅助函数 ==========

def _compute_raster_stats(coverage_id, thresholds, pixel_area_mu=0.015, pixel_bias=0.0, clip_geom=None):
    """
    从 GeoServer WCS 下载 GeoTIFF，使用 Pillow+numpy 计算真实统计值。
    支持通过 clip_geom (shapely Polygon/MultiPolygon, EPSG:4326) 裁剪到指定区域。

    参数:
        coverage_id: GeoServer WCS coverage ID (如 'baiyunshan__NDVI-1')
        thresholds: [(label, low, high), ...] 分级阈值列表
        pixel_area_mu: 每像素面积(亩)，10m分辨率≈0.015亩
        pixel_bias: 对有效像素值施加的偏移量（用于年份差异模拟）
        clip_geom: shapely Polygon/MultiPolygon，裁剪到此几何范围
    返回:
        {mean, min, max, total_valid_pixels, total_area_mu, classes: [...]}
    """
    import requests as req
    from PIL import Image
    import numpy as np
    from io import BytesIO

    url = f'{Config.GEOSERVER_URL}/baiyunshan/wcs'
    params = {
        'service': 'WCS',
        'version': '2.0.1',
        'request': 'GetCoverage',
        'coverageId': coverage_id,
        'format': 'image/tiff',
    }

    resp = req.get(url, params=params,
                   auth=(Config.GEOSERVER_USER, Config.GEOSERVER_PASSWORD),
                   timeout=90)
    if resp.status_code != 200:
        raise Exception(f'WCS 请求失败: HTTP {resp.status_code}')

    # 如果有裁剪几何，使用 rasterio 进行精确多边形裁剪
    if clip_geom is not None:
        import rasterio
        import rasterio.mask
        import tempfile, os

        # 写入临时文件
        tmp = tempfile.NamedTemporaryFile(suffix='.tif', delete=False)
        try:
            tmp.write(resp.content)
            tmp.close()

            with rasterio.open(tmp.name) as src:
                # clip_geom 需要与栅格坐标系一致 (EPSG:4326)
                out_image, out_transform = rasterio.mask.mask(
                    src, [clip_geom], crop=True, nodata=-9999
                )
                out_image = out_image[0]  # 第一个波段
                arr = out_image.astype(np.float64)
                # 将 nodata 和无效值设为 nan
                arr[arr <= -999.0] = np.nan
                valid_mask = ~np.isnan(arr) & (arr > -999.0)
                valid_arr = arr[valid_mask]
                total_valid = int(valid_mask.sum())
        finally:
            os.unlink(tmp.name)
    else:
        img = Image.open(BytesIO(resp.content))
        arr = np.array(img)

        valid_mask = arr > -999.0
        valid_arr = arr[valid_mask].astype(np.float64)
        total_valid = int(valid_mask.sum())

    if total_valid == 0:
        raise Exception('栅格中无有效像素')

    # 施加像素偏移（用于年份差异模拟）
    if pixel_bias != 0.0:
        valid_arr = np.clip(valid_arr + pixel_bias, 0.0, 1.0)

    mean_val = float(valid_arr.mean())
    min_val = float(valid_arr.min())
    max_val = float(valid_arr.max())

    # 按阈值分级
    classes = []
    for label, lo, hi in thresholds:
        if hi is None:
            cnt = int((valid_arr >= lo).sum())
        else:
            cnt = int(((valid_arr >= lo) & (valid_arr < hi)).sum())
        classes.append({
            'label': label,
            'count': cnt,
            'area_mu': round(cnt * pixel_area_mu),
            'pct': round(100.0 * cnt / total_valid, 1) if total_valid > 0 else 0,
        })

    return {
        'mean': round(mean_val, 4),
        'min': round(min_val, 4),
        'max': round(max_val, 4),
        'total_valid_pixels': total_valid,
        'total_area_mu': round(total_valid * pixel_area_mu),
        'classes': classes,
    }


# ========== NDVI 分析端点 ==========

@app.route('/api/spatial/ndvi/analyze', methods=['POST'])
@jwt_required()
def run_ndvi_analysis():
    """执行 NDVI 分析 — 从 GeoServer WCS 下载栅格计算真实统计值"""
    data = request.get_json() or {}
    year = data.get('year', '2021')
    compartment = data.get('compartment', '全部林区')

    # 年份 → WCS coverage ID 映射
    # NDVI-1(mean=0.378)为淡季影像，NDVI-2(mean=0.835)和NDVI(mean=0.743)为旺季
    coverage_map = {
        '2021': 'baiyunshan__NDVI-2',   # 旺季影像，均值0.835
        '2022': 'baiyunshan__NDVI',     # 旺季影像，均值0.743
    }
    coverage_id = coverage_map.get(year)
    if not coverage_id:
        return jsonify({'success': False, 'message': f'不支持的年份: {year}'}), 400

    # NDVI 分级阈值 — 支持用户自定义，默认值如UI所示
    custom = data.get('thresholds', {})
    high_th = float(custom.get('high', 0.70))
    mid_th  = float(custom.get('mid', 0.40))
    low_th  = float(custom.get('low', 0.15))
    thresholds = [
        ('high', high_th, None),
        ('mid_high', (high_th + mid_th) / 2, high_th),
        ('mid', mid_th, (high_th + mid_th) / 2),
        ('low', low_th, mid_th),
        ('bare', -999.0, low_th),
    ]

    # 解析林区裁剪几何
    clip_geom = None
    if compartment and compartment != '全部林区':
        from compartment_bounds import COMPARTMENT_POLYGONS
        clip_geom = COMPARTMENT_POLYGONS.get(compartment)
        if clip_geom is None:
            return jsonify({'success': False, 'message': f'未知林区: {compartment}'}), 400

    try:
        stats = _compute_raster_stats(coverage_id, thresholds, clip_geom=clip_geom)

        # 组装各林区数据（基于整体统计 + 合理方差）
        if clip_geom is not None:
            areas = [_make_single_area_ndvi(stats['mean'], compartment, high_th, mid_th, low_th)]
        else:
            areas = _generate_per_area_ndvi(stats['mean'], high_th, mid_th, low_th)

        return jsonify({
            'success': True,
            'data': {
                'year': year,
                'compartment': compartment,
                'avgNdvi': stats['mean'],
                'minNdvi': stats['min'],
                'maxNdvi': stats['max'],
                'totalAreaMu': stats['total_area_mu'],
                'highArea': stats['classes'][0]['area_mu'],
                'midHighArea': stats['classes'][1]['area_mu'],
                'midArea': stats['classes'][2]['area_mu'],
                'lowArea': stats['classes'][3]['area_mu'],
                'bareArea': stats['classes'][4]['area_mu'],
                'degradedCount': max(1, int(stats['classes'][3]['count'] / 1000)),
                'areas': areas,
                'thresholds': {'high': high_th, 'mid': mid_th, 'low': low_th},
                'source': 'GeoServer WCS 实时计算',
            }
        })
    except Exception as e:
        # WCS 失败时回退到合理的估算值
        year_data = {
            '2021': {'avg': 0.72, 'high': 7520, 'mid': 3080, 'low': 1250, 'bare': 410},
            '2022': {'avg': 0.75, 'high': 8100, 'mid': 2850, 'low': 1080, 'bare': 330},
        }
        yd = year_data.get(year, year_data['2021'])
        fallback_areas = [_make_single_area_ndvi(yd['avg'], compartment, high_th, mid_th, low_th)] if clip_geom is not None else _generate_per_area_ndvi(yd['avg'], high_th, mid_th, low_th)
        return jsonify({
            'success': True,
            'data': {
                'year': year,
                'compartment': compartment,
                'avgNdvi': yd['avg'],
                'totalAreaMu': 12060,
                'highArea': yd['high'],
                'midArea': yd['mid'],
                'lowArea': yd['low'],
                'bareArea': yd['bare'],
                'degradedCount': 2 if year == '2022' else 3,
                'areas': fallback_areas,
                'thresholds': {'high': high_th, 'mid': mid_th, 'low': low_th},
                'source': f'离线估算 (WCS错误: {str(e)[:100]})',
            }
        })


def _generate_per_area_ndvi(avg_ndvi, high_th=0.70, mid_th=0.40, low_th=0.15):
    """根据整体 NDVI 均值生成 5 个林区的合理估算值"""
    import random
    area_names = ['一号林区', '二号林区', '三号林区', '四号林区', '五号林区']
    base = avg_ndvi
    variations = [0.07, -0.10, 0.12, -0.12, -0.02]  # 各林区偏离均值的量
    mid_high_th = (high_th + mid_th) / 2
    levels = []
    for i, name in enumerate(area_names):
        val = round(max(0.05, min(0.98, base + variations[i] + random.uniform(-0.03, 0.03))), 2)
        if val >= high_th:
            level = '高植被'
        elif val >= mid_high_th:
            level = '中高植被'
        elif val >= mid_th:
            level = '中植被'
        elif val >= low_th:
            level = '低植被'
        else:
            level = '裸地'
        levels.append({'name': name, 'ndvi': val, 'level': level})
    return levels


@app.route('/api/analysis/coverage', methods=['POST'])
@jwt_required()
def run_coverage_analysis():
    """巡护覆盖分析 — 基于真实轨迹数据的缓冲区分析"""
    data = request.get_json() or {}
    period = data.get('period', 'today')  # today / 7days / 30days

    now = datetime.datetime.now(datetime.timezone.utc)
    if period == 'today':
        start_time = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == '30days':
        start_time = now - datetime.timedelta(days=30)
    else:  # 7days
        start_time = now - datetime.timedelta(days=7)

    # 查询时间段内的所有轨迹点
    ranger_tracks = RangerTrack.query.filter(
        RangerTrack.timestamp >= start_time
    ).all()
    drone_tracks = DroneTrack.query.filter(
        DroneTrack.timestamp >= start_time
    ).all()

    all_points = []
    for t in ranger_tracks:
        all_points.append((t.lng, t.lat))
    for t in drone_tracks:
        all_points.append((t.lng, t.lat))

    if len(all_points) < 3:
        return jsonify({
            'success': True,
            'data': {
                'coverageRate': 0, 'coveredArea': 0, 'totalArea': 12060,
                'blindArea': 12060, 'completeness': '数据不足',
                'blindAreas': [],
                'trackPoints': len(all_points),
                'period': period,
            }
        })

    try:
        from shapely.geometry import Point, Polygon, box
        from shapely.ops import unary_union
        import math

        # 为每个轨迹点创建缓冲区（护林员约500m视线范围，无人机约1km）
        buffers = []
        for lng, lat in all_points:
            # 近似：经度1度≈111km*cos(lat)，纬度1度≈111km
            lat_rad = math.radians(lat)
            buffer_deg_lng = 0.005 / math.cos(lat_rad)  # ~500m
            buffer_deg_lat = 0.005  # ~500m
            p = Point(lng, lat)
            # Shapely buffer 单位是度，直接用近似椭圆
            buffers.append(p.buffer(max(buffer_deg_lng, buffer_deg_lat)))

        # 合并所有缓冲区
        covered_union = unary_union(buffers)

        # 白云山林场边界框（近似多边形）
        forest_bounds = box(119.854, 28.480, 119.966, 28.581)
        # 实际覆盖 = 缓冲区 ∩ 林场范围
        effective_coverage = covered_union.intersection(forest_bounds)

        # 计算面积（近似：1平方度 ≈ 12321 km²，实际按纬度调整）
        total_area_deg = (119.966 - 119.854) * (28.581 - 28.480)  # 度²
        covered_area_deg = effective_coverage.area
        coverage_rate = min(100, round(covered_area_deg / total_area_deg * 100, 1))

        # 转换为亩（1 km² = 1500亩，1度² ≈ 12321 km²）
        total_area_mu = round(total_area_deg * 12321 * 1500 / 10000, 0)  # 度² → 公顷 → 亩
        covered_area_mu = round(covered_area_deg * 12321 * 1500 / 10000, 0)
        blind_area_mu = round(total_area_mu - covered_area_mu, 0)

        # 盲区分析
        blind_areas = []
        if blind_area_mu > 0:
            blind_polygons = forest_bounds.difference(effective_coverage)
            if hasattr(blind_polygons, 'geoms'):
                for i, geom in enumerate(list(blind_polygons.geoms)[:5]):
                    area = round(geom.area * 12321 * 1500 / 10000, 0)
                    centroid = geom.centroid
                    blind_areas.append({
                        'id': f'BA{i+1:02d}',
                        'name': f'盲区{i+1}',
                        'area': area,
                        'lat': round(centroid.y, 5),
                        'lng': round(centroid.x, 5),
                        'tag': '未覆盖' if area > 500 else '覆盖不足',
                    })
            elif not blind_polygons.is_empty:
                area = round(blind_polygons.area * 12321 * 1500 / 10000, 0)
                blind_areas.append({
                    'id': 'BA01', 'name': '未覆盖区域', 'area': area,
                    'lat': 28.530, 'lng': 119.910, 'tag': '未覆盖',
                })

        # 完整度评价
        if coverage_rate >= 80:
            completeness = '优秀'
        elif coverage_rate >= 60:
            completeness = '良好'
        elif coverage_rate >= 40:
            completeness = '一般'
        else:
            completeness = '较差'

        return jsonify({
            'success': True,
            'data': {
                'coverageRate': coverage_rate,
                'coveredArea': covered_area_mu,
                'totalArea': total_area_mu,
                'blindArea': blind_area_mu,
                'completeness': completeness,
                'blindAreas': blind_areas,
                'trackPoints': len(all_points),
                'period': period,
            }
        })

    except ImportError:
        # Shapely不可用时返回模拟数据
        import random
        return jsonify({
            'success': True,
            'data': {
                'coverageRate': round(random.uniform(65, 85), 1),
                'coveredArea': round(random.uniform(8000, 10000), 0),
                'totalArea': 12060,
                'blindArea': round(random.uniform(2000, 4000), 0),
                'completeness': '良好',
                'blindAreas': [
                    {'id': 'BA01', 'name': '东南角未覆盖区', 'area': 850, 'tag': '未覆盖', 'lat': 28.490, 'lng': 119.950},
                    {'id': 'BA02', 'name': '西北边缘区', 'area': 920, 'tag': '未覆盖', 'lat': 28.570, 'lng': 119.870},
                ],
                'trackPoints': len(all_points),
                'period': period,
            }
        })


# ========== 风险预警 ==========

@app.route('/api/risk/assessment', methods=['GET', 'POST'])
@jwt_required()
def risk_assessment():
    """综合风险评估"""
    if request.method == 'GET':
        return jsonify({
            'summary': {'total': 15, 'high': 3, 'mid': 5, 'low': 7},
            'items': [
                {'id': 'RA001', 'area': '一号林区', 'type': '森林火灾', 'level': 'high', 'score': 87.5, 'desc': '近期高温干燥，火险等级极高', 'time': '2026-06-10 08:00', 'status': '预警中'},
                {'id': 'RA002', 'area': '三号林区', 'type': '松材线虫病', 'level': 'high', 'score': 82.3, 'desc': '病虫害扩散趋势明显', 'time': '2026-06-10 08:00', 'status': '预警中'},
                {'id': 'RA003', 'area': '二号林区', 'type': '森林火灾', 'level': 'high', 'score': 79.1, 'desc': '连续高温预警，火险等级较高', 'time': '2026-06-10 08:00', 'status': '预警中'},
                {'id': 'RA004', 'area': '四号林区', 'type': '地质灾害', 'level': 'mid', 'score': 65.4, 'desc': '近期降雨较多，山体滑坡风险', 'time': '2026-06-10 08:00', 'status': '监控中'},
                {'id': 'RA005', 'area': '五号林区', 'type': '松材线虫病', 'level': 'mid', 'score': 58.7, 'desc': '发现疑似感染树木', 'time': '2026-06-10 08:00', 'status': '监控中'},
            ]
        })
    else:
        data = request.get_json()
        # 模拟执行风险评估
        time.sleep(1.2)
        return jsonify({'success': True, 'message': '风险评估已完成'})


# ========== 统计报表 ==========

@app.route('/api/stats/patrol', methods=['GET'])
@jwt_required()
def get_patrol_stats():
    """巡护统计"""
    return jsonify({
        'totalPatrols': 24, 'totalDistance': 136.8, 'totalDuration': 48.5,
        'dailyTrend': [18, 22, 20, 24, 26, 23, 24],
        'weeklyTrend': [120, 135, 128, 142, 136, 130, 138],
        'areaDistribution': [
            {'area': '一号林区', 'count': 6, 'distance': 38.2},
            {'area': '二号林区', 'count': 5, 'distance': 32.5},
            {'area': '三号林区', 'count': 5, 'distance': 28.1},
            {'area': '四号林区', 'count': 4, 'distance': 22.0},
            {'area': '五号林区', 'count': 4, 'distance': 16.0},
        ]
    })


@app.route('/api/stats/performance', methods=['GET'])
@jwt_required()
def get_performance_ranking():
    """人员绩效排行"""
    return jsonify([
        {'rank': 1, 'name': '张建国', 'id': 'HL001', 'patrols': 28, 'distance': 86.5, 'duration': 32.4, 'score': 95.2, 'area': '一号林区'},
        {'rank': 2, 'name': '刘德才', 'id': 'HL005', 'patrols': 25, 'distance': 78.3, 'duration': 29.8, 'score': 91.7, 'area': '三号林区'},
        {'rank': 3, 'name': '李明辉', 'id': 'HL002', 'patrols': 23, 'distance': 72.1, 'duration': 27.5, 'score': 88.4, 'area': '一号林区'},
        {'rank': 4, 'name': '王大山', 'id': 'HL003', 'patrols': 21, 'distance': 65.8, 'duration': 25.2, 'score': 84.1, 'area': '二号林区'},
        {'rank': 5, 'name': '陈志强', 'id': 'HL004', 'patrols': 18, 'distance': 52.4, 'duration': 20.6, 'score': 76.3, 'area': '二号林区'},
    ])


@app.route('/api/stats/drones', methods=['GET'])
@jwt_required()
def get_drone_stats():
    """无人机统计"""
    return jsonify({
        'totalFlights': 42, 'totalDuration': 126.5, 'totalDistance': 892.3,
        'fleet': [
            {'name': 'UAV-01', 'model': '大疆M300', 'flights': 16, 'duration': 48.2, 'distance': 342.1, 'status': '巡航中'},
            {'name': 'UAV-02', 'model': '大疆M300', 'flights': 14, 'duration': 42.5, 'distance': 298.7, 'status': '巡航中'},
            {'name': 'UAV-03', 'model': '大疆M350', 'flights': 12, 'duration': 35.8, 'distance': 251.5, 'status': '巡航中'},
        ]
    })


@app.route('/api/stats/disaster', methods=['GET'])
@jwt_required()
def get_disaster_stats():
    """灾害统计"""
    return jsonify({
        'fireCount': 3, 'pestCount': 7, 'geoCount': 2, 'totalAffected': 128.5,
        'monthlyTrend': [2, 1, 3, 2, 4, 3, 3, 5, 2, 1, 2, 3],
        'typeDistribution': [
            {'type': '森林火灾', 'count': 3, 'affected': 86},
            {'type': '松材线虫病', 'count': 7, 'affected': 32.5},
            {'type': '地质灾害', 'count': 2, 'affected': 10},
        ]
    })


@app.route('/api/stats/export', methods=['POST'])
@jwt_required()
def export_report():
    """报表导出"""
    data = request.get_json()
    return jsonify({'success': True, 'message': f'{data.get("type")}.{data.get("format")} 导出成功'})


# ========== 用户管理 ==========

@app.route('/api/users', methods=['GET', 'POST'])
@jwt_required()
def users():
    if request.method == 'GET':
        users = User.query.all()
        return jsonify([u.to_dict() for u in users])
    else:
        data = request.get_json()
        if User.query.filter_by(username=data.get('username')).first():
            return jsonify({'success': False, 'error': '用户名已存在'}), 400
        user = User(
            username=data.get('username'),
            password_hash=generate_password_hash(data.get('password', '123456')),
            name=data.get('name', ''), role=data.get('role', 'ranger'),
        )
        db.session.add(user)
        db.session.commit()
        return jsonify({'success': True, 'id': user.to_dict()['id']})


@app.route('/api/users/<int:id>', methods=['PUT', 'DELETE'])
@jwt_required()
def user_manage(id):
    user = User.query.get_or_404(id)
    if request.method == 'PUT':
        data = request.get_json()
        if 'name' in data: user.name = data['name']
        if 'role' in data: user.role = data['role']
        if 'password' in data: user.password_hash = generate_password_hash(data['password'])
        db.session.commit()
        return jsonify({'success': True})
    else:
        db.session.delete(user)
        db.session.commit()
        return jsonify({'success': True})


# ========== 角色管理 ==========

@app.route('/api/roles', methods=['GET', 'POST'])
@jwt_required()
def roles():
    if request.method == 'GET':
        roles = Role.query.all()
        return jsonify([r.to_dict() for r in roles])
    else:
        data = request.get_json()
        role = Role(name=data.get('name'), label=data.get('label', ''), desc=data.get('desc', ''))
        db.session.add(role)
        db.session.commit()
        return jsonify({'success': True, 'id': role.to_dict()['id']})


@app.route('/api/roles/<int:id>', methods=['PUT', 'DELETE'])
@jwt_required()
def role_manage(id):
    role = Role.query.get_or_404(id)
    if request.method == 'PUT':
        data = request.get_json()
        if 'label' in data: role.label = data['label']
        if 'desc' in data: role.desc = data['desc']
        db.session.commit()
        return jsonify({'success': True})
    else:
        db.session.delete(role)
        db.session.commit()
        return jsonify({'success': True})


# ========== 权限管理 ==========

@app.route('/api/permissions', methods=['GET'])
@jwt_required()
def get_permissions():
    perms = Permission.query.all()
    return jsonify([p.to_dict() for p in perms])


@app.route('/api/permissions/<int:id>', methods=['PUT'])
@jwt_required()
def update_permission(id):
    perm = Permission.query.get_or_404(id)
    data = request.get_json()
    if 'admin' in data: perm.admin = data['admin']
    if 'ranger' in data: perm.ranger = data['ranger']
    if 'guest' in data: perm.guest = data['guest']
    db.session.commit()
    return jsonify({'success': True})


# ========== 数据运维 ==========

@app.route('/api/system/data-ops', methods=['GET'])
@jwt_required()
def get_data_ops():
    return jsonify({
        'lastBackup': '2026-07-02 03:00',
        'backupSize': '2.3 GB',
        'dbStatus': '正常',
        'storageUsed': '68.5%',
        'recentOps': [
            {'time': '2026-07-02 03:00', 'type': '自动备份', 'status': '成功', 'size': '2.3 GB'},
            {'time': '2026-07-01 03:00', 'type': '自动备份', 'status': '成功', 'size': '2.2 GB'},
            {'time': '2026-06-30 15:30', 'type': '数据导入', 'status': '成功', 'size': '156 MB'},
        ]
    })


@app.route('/api/system/backup', methods=['POST'])
@jwt_required()
def backup_data():
    return jsonify({'success': True, 'id': f'BK{int(time.time())}'})


@app.route('/api/system/import', methods=['POST'])
@jwt_required()
def import_data():
    return jsonify({'success': True, 'id': f'IMP{int(time.time())}'})


# ========== 系统日志 ==========

@app.route('/api/system/logs', methods=['GET'])
@jwt_required()
def get_system_logs():
    logs = SystemLog.query.order_by(SystemLog.time.desc()).limit(50).all()
    return jsonify([l.to_dict() for l in logs])


# ========== 系统监控 ==========

@app.route('/api/system/monitor', methods=['GET'])
@jwt_required()
def get_system_monitor():
    """系统监控 - 使用psutil获取真实数据"""
    try:
        import psutil
        cpu = psutil.cpu_percent(interval=0.5)
        mem = psutil.virtual_memory().percent
        disk = psutil.disk_usage('/').percent
        uptime_seconds = time.time() - psutil.boot_time()
        uptime_str = f'{int(uptime_seconds // 86400)}天 {int(uptime_seconds % 86400 // 3600)}小时'
    except ImportError:
        cpu, mem, disk, uptime_str = 32.5, 58.2, 68.5, '15天 8小时'

    return jsonify({
        'cpu': cpu, 'memory': mem, 'disk': disk, 'network': 12.8,
        'uptime': uptime_str,
        'services': [
            {'name': 'Web服务', 'status': '运行中', 'port': 5000, 'cpu': 8.2, 'memory': 12.5},
            {'name': '数据库', 'status': '运行中', 'port': 0, 'cpu': 15.3, 'memory': 25.8},
            {'name': '消息队列', 'status': '运行中', 'port': 0, 'cpu': 3.9, 'memory': 9.7},
        ]
    })


# ========== 坐标同步 ==========

@app.route('/api/positions/sync', methods=['POST'])
def sync_positions():
    """前端 ExperimentalLayerManager 生成的坐标同步到后端数据库"""
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'empty body'}), 400

    updated_rid = 0
    updated_did = 0

    # 护林员位置同步
    for item in data.get('rangers', []):
        r = Ranger.query.filter_by(name=item.get('name')).first()
        if r:
            r.lat = item.get('lat', r.lat)
            r.lng = item.get('lng', r.lng)
            r.lat = round(r.lat, 6)
            r.lng = round(r.lng, 6)
            updated_rid += 1

    # 无人机位置同步
    for item in data.get('drones', []):
        d = Drone.query.filter_by(code=item.get('code')).first()
        if d:
            d.lat = item.get('lat', d.lat)
            d.lng = item.get('lng', d.lng)
            d.lat = round(d.lat, 6)
            d.lng = round(d.lng, 6)
            updated_did += 1

    db.session.commit()
    print(f'[Sync] 护林员 {updated_rid} / 无人机 {updated_did} 位置已同步')
    return jsonify({'success': True, 'rangers': updated_rid, 'drones': updated_did})


# ========== GeoServer 代理 ==========

@app.route('/api/geoserver/<path:subpath>', methods=['GET'])
@jwt_required()
def geoserver_proxy(subpath):
    """代理 GeoServer WMS/WFS 请求，解决跨域问题"""
    import requests as req
    target = f'{Config.GEOSERVER_URL}/{subpath}'
    params = dict(request.args)
    try:
        resp = req.get(target, params=params, auth=(Config.GEOSERVER_USER, Config.GEOSERVER_PASSWORD), timeout=15)
        return Response(resp.content, status=resp.status_code, content_type=resp.headers.get('Content-Type', 'image/png'))
    except req.RequestException as e:
        return jsonify({'error': str(e)}), 502


# ========== SSE 实时推送 ==========

@app.route('/api/patrol/stream', methods=['GET'])
def sse_stream():
    """SSE端点：推送巡护力量实时位置
    支持URL参数token认证（因为EventSource不支持自定义header）
    """
    # URL参数方式传递token
    token = request.args.get('token', '')
    if token:
        try:
            from flask_jwt_extended import decode_token
            decode_token(token)
        except Exception:
            return jsonify({'error': '无效的token'}), 401

    q = queue.Queue(maxsize=100)
    sse_queues.append(q)

    def generate():
        try:
            # 发送初始连接确认
            yield f'data: {json.dumps({"type": "connected", "data": {"message": "SSE连接已建立"}}, ensure_ascii=False)}\n\n'
            while True:
                try:
                    msg = q.get(timeout=30)
                    yield f'data: {msg}\n\n'
                except queue.Empty:
                    # 心跳保活
                    yield f'data: {json.dumps({"type": "heartbeat", "data": {}}, ensure_ascii=False)}\n\n'
        except GeneratorExit:
            if q in sse_queues:
                sse_queues.remove(q)

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
            'Access-Control-Allow-Origin': '*',
        }
    )


# ========== 健康检查 ==========

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'time': datetime.datetime.now().isoformat()})


# ========== 轨迹模拟器（后台线程） ==========

_track_sim_running = False

# 导入新轨迹引擎
try:
    from track_engine import (
        RangerTrackGenerator, DroneTrackGenerator,
        RANGER_CONFIG, DRONE_CONFIG, distance_m, bearing_deg
    )
    TRACK_ENGINE_AVAILABLE = True
    print('[TrackSim] 真实轨迹引擎已加载')
except ImportError:
    TRACK_ENGINE_AVAILABLE = False
    print('[TrackSim] WARNING 轨迹引擎加载失败')

# 每个实体的轨迹生成器
_ranger_generators = {}   # {ranger_id: RangerTrackGenerator}
_drone_generators = {}    # {drone_id: DroneTrackGenerator}


def _get_patrol_route_for_area(area_name):
    """根据林区名称获取对应的巡护路线"""
    if not PATROL_ROUTES:
        return None
    if area_name in PATROL_ROUTES:
        return PATROL_ROUTES[area_name]
    for key in PATROL_ROUTES:
        if key in area_name or area_name in key:
            return PATROL_ROUTES[key]
    return None


def _get_boundary_for_ranger(name, area):
    """根据护林员姓名获取对应的林区SHP边界多边形"""
    if not COMPARTMENT_POLYGONS or not RANGER_MAP:
        return None
    # 1. 按姓名精确匹配
    if name in RANGER_MAP:
        comp = RANGER_MAP[name]
        return COMPARTMENT_POLYGONS.get(comp)
    # 2. 按区域模糊匹配
    if area:
        for comp_name in COMPARTMENT_POLYGONS:
            if comp_name in area or area in comp_name:
                return COMPARTMENT_POLYGONS[comp_name]
    return None


def track_simulator():
    """
    巡护轨迹模拟器 — 真实巡护规律版本
    - 护林员：沿道路网络 + GPS漂移 + 重点区域减速/停留
    - 无人机：Boustrophedon回字形航测 + 平滑转弯 + 自动返航
    """
    import random
    import math

    global _track_sim_running
    _track_sim_running = True
    dt_sim_update = RANGER_CONFIG.get('update_interval_s', 1.0) if TRACK_ENGINE_AVAILABLE else 2.0
    _tick = 0  # SSE广播节流计数器

    while _track_sim_running:
        _tick += 1
        try:
            with app.app_context():
                now = datetime.datetime.now(datetime.timezone.utc)

                if not TRACK_ENGINE_AVAILABLE:
                    time.sleep(2)
                    continue

                # === 护林员：道路网络巡护 ===
                rangers = Ranger.query.filter_by(status='在线').all()
                if len(_ranger_generators) == 0:
                    print(f'[TrackSim] 初始化 {len(rangers)} 个护林员生成器')
                for r in rangers:
                    try:
                        if r.id not in _ranger_generators:
                            route = _get_patrol_route_for_area(r.area)
                            boundary = _get_boundary_for_ranger(r.name, r.area)
                            _ranger_generators[r.id] = RangerTrackGenerator(route=route, boundary_polygon=boundary)
                            if r.lat and 28.48 < r.lat < 28.58:
                                _ranger_generators[r.id].position = (r.lat, r.lng)

                        gen = _ranger_generators[r.id]
                        dt = RANGER_CONFIG['update_interval_s']
                        lat, lng, speed_ms, status = gen.step(dt)

                        r.lat = lat
                        r.lng = lng
                        r.speed_kmh = round(speed_ms * 3.6, 1)
                        r.battery_percent = max(5, (r.battery_percent or 100) - random.uniform(0.0005, 0.002))
                        r.updated_at = now

                        track = RangerTrack(
                            ranger_id=r.id, timestamp=now,
                            lat=lat, lng=lng,
                            speed_kmh=r.speed_kmh,
                            battery_percent=r.battery_percent,
                            status=status
                        )
                        db.session.add(track)
                        if _tick % 10 == 0:
                            broadcast_sse('ranger_update', r.to_dict())
                    except Exception as e:
                        print(f'[TrackSim] Ranger {r.name} error: {e}')
                        continue

                # === 无人机：Boustrophedon航测 / 任务飞行 ===
                drones_all = Drone.query.filter(
                    Drone.status.in_(['巡航中', '任务飞行中'])
                ).all()
                for d in drones_all:
                    # 检查是否有派发任务
                    mission = drone_missions.get(d.id)
                    if mission and mission['status'] in ('en_route', 'returning'):
                        # 任务模式：沿任务航线飞行
                        waypoints = mission['waypoints']
                        idx = mission['current_idx']
                        if idx >= len(waypoints) - 1:
                            mission['status'] = 'completed'
                            d.status = '巡航中'
                            if mission.get('task_id'):
                                t = PatrolTask.query.filter_by(task_number=mission['task_id']).first()
                                if t: t.status = '已完成'; t.progress = 100
                            continue

                        wp_a = waypoints[idx]
                        wp_b = waypoints[idx + 1]
                        speed = mission.get('speed_mps', 12.0)
                        seg_dist = distance_m(wp_a, wp_b)
                        step_frac = (speed * dt_sim_update) / max(seg_dist, 0.1)
                        new_frac = mission.get('_frac', 0) + step_frac
                        if new_frac >= 1.0:
                            new_frac = 0.0
                            idx += 1
                            mission['current_idx'] = idx
                            if idx >= len(waypoints) - 1:
                                mission['status'] = 'completed'
                                d.status = '巡航中'
                        mission['_frac'] = new_frac
                        lat = wp_a[0] + (wp_b[0] - wp_a[0]) * new_frac
                        lng = wp_a[1] + (wp_b[1] - wp_a[1]) * new_frac
                        heading = bearing_deg(wp_a, wp_b)
                        speed_ms = speed
                    else:
                        # 日常Boustrophedon航测模式
                        if d.id not in _drone_generators:
                            drone_boundary = BAIYUNSHAN_BOUNDARY
                            drone_bounds = None
                            if hasattr(d, 'area') and d.area and d.area in COMPARTMENT_POLYGONS:
                                drone_boundary = COMPARTMENT_POLYGONS[d.area]
                                poly = drone_boundary
                                drone_bounds = (poly.bounds[1], poly.bounds[0], poly.bounds[3], poly.bounds[2])
                            # 全场区无人机：根据ID生成不同子区域，避免重叠
                            if drone_bounds is None and drone_boundary is BAIYUNSHAN_BOUNDARY:
                                # 4个象限分配：UAV-01=SW, UAV-04=NE, UAV-05=NW, UAV-06=SE
                                b = BAIYUNSHAN_BOUNDARY.bounds  # minx,miny,maxx,maxy
                                mx, my = (b[0]+b[2])/2, (b[1]+b[3])/2
                                offsets = {
                                    1: (b[1], b[0], my, mx),     # UAV-01: SW
                                    4: (my+0.01, mx+0.01, b[3], b[2]),   # UAV-04: NE
                                    5: (my+0.01, b[0]+0.01, b[3]-0.01, mx), # UAV-05: NW
                                    6: (b[1], mx+0.01, my-0.01, b[2]),   # UAV-06: SE
                                }
                                drone_bounds = offsets.get(d.id)
                            _drone_generators[d.id] = DroneTrackGenerator(
                                area_bounds=drone_bounds,
                                boundary_polygon=drone_boundary)
                        gen = _drone_generators[d.id]
                        dt = DRONE_CONFIG['update_interval_s']
                        lat, lng, speed_ms, heading, _ = gen.step(dt)

                    d.lat = lat
                    d.lng = lng
                    d.speed_kmh = round(speed_ms * 3.6, 1) if speed_ms else 0
                    d.altitude_m = DRONE_CONFIG['altitude_m'] + random.uniform(-5, 5)
                    d.heading_deg = heading
                    d.battery_percent = max(5, (d.battery_percent or 100) - random.uniform(0.003, 0.01))
                    d.updated_at = now

                    dtrack = DroneTrack(
                        drone_id=d.id,
                        task_id=mission.get('task_id', '') if mission else '',
                        timestamp=now, lat=lat, lng=lng,
                        altitude_m=d.altitude_m, heading_deg=d.heading_deg,
                        payload_status='任务中' if mission else '航测'
                    )
                    db.session.add(dtrack)
                    if _tick % 10 == 0:
                        broadcast_sse('drone_update', d.to_dict())

                db.session.commit()

        except Exception as e:
            try:
                db.session.rollback()
            except Exception:
                pass
            print(f'[TrackSim] Error: {e}')

        time.sleep(dt_sim_update)


def start_track_simulator():
    """启动轨迹模拟器"""
    t = threading.Thread(target=track_simulator, daemon=True)
    t.start()
    print('[TrackSim] 轨迹模拟器已启动')


def stop_track_simulator():
    """停止轨迹模拟器"""
    global _track_sim_running
    _track_sim_running = False


# ========== 初始化种子数据 ==========

def init_db():
    """初始化数据库并填充种子数据"""
    with app.app_context():
        db.create_all()

        # 只在空数据库时填充种子数据
        if User.query.first() is None:
            _seed_data()
            print('[InitDB] 种子数据已填充')


def _seed_data():
    """填充初始种子数据（与原型mock数据一致）"""
    now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    # === 用户 ===
    users = [
        User(username='admin', password_hash=generate_password_hash('admin'), name='管理员', role='admin', status='在线', last_login=now_str),
        User(username='zhangjg', password_hash=generate_password_hash('123456'), name='张建国', role='ranger', status='在线', last_login=now_str),
        User(username='limh', password_hash=generate_password_hash('123456'), name='李明辉', role='ranger', status='在线', last_login=now_str),
        User(username='wangds', password_hash=generate_password_hash('123456'), name='王大山', role='ranger', status='在线', last_login=now_str),
        User(username='chenzq', password_hash=generate_password_hash('123456'), name='陈志强', role='ranger', status='离线', last_login='2026-07-01 17:30'),
        User(username='liudc', password_hash=generate_password_hash('123456'), name='刘德才', role='ranger', status='在线', last_login=now_str),
        User(username='zhumy', password_hash=generate_password_hash('123456'), name='朱明远', role='ranger', status='在线', last_login=now_str),
        User(username='ligd', password_hash=generate_password_hash('123456'), name='李国栋', role='ranger', status='在线', last_login=now_str),
        User(username='guest', password_hash=generate_password_hash('guest'), name='游客', role='guest', status='在线', last_login=now_str),
    ]
    db.session.add_all(users)
    db.session.flush()

    # === 护林员（新路网初始位置） ===
    _road_starts = [
        (28.498, 119.922), (28.508, 119.916), (28.520, 119.911),
        (28.531, 119.907), (28.541, 119.905), (28.551, 119.902),
        (28.560, 119.900), (28.564, 119.899), (28.546, 119.912),
        (28.535, 119.893), (28.548, 119.928), (28.565, 119.890),
    ]
    ranger_data = [
        {'name': '张建国', 'phone': '13800001001', 'area': '一号林区', 'status': '在线', 'tag': '资深护林员', 'lat': _road_starts[0][0], 'lng': _road_starts[0][1]},
        {'name': '李明辉', 'phone': '13800001002', 'area': '一号林区', 'status': '在线', 'tag': '护林员', 'lat': _road_starts[1][0], 'lng': _road_starts[1][1]},
        {'name': '王大山', 'phone': '13800001003', 'area': '二号林区', 'status': '在线', 'tag': '护林员', 'lat': _road_starts[2][0], 'lng': _road_starts[2][1]},
        {'name': '陈志强', 'phone': '13800001004', 'area': '二号林区', 'status': '离线', 'tag': '护林员', 'lat': _road_starts[3][0], 'lng': _road_starts[3][1]},
        {'name': '刘德才', 'phone': '13800001005', 'area': '三号林区', 'status': '在线', 'tag': '高级护林员', 'lat': _road_starts[4][0], 'lng': _road_starts[4][1]},
        {'name': '朱明远', 'phone': '13800001006', 'area': '三号林区', 'status': '在线', 'tag': '护林员', 'lat': _road_starts[5][0], 'lng': _road_starts[5][1]},
        {'name': '李国栋', 'phone': '13800001007', 'area': '四号林区', 'status': '在线', 'tag': '护林员', 'lat': _road_starts[6][0], 'lng': _road_starts[6][1]},
        {'name': '孙志明', 'phone': '13800001008', 'area': '四号林区', 'status': '离线', 'tag': '护林员', 'lat': _road_starts[7][0], 'lng': _road_starts[7][1]},
    ]
    for rd in ranger_data:
        r = Ranger(**rd)
        db.session.add(r)
    db.session.flush()

    # === 无人机 ===
    import random as _rnd
    drone_data = [
        {'code': 'UAV-01', 'model': '大疆经纬M300 RTK', 'status': '巡航中', 'tag': '红外巡查', 'battery_percent': 85, 'flight_hours': 48.2, 'lat': round(_rnd.uniform(28.485, 28.575), 6), 'lng': round(_rnd.uniform(119.860, 119.960), 6)},
        {'code': 'UAV-02', 'model': '大疆经纬M300 RTK', 'status': '巡航中', 'tag': '多光谱巡查', 'battery_percent': 72, 'flight_hours': 42.5, 'lat': round(_rnd.uniform(28.485, 28.575), 6), 'lng': round(_rnd.uniform(119.860, 119.960), 6)},
        {'code': 'UAV-03', 'model': '大疆经纬M350 RTK', 'status': '巡航中', 'tag': '可见光巡查', 'battery_percent': 91, 'flight_hours': 35.8, 'lat': round(_rnd.uniform(28.485, 28.575), 6), 'lng': round(_rnd.uniform(119.860, 119.960), 6)},
        {'code': 'UAV-04', 'model': '大疆御3T', 'status': '维护中', 'tag': '备用机', 'battery_percent': 100, 'flight_hours': 28.3, 'lat': round(_rnd.uniform(28.485, 28.575), 6), 'lng': round(_rnd.uniform(119.860, 119.960), 6)},
        {'code': 'UAV-05', 'model': '大疆经纬M30T', 'status': '待命', 'tag': '应急巡查', 'battery_percent': 100, 'flight_hours': 15.7, 'lat': round(_rnd.uniform(28.485, 28.575), 6), 'lng': round(_rnd.uniform(119.860, 119.960), 6)},
        {'code': 'UAV-06', 'model': '大疆FPV穿越机', 'status': '巡航中', 'tag': '热成像巡查', 'battery_percent': 64, 'flight_hours': 52.0, 'lat': round(_rnd.uniform(28.485, 28.575), 6), 'lng': round(_rnd.uniform(119.860, 119.960), 6)},
    ]
    for dd in drone_data:
        db.session.add(Drone(**dd))
    db.session.flush()

    # === 巡逻队伍 ===
    teams = [
        {'name': '第一巡护队', 'leader': '张建国', 'member_count': 5, 'area': '一号林区', 'monthly_patrols': 28},
        {'name': '第二巡护队', 'leader': '王大山', 'member_count': 4, 'area': '二号林区', 'monthly_patrols': 24},
        {'name': '第三巡护队', 'leader': '刘德才', 'member_count': 3, 'area': '三号林区', 'monthly_patrols': 22},
        {'name': '无人机中队', 'leader': '管理员', 'member_count': 4, 'area': '全场区', 'monthly_patrols': 42},
    ]
    for td in teams:
        db.session.add(PatrolTeam(**td))

    # === 巡护任务（预生成编号避免冲突） ===
    today = datetime.date.today().strftime('%Y%m%d')
    task_defs = [
        ('东部林区日常巡护', '日常巡护', '一号林区', 1, None),
        ('松材线虫病专项巡查', '疫情巡护', '二号林区', 3, None),
        ('无人机火险巡查', '防火巡护', '全场区', None, 1),
        ('三号林区日常巡护', '日常巡护', '三号林区', 5, None),
    ]
    for i, (name, ttype, area, rid, did) in enumerate(task_defs):
        tn = f'XH{today}-{i+1:03d}'
        db.session.add(PatrolTask(
            task_number=tn, name=name, type=ttype,
            time_start='2026-07-03 08:00', time_end='2026-07-03 17:00',
            area=area, ranger_id=rid, drone_id=did,
            route_geometry=_gen_route_geometry(area),
            status='待执行', creator='管理员',
        ))

    # === 巡护路线 ===
    routes = [
        {'name': '一号标准巡线', 'route_type': '徒步', 'length_km': 12.5, 'creator': '张建国', 'status': '启用'},
        {'name': '二号防火巡线', 'route_type': '徒步', 'length_km': 15.8, 'creator': '王大山', 'status': '启用'},
        {'name': 'UAV网格化航线-A', 'route_type': '无人机', 'length_km': 45.2, 'creator': '管理员', 'status': '启用'},
        {'name': '病虫害巡线', 'route_type': '徒步', 'length_km': 8.3, 'creator': '刘德才', 'status': '启用'},
    ]
    for rd in routes:
        db.session.add(PatrolRoute(**rd))

    # === 火情事件 ===
    fires = [
        {'name': 'F001号火情', 'lat': 28.515, 'lng': 119.905, 'risk_level': '高', 'status': '蔓延中',
         'temperature_c': 85.3, 'area_mu': 45, 'description': '无人机红外发现林冠层异常高温',
         'reported_by': 'UAV-01', 'reported_at': '2026-07-02 14:23'},
        {'name': 'F002号火情', 'lat': 28.495, 'lng': 119.935, 'risk_level': '中', 'status': '已控制',
         'temperature_c': 52.1, 'area_mu': 21, 'description': '护林员上报烟雾',
         'reported_by': '张建国', 'reported_at': '2026-07-02 10:15'},
        {'name': 'F003号火情', 'lat': 28.545, 'lng': 119.880, 'risk_level': '低', 'status': '已派发',
         'temperature_c': 38.5, 'area_mu': 20, 'description': '遥感影像热点标记',
         'reported_by': '系统', 'reported_at': '2026-07-01 16:08'},
    ]
    for fd in fires:
        db.session.add(FireEvent(**fd))

    # === 疫情事件 ===
    pests = [
        {'name': '松材线虫-01', 'lat': 28.510, 'lng': 119.910, 'disease_type': '松材线虫病',
         'confidence': 92.3, 'affected_area_mu': 8.5, 'description': '无人机多光谱发现红褐色枯死木'},
        {'name': '松材线虫-02', 'lat': 28.498, 'lng': 119.940, 'disease_type': '松材线虫病',
         'confidence': 85.1, 'affected_area_mu': 5.2, 'description': '护林员上报疑似病害木'},
        {'name': '松材线虫-03', 'lat': 28.540, 'lng': 119.885, 'disease_type': '松材线虫病',
         'confidence': 78.6, 'affected_area_mu': 3.8, 'description': '遥感NDVI变化检测发现'},
        {'name': '松材线虫-04', 'lat': 28.485, 'lng': 119.945, 'disease_type': '松材线虫病',
         'confidence': 94.1, 'affected_area_mu': 12.0, 'description': 'AI识别高置信度检测'},
    ]
    for pd in pests:
        db.session.add(PestEvent(**pd))

    # === 异常事件 ===
    abnormal = [
        {'type': 'fire', 'area': '一号林区', 'desc': '发现明火', 'level': '高', 'time': '2026-07-02 14:23', 'status': '处置中', 'handler': '张建国', 'source': '护林员张建国上报', 'measure': '已现场制止并扑灭明火，对当事人进行警示教育，上报林业站备案', 'lat': 28.520, 'lng': 119.908},
        {'type': 'pest', 'area': '二号林区', 'desc': '松材线虫病感染', 'level': '高', 'time': '2026-07-01 10:30', 'status': '处置中', 'handler': '王大山', 'source': '无人机UAV-02巡查发现', 'measure': '已标记疫区范围，协调森林防疫站进行药物防治', 'lat': 28.498, 'lng': 119.935},
        {'type': 'fire', 'area': '三号林区', 'desc': '烟雾疑似', 'level': '中', 'time': '2026-07-02 15:07', 'status': '已派发', 'handler': '刘德才', 'source': '遥感卫星热点监测', 'measure': '已派发巡护三队前往现场核查，等待反馈', 'lat': 28.545, 'lng': 119.880},
        {'type': 'geo', 'area': '四号林区', 'desc': '山体裂缝', 'level': '中', 'time': '2026-06-30 09:00', 'status': '监控中', 'handler': '陈志强', 'source': '无人机UAV-01航测发现', 'measure': '已安装位移监测传感器，列入重点监控区域', 'lat': 28.500, 'lng': 119.935},
        {'type': 'theft', 'area': '五号林区', 'desc': '疑似盗伐痕迹', 'level': '低', 'time': '2026-06-29 16:20', 'status': '已处置', 'handler': '李明辉', 'source': '护林员李明辉上报', 'measure': '已组织现场勘查取证，协调森林公安介入调查，加强该区域巡护频次', 'lat': 28.555, 'lng': 119.870},
    ]
    for ad in abnormal:
        db.session.add(AbnormalEvent(**ad))

    # === 告警 ===
    warnings = [
        {'type': '火情', 'level': '高', 'description': 'F001号火情 - 林冠层异常高温 85.3°C', 'related_event_id': 'F001', 'created_at': '2026-07-02 14:23'},
        {'type': '火情', 'level': '中', 'description': 'F002号火情 - 烟雾确认', 'related_event_id': 'F002', 'created_at': '2026-07-02 10:15'},
        {'type': '疫情', 'level': '高', 'description': '松材线虫-01 置信度92.3%', 'related_event_id': 'P001', 'created_at': '2026-07-02 11:00'},
        {'type': '异常', 'level': '中', 'description': '四号林区山体裂缝', 'related_event_id': 'AE004', 'created_at': '2026-06-30 09:00'},
        {'type': '巡护', 'level': '低', 'description': '无人机UAV-04离线超过24小时', 'related_event_id': '', 'created_at': '2026-07-02 08:00'},
        {'type': '异常', 'level': '低', 'description': '五号林区疑似盗伐', 'related_event_id': 'AE005', 'created_at': '2026-06-29 16:20'},
    ]
    for wd in warnings:
        db.session.add(AlertWarning(**wd))

    # === AI识别影像 ===
    fire_imgs = [
        {'source_type': 'UAV', 'detection_type': 'fire', 'confidence': 97.3, 'status': '高风险',
         'bbox_json': '{"x":120,"y":80,"w":200,"h":150}', 'lat': 28.515, 'lng': 119.905,
         'image_path': '/static/images/fire_uav_001.jpg', 'created_at': '2026-07-02 14:23'},
        {'source_type': 'UAV', 'detection_type': 'fire', 'confidence': 89.1, 'status': '高风险',
         'bbox_json': '{"x":100,"y":60,"w":180,"h":140}', 'lat': 28.495, 'lng': 119.935,
         'image_path': '/static/images/fire_uav_002.jpg', 'created_at': '2026-07-02 10:15'},
        {'source_type': 'manual', 'detection_type': 'fire', 'confidence': 78.5, 'status': '疑似',
         'bbox_json': '{"x":150,"y":90,"w":160,"h":120}', 'lat': 28.545, 'lng': 119.880,
         'image_path': '/static/images/fire_manual_001.jpg', 'created_at': '2026-07-01 16:08'},
        {'source_type': 'UAV', 'detection_type': 'fire', 'confidence': 71.2, 'status': '正常',
         'bbox_json': '{"x":80,"y":50,"w":100,"h":80}', 'lat': 28.530, 'lng': 119.890,
         'image_path': '/static/images/fire_uav_003.jpg', 'created_at': '2026-07-01 09:00'},
    ]
    for fd in fire_imgs:
        db.session.add(AiImage(**fd))

    pest_imgs = [
        {'source_type': 'UAV', 'detection_type': 'pest', 'confidence': 94.1, 'status': '高风险',
         'bbox_json': '{"x":200,"y":100,"w":120,"h":100}', 'lat': 28.510, 'lng': 119.910,
         'image_path': '/static/images/pest_uav_001.jpg', 'created_at': '2026-07-02 11:00'},
        {'source_type': 'UAV', 'detection_type': 'pest', 'confidence': 85.3, 'status': '疑似',
         'bbox_json': '{"x":180,"y":80,"w":110,"h":90}', 'lat': 28.498, 'lng': 119.940,
         'image_path': '/static/images/pest_uav_002.jpg', 'created_at': '2026-07-01 14:30'},
        {'source_type': 'manual', 'detection_type': 'pest', 'confidence': 74.6, 'status': '疑似',
         'bbox_json': '{"x":160,"y":70,"w":130,"h":110}', 'lat': 28.540, 'lng': 119.885,
         'image_path': '/static/images/pest_manual_001.jpg', 'created_at': '2026-06-30 10:00'},
    ]
    for pd in pest_imgs:
        db.session.add(AiImage(**pd))

    # === 角色 ===
    roles = [
        {'name': 'admin', 'label': '系统管理员', 'desc': '拥有系统全部权限', 'user_count': 1},
        {'name': 'ranger', 'label': '护林员', 'desc': '巡护监控与数据上报权限', 'user_count': 5},
        {'name': 'guest', 'label': '游客', 'desc': '仅查看驾驶舱与统计报表', 'user_count': 1},
    ]
    for rd in roles:
        db.session.add(Role(**rd))

    # === 权限 ===
    permissions = [
        {'module': '综合驾驶舱', 'admin': True, 'ranger': True, 'guest': True},
        {'module': '巡护监控与管理', 'admin': True, 'ranger': True, 'guest': False},
        {'module': '空间数据管理', 'admin': True, 'ranger': True, 'guest': False},
        {'module': '灾害识别处置', 'admin': True, 'ranger': True, 'guest': False},
        {'module': '统计报表', 'admin': True, 'ranger': True, 'guest': True},
        {'module': '系统管理', 'admin': True, 'ranger': False, 'guest': False},
    ]
    for pd in permissions:
        db.session.add(Permission(**pd))

    # === 系统日志 ===
    logs = [
        {'time': '2026-07-02 09:15', 'user': '管理员', 'action': '登录系统', 'module': '认证', 'ip': '192.168.1.100'},
        {'time': '2026-07-02 09:10', 'user': '张建国', 'action': '上报巡护数据', 'module': '巡护管理', 'ip': '192.168.1.101'},
        {'time': '2026-07-02 08:45', 'user': '系统', 'action': '自动备份完成', 'module': '数据运维', 'ip': '-'},
        {'time': '2026-07-02 08:30', 'user': '李明辉', 'action': '查看火情详情', 'module': '灾害识别', 'ip': '192.168.1.102'},
        {'time': '2026-07-02 08:00', 'user': '管理员', 'action': '修改权限配置', 'module': '系统管理', 'ip': '192.168.1.100'},
        {'time': '2026-07-01 17:30', 'user': '陈志强', 'action': '退出系统', 'module': '认证', 'ip': '192.168.1.103'},
        {'time': '2026-07-01 17:00', 'user': '王大山', 'action': '上报异常事件', 'module': '巡护管理', 'ip': '192.168.1.104'},
        {'time': '2026-07-01 16:30', 'user': '系统', 'action': '风险预警触发', 'module': '风险预警', 'ip': '-'},
    ]
    for ld in logs:
        db.session.add(SystemLog(**ld))

    db.session.commit()


# ========== 静态文件服务 ==========

import flask

@app.route('/')
def serve_index():
    """Serve the prototype index.html"""
    resp = flask.send_file(os.path.join(PROTOTYPE_DIR, 'index.html'))
    resp.headers['Cache-Control'] = 'no-cache'
    return resp

@app.route('/mobile')
def serve_mobile():
    """护林员手机端"""
    resp = flask.send_file(os.path.join(PROTOTYPE_DIR, 'mobile.html'))
    resp.headers['Cache-Control'] = 'no-cache'
    return resp

@app.route('/<path:filename>')
def serve_static(filename):
    """Serve prototype files"""
    if filename.startswith('api/'):
        return jsonify({'error': 'Not found'}), 404
    filepath = os.path.join(PROTOTYPE_DIR, filename)
    if os.path.isfile(filepath):
        return flask.send_file(filepath)
    return flask.send_file(os.path.join(PROTOTYPE_DIR, 'index.html'))


# ========== 启动 ==========

if __name__ == '__main__':
    print(f'[Init] 原型目录: {PROTOTYPE_DIR}')
    print(f'[Init] 原型文件: {os.path.isfile(os.path.join(PROTOTYPE_DIR, "index.html"))}')
    init_db()
    start_track_simulator()
    print(f'[Init] 系统启动完成，访问 http://localhost:5051')
    try:
        app.run(host='0.0.0.0', port=5051, debug=False)
    finally:
        stop_track_simulator()
