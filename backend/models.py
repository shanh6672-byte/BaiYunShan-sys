"""SQLAlchemy 数据模型"""
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# ========== 用户与认证 ==========

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(50), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    name = db.Column(db.String(50), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='ranger')  # admin / ranger / guest
    status = db.Column(db.String(10), default='在线')  # 在线 / 离线
    phone = db.Column(db.String(20), default='')
    last_login = db.Column(db.String(50), default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': f'U{self.id:03d}',
            'username': self.username,
            'name': self.name,
            'role': self.role,
            'status': self.status,
            'lastLogin': self.last_login,
        }


class Role(db.Model):
    __tablename__ = 'roles'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(20), unique=True, nullable=False)
    label = db.Column(db.String(50), nullable=False)
    desc = db.Column(db.String(200), default='')
    user_count = db.Column(db.Integer, default=0)

    def to_dict(self):
        return {
            'id': f'R{self.id:03d}',
            'name': self.name,
            'label': self.label,
            'desc': self.desc,
            'userCount': self.user_count,
        }


class Permission(db.Model):
    __tablename__ = 'permissions'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    module = db.Column(db.String(50), nullable=False)
    admin = db.Column(db.Boolean, default=False)
    ranger = db.Column(db.Boolean, default=False)
    guest = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            'module': self.module,
            'admin': self.admin,
            'ranger': self.ranger,
            'guest': self.guest,
        }


# ========== 巡护力量 ==========

class Ranger(db.Model):
    __tablename__ = 'rangers'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    name = db.Column(db.String(50), nullable=False)
    phone = db.Column(db.String(20), default='')
    area = db.Column(db.String(100), default='')
    status = db.Column(db.String(10), default='在线')  # 在线 / 离线
    tag = db.Column(db.String(50), default='')
    speed_kmh = db.Column(db.Float, default=0)
    battery_percent = db.Column(db.Float, default=100)
    lat = db.Column(db.Float, default=28.467)
    lng = db.Column(db.Float, default=119.922)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': f'HL{self.id:03d}',
            'userId': self.user_id,
            'name': self.name,
            'phone': self.phone,
            'area': self.area,
            'status': self.status,
            'tag': self.tag,
            'speedKmh': self.speed_kmh,
            'batteryPercent': self.battery_percent,
            'lat': self.lat,
            'lng': self.lng,
        }


class Drone(db.Model):
    __tablename__ = 'drones'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    code = db.Column(db.String(20), unique=True, nullable=False)
    model = db.Column(db.String(50), default='大疆M300')
    status = db.Column(db.String(20), default='巡航中')
    tag = db.Column(db.String(50), default='')
    lat = db.Column(db.Float, default=28.467)
    lng = db.Column(db.Float, default=119.922)
    altitude_m = db.Column(db.Float, default=120)
    heading_deg = db.Column(db.Float, default=0)
    battery_percent = db.Column(db.Float, default=100)
    flight_hours = db.Column(db.Float, default=0)
    area = db.Column(db.String(50), default='全场区')
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': f'UAV{self.id:02d}',
            'code': self.code,
            'model': self.model,
            'status': self.status,
            'tag': self.tag,
            'lat': self.lat,
            'lng': self.lng,
            'altitudeM': self.altitude_m,
            'headingDeg': self.heading_deg,
            'batteryPercent': self.battery_percent,
            'flightHours': self.flight_hours,
        }


class PatrolTeam(db.Model):
    __tablename__ = 'patrol_teams'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(50), nullable=False)
    leader = db.Column(db.String(50), default='')
    member_count = db.Column(db.Integer, default=0)
    area = db.Column(db.String(100), default='')
    monthly_patrols = db.Column(db.Integer, default=0)

    def to_dict(self):
        return {
            'id': f'T{self.id:03d}',
            'name': self.name,
            'leader': self.leader,
            'memberCount': self.member_count,
            'area': self.area,
            'monthlyPatrols': self.monthly_patrols,
        }


# ========== 巡护轨迹 ==========

class RangerTrack(db.Model):
    __tablename__ = 'ranger_tracks'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    ranger_id = db.Column(db.Integer, db.ForeignKey('rangers.id'), nullable=False, index=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    lat = db.Column(db.Float, nullable=False)
    lng = db.Column(db.Float, nullable=False)
    speed_kmh = db.Column(db.Float, default=0)
    battery_percent = db.Column(db.Float, default=100)
    status = db.Column(db.String(20), default='正常')

    def to_dict(self):
        return {
            'rangerId': f'HL{self.ranger_id:03d}',
            'timestamp': self.timestamp.strftime('%Y-%m-%d %H:%M:%S') if self.timestamp else '',
            'lat': self.lat,
            'lng': self.lng,
            'speedKmh': self.speed_kmh,
            'batteryPercent': self.battery_percent,
            'status': self.status,
        }


class DroneTrack(db.Model):
    __tablename__ = 'drone_tracks'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    drone_id = db.Column(db.Integer, db.ForeignKey('drones.id'), nullable=False, index=True)
    task_id = db.Column(db.String(50), default='')
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    lat = db.Column(db.Float, nullable=False)
    lng = db.Column(db.Float, nullable=False)
    altitude_m = db.Column(db.Float, default=120)
    heading_deg = db.Column(db.Float, default=0)
    payload_status = db.Column(db.String(20), default='正常')

    def to_dict(self):
        return {
            'droneId': f'UAV{self.drone_id:02d}',
            'taskId': self.task_id,
            'timestamp': self.timestamp.strftime('%Y-%m-%d %H:%M:%S') if self.timestamp else '',
            'lat': self.lat,
            'lng': self.lng,
            'altitudeM': self.altitude_m,
            'headingDeg': self.heading_deg,
            'payloadStatus': self.payload_status,
        }


# ========== 巡护任务与路线 ==========

class PatrolTask(db.Model):
    """巡护任务 — 完整字段"""
    __tablename__ = 'patrol_tasks'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    task_number = db.Column(db.String(20), unique=True, default='')
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(20), default='日常巡护')  # 日常巡护/防火巡护/疫情巡护
    time_start = db.Column(db.String(30), default='')
    time_end = db.Column(db.String(30), default='')
    area = db.Column(db.String(100), default='')
    ranger_id = db.Column(db.Integer, db.ForeignKey('rangers.id'), nullable=True)
    drone_id = db.Column(db.Integer, db.ForeignKey('drones.id'), nullable=True)
    route_geometry = db.Column(db.Text, default='')       # GeoJSON LineString
    actual_track = db.Column(db.Text, default='')          # 实际轨迹
    status = db.Column(db.String(20), default='草稿')       # 草稿/待执行/进行中/已完成
    progress = db.Column(db.Integer, default=0)
    creator = db.Column(db.String(50), default='')
    description = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        ranger = Ranger.query.get(self.ranger_id) if self.ranger_id else None
        drone = Drone.query.get(self.drone_id) if self.drone_id else None
        return {
            'id': f'TASK{self.id:03d}',
            'taskNumber': self.task_number,
            'name': self.name,
            'type': self.type,
            'timeStart': self.time_start,
            'timeEnd': self.time_end,
            'area': self.area,
            'rangerId': self.ranger_id,
            'rangerName': ranger.name if ranger else '',
            'droneId': self.drone_id,
            'droneCode': drone.code if drone else '',
            'routeGeometry': self.route_geometry,
            'actualTrack': self.actual_track,
            'status': self.status,
            'progress': self.progress,
            'creator': self.creator,
            'description': self.description,
            'createdAt': self.created_at.strftime('%Y-%m-%d %H:%M') if self.created_at else '',
        }


# ========== GPS 追踪（护林员手机端每5秒上传） ==========

class GpsTrack(db.Model):
    __tablename__ = 'gps_tracks'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    task_id = db.Column(db.Integer, db.ForeignKey('patrol_tasks.id'), nullable=False, index=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    lat = db.Column(db.Float, nullable=False)
    lng = db.Column(db.Float, nullable=False)
    speed = db.Column(db.Float, default=0)
    accuracy = db.Column(db.Float, default=0)

    def to_dict(self):
        return {
            'lat': self.lat,
            'lng': self.lng,
            'timestamp': self.timestamp.strftime('%Y-%m-%d %H:%M:%S') if self.timestamp else '',
            'speed': self.speed,
        }


class PatrolRoute(db.Model):
    __tablename__ = 'patrol_routes'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False)
    route_type = db.Column(db.String(30), default='')
    length_km = db.Column(db.Float, default=0)
    status = db.Column(db.String(20), default='启用')
    creator = db.Column(db.String(50), default='')
    geometry_json = db.Column(db.Text, default='')  # GeoJSON LineString
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': f'R{self.id:03d}',
            'name': self.name,
            'type': self.route_type,
            'lengthKm': self.length_km,
            'status': self.status,
            'creator': self.creator,
            'geometry': self.geometry_json,
        }


class PatrolLog(db.Model):
    __tablename__ = 'patrol_logs'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    ranger_name = db.Column(db.String(50), default='')
    task_id = db.Column(db.Integer, nullable=True)
    date = db.Column(db.String(20), default='')
    area = db.Column(db.String(100), default='')
    duration_min = db.Column(db.Float, default=0)
    distance_km = db.Column(db.Float, default=0)
    findings = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': f'LOG{self.id:03d}',
            'rangerName': self.ranger_name,
            'taskId': self.task_id,
            'date': self.date,
            'area': self.area,
            'durationMin': self.duration_min,
            'distanceKm': self.distance_km,
            'findings': self.findings,
        }


# ========== 灾害事件 ==========

class FireEvent(db.Model):
    __tablename__ = 'fire_events'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(50), default='')
    lat = db.Column(db.Float, nullable=False)
    lng = db.Column(db.Float, nullable=False)
    risk_level = db.Column(db.String(10), default='中')  # 高 / 中 / 低
    status = db.Column(db.String(20), default='监测中')  # 蔓延中 / 已控制 / 已派发 / 监测中
    temperature_c = db.Column(db.Float, default=0)
    area_mu = db.Column(db.Float, default=0)
    description = db.Column(db.Text, default='')
    image_path = db.Column(db.String(200), default='')
    reported_by = db.Column(db.String(50), default='')
    reported_at = db.Column(db.String(30), default='')

    def to_dict(self):
        return {
            'id': f'F{self.id:03d}',
            'name': self.name,
            'lat': self.lat,
            'lng': self.lng,
            'riskLevel': self.risk_level,
            'status': self.status,
            'temperatureC': self.temperature_c,
            'areaMu': self.area_mu,
            'description': self.description,
            'imagePath': self.image_path,
            'reportedBy': self.reported_by,
            'reportedAt': self.reported_at,
        }


class PestEvent(db.Model):
    __tablename__ = 'pest_events'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(50), default='')
    lat = db.Column(db.Float, nullable=False)
    lng = db.Column(db.Float, nullable=False)
    disease_type = db.Column(db.String(30), default='松材线虫病')
    confidence = db.Column(db.Float, default=0)
    affected_area_mu = db.Column(db.Float, default=0)
    status = db.Column(db.String(20), default='待处理')
    description = db.Column(db.Text, default='')
    image_path = db.Column(db.String(200), default='')
    reported_at = db.Column(db.String(30), default='')

    def to_dict(self):
        return {
            'id': f'P{self.id:03d}',
            'name': self.name,
            'lat': self.lat,
            'lng': self.lng,
            'diseaseType': self.disease_type,
            'confidence': self.confidence,
            'affectedAreaMu': self.affected_area_mu,
            'status': self.status,
            'description': self.description,
            'imagePath': self.image_path,
            'reportedAt': self.reported_at,
        }


class AbnormalEvent(db.Model):
    __tablename__ = 'abnormal_events'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    type = db.Column(db.String(20), default='fire')  # fire / pest / geo / theft
    area = db.Column(db.String(100), default='')
    desc = db.Column(db.Text, default='')
    level = db.Column(db.String(10), default='中')  # 高 / 中 / 低
    time = db.Column(db.String(30), default='')
    status = db.Column(db.String(20), default='处置中')
    handler = db.Column(db.String(50), default='')
    source = db.Column(db.String(100), default='')  # 上报来源（人员/设备）
    measure = db.Column(db.Text, default='')        # 处置措施
    lat = db.Column(db.Float, default=28.510)
    lng = db.Column(db.Float, default=119.910)

    def to_dict(self):
        return {
            'id': f'AE{self.id:03d}',
            'type': self.type,
            'area': self.area,
            'desc': self.desc,
            'level': self.level,
            'time': self.time,
            'status': self.status,
            'handler': self.handler,
            'source': self.source,
            'measure': self.measure,
            'lat': self.lat,
            'lng': self.lng,
        }


class AlertWarning(db.Model):
    __tablename__ = 'alert_warnings'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    type = db.Column(db.String(30), default='')
    level = db.Column(db.String(10), default='中')  # 高 / 中 / 低
    description = db.Column(db.Text, default='')
    related_event_id = db.Column(db.String(50), default='')
    is_handled = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.String(30), default='')

    def to_dict(self):
        return {
            'id': f'W{self.id:03d}',
            'type': self.type,
            'level': self.level,
            'description': self.description,
            'relatedEventId': self.related_event_id,
            'isHandled': self.is_handled,
            'createdAt': self.created_at,
        }


class AiImage(db.Model):
    __tablename__ = 'ai_images'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    image_path = db.Column(db.String(200), default='')
    source_type = db.Column(db.String(20), default='UAV')  # UAV / manual
    detection_type = db.Column(db.String(20), default='fire')  # fire / pest
    confidence = db.Column(db.Float, default=0)
    bbox_json = db.Column(db.Text, default='{}')
    lat = db.Column(db.Float, default=28.467)
    lng = db.Column(db.Float, default=119.922)
    status = db.Column(db.String(20), default='高风险')  # 高风险 / 疑似 / 正常
    created_at = db.Column(db.String(30), default='')

    def to_dict(self):
        return {
            'id': f'IMG{self.id:03d}',
            'imagePath': self.image_path,
            'sourceType': self.source_type,
            'detectionType': self.detection_type,
            'confidence': self.confidence,
            'bboxJson': self.bbox_json,
            'lat': self.lat,
            'lng': self.lng,
            'status': self.status,
            'createdAt': self.created_at,
        }


class SystemLog(db.Model):
    __tablename__ = 'system_logs'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    time = db.Column(db.String(30), default='')
    user = db.Column(db.String(50), default='')
    action = db.Column(db.String(100), default='')
    module = db.Column(db.String(50), default='')
    ip = db.Column(db.String(20), default='')

    def to_dict(self):
        return {
            'time': self.time,
            'user': self.user,
            'action': self.action,
            'module': self.module,
            'ip': self.ip,
        }
