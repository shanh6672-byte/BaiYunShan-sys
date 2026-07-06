"""
种子数据脚本：将 app.js 中的 mock 数据导入 PostgreSQL 数据库
运行方式：cd backend && python -m seed.seed_data
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from config import settings
from services.auth import hash_password

engine = create_engine(settings.DATABASE_URL_SYNC, echo=True)


def seed():
    with engine.connect() as conn:
        # ==================== 用户 ====================
        users = [
            ("admin", hash_password("admin"), "管理员", "admin", "在线"),
            ("zhangjg", hash_password("123456"), "张建国", "ranger", "在线"),
            ("limh", hash_password("123456"), "李明辉", "ranger", "在线"),
            ("wangds", hash_password("123456"), "王大山", "ranger", "在线"),
            ("chenzq", hash_password("123456"), "陈志强", "ranger", "离线"),
            ("liudc", hash_password("123456"), "刘德才", "ranger", "在线"),
            ("guest", hash_password("guest"), "游客", "guest", "在线"),
        ]
        for u in users:
            conn.execute(
                text("INSERT INTO users (username, password_hash, name, role, status) VALUES (:u, :p, :n, :r, :s) ON CONFLICT (username) DO NOTHING"),
                {"u": u[0], "p": u[1], "n": u[2], "r": u[3], "s": u[4]},
            )
        conn.commit()
        print("[OK] 用户数据已插入")

        # ==================== 林区配置 ====================
        conn.execute(
            text("""
                INSERT INTO forest_areas (name, center_lat, center_lng, boundary)
                VALUES (
                    '云山林场', 26.65, 106.73,
                    ST_GeogFromText('POLYGON((106.710 26.668, 106.725 26.665, 106.740 26.668, 106.752 26.662, 106.755 26.650, 106.750 26.638, 106.740 26.630, 106.725 26.628, 106.712 26.632, 106.708 26.640, 106.705 26.652, 106.708 26.662, 106.710 26.668))')
                ) ON CONFLICT DO NOTHING
            """)
        )
        conn.commit()
        print("[OK] 林区配置已插入")

        # ==================== 林班小班 ====================
        compartments = [
            ("一号林区", "一号林区", "#00bcd4", "POLYGON((106.710 26.662, 106.728 26.660, 106.730 26.652, 106.718 26.648, 106.708 26.650, 106.710 26.662))"),
            ("二号林区", "二号林区", "#009688", "POLYGON((106.728 26.660, 106.745 26.662, 106.748 26.650, 106.735 26.648, 106.730 26.652, 106.728 26.660))"),
            ("三号林区", "三号林区", "#00acc1", "POLYGON((106.718 26.648, 106.730 26.652, 106.735 26.648, 106.730 26.638, 106.720 26.635, 106.718 26.648))"),
            ("四号林区", "四号林区", "#26a69a", "POLYGON((106.748 26.650, 106.752 26.662, 106.755 26.650, 106.750 26.638, 106.745 26.640, 106.748 26.650))"),
            ("五号林区", "五号林区", "#00897b", "POLYGON((106.710 26.638, 106.718 26.648, 106.720 26.635, 106.715 26.630, 106.708 26.632, 106.710 26.638))"),
        ]
        for name, area, color, poly in compartments:
            conn.execute(
                text("INSERT INTO compartments (name, area_name, color, geom) VALUES (:n, :a, :c, ST_GeogFromText(:p)) ON CONFLICT DO NOTHING"),
                {"n": name, "a": area, "c": color, "p": poly},
            )
        conn.commit()
        print("[OK] 林班小班已插入")

        # ==================== 护林员 ====================
        rangers = [
            ("HL001", "张建国", "138****1234", "一号林区", "在线", "2.3km/h", "78%", 106.722, 26.655),
            ("HL002", "李明辉", "139****5678", "一号林区", "在线", "1.8km/h", "65%", 106.728, 26.658),
            ("HL003", "王大山", "137****9012", "二号林区", "在线", "3.1km/h", "42%", 106.735, 26.648),
            ("HL004", "陈志强", "136****3456", "二号林区", "离线", "-", "15%", 106.740, 26.660),
            ("HL005", "刘德才", "135****7890", "三号林区", "在线", "2.0km/h", "90%", 106.718, 26.642),
            ("HL006", "赵文华", "134****2345", "三号林区", "在线", "1.5km/h", "88%", 106.720, 26.640),
            ("HL007", "孙立军", "133****6789", "四号林区", "离线", "-", "30%", 106.745, 26.638),
            ("HL008", "周国平", "132****0123", "五号林区", "在线", "2.5km/h", "72%", 106.710, 26.633),
        ]
        for r in rangers:
            conn.execute(
                text("""
                    INSERT INTO rangers (staff_id, name, phone, area_name, status, speed, battery, location)
                    VALUES (:sid, :n, :ph, :a, :s, :sp, :b, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326))
                    ON CONFLICT (staff_id) DO NOTHING
                """),
                {"sid": r[0], "n": r[1], "ph": r[2], "a": r[3], "s": r[4], "sp": r[5], "b": r[6], "lng": r[7], "lat": r[8]},
            )
        conn.commit()
        print("[OK] 护林员数据已插入")

        # ==================== 无人机 ====================
        drones = [
            ("UAV-01", "大疆M300", "120m", "NE", "85%", "巡航中", 128, 106.730, 26.660),
            ("UAV-02", "大疆M300", "100m", "SW", "52%", "巡航中", 96, 106.740, 26.650),
            ("UAV-03", "大疆M350", "150m", "E", "92%", "巡航中", 45, 106.720, 26.645),
            ("UAV-04", "大疆M350", "0m", "N", "15%", "维护中", 210, 106.715, 26.655),
            ("UAV-05", "极飞V40", "0m", "N", "78%", "待命", 67, 106.725, 26.642),
            ("UAV-06", "大疆M30T", "0m", "N", "60%", "待命", 88, 106.735, 26.648),
        ]
        for d in drones:
            conn.execute(
                text("""
                    INSERT INTO drones (name, model, alt, heading, battery, status, flight_hours, location)
                    VALUES (:n, :m, :a, :h, :b, :s, :fh, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326))
                    ON CONFLICT (name) DO NOTHING
                """),
                {"n": d[0], "m": d[1], "a": d[2], "h": d[3], "b": d[4], "s": d[5], "fh": d[6], "lng": d[7], "lat": d[8]},
            )
        conn.commit()
        print("[OK] 无人机数据已插入")

        # ==================== 火情 ====================
        fires = [
            ("F001", "一般", "一号林区", "14:23", "处置中", 106.732, 26.656),
            ("F002", "较大", "三号林区", "15:07", "处置中", 106.718, 26.643),
            ("F003", "一般", "四号林区", "16:35", "已派发", 106.745, 26.641),
        ]
        for f in fires:
            conn.execute(
                text("""
                    INSERT INTO fires (name, level, area_name, report_time, status, location)
                    VALUES (:n, :l, :a, :t, :s, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326))
                    ON CONFLICT DO NOTHING
                """),
                {"n": f[0], "l": f[1], "a": f[2], "t": f[3], "s": f[4], "lng": f[5], "lat": f[6]},
            )
        conn.commit()
        print("[OK] 火情数据已插入")

        # ==================== 火情详情点 ====================
        fire_points = [
            ("F001", "较大", "三号林区", "15:07", "蔓延中", 106.718, 26.643, "东北风 3级", "向西南蔓延", "1.2 km/h", "52亩", "已派遣巡护二队前往处置", "刘德才", "巡护二队6人 + 应急突击队4人"),
            ("F002", "一般", "一号林区", "14:23", "控制中", 106.732, 26.656, "东北风 2级", "向西南缓慢蔓延", "0.5 km/h", "18亩", "护林员张建国现场处置中，火势已基本控制", "张建国", "护林员2人"),
            ("F003", "一般", "四号林区", "16:35", "已派发", 106.745, 26.641, "东风 2级", "向西蔓延", "0.8 km/h", "16亩", "已派发巡护任务，护林员正在赶往现场", "待指派", "待调配"),
        ]
        for fp in fire_points:
            conn.execute(
                text("""
                    INSERT INTO fire_points (fire_name, level, area_name, report_time, status, lng, lat, wind_direction, spread_direction, spread_speed, affected_area, response_plan, commander, forces)
                    VALUES (:fn, :l, :a, :t, :s, :lng, :lat, :wd, :sd, :ss, :aa, :rp, :c, :f)
                    ON CONFLICT DO NOTHING
                """),
                {"fn": fp[0], "l": fp[1], "a": fp[2], "t": fp[3], "s": fp[4], "lng": fp[5], "lat": fp[6],
                 "wd": fp[7], "sd": fp[8], "ss": fp[9], "aa": fp[10], "rp": fp[11], "c": fp[12], "f": fp[13]},
            )
        conn.commit()
        print("[OK] 火情详情已插入")

        # ==================== 虫害 ====================
        pests = [
            ("一号林区", "5.2亩", 106.725, 26.652),
            ("二号林区", "3.8亩", 106.738, 26.648),
            ("三号林区", "8.1亩", 106.715, 26.640),
            ("四号林区", "2.4亩", 106.742, 26.655),
            ("五号林区", "6.5亩", 106.728, 26.637),
            ("一号林区", "1.8亩", 106.720, 26.658),
            ("二号林区", "4.2亩", 106.735, 26.643),
        ]
        for p in pests:
            conn.execute(
                text("""
                    INSERT INTO pests (area_name, area_size, location)
                    VALUES (:a, :s, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326))
                    ON CONFLICT DO NOTHING
                """),
                {"a": p[0], "s": p[1], "lng": p[2], "lat": p[3]},
            )
        conn.commit()
        print("[OK] 虫害数据已插入")

        # ==================== 巡护路线 ====================
        routes = [
            ("RT001", "一号林区日常巡护路线", "巡林员", 12.5, "启用", "张建国",
             "LINESTRING(106.718 26.652, 106.720 26.654, 106.724 26.656, 106.728 26.655)"),
            ("RT002", "二号林区专项巡护路线", "巡林员", 9.8, "启用", "王大山",
             "LINESTRING(106.732 26.648, 106.735 26.650, 106.738 26.646)"),
            ("RT003", "全域无人机巡航路线A", "无人机", 28.3, "启用", "UAV-01",
             "LINESTRING(106.720 26.650, 106.735 26.655, 106.745 26.645, 106.730 26.640, 106.715 26.645, 106.720 26.650)"),
            ("RT004", "三号林区无人机巡检路线", "无人机", 15.6, "停用", "UAV-02",
             "LINESTRING(106.715 26.642, 106.725 26.640, 106.720 26.635, 106.712 26.638, 106.715 26.642)"),
        ]
        for rt in routes:
            conn.execute(
                text("""
                    INSERT INTO patrol_routes (route_code, name, route_type, length_km, status, person, path)
                    VALUES (:rc, :n, :rt, :l, :s, :p, ST_GeogFromText(:path))
                    ON CONFLICT (route_code) DO NOTHING
                """),
                {"rc": rt[0], "n": rt[1], "rt": rt[2], "l": rt[3], "s": rt[4], "p": rt[5], "path": rt[6]},
            )
        conn.commit()
        print("[OK] 巡护路线已插入")

        # ==================== 巡护任务 ====================
        tasks = [
            ("T001", "一号林区日常巡护", "日常巡护", "张建国", None, "一号林区", 75, "执行中"),
            ("T002", "二号林区火情排查", "应急巡护", "李明辉", None, "二号林区", 40, "执行中"),
            ("T003", "三号林区病虫害巡查", "专项巡护", None, "UAV-03", "三号林区", 100, "已完成"),
            ("T004", "四号林区专项巡护", "专项巡护", "王大山", None, "四号林区", 0, "待执行"),
        ]
        for t in tasks:
            conn.execute(
                text("""
                    INSERT INTO patrol_tasks (task_code, name, task_type, assigned_ranger, assigned_drone, area_name, progress, status)
                    VALUES (:tc, :n, :tt, :ar, :ad, :an, :p, :s)
                    ON CONFLICT (task_code) DO NOTHING
                """),
                {"tc": t[0], "n": t[1], "tt": t[2], "ar": t[3], "ad": t[4], "an": t[5], "p": t[6], "s": t[7]},
            )
        conn.commit()
        print("[OK] 巡护任务已插入")

        # ==================== 巡护日志 ====================
        logs = [
            ("06-08", "张建国", "一号林区", 6.5, 18.2, "野外用火1处"),
            ("06-08", "李明辉", "一号林区", 5.0, 14.5, "无异常"),
            ("06-07", "王大山", "二号林区", 7.0, 20.3, "枯死松树3棵"),
        ]
        for log in logs:
            conn.execute(
                text("""
                    INSERT INTO patrol_logs (patrol_date, person, area_name, duration_h, distance_km, findings)
                    VALUES (:d, :p, :a, :dh, :dk, :f)
                    ON CONFLICT DO NOTHING
                """),
                {"d": log[0], "p": log[1], "a": log[2], "dh": log[3], "dk": log[4], "f": log[5]},
            )
        conn.commit()
        print("[OK] 巡护日志已插入")

        # ==================== 异常事件 ====================
        events = [
            ("AE001", "fire", "一号林区", "发现明火", "high", "2026-06-10 14:23", "处置中", "张建国", 106.732, 26.656),
            ("AE002", "pest", "二号林区", "松材线虫病感染", "high", "2026-06-09 10:30", "处置中", "王大山", 106.738, 26.648),
            ("AE003", "fire", "三号林区", "烟雾疑似", "mid", "2026-06-10 15:07", "已派发", "刘德才", 106.718, 26.643),
            ("AE004", "geo", "四号林区", "山体裂缝", "mid", "2026-06-08 09:00", "监控中", "陈志强", 106.745, 26.641),
            ("AE005", "theft", "五号林区", "疑似盗伐痕迹", "low", "2026-06-07 16:20", "已处置", "李明辉", 106.710, 26.633),
        ]
        for ev in events:
            conn.execute(
                text("""
                    INSERT INTO abnormal_events (event_code, event_type, area_name, description, level, report_time, status, handler, location)
                    VALUES (:ec, :et, :an, :d, :l, :rt, :s, :h, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326))
                    ON CONFLICT (event_code) DO NOTHING
                """),
                {"ec": ev[0], "et": ev[1], "an": ev[2], "d": ev[3], "l": ev[4], "rt": ev[5], "s": ev[6], "h": ev[7], "lng": ev[8], "lat": ev[9]},
            )
        conn.commit()
        print("[OK] 异常事件已插入")

        # ==================== 风险预警 ====================
        risks = [
            ("RA001", "一号林区", "森林火灾", "high", 87.5, "近期高温干燥，火险等级极高", "2026-06-10 08:00", "预警中"),
            ("RA002", "三号林区", "松材线虫病", "high", 82.3, "病虫害扩散趋势明显", "2026-06-10 08:00", "预警中"),
            ("RA003", "二号林区", "森林火灾", "high", 79.1, "连续高温预警，火险等级较高", "2026-06-10 08:00", "预警中"),
            ("RA004", "四号林区", "地质灾害", "mid", 65.4, "近期降雨较多，山体滑坡风险", "2026-06-10 08:00", "监控中"),
            ("RA005", "五号林区", "松材线虫病", "mid", 58.7, "发现疑似感染树木", "2026-06-10 08:00", "监控中"),
            ("RA006", "一号林区", "盗伐风险", "mid", 52.3, "偏远区域巡护覆盖不足", "2026-06-10 08:00", "监控中"),
            ("RA007", "二号林区", "地质灾害", "mid", 48.9, "低洼区域积水风险", "2026-06-10 08:00", "监控中"),
            ("RA008", "三号林区", "盗伐风险", "mid", 45.2, "边界区域监控盲区", "2026-06-10 08:00", "监控中"),
            ("RA009", "四号林区", "森林火灾", "low", 32.1, "火险等级一般", "2026-06-10 08:00", "已解除"),
            ("RA010", "五号林区", "地质灾害", "low", 28.5, "风险较低", "2026-06-10 08:00", "已解除"),
        ]
        for r in risks:
            conn.execute(
                text("""
                    INSERT INTO risk_assessments (risk_code, area_name, risk_type, level, score, description, report_time, status)
                    VALUES (:rc, :an, :rt, :l, :sc, :d, :tm, :s)
                    ON CONFLICT (risk_code) DO NOTHING
                """),
                {"rc": r[0], "an": r[1], "rt": r[2], "l": r[3], "sc": r[4], "d": r[5], "tm": r[6], "s": r[7]},
            )
        conn.commit()
        print("[OK] 风险预警已插入")

        # ==================== FVC数据 ====================
        fvc_areas = [
            ("一号林区", 0.72, "中高覆盖", 1850, 920, 380, 150, "稳定"),
            ("二号林区", 0.58, "中覆盖", 1120, 860, 520, 200, "下降"),
            ("三号林区", 0.81, "高覆盖", 2100, 680, 180, 40, "上升"),
            ("四号林区", 0.43, "低覆盖", 680, 540, 860, 120, "下降"),
            ("五号林区", 0.65, "中高覆盖", 1070, 450, 290, 50, "稳定"),
        ]
        for fa in fvc_areas:
            conn.execute(
                text("""
                    INSERT INTO fvc_analysis (name, fvc, level, area_high, area_mid, area_low, area_bare, trend)
                    VALUES (:n, :f, :l, :ah, :am, :al, :ab, :t)
                    ON CONFLICT DO NOTHING
                """),
                {"n": fa[0], "f": fa[1], "l": fa[2], "ah": fa[3], "am": fa[4], "al": fa[5], "ab": fa[6], "t": fa[7]},
            )
        conn.commit()
        print("[OK] FVC数据已插入")

        # FVC退化区域
        degraded = [
            ("二号林区西南部", 0.22, "严重退化", 26.648, 106.738),
            ("四号林区北部", 0.18, "严重退化", 26.656, 106.746),
            ("二号林区东部", 0.35, "中度退化", 26.655, 106.742),
        ]
        for dg in degraded:
            conn.execute(
                text("""
                    INSERT INTO fvc_degraded (area_name, fvc, level, lat, lng)
                    VALUES (:a, :f, :l, :lat, :lng)
                    ON CONFLICT DO NOTHING
                """),
                {"a": dg[0], "f": dg[1], "l": dg[2], "lat": dg[3], "lng": dg[4]},
            )
        conn.commit()
        print("[OK] FVC退化区域已插入")

        # ==================== 系统日志 ====================
        sys_logs = [
            ("2026-06-10 09:15", "管理员", "登录系统", "认证", "192.168.1.100"),
            ("2026-06-10 09:10", "张建国", "上报巡护数据", "巡护管理", "192.168.1.101"),
            ("2026-06-10 08:45", "系统", "自动备份完成", "数据运维", "-"),
            ("2026-06-10 08:30", "李明辉", "查看火情详情", "灾害识别", "192.168.1.102"),
            ("2026-06-10 08:00", "管理员", "修改权限配置", "系统管理", "192.168.1.100"),
            ("2026-06-09 17:30", "陈志强", "退出系统", "认证", "192.168.1.103"),
            ("2026-06-09 17:00", "王大山", "上报异常事件", "巡护管理", "192.168.1.104"),
            ("2026-06-09 16:30", "系统", "风险预警触发", "风险预警", "-"),
        ]
        for sl in sys_logs:
            conn.execute(
                text("""
                    INSERT INTO system_logs (log_time, username, action, module, ip_address)
                    VALUES (:t, :u, :a, :m, :ip)
                    ON CONFLICT DO NOTHING
                """),
                {"t": sl[0], "u": sl[1], "a": sl[2], "m": sl[3], "ip": sl[4]},
            )
        conn.commit()
        print("[OK] 系统日志已插入")

        # ==================== 备份记录 ====================
        backups = [
            ("2026-06-10 03:00", "自动备份", "成功", "2.3 GB"),
            ("2026-06-09 03:00", "自动备份", "成功", "2.2 GB"),
            ("2026-06-08 15:30", "数据导入", "成功", "156 MB"),
            ("2026-06-08 03:00", "自动备份", "成功", "2.2 GB"),
            ("2026-06-07 03:00", "自动备份", "成功", "2.1 GB"),
        ]
        for bk in backups:
            conn.execute(
                text("""
                    INSERT INTO data_backups (backup_time, backup_type, status, size)
                    VALUES (:t, :tp, :s, :sz)
                    ON CONFLICT DO NOTHING
                """),
                {"t": bk[0], "tp": bk[1], "s": bk[2], "sz": bk[3]},
            )
        conn.commit()
        print("[OK] 备份记录已插入")

        # ==================== 图像识别数据（火情） ====================
        fire_images = [
            ("fire", "三号林区", "三号林区火情", "无人机UAV-03", "15:07", "高危 - 明火", "high", "26.643000", "106.718000", "fire"),
            ("fire", "一号林区", "一号林区火情", "护林员张建国", "14:23", "高危 - 明火", "high", "26.656000", "106.732000", "fire"),
            ("fire", "二号林区", "二号林区烟雾", "无人机UAV-01", "13:50", "疑似 - 烟雾", "mid", "26.648000", "106.735000", "smoke"),
            ("fire", "二号林区", "二号林区巡护", "护林员李明辉", "12:15", "正常", "low", "26.660000", "106.740000", "normal"),
            ("fire", "四号林区", "四号林区明火", "无人机UAV-03", "11:30", "高危 - 明火", "high", "26.641000", "106.745000", "fire"),
            ("fire", "一号林区", "一号林区余火", "护林员王大山", "10:45", "疑似 - 余烬", "mid", "26.658000", "106.728000", "smoke"),
            ("fire", "五号林区", "五号林区巡护", "护林员陈志强", "09:50", "正常", "low", "26.635000", "106.750000", "normal"),
            ("fire", "三号林区", "三号林区热源", "无人机UAV-02", "09:10", "疑似 - 热源", "mid", "26.645000", "106.720000", "smoke"),
            ("fire", "一号林区", "一号林区过火", "无人机UAV-01", "08:30", "高危 - 过火区", "high", "26.654000", "106.730000", "fire"),
            ("fire", "四号林区", "四号林区巡护", "护林员刘德才", "08:00", "正常", "low", "26.639000", "106.742000", "normal"),
        ]
        for fi in fire_images:
            conn.execute(
                text("""
                    INSERT INTO image_recognition (recognition_type, area_name, label, source, time, result, level, lat, lng, svg_type)
                    VALUES (:rt, :a, :l, :s, :t, :r, :lv, :lat, :lng, :sv)
                    ON CONFLICT DO NOTHING
                """),
                {"rt": fi[0], "a": fi[1], "l": fi[2], "s": fi[3], "t": fi[4], "r": fi[5], "lv": fi[6], "lat": fi[7], "lng": fi[8], "sv": fi[9]},
            )
        conn.commit()
        print("[OK] 图像识别数据已插入")

        print("\n🎉 所有种子数据导入完成!")


if __name__ == "__main__":
    seed()
