class GpsCollector {
  constructor(options) {
    options = options || {};
    this.minAccuracy = options.minAccuracy || 60;
    this.minDistance = options.minDistance || 3;
    this.watchId = null;
    this.pollTimer = null;
    this.lastPosition = null;
    this.lastPointTime = 0;
    this.lastRawTime = 0;
    this.lastRawLat = undefined;
    this.lastRawLng = undefined;
    this.lastEmitTime = 0;
    this.onPosition = null;
    this.onRawPosition = null;
    this.onError = null;
    this.onStatus = null;
    this.onDebug = null;
    this.rawCount = 0;
    this.pollFailCount = 0;
    this._permReported = false;
    this._startTime = 0;
    this._hasFix = false;       // 是否已拿到过位置
    this._useLowAccuracy = false; // 降级到网络定位
    this.maxSpeed = options.maxSpeed || 15;
    this.staleTimeout = options.staleTimeout || 30000;
  }

  start() {
    if (!navigator.geolocation) {
      if (this.onError) this.onError('设备不支持GPS定位');
      return false;
    }

    var self = this;
    this._startTime = Date.now();
    this._hasFix = false;
    this._useLowAccuracy = false;

    // 检查权限状态
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then(function(status) {
        if (self.onDebug) self.onDebug('定位权限: ' + status.state);
        if (status.state === 'denied') {
          if (self.onError) self.onError('定位权限已被拒绝，请在浏览器设置中允许');
        } else if (status.state === 'prompt') {
          if (self.onStatus) self.onStatus('请允许浏览器定位权限请求');
        } else if (status.state === 'granted') {
          if (self.onStatus) self.onStatus('定位权限已授予，等待位置...');
        }
      }).catch(function() {});
    }

    // watchPosition 始终用高精度尝试
    try {
      this.watchId = navigator.geolocation.watchPosition(
        function(pos) { self._onPosition(pos, 'watch'); },
        function(err) { self._onWatchError(err); },
        {
          enableHighAccuracy: true,
          timeout: 60000,
          maximumAge: 5000
        }
      );
      if (self.onDebug) self.onDebug('watchPosition(GPS) 已启动');
    } catch(e) {
      if (self.onDebug) self.onDebug('watchPosition 启动失败: ' + e.message);
    }

    this._doPoll();
    this.pollTimer = setInterval(function() {
      self._doPoll();
    }, 3000);

    return true;
  }

  _doPoll() {
    var self = this;
    // 25秒内没拿到位置 → 降级到网络定位（国内Android Chrome无GMS无法用高精度GPS）
    if (!this._hasFix && !this._useLowAccuracy && Date.now() - this._startTime > 25000) {
      this._useLowAccuracy = true;
      if (this.onStatus) this.onStatus('切换网络定位模式(GPS不可用)...');
      if (this.onDebug) this.onDebug('降级为网络定位(enableHighAccuracy=false)');
    }

    var highAcc = !this._useLowAccuracy;
    try {
      navigator.geolocation.getCurrentPosition(
        function(pos) { self._onPosition(pos, 'poll'); },
        function(err) {
          self.pollFailCount++;
          if (self.onDebug) self.onDebug('poll#' + self.pollFailCount + ': err=' + err.code + ' highAcc=' + highAcc);
          if (err.code === 1 && !self._permReported) {
            self._permReported = true;
            self._onError(err);
          }
        },
        {
          enableHighAccuracy: highAcc,
          timeout: 60000,
          maximumAge: 5000
        }
      );
    } catch(e) {
      if (self.onDebug) self.onDebug('poll异常: ' + e.message);
    }
  }

  stop() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  _onPosition(pos, source) {
    this.rawCount++;
    this._hasFix = true;

    // 拿到位置后如果还在低精度模式，尝试升回高精度
    if (this._useLowAccuracy) {
      this._useLowAccuracy = false;
      if (this.onStatus) this.onStatus('已定位(' + source + ')，恢复GPS模式');
    }

    if (this.lastRawLat !== undefined && this.lastRawTime) {
      var rawDt = (Date.now() - this.lastRawTime) / 1000;
      if (rawDt > 0.2) {
        var rawDist = haversineDistance(
          { latitude: this.lastRawLat, longitude: this.lastRawLng },
          { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
        );
        if (rawDist / rawDt > this.maxSpeed) {
          if (this.onDebug) {
            this.onDebug('速度异常拒绝: ' + (rawDist / rawDt).toFixed(1) + 'm/s');
          }
          return;
        }
      }
    }

    this.lastRawTime = Date.now();
    this.lastRawLat = pos.coords.latitude;
    this.lastRawLng = pos.coords.longitude;

    if (this.onRawPosition) {
      this.onRawPosition({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        acc: pos.coords.accuracy,
        ts: pos.timestamp,
        source: source + (this._useLowAccuracy ? '/net' : '/gps')
      });
    }

    var point = this._filterPoint(pos);
    if (point && this.onPosition) {
      this.onPosition(point);
    }
  }

  _filterPoint(pos) {
    var c = pos.coords;
    var lat = c.latitude;
    var lng = c.longitude;
    var acc = c.accuracy;
    var ts = pos.timestamp || Date.now();

    if (acc > this.minAccuracy) return null;

    if (this.lastPointTime && ts - this.lastPointTime < 1000) return null;

    if (this.lastPosition && this.minDistance > 0) {
      var dist = haversineDistance(this.lastPosition, { latitude: lat, longitude: lng });
      if (dist < this.minDistance) {
        if (!this.lastEmitTime || Date.now() - this.lastEmitTime < this.staleTimeout) {
          return null;
        }
      }
    }

    this.lastPosition = { latitude: lat, longitude: lng };
    this.lastPointTime = ts;
    this.lastEmitTime = Date.now();

    return {
      latitude: Math.round(lat * 1000000) / 1000000,
      longitude: Math.round(lng * 1000000) / 1000000,
      accuracy: Math.round(acc * 10) / 10,
      altitude: c.altitude != null ? Math.round(c.altitude * 10) / 10 : null,
      altitudeAccuracy: c.altitudeAccuracy != null ? Math.round(c.altitudeAccuracy * 10) / 10 : null,
      speed: c.speed != null ? Math.round(c.speed * 100) / 100 : null,
      heading: c.heading != null ? Math.round(c.heading * 10) / 10 : null,
      recorded_at: ts
    };
  }

  _onWatchError(err) {
    if (this.onDebug) this.onDebug('watch错误: code=' + err.code);
    if (err.code === 1 && !this._permReported) {
      this._permReported = true;
      this._onError(err);
    }
  }

  _onError(err) {
    var msg;
    switch(err.code) {
      case 1: msg = '定位权限未授予，请在手机设置中允许Chrome访问位置'; break;
      case 2: msg = '获取位置失败(信号差?)'; break;
      case 3: msg = '定位超时'; break;
      default: msg = 'GPS错误: ' + (err.message || '');
    }
    if (this.onError) this.onError(msg);
  }
}
