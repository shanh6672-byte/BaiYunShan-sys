"""巡护模块 API — 路线规划、任务管理、巡护日志"""
import json
import datetime
import math
import random
from flask import Blueprint, request, jsonify

patrol_bp = Blueprint('patrol', __name__, url_prefix='/api')

# 延迟导入，避免循环依赖
def _get_db_routes():
    try:
        from models import PatrolRoute
        routes = PatrolRoute.query.filter_by(status='启用').order_by(PatrolRoute.created_at.desc()).all()
        result = []
        for r in routes:
            d = r.to_dict()
            coords = []
            try:
                geo = json.loads(r.geometry_json) if r.geometry_json else {}
                coords = geo.get('coordinates', [])
            except Exception:
                pass
            d['id'] = 'UR{:03d}'.format(r.id)
            d['waypoints'] = [[c[1], c[0]] for c in coords] if coords else []
            d['distance_km'] = r.length_km or 0
            d['type'] = r.route_type or '自定义'
            d['area'] = ''
            d['suitable_for'] = 'both'
            d['desc'] = f'用户规划路线 ({r.length_km}km)'
            result.append(d)
        return result
    except Exception:
        return []

# ==================== 白云山预设巡护路线 ====================
# 林场范围: [119.854, 28.480] ~ [119.966, 28.581], 中心 [28.467, 119.922]
# 5个子区域，每区域4条路线，共20条

def _gen_perimeter(cx, cy, w, h, steps):
    """边界巡护：沿矩形边界绕行"""
    pts = []
    for i in range(steps + 1):
        t = i / steps
        if t <= 0.25:
            x = cx - w/2 + (w) * (t / 0.25)
            y = cy - h/2
        elif t <= 0.5:
            x = cx + w/2
            y = cy - h/2 + (h) * ((t - 0.25) / 0.25)
        elif t <= 0.75:
            x = cx + w/2 - (w) * ((t - 0.5) / 0.25)
            y = cy + h/2
        else:
            x = cx - w/2
            y = cy + h/2 - (h) * ((t - 0.75) / 0.25)
        pts.append([round(y, 6), round(x, 6)])
    return pts

def _gen_zigzag(cx, cy, w, h, passes):
    """之字形覆盖：水平来回扫描"""
    pts = []
    for p in range(passes):
        y0 = cy - h/2 + (h / passes) * p
        y1 = cy - h/2 + (h / passes) * (p + 0.5)
        segs = 6
        for i in range(segs + 1):
            t = i / segs
            if p % 2 == 0:
                x = cx - w/2 + w * t
            else:
                x = cx + w/2 - w * t
            y = y0 + (y1 - y0) * t
            pts.append([round(y, 6), round(x, 6)])
    return pts

def _gen_spine(cx, cy, w, h, direction, detour_count=2):
    """主干道巡护：直线穿越 + 小绕行"""
    pts = []
    if direction == 'horiz':
        steps = 10
        for i in range(steps + 1):
            t = i / steps
            x = cx - w/2 + w * t
            y = cy
            if i > 0 and i < steps and i % (steps // (detour_count + 1)) == 0:
                y += (0.001 if i % 2 == 0 else -0.001)
            pts.append([round(y, 6), round(x, 6)])
    else:
        steps = 10
        for i in range(steps + 1):
            t = i / steps
            y = cy - h/2 + h * t
            x = cx
            if i > 0 and i < steps and i % (steps // (detour_count + 1)) == 0:
                x += (0.001 if i % 2 == 0 else -0.001)
            pts.append([round(y, 6), round(x, 6)])
    return pts

def _gen_diagonal(cx, cy, w, h):
    """对角线巡护：左上到右下"""
    pts = []
    steps = 12
    for i in range(steps + 1):
        t = i / steps
        y = cy + h/2 - h * t
        x = cx - w/2 + w * t
        pts.append([round(y, 6), round(x, 6)])
    return pts

def _gen_ribs(cx, cy, w, h, rib_count=4):
    """鱼骨巡护：主干 + 分支"""
    pts = []
    spine_steps = 10
    for i in range(spine_steps + 1):
        t = i / spine_steps
        x = cx - w/2 + w * t
        y = cy
        pts.append([round(y, 6), round(x, 6)])
        if i > 0 and i < spine_steps and i % (spine_steps // rib_count) == 0:
            detour_x = cx - w/2 + w * t
            detour_y1 = cy + h/2 * 0.6
            detour_y2 = cy - h/2 * 0.6
            pts.append([round(detour_y1, 6), round(detour_x, 6)])
            pts.append([round(detour_y2, 6), round(detour_x + 0.0005, 6)])
            pts.append([round(cy, 6), round(detour_x + 0.001, 6)])
    return pts

# 5个子区域定义 [center_lat, center_lng, width_deg, height_deg, name]
AREAS = [
    [28.5331, 119.9127, 0.0485, 0.0376, '一号林区'],
    [28.5538, 119.9323, 0.0401, 0.0538, '二号林区'],
    [28.5044, 119.9439, 0.0414, 0.0454, '三号林区'],
    [28.5140, 119.8721, 0.0389, 0.0394, '四号林区'],
    [28.4928, 119.9053, 0.0377, 0.0323, '五号林区'],
]

ROUTE_DEFS = []
route_id = 1

for area in AREAS:
    cy, cx, w, h, name = area
    ROUTE_DEFS.append({
        'id': 'R{:03d}'.format(route_id), 'name': name + '-\u8fb9\u754c\u5de1\u62a4', 'area': name, 'type': '\u8fb9\u754c\u5de1\u62a4',
        'desc': '\u6cbf' + name + '\u5916\u56f4\u8fb9\u754c\u7ed5\u884c\u4e00\u5468', 'waypoints': _gen_perimeter(cx, cy, w, h, 20),
        'suitable_for': 'both', 'distance_km': round((w * 2 + h * 2) * 100, 1)
    }); route_id += 1

    ROUTE_DEFS.append({
        'id': 'R{:03d}'.format(route_id), 'name': name + '-\u4e4b\u5b57\u8986\u76d6', 'area': name, 'type': '\u4e4b\u5b57\u8986\u76d6',
        'desc': '\u5728' + name + '\u5185\u4e4b\u5b57\u5f62\u626b\u63cf\uff0c\u5168\u9762\u8986\u76d6', 'waypoints': _gen_zigzag(cx, cy, w, h, 4),
        'suitable_for': 'drone', 'distance_km': round((w * 4 + h) * 100, 1)
    }); route_id += 1

    ROUTE_DEFS.append({
        'id': 'R{:03d}'.format(route_id), 'name': name + '-\u4e3b\u5e72\u9053\u5de1\u62a4', 'area': name, 'type': '\u4e3b\u5e72\u9053\u5de1\u62a4',
        'desc': '\u6cbf' + name + '\u4e3b\u5e72\u9053\u76f4\u7ebf\u7a7f\u8d8a', 'waypoints': _gen_spine(cx, cy, w, h, 'horiz'),
        'suitable_for': 'ranger', 'distance_km': round(w * 100, 1)
    }); route_id += 1

    ROUTE_DEFS.append({
        'id': 'R{:03d}'.format(route_id), 'name': name + '-\u9c7c\u9aa8\u5de1\u62a4', 'area': name, 'type': '\u9c7c\u9aa8\u5de1\u62a4',
        'desc': '\u4e3b\u5e72+\u5206\u652f\uff0c\u8986\u76d6' + name + '\u91cd\u70b9\u70b9\u4f4d', 'waypoints': _gen_ribs(cx, cy, w, h, 4),
        'suitable_for': 'ranger', 'distance_km': round((w * 1.6 + h * 0.6 * 4) * 100, 1)
    }); route_id += 1

# ==================== 路线 API ====================

@patrol_bp.route('/patrol-routes', methods=['GET'])
def get_routes():
    area = request.args.get('area', '')
    route_type = request.args.get('type', '')
    suitable = request.args.get('suitable', '')
    # 合并预设路线 + 数据库用户路线
    result = list(ROUTE_DEFS) + _get_db_routes()
    if area:
        result = [r for r in result if area in (r.get('area') or '')]
    if route_type:
        result = [r for r in result if r.get('type') == route_type]
    if suitable:
        result = [r for r in result if r.get('suitable_for') in (suitable, 'both')]
    return jsonify({'success': True, 'data': result, 'total': len(result)})

@patrol_bp.route('/patrol-routes/<route_id>', methods=['GET', 'DELETE'])
def get_route(route_id):
    # \u5148\u67e5\u5185\u5b58\u9884\u8bbe\u8def\u7ebf
    for r in ROUTE_DEFS:
        if r['id'] == route_id:
            if request.method == 'DELETE':
                return jsonify({'success': False, 'error': '\u9884\u8bbe\u8def\u7ebf\u4e0d\u53ef\u5220\u9664'}), 403
            return jsonify({'success': True, 'data': r})
    # \u518d\u67e5\u6570\u636e\u5e93\u7528\u6237\u8def\u7ebf
    if route_id.startswith('UR'):
        try:
            from models import PatrolRoute, db
            rid = int(route_id[2:])
            route = PatrolRoute.query.get(rid)
            if route:
                if request.method == 'DELETE':
                    db.session.delete(route)
                    db.session.commit()
                    return jsonify({'success': True})
                d = route.to_dict()
                coords = []
                try:
                    geo = json.loads(route.geometry_json) if route.geometry_json else {}
                    coords = geo.get('coordinates', [])
                except Exception:
                    pass
                d['waypoints'] = [[c[1], c[0]] for c in coords] if coords else []
                d['distance_km'] = route.length_km or 0
                return jsonify({'success': True, 'data': d})
        except Exception:
            pass
    return jsonify({'success': False, 'error': '\u8def\u7ebf\u4e0d\u5b58\u5728'}), 404


# ==================== 巡护任务（内存存储） ====================

_tasks = []
_task_id_seq = 1


def _seed_tasks():
    global _task_id_seq
    if _tasks:
        return
    now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    seed = [
        {'name': '一号林区日常巡护', 'type': '日常巡护', 'area': '一号林区', 'members': ['HL001'], 'members_names': ['张建国'],
         'route_name': '一号林区-鱼骨巡护', 'start_time': '2026-07-05T08:00', 'end_time': '2026-07-05T12:00'},
        {'name': '二号林区防火巡护', 'type': '防火巡护', 'area': '二号林区', 'members': ['HL002'], 'members_names': ['李明辉'],
         'route_name': '二号林区-之字覆盖', 'start_time': '2026-07-05T09:00', 'end_time': '2026-07-05T13:00'},
        {'name': '三号林区疫情巡护', 'type': '疫情巡护', 'area': '三号林区', 'members': ['HL003'], 'members_names': ['王大山'],
         'route_name': '三号林区-主干道巡护', 'start_time': '2026-07-05T07:00', 'end_time': '2026-07-05T11:00'},
        {'name': '四号林区应急巡护', 'type': '应急巡护', 'area': '四号林区', 'members': ['HL004'], 'members_names': ['陈志强'],
         'route_name': '四号林区-鱼骨巡护', 'start_time': '2026-07-05T10:00', 'end_time': '2026-07-05T14:00'},
    ]
    for s in seed:
        wps = []
        for r in ROUTE_DEFS:
            if r['name'] == s['route_name']:
                wps = r['waypoints']
                break
        task = {
            'id': 'PT{:04d}'.format(_task_id_seq),
            'name': s['name'], 'type': s['type'], 'area': s['area'],
            'description': '', 'route_id': '', 'route_name': s['route_name'],
            'route_waypoints': wps, 'members': s['members'],
            'members_names': s.get('members_names', []),
            'start_time': s['start_time'], 'end_time': s['end_time'],
            'status': '待执行', 'created_at': now
        }
        _task_id_seq += 1
        _tasks.append(task)

_seed_tasks()

@patrol_bp.route('/patrol-tasks', methods=['GET'])
def get_tasks():
    status = request.args.get('status', '')
    result = list(_tasks)
    if status:
        result = [t for t in result if t['status'] == status]
    result.sort(key=lambda t: t.get('created_at', ''), reverse=True)
    return jsonify({'success': True, 'data': result, 'total': len(result)})

@patrol_bp.route('/patrol-tasks', methods=['POST'])
def create_task():
    global _task_id_seq
    data = request.get_json() or {}
    now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    task = {
        'id': 'PT{:04d}'.format(_task_id_seq),
        'name': data.get('name', ''),
        'type': data.get('type', '\u65e5\u5e38\u5de1\u62a4'),
        'area': data.get('area', ''),
        'description': data.get('description', ''),
        'route_id': data.get('route_id', ''),
        'route_name': data.get('route_name', ''),
        'route_waypoints': data.get('route_waypoints', []),
        'members': data.get('members', []),
        'start_time': data.get('start_time', ''),
        'end_time': data.get('end_time', ''),
        'progress': 0,
        'status': '待执行',
        'created_at': now
    }
    _task_id_seq += 1
    _tasks.append(task)
    return jsonify({'success': True, 'data': task})

@patrol_bp.route('/patrol-tasks/<task_id>', methods=['GET', 'PUT'])
def task_by_id(task_id):
    # GET — 获取单个任务（手机端查询最新任务路线）
    if request.method == 'GET':
        for t in _tasks:
            if t['id'] == task_id:
                return jsonify({'success': True, 'data': t})
        return jsonify({'success': False, 'error': '任务不存在'}), 404
    # PUT — 更新任务
    data = request.get_json() or {}
    for t in _tasks:
        if t['id'] == task_id:
            for k in ('status', 'progress', 'name', 'description', 'route_id', 'route_name', 'route_waypoints', 'members', 'start_time', 'end_time'):
                if k in data:
                    t[k] = data[k]
            return jsonify({'success': True, 'data': t})
    return jsonify({'success': False, 'error': '\u4efb\u52a1\u4e0d\u5b58\u5728'}), 404

@patrol_bp.route('/patrol-tasks/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    global _tasks
    _tasks = [t for t in _tasks if t['id'] != task_id]
    return jsonify({'success': True})


# ==================== 巡护日志 ====================

_logs = []
_log_id_seq = 1

@patrol_bp.route('/patrol-logs', methods=['GET'])
def get_logs():
    task_id = request.args.get('task_id', '')
    result = list(_logs)
    if task_id:
        result = [l for l in result if l['task_id'] == task_id]
    result.sort(key=lambda l: l.get('created_at', ''), reverse=True)
    return jsonify({'success': True, 'data': result, 'total': len(result)})

@patrol_bp.route('/patrol-logs', methods=['POST'])
def create_log():
    global _log_id_seq
    data = request.get_json() or {}
    now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    log = {
        'id': 'PL{:04d}'.format(_log_id_seq),
        'task_id': data.get('task_id', ''),
        'user_id': data.get('user_id', ''),
        'user_name': data.get('user_name', ''),
        'content': data.get('content', ''),
        'type': data.get('type', 'info'),
        'lat': data.get('lat', 0),
        'lng': data.get('lng', 0),
        'created_at': now
    }
    _log_id_seq += 1
    _logs.append(log)
    return jsonify({'success': True, 'data': log})


# ==================== 模拟轨迹流 ====================

@patrol_bp.route('/patrol-trajectory/simulate', methods=['POST'])
def simulate_trajectory():
    """模拟护林员/无人机沿路线移动，返回轨迹点流"""
    data = request.get_json() or {}
    route_id = data.get('route_id', '')
    user_type = data.get('user_type', 'ranger')

    route = None
    for r in ROUTE_DEFS:
        if r['id'] == route_id:
            route = r
            break
    if not route:
        return jsonify({'success': False, 'error': '\u8def\u7ebf\u4e0d\u5b58\u5728'}), 404

    waypoints = route['waypoints']
    speed = 1.5 if user_type == 'ranger' else 8.0

    points = []
    interval_s = 10

    total_dist = 0
    segments = []
    for i in range(len(waypoints) - 1):
        dlat = waypoints[i+1][0] - waypoints[i][0]
        dlng = waypoints[i+1][1] - waypoints[i][1]
        dist = math.sqrt(dlat**2 + dlng**2) * 111000
        total_dist += dist
        segments.append(dist)

    total_time = total_dist / speed
    num_points = max(10, int(total_time / interval_s))
    dt = total_time / num_points

    cumulative = [0]
    for s in segments:
        cumulative.append(cumulative[-1] + s)

    now = datetime.datetime.now()
    for i in range(num_points + 1):
        t_val = i / num_points
        target_dist = t_val * total_dist

        seg_idx = 0
        for j in range(len(cumulative) - 1):
            if cumulative[j] <= target_dist <= cumulative[j+1]:
                seg_idx = j
                break

        if cumulative[seg_idx + 1] == cumulative[seg_idx]:
            seg_t = 0
        else:
            seg_t = (target_dist - cumulative[seg_idx]) / max(0.001, cumulative[seg_idx + 1] - cumulative[seg_idx])
        seg_t = max(0, min(1, seg_t))

        lat = waypoints[seg_idx][0] + seg_t * (waypoints[seg_idx+1][0] - waypoints[seg_idx][0])
        lng = waypoints[seg_idx][1] + seg_t * (waypoints[seg_idx+1][1] - waypoints[seg_idx][1])

        heading = 0
        if seg_idx < len(waypoints) - 1:
            dy = waypoints[seg_idx+1][0] - waypoints[seg_idx][0]
            dx = waypoints[seg_idx+1][1] - waypoints[seg_idx][1]
            heading = math.degrees(math.atan2(dx, dy)) % 360

        ts = now - datetime.timedelta(seconds=(num_points - i) * interval_s)
        points.append({
            'lat': round(lat, 6),
            'lng': round(lng, 6),
            'ts': ts.strftime('%Y-%m-%dT%H:%M:%S'),
            'speed': round(speed + random.uniform(-0.3, 0.3), 1),
            'heading': round(heading, 1),
            'accuracy': 3 if user_type == 'ranger' else 1
        })

    return jsonify({'success': True, 'data': points, 'total': len(points)})
