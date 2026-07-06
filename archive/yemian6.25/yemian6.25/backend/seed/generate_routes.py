"""
巡护路径生成脚本 — 为护林员和无人机生成模拟巡护轨迹
运行：python -m seed.generate_routes
"""
import sys, os, random, math
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from config import settings

engine = create_engine(settings.DATABASE_URL_SYNC)

# 白云山中心点
CENTER_LAT, CENTER_LNG = 28.467, 119.922

def generate_walk_path(start_lat, start_lng, steps=60, step_m=30):
    """生成步行路径：带随机偏转的蜿蜒路线"""
    points = [(start_lat, start_lng)]
    lat, lng = start_lat, start_lng
    heading = random.uniform(0, 360)
    for _ in range(steps):
        # 随机偏转 ±30度
        heading += random.uniform(-30, 30)
        heading %= 360
        # 30m步长 → 约 0.00027 度
        d = step_m / 111320.0
        lat += d * math.cos(math.radians(heading))
        lng += d * math.sin(math.radians(heading)) / math.cos(math.radians(lat))
        points.append((round(lat, 6), round(lng, 6)))
    return points

def generate_drone_path(start_lat, start_lng, cols=6, rows=4, spacing_m=400):
    """生成无人机网格巡航路径"""
    points = []
    d_lat = spacing_m / 111320.0
    d_lng = spacing_m / (111320.0 * math.cos(math.radians(start_lat)))
    for row in range(rows):
        lng_offset = d_lng * cols if row % 2 == 1 else 0
        for col in range(cols + 1):
            c = cols - col if row % 2 == 1 else col
            points.append((
                round(start_lat + row * d_lat, 6),
                round(start_lng + c * d_lng, 6)
            ))
    return points

def points_to_wkt(points):
    """转换为 WKT LINESTRING"""
    coords = ', '.join(f'{lng} {lat}' for lat, lng in points)
    return f'LINESTRING({coords})'

def seed():
    with engine.connect() as conn:
        # 先清空旧路线
        conn.execute(text("DELETE FROM patrol_routes"))
        conn.commit()

        # ===== 护林员巡护路线 =====
        ranger_routes = [
            ("HL001", "张建国", "一号林区日常巡护", "巡林员", 6.2, CENTER_LAT + 0.005, CENTER_LNG - 0.004, 80),
            ("HL002", "李明辉", "一号林区补充巡护", "巡林员", 4.8, CENTER_LAT + 0.003, CENTER_LNG + 0.002, 65),
            ("HL003", "王大山", "二号林区巡护路线", "巡林员", 7.5, CENTER_LAT - 0.003, CENTER_LNG + 0.005, 90),
            ("HL005", "刘德才", "三号林区巡护路线", "巡林员", 5.3, CENTER_LAT - 0.005, CENTER_LNG - 0.003, 70),
            ("HL006", "赵文华", "一号林区样地监测", "巡林员", 3.9, CENTER_LAT + 0.006, CENTER_LNG + 0.001, 50),
        ]

        for i, (sid, name, route_name, rtype, length, slat, slng, steps) in enumerate(ranger_routes):
            route_code = f'RT{101+i}'
            points = generate_walk_path(slat, slng, steps=steps, step_m=random.randint(25, 40))
            wkt = points_to_wkt(points)
            conn.execute(
                text("""
                    INSERT INTO patrol_routes (route_code, name, route_type, length_km, status, person, path)
                    VALUES (:rc, :n, :rt, :l, '启用', :p, ST_GeogFromText(:wkt))
                """),
                {"rc": route_code, "n": route_name, "rt": rtype, "l": length, "p": name, "wkt": wkt}
            )

        # ===== 无人机巡航路线 =====
        drone_routes = [
            ("UAV-01", "全域无人机网格巡航A", 28.3, CENTER_LAT, CENTER_LNG - 0.006, 6, 4, 400),
            ("UAV-02", "全域无人机网格巡航B", 22.1, CENTER_LAT + 0.004, CENTER_LNG, 5, 3, 500),
            ("UAV-03", "三号林区无人机巡检", 15.6, CENTER_LAT - 0.004, CENTER_LNG + 0.003, 4, 3, 350),
        ]

        for i, (dname, route_name, length, slat, slng, cols, rows, spacing) in enumerate(drone_routes):
            route_code = f'RT{201+i}'
            points = generate_drone_path(slat, slng, cols=cols, rows=rows, spacing_m=spacing)
            wkt = points_to_wkt(points)
            conn.execute(
                text("""
                    INSERT INTO patrol_routes (route_code, name, route_type, length_km, status, person, path)
                    VALUES (:rc, :n, '无人机', :l, '启用', :p, ST_GeogFromText(:wkt))
                """),
                {"rc": route_code, "n": route_name, "l": length, "p": dname, "wkt": wkt}
            )

        conn.commit()
        result = conn.execute(text("SELECT COUNT(*) FROM patrol_routes"))
        count = result.scalar()
        print(f"[OK] 已生成 {count} 条巡护路线 (5条护林员 + 3条无人机)")

if __name__ == "__main__":
    seed()
