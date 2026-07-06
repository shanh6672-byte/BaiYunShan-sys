// patrol-replay-player.js — 历史轨迹回放引擎
class PatrolReplayPlayer {
    constructor(mapManager) {
        this.mgr = mapManager;
        this.map = mapManager.map;
        this.trajectory = [];
        this.playing = false;
        this.currentIndex = 0;
        this.speed = 1;
        this.timerId = null;
        this.drawnPoints = [];

        this.onProgress = null;
        this.onComplete = null;
        this.onTimeUpdate = null;
    }

    async load(userId, from, to) {
        this.stop();
        this.trajectory = [];

        // 尝试从真实API获取轨迹数据
        try {
            var patrolsResp = await fetch('/api/patrols');
            var allPatrols = await patrolsResp.json();
            // 查找该用户所属的任务
            var candidatePatrols = [];
            allPatrols.forEach(function(p) {
                if (!p.members) return;
                var isMember = p.members.some(function(m) { return (m.id || m) === userId; });
                if (isMember) candidatePatrols.push(p);
            });

            // 从每个候选任务获取轨迹
            for (var i = 0; i < candidatePatrols.length; i++) {
                var pid = candidatePatrols[i].id;
                var params = '?userId=' + userId;
                if (from) params += '&from=' + from;
                if (to) params += '&to=' + to;
                var trajResp = await fetch('/api/trajectory/' + pid + params);
                var trajData = await trajResp.json();
                if (trajData.points && trajData.points.length > 0) {
                    trajData.points.forEach(function(p) {
                        this.trajectory.push({
                            lat: p.latitude,
                            lng: p.longitude,
                            ts: p.recorded_at,
                            speed: p.speed || 0,
                            accuracy: p.accuracy || 5,
                            heading: p.heading || 0
                        });
                    }.bind(this));
                }
            }
        } catch(e) { console.log('[Replay] API获取失败, fallback到mock:', e.message); }

        // 如果没有真实数据，fallback到mock
        if (this.trajectory.length === 0) {
            this.trajectory = await PatrolApiService.getMockTrajectory(userId, from, to);
        }

        if (this.trajectory.length === 0) return 0;

        this.mgr.addReplayMarkerAndLine(this.trajectory);
        this.currentIndex = 0;
        this.drawnPoints = [this.trajectory[0]];
        this._notifyProgress();
        return this.trajectory.length;
    }

    play() {
        if (this.playing) return;
        if (this.currentIndex >= this.trajectory.length - 1) {
            this.currentIndex = 0;
            this.mgr.updateReplayPosition(0);
        }
        this.playing = true;
        this._animate();
    }

    pause() {
        this.playing = false;
        clearTimeout(this.timerId);
        this.timerId = null;
    }

    stop() {
        this.pause();
        this.currentIndex = 0;
        this.drawnPoints = [];
        this.mgr.clearReplay();
        this._notifyProgress();
    }

    seek(progress) {
        const wasPlaying = this.playing;
        if (wasPlaying) this.pause();
        this.currentIndex = Math.floor((progress / 100) * (this.trajectory.length - 1));
        this.currentIndex = Math.max(0, Math.min(this.currentIndex, this.trajectory.length - 1));
        this.mgr.updateReplayPosition(this.currentIndex);
        this._notifyProgress();
        if (wasPlaying) this.play();
    }

    setSpeed(speed) {
        this.speed = speed;
        if (this.playing) {
            this.pause();
            this.play();
        }
    }

    _animate() {
        if (!this.playing) return;
        const total = this.trajectory.length;
        if (this.currentIndex >= total - 1) {
            this.currentIndex = total - 1;
            this.mgr.updateReplayPosition(this.currentIndex);
            this._notifyProgress();
            this.playing = false;
            if (this.onComplete) this.onComplete();
            return;
        }

        this.currentIndex++;
        this.mgr.updateReplayPosition(this.currentIndex);

        if (this.currentIndex % 5 === 0) {
            this._notifyProgress();
        }

        if (this.currentIndex >= total - 1) {
            this.currentIndex = total - 1;
            this._notifyProgress();
            this.playing = false;
            if (this.onComplete) this.onComplete();
            return;
        }

        let interval = 1000 / this.speed;
        interval = Math.max(50, Math.min(interval, 2000));
        this.timerId = setTimeout(() => this._animate(), interval);
    }

    _notifyProgress() {
        const total = this.trajectory.length;
        if (total === 0) return;
        const progress = (this.currentIndex / (total - 1)) * 100;
        if (this.onProgress) this.onProgress(progress);

        if (this.onTimeUpdate && this.trajectory[this.currentIndex]) {
            const ts = this.trajectory[this.currentIndex].ts;
            this.onTimeUpdate(new Date(ts));
        }
    }
}
