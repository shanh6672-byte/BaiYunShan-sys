"""
真实巡护轨迹仿真引擎 v2
- 护林员：沿密集林区道路网络巡护 + GPS漂移 + 重点区域停留
- 无人机：回字形(Boustrophedon)航测覆盖 + 平滑转弯 + 自动返航
"""
import math
import random
from shapely.geometry import Point as ShapelyPoint


# ============================================================
#  白云山林区道路网络（高密度蜿蜒道路）
#  每条约 3-8km，含自然弯曲
# ============================================================

def _curve(start, end, steps, amplitude=0.002, noise=0.0005):
    """生成弯曲道路点列"""
    pts = []
    for i in range(steps + 1):
        frac = i / steps
        lat = start[0] + (end[0] - start[0]) * frac
        lng = start[1] + (end[1] - start[1]) * frac
        # 正弦弯曲
        wave = math.sin(frac * math.pi * random.uniform(1.5, 3.5)) * amplitude
        # 加入随机噪声
        lat += wave * (0.7 + 0.3 * random.random())
        lng += wave * (0.7 + 0.3 * random.random())
        lat += random.uniform(-noise, noise)
        lng += random.uniform(-noise, noise)
        pts.append((round(lat, 6), round(lng, 6)))
    return pts


def _build_winding_main_road():
    """构建蜿蜒主路 (~8km)"""
    segments = [
        (28.498, 119.922), (28.503, 119.918), (28.508, 119.916), (28.514, 119.913),
        (28.520, 119.911), (28.526, 119.909), (28.531, 119.907), (28.536, 119.906),
        (28.541, 119.905), (28.546, 119.904), (28.551, 119.902), (28.556, 119.901),
        (28.560, 119.900), (28.564, 119.899), (28.568, 119.898),
    ]
    pts = []
    for i in range(len(segments) - 1):
        pts.extend(_curve(segments[i], segments[i+1], 12, 0.0015, 0.0003))
    return pts


def _build_branch_roads():
    """构建支路网络"""
    branches = {}
    # 一号林区支路网 (~5km)
    branches['b1'] = _curve((28.505,119.917), (28.510,119.928), 15, 0.002, 0.0004) + \
                     _curve((28.510,119.928), (28.516,119.940), 18, 0.003, 0.0003) + \
                     _curve((28.516,119.940), (28.522,119.950), 12, 0.002, 0.0004)
    # 二号林区支路网 (~4km)
    branches['b2'] = _curve((28.520,119.911), (28.516,119.922), 14, 0.0025, 0.0003) + \
                     _curve((28.516,119.922), (28.510,119.935), 16, 0.003, 0.0004) + \
                     _curve((28.510,119.935), (28.506,119.945), 10, 0.0015, 0.0003)
    # 三号林区支路网 (~5km)
    branches['b3'] = _curve((28.536,119.906), (28.542,119.915), 12, 0.002, 0.0003) + \
                     _curve((28.542,119.915), (28.548,119.928), 16, 0.003, 0.0004) + \
                     _curve((28.548,119.928), (28.552,119.940), 14, 0.002, 0.0003)
    # 四号林区支路网 (~3.5km)
    branches['b4'] = _curve((28.551,119.902), (28.546,119.912), 13, 0.002, 0.0004) + \
                     _curve((28.546,119.912), (28.540,119.925), 15, 0.0025, 0.0003)
    # 五号林区支路网 (~3km)
    branches['b5'] = _curve((28.560,119.900), (28.565,119.890), 11, 0.002, 0.0003) + \
                     _curve((28.565,119.890), (28.570,119.880), 10, 0.0015, 0.0004)
    # 六号林区支路网 (~3km)
    branches['b6'] = _curve((28.542,119.905), (28.535,119.893), 12, 0.0025, 0.0003) + \
                     _curve((28.535,119.893), (28.529,119.882), 14, 0.002, 0.0004)
    # 连接支路：b1↔b2 (~1.5km)
    branches['b12'] = _curve((28.514,119.932), (28.513,119.928), 8, 0.001, 0.0003)
    # 连接支路：b3↔b4 (~1.5km)
    branches['b34'] = _curve((28.546,119.920), (28.543,119.918), 7, 0.001, 0.0003)
    # 连接支路：b5↔主路 (~1km)
    branches['b5r'] = _curve((28.568,119.898), (28.564,119.894), 6, 0.0015, 0.0003)

    return branches


# 支路连接到主路的节点索引
BRANCH_JUNCTIONS = {
    'b1': 2,    # 主路索引2附近 (28.508)
    'b2': 5,    # 主路索引5 (28.526)
    'b3': 8,    # 主路索引8 (28.541)
    'b4': 10,   # 主路索引10 (28.551)
    'b5': 13,   # 主路索引13 (28.564)
    'b6': 9,    # 主路索引9 (28.546)
    'b12': -1,  # 连接支路
    'b34': -1,
    'b5r': -1,
}

# 重点区域（火险区、疫情区）
KEY_AREAS = [
    {'name': '火险高发区A', 'lat': 28.520, 'lng': 119.911, 'radius_m': 500},
    {'name': '火险高发区B', 'lat': 28.545, 'lng': 119.920, 'radius_m': 400},
    {'name': '松材线虫疫区A', 'lat': 28.512, 'lng': 119.936, 'radius_m': 600},
    {'name': '松材线虫疫区B', 'lat': 28.538, 'lng': 119.895, 'radius_m': 350},
    {'name': '重点巡护区C', 'lat': 28.530, 'lng': 119.905, 'radius_m': 450},
]

# 护林员巡护配置
RANGER_CONFIG = {
    'walk_speed_ms': 1.2,       # 正常步行速度 ~4.3 km/h
    'slow_speed_ms': 0.5,       # 重点区域减速 ~1.8 km/h
    'gps_drift_m': 3.0,         # GPS漂移最大值
    'drift_interval_m': 50,     # 每隔多少米加一次漂移
    'stop_min_s': 30,           # 重点区域最短停留
    'stop_max_s': 120,          # 重点区域最长停留
    'branch_probability': 0.3,  # 经过支路连接点时进入支路的概率
    'return_probability': 0.15, # 支路上返回主路的概率
    'update_interval_s': 1.0,   # 轨迹点生成间隔
}

# 无人机航测配置
DRONE_CONFIG = {
    'flight_speed_ms': 12.0,    # 飞行速度 12m/s
    'altitude_m': 120,          # 飞行高度
    'line_spacing_m': 50,       # 航带间距（可配置30/50/100）
    'turn_radius_m': 30,        # 转弯半径
    'update_interval_s': 0.5,   # 位置更新间隔
}


def meters_to_deg(meters, lat):
    """米转经纬度（近似）"""
    lat_rad = math.radians(lat)
    deg_lat = meters / 111320.0
    deg_lng = meters / (111320.0 * math.cos(lat_rad))
    return deg_lat, deg_lng


def distance_m(p1, p2):
    """两点间距离（米）"""
    lat_mid = (p1[0] + p2[0]) / 2
    dlat = (p2[0] - p1[0]) * 111320.0
    dlng = (p2[1] - p1[1]) * 111320.0 * math.cos(math.radians(lat_mid))
    return math.sqrt(dlat**2 + dlng**2)


def bearing_deg(p1, p2):
    """从p1到p2的方位角"""
    lat_mid = (p1[0] + p2[0]) / 2
    dlat = (p2[0] - p1[0]) * 111320.0
    dlng = (p2[1] - p1[1]) * 111320.0 * math.cos(math.radians(lat_mid))
    return (math.degrees(math.atan2(dlng, dlat)) + 360) % 360


def interpolate_path(waypoints, step_m=5.0):
    """将稀疏路点插值为密集连续路径（每step_m米一个点）"""
    dense = []
    for i in range(len(waypoints) - 1):
        p1, p2 = waypoints[i], waypoints[i + 1]
        dist = distance_m(p1, p2)
        steps = max(1, int(dist / step_m))
        for j in range(steps):
            frac = j / steps
            lat = p1[0] + (p2[0] - p1[0]) * frac
            lng = p1[1] + (p2[1] - p1[1]) * frac
            dense.append((round(lat, 6), round(lng, 6)))
    dense.append(waypoints[-1])
    return dense


def add_gps_drift(point, drift_m=3.0):
    """添加GPS漂移噪声（高斯分布，0.5~3m）"""
    # 随机方向和距离（0.5m ~ drift_m）
    angle = random.uniform(0, 2 * math.pi)
    dist = random.gauss(drift_m / 2, drift_m / 4)
    dist = max(0.5, min(drift_m, abs(dist)))
    dlat, dlng = meters_to_deg(dist, point[0])
    return (
        point[0] + dlat * math.cos(angle),
        point[1] + dlng * math.sin(angle),
    )


def is_in_key_area(lat, lng):
    """检查是否在重点区域内"""
    for area in KEY_AREAS:
        dist = distance_m((lat, lng), (area['lat'], area['lng']))
        if dist < area['radius_m']:
            return area
    return None


# ============================================================
#  护林员轨迹生成器
# ============================================================

class RangerTrackGenerator:
    """基于林区SHP边界的护林员巡护轨迹生成器 — 沿预设路线巡护 + GPS漂移 + 边界约束"""

    def __init__(self, route=None, boundary_polygon=None):
        """
        route: [(lat, lng), ...] 巡护路线点列表
        boundary_polygon: shapely Polygon，约束活动范围
        """
        self.config = RANGER_CONFIG
        self.boundary = boundary_polygon  # shapely Polygon or None

        if route and len(route) >= 2:
            self.route = list(route)
        else:
            self.route = _build_winding_main_road()
        self.route = interpolate_path(self.route, step_m=15)

        # 状态
        self.road_index = 0
        self.direction = 1
        self.distance_since_drift = 0
        self.stopping = False
        self.stop_remaining = 0
        self.position = self.route[0]
        self.total_distance = 0
        self.patrol_complete = False

    @staticmethod
    def _nearest_boundary_point(boundary, pt):
        """找到边界上离pt最近的点（兼容Polygon和MultiPolygon）"""
        from shapely.geometry import MultiPolygon
        min_dist = float('inf')
        best = None
        polys = boundary.geoms if isinstance(boundary, MultiPolygon) else [boundary]
        for poly in polys:
            nearest = poly.exterior.interpolate(poly.exterior.project(pt))
            d = pt.distance(nearest)
            if d < min_dist:
                min_dist = d
                best = nearest
        return best

    def _clamp_to_boundary(self, lat, lng):
        """若点在边界外，拉回到边界内最近点"""
        if self.boundary is None:
            return (lat, lng)
        pt = ShapelyPoint(lng, lat)
        if self.boundary.contains(pt):
            return (lat, lng)
        nearest = self._nearest_boundary_point(self.boundary, pt)
        if nearest is None:
            return (lat, lng)
        return (round(nearest.y, 6), round(nearest.x, 6))

    def _get_waypoints(self):
        if self.direction == 1:
            return self.route
        return list(reversed(self.route))
        return False

    def step(self, dt_s=1.0):
        """推进一个时间步长。到达路线终点后反向折返"""
        if self.patrol_complete:
            self.patrol_complete = False
            self.road_index = random.randint(0, min(5, len(self.route) - 2))
            self.direction = 1
            self.position = self.route[self.road_index]

        if self.stopping:
            self.stop_remaining -= dt_s
            if self.stop_remaining <= 0:
                self.stopping = False
            return (*self.position, 0, '停留')

        # 重点区域检查
        area = is_in_key_area(*self.position)
        speed = self.config['slow_speed_ms'] if area else self.config['walk_speed_ms']
        area_name = area['name'] if area else ''
        status = '巡护-' + area_name if area else '巡护中'

        if area and not self.stopping and random.random() < 0.015:
            self.stopping = True
            self.stop_remaining = random.uniform(self.config['stop_min_s'], self.config['stop_max_s'])
            return (*self.position, 0, '停留')

        waypoints = self._get_waypoints()
        if self.road_index >= len(waypoints) - 2:
            self.direction *= -1
            self.road_index = 0

        target = waypoints[min(self.road_index + 1, len(waypoints) - 1)]
        dist = distance_m(self.position, target)
        step_m = speed * dt_s

        if dist < step_m:
            self.position = target
            self.road_index += 1
            self.total_distance += dist
            self.distance_since_drift += dist
        else:
            frac = step_m / dist
            new_lat = self.position[0] + (target[0] - self.position[0]) * frac
            new_lng = self.position[1] + (target[1] - self.position[1]) * frac
            self.position = (new_lat, new_lng)
            self.total_distance += step_m
            self.distance_since_drift += step_m

        # GPS漂移
        drifted = self.position
        if self.distance_since_drift >= self.config['drift_interval_m']:
            drifted = add_gps_drift(self.position, self.config['gps_drift_m'])
            self.distance_since_drift = 0

        # 边界约束：确保位置在林区SHP范围内
        drifted = self._clamp_to_boundary(*drifted)

        # 累计巡护5km以上可完成一轮
        if self.total_distance > random.uniform(3500, 5000):
            self.patrol_complete = True
            status = '完成'

        return (round(drifted[0], 6), round(drifted[1], 6), round(speed, 2), status)


# ============================================================
#  无人机 Boustrophedon 航测轨迹生成器
# ============================================================

class DroneTrackGenerator:
    """回字形(Boustrophedon)航测覆盖轨迹生成器 + SHP边界约束"""

    def __init__(self, area_bounds=None, boundary_polygon=None):
        """
        area_bounds: (lat_min, lng_min, lat_max, lng_max)
        boundary_polygon: shapely Polygon，约束飞行范围
        """
        self.config = DRONE_CONFIG
        self.boundary = boundary_polygon  # shapely Polygon or None
        # 默认：白云山真实边界
        self.bounds = area_bounds or (28.4799, 119.8545, 28.5807, 119.9660)
        self.spacing = self.config['line_spacing_m']
        self.turn_radius = self.config['turn_radius_m']
        self.waypoints = []
        self._generate_flight_lines()
        self.current_idx = 0
        self.current_frac = 0.0
        self.mission_complete = False

    def _generate_flight_lines(self):
        """生成Boustrophedon回字形航线"""
        lat_min, lng_min, lat_max, lng_max = self.bounds

        # 计算最长边确定飞行方向
        lat_span_m = (lat_max - lat_min) * 111320.0
        lng_span_m = (lng_max - lng_min) * 111320.0 * math.cos(math.radians((lat_min + lat_max) / 2))

        if lat_span_m > lng_span_m:
            # 南北向更长 → 东西向航带
            self.flight_axis = 'EW'
            spacing_lat, _ = meters_to_deg(self.spacing, (lat_min + lat_max) / 2)
            num_lines = max(3, int(lat_span_m / self.spacing))
            for i in range(num_lines):
                lat = lat_min + spacing_lat * (i + 0.5)
                if i % 2 == 0:
                    self.waypoints.append((lat, lng_min))
                    self.waypoints.append((lat, lng_max))
                else:
                    self.waypoints.append((lat, lng_max))
                    self.waypoints.append((lat, lng_min))
        else:
            # 东西向更长 → 南北向航带
            self.flight_axis = 'NS'
            spacing_lng, _ = meters_to_deg(self.spacing, (lat_min + lat_max) / 2)
            num_lines = max(3, int(lng_span_m / self.spacing))
            for i in range(num_lines):
                lng = lng_min + spacing_lng * (i + 0.5)
                if i % 2 == 0:
                    self.waypoints.append((lat_min, lng))
                    self.waypoints.append((lat_max, lng))
                else:
                    self.waypoints.append((lat_max, lng))
                    self.waypoints.append((lat_min, lng))

        # 返航点
        home = ((lat_min + lat_max) / 2, (lng_min + lng_max) / 2)
        self.waypoints.append(home)

        # 密集插值 + 转弯平滑
        self._smooth_turns()

    def _smooth_turns(self):
        """在航带端点处添加贝塞尔平滑转弯（避免90°急转）"""
        if len(self.waypoints) < 3:
            return
        smoothed = [self.waypoints[0]]
        for i in range(1, len(self.waypoints) - 1):
            prev = self.waypoints[i - 1]
            curr = self.waypoints[i]
            nxt = self.waypoints[min(i + 1, len(self.waypoints) - 1)]

            # 检测是否为掉头点（方向变化 > 160°）
            b1 = bearing_deg(prev, curr)
            b2 = bearing_deg(curr, nxt)
            if abs(b2 - b1) > 160:
                # 插入转弯弧线（多个中间点）
                turn_pts = self._generate_turn_arc(prev, curr, nxt)
                smoothed.extend(turn_pts)
            else:
                smoothed.append(curr)
        smoothed.append(self.waypoints[-1])
        self.waypoints = smoothed

    def _generate_turn_arc(self, prev, curr, apex, num_pts=6):
        """生成转弯弧线点"""
        pts = []
        for i in range(1, num_pts + 1):
            frac = i / (num_pts + 1)
            lat = curr[0] + (apex[0] - curr[0]) * frac * 0.3
            lng = curr[1] + (apex[1] - curr[1]) * frac * 0.3
            # 向外偏移模拟转弯半径
            offset_lat = math.sin(frac * math.pi) * 0.00015
            offset_lng = math.sin(frac * math.pi) * 0.00015
            pts.append((round(lat + offset_lat, 6), round(lng + offset_lng, 6)))
        return pts

    def step(self, dt_s=0.5):
        """推进一个时间步长"""
        if self.mission_complete:
            wp = self.waypoints[-1]
            return (wp[0], wp[1], 0, 0, '完成')

        if self.current_idx >= len(self.waypoints) - 1:
            self.mission_complete = True
            wp = self.waypoints[-1]
            return (wp[0], wp[1], 0, 0, '完成')

        wp_a = self.waypoints[self.current_idx]
        wp_b = self.waypoints[self.current_idx + 1]
        seg_dist = distance_m(wp_a, wp_b)

        speed = self.config['flight_speed_ms']
        step_frac = (speed * dt_s) / max(seg_dist, 1)
        self.current_frac += step_frac

        if self.current_frac >= 1.0:
            self.current_frac = 0.0
            self.current_idx += 1
            if self.current_idx >= len(self.waypoints) - 1:
                self.mission_complete = True
            wp_a = self.waypoints[min(self.current_idx, len(self.waypoints) - 2)]
            wp_b = self.waypoints[min(self.current_idx + 1, len(self.waypoints) - 1)]

        lat = wp_a[0] + (wp_b[0] - wp_a[0]) * self.current_frac
        lng = wp_a[1] + (wp_b[1] - wp_a[1]) * self.current_frac
        heading = bearing_deg(wp_a, wp_b)

        # 边界约束
        if self.boundary is not None:
            pt = ShapelyPoint(lng, lat)
            if not self.boundary.contains(pt):
                nearest = RangerTrackGenerator._nearest_boundary_point(self.boundary, pt)
                if nearest is not None:
                    lat, lng = round(nearest.y, 6), round(nearest.x, 6)

        return (round(lat, 6), round(lng, 6), round(speed, 2), round(heading, 1), '航测中')
