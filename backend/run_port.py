"""
在指定端口启动白云山森林巡护管理系统
用法: python run_port.py [端口号]
示例: python run_port.py 5052
"""
import sys
import os

# 默认端口 5052，可通过命令行参数指定
port = int(sys.argv[1]) if len(sys.argv) > 1 else 5052

# 导入主 app
from app import app, init_db, start_track_simulator, stop_track_simulator

if __name__ == '__main__':
    print(f'[Init] 原型目录: {os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))}')
    init_db()
    start_track_simulator()
    print(f'[Init] 系统启动完成，访问 http://localhost:{port}')
    try:
        app.run(host='0.0.0.0', port=port, debug=False)
    finally:
        stop_track_simulator()
