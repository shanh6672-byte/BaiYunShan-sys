"""
巡护轨迹仿真引擎 v3 — 鱼骨+之字路线
护林员走鱼骨路线，无人机飞之字航线
"""
import math
import random
from routes.patrol_routes import AREAS


def _make_fishbone(cx, cy, w, h, rib_count=4):
    """鱼骨巡护：主干 + 分支"""
    pts = []
    spine_steps = 10
    for i in range(spine_steps + 1):
        t = i / spine_steps
        x = cx - w/2 + w * t
        y = cy
        pts.append([round(y, 6), round(x, 6)])
        if i > 0 and i < spine_steps and i % max(1, spine_steps // rib_count) == 0:
            pts.append([round(cy + h/2 * 0.6, 6), round(x, 6)])
            pts.append([round(cy - h/2 * 0.6, 6), round(x + 0.0005, 6)])
            pts.append([round(cy, 6), round(x + 0.001, 6)])
    return pts


def _make_zigzag(cx, cy, w, h, passes=4):
    """之字覆盖航线"""
    pts = []
    for p in range(passes + 1):
        t = p / passes
        x = cx - w/2 + w * t
        y0 = cy + h/2 * (0.8 if p % 2 == 0 else -0.8)
        y1 = cy + h/2 * (-0.8 if p % 2 == 0 else 0.8)
        pts.append([round(y0, 6), round(x, 6)])
        pts.append([round(y1, 6), round(x, 6)])
    return pts


def _make_perimeter(cx, cy, w, h, steps=20):
    """边界绕行"""
    pts = []
    for i in range(steps):
        t = i / steps
        if t < 0.25:
            x = cx - w/2 + w * 4 * t
            y = cy + h/2
        elif t < 0.5:
            x = cx + w/2
            y = cy + h/2 - h * 4 * (t - 0.25)
        elif t < 0.75:
            x = cx + w/2 - w * 4 * (t - 0.5)
            y = cy - h/2
        else:
            x = cx - w/2
            y = cy - h/2 + h * 4 * (t - 0.75)
        pts.append([round(y, 6), round(x, 6)])
    pts.append(pts[0][:])
    return pts


# 预生成路线
FISHBONE_ROUTES = {}
ZIGZAG_ROUTES = {}
PERIMETER_ROUTES = {}
AREA_NAMES = []

for a in AREAS:
    cy, cx, w, h, name = a
    AREA_NAMES.append(name)
    FISHBONE_ROUTES[name] = _make_fishbone(cx, cy, w, h)
    ZIGZAG_ROUTES[name] = _make_zigzag(cx, cy, w, h)
    PERIMETER_ROUTES[name] = _make_perimeter(cx, cy, w, h)


def meters_to_deg(meters, lat):
    return meters / 111320.0, meters / (111320.0 * math.cos(math.radians(lat)))


def distance_m(p1, p2):
    lat_mid = (p1[0] + p2[0]) / 2
    dlat = (p2[0] - p1[0]) * 111320.0
    dlng = (p2[1] - p1[1]) * 111320.0 * math.cos(math.radians(lat_mid))
    return math.sqrt(dlat*dlat + dlng*dlng)


def bearing_deg(p1, p2):
    dlat = p2[0] - p1[0]
    dlng = p2[1] - p1[1]
    return math.degrees(math.atan2(dlng, dlat)) % 360


# 配置
RANGER_CONFIG = {
    'walk_speed_ms': 1.2,
    'update_interval_s': 1.0,
    'gps_drift_m': 2.0,
}
DRONE_CONFIG = {
    'flight_speed_ms': 12.0,
    'altitude_m': 120,
    'update_interval_s': 0.5,
}


class RangerTrackGenerator:
    """护林员沿鱼骨路线巡护"""
    def __init__(self, ranger_id, area_name=None):
        self.ranger_id = ranger_id
        area_name = area_name or random.choice(AREA_NAMES)
        route = FISHBONE_ROUTES.get(area_name, FISHBONE_ROUTES[AREA_NAMES[0]])
        # 转成 (lat, lng) 元组
        self.waypoints = [(p[0], p[1]) for p in route]
        self.wp_index = 0
        self.progress = 0.0  # 当前段内的进度 0..1
        self.speed = RANGER_CONFIG['walk_speed_ms'] * (0.8 + 0.4 * random.random())
        self.current_pos = self.waypoints[0]

    def tick(self, dt):
        """返回新位置 (lat, lng)，到达终点后循环"""
        if self.wp_index >= len(self.waypoints) - 1:
            self.wp_index = 0
            self.progress = 0.0
            self.current_pos = self.waypoints[0]
            return self.current_pos

        p1 = self.waypoints[self.wp_index]
        p2 = self.waypoints[self.wp_index + 1]
        seg_dist = distance_m(p1, p2)
        step_m = self.speed * dt
        step_frac = step_dist / seg_dist if seg_dist > 0 else 0
        self.progress += step_frac

        if self.progress >= 1.0:
            self.wp_index += 1
            self.progress = 0.0
            self.current_pos = p2
        else:
            self.current_pos = (
                p1[0] + (p2[0] - p1[0]) * self.progress,
                p1[1] + (p2[1] - p1[1]) * self.progress,
            )
        # GPS 漂移
        dlat_m = random.gauss(0, RANGER_CONFIG['gps_drift_m'])
        dlng_m = random.gauss(0, RANGER_CONFIG['gps_drift_m'])
        dlat, dlng = meters_to_deg(max(-5, min(5, dlat_m)), self.current_pos[0])
        return (round(self.current_pos[0] + dlat, 6), round(self.current_pos[1] + dlng, 6))


class DroneTrackGenerator:
    """无人机沿之字航线飞行"""
    def __init__(self, drone_id, area_name=None):
        self.drone_id = drone_id
        area_name = area_name or random.choice(AREA_NAMES)
        route = ZIGZAG_ROUTES.get(area_name, ZIGZAG_ROUTES[AREA_NAMES[0]])
        self.waypoints = [(p[0], p[1]) for p in route]
        self.wp_index = 0
        self.progress = 0.0
        self.speed = DRONE_CONFIG['flight_speed_ms'] * (0.9 + 0.2 * random.random())
        self.current_pos = self.waypoints[0]

    def tick(self, dt):
        if self.wp_index >= len(self.waypoints) - 1:
            self.wp_index = 0
            self.progress = 0.0
            self.current_pos = self.waypoints[0]
            return self.current_pos

        p1 = self.waypoints[self.wp_index]
        p2 = self.waypoints[self.wp_index + 1]
        seg_dist = distance_m(p1, p2)
        step_frac = self.speed * dt / seg_dist if seg_dist > 0 else 0
        self.progress += step_frac

        if self.progress >= 1.0:
            self.wp_index += 1
            self.progress = 0.0
            self.current_pos = p2
        else:
            self.current_pos = (
                p1[0] + (p2[0] - p1[0]) * self.progress,
                p1[1] + (p2[1] - p1[1]) * self.progress,
            )
        dlat_m = random.gauss(0, 1.5)
        dlng_m = random.gauss(0, 1.5)
        dlat, dlng = meters_to_deg(max(-3, min(3, dlat_m)), self.current_pos[0])
        return (round(self.current_pos[0] + dlat, 6), round(self.current_pos[1] + dlng, 6))
