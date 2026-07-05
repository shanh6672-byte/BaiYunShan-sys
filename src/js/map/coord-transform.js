// ==================== 坐标系转换工具 ====================
// 文件：src/js/map/coord-transform.js
// 职责：WGS84 ↔ GCJ-02 坐标转换 + 坐标合法性校验 + 投影坐标自动检测

var CoordTransform = {
    PI: Math.PI,
    A: 6378245.0,
    EE: 0.00669342162296594323,

    // ---- 中国经纬度合法范围 ----
    LNG_MIN: 73,  LNG_MAX: 136,
    LAT_MIN: 3,   LAT_MAX: 54,

    // ---- 丽水白云山范围（用于投影坐标检测） ----
    BAIYUNSHAN: { lngMin: 119.80, lngMax: 120.00, latMin: 28.45, latMax: 28.60 },

    // ---- WGS84 → GCJ-02 ----
    wgs84ToGcj02: function (lng, lat) {
        console.log('[CoordTransform] 入口 WGS84 → GCJ-02: lng=' + lng + ', lat=' + lat);

        // ★ 坐标合法性检查
        if (!this._isValid(lng, lat)) {
            var fixed = this._tryFixProjected(lng, lat);
            if (fixed) {
                console.log('[CoordTransform] 检测到投影坐标，已自动转换: [' + lng + ',' + lat + '] → [' + fixed[0].toFixed(6) + ',' + fixed[1].toFixed(6) + ']');
                lng = fixed[0]; lat = fixed[1];
            } else {
                console.warn('%c[CoordTransform] 坐标超出中国范围，拒绝转换！原始: lng=' + lng + ', lat=' + lat, 'color:red;font-weight:bold');
                return null;  // 返回 null 阻止该实体
            }
        }

        if (this._outOfChina(lng, lat)) {
            console.log('[CoordTransform] 境外坐标，原样返回: [' + lng + ',' + lat + ']');
            return [lng, lat];
        }

        var dLat = this._transformLat(lng - 105.0, lat - 35.0);
        var dLng = this._transformLng(lng - 105.0, lat - 35.0);
        var radLat = lat / 180.0 * this.PI;
        var magic = Math.sin(radLat);
        magic = 1 - this.EE * magic * magic;
        var sqrtMagic = Math.sqrt(magic);
        dLat = (dLat * 180.0) / ((this.A * (1 - this.EE)) / (magic * sqrtMagic) * this.PI);
        dLng = (dLng * 180.0) / (this.A / sqrtMagic * Math.cos(radLat) * this.PI);

        var result = [lng + dLng, lat + dLat];
        console.log('[CoordTransform] 出口 WGS84 → GCJ-02: [' + result[0].toFixed(6) + ',' + result[1].toFixed(6) + ']');
        return result;
    },

    // ---- GCJ-02 → WGS-84 ----
    gcj02ToWgs84: function (lng, lat) {
        if (this._outOfChina(lng, lat)) return [lng, lat];
        var gcj = this.wgs84ToGcj02(lng, lat);
        if (!gcj) return null;
        var dLng = gcj[0] - lng;
        var dLat = gcj[1] - lat;
        return [lng - dLng, lat - dLat];
    },

    // ---- 坐标合法性校验 ----
    _isValid: function (lng, lat) {
        if (typeof lng !== 'number' || typeof lat !== 'number') return false;
        if (isNaN(lng) || isNaN(lat)) return false;
        // 检测明显的投影坐标（值 > 180 或 > 90 说明是米制投影坐标）
        if (Math.abs(lng) > 180 || Math.abs(lat) > 90) return false;
        return true;
    },

    // ---- 尝试修复投影坐标 → WGS84 ----
    // 检测 EPSG:3857 (Web Mercator) 米制坐标并转为度
    _tryFixProjected: function (lng, lat) {
        // Web Mercator 特征：x 约 13000000~13500000，y 约 2800000~3500000
        if (lng > 1000000 && lat > 1000000) {
            // EPSG:3857 Web Mercator → WGS84
            var x = lng;
            var y = lat;
            var R = 6378137.0;
            var fixedLng = x / R * 180.0 / this.PI * this.PI / (180.0 / this.PI);
            // 简化：x / 20037508.34 * 180
            fixedLng = x / 20037508.34 * 180.0;
            // y → lat: atan(sinh(y/R)) in degrees
            var fixedLat = Math.atan(Math.sinh(y / R)) * 180.0 / this.PI;

            // 验证转换结果在合理范围
            if (fixedLng >= this.LNG_MIN && fixedLng <= this.LNG_MAX &&
                fixedLat >= this.LAT_MIN && fixedLat <= this.LAT_MAX) {
                return [fixedLng, fixedLat];
            }
        }
        return null;
    },

    // ---- 判断是否在中国境外 ----
    _outOfChina: function (lng, lat) {
        return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
    },

    // ---- 纬度偏移 ----
    _transformLat: function (x, y) {
        var ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
        ret += (20.0 * Math.sin(6.0 * x * this.PI) + 20.0 * Math.sin(2.0 * x * this.PI)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(y * this.PI) + 40.0 * Math.sin(y / 3.0 * this.PI)) * 2.0 / 3.0;
        ret += (160.0 * Math.sin(y / 12.0 * this.PI) + 320.0 * Math.sin(y * this.PI / 30.0)) * 2.0 / 3.0;
        return ret;
    },

    // ---- 经度偏移 ----
    _transformLng: function (x, y) {
        var ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
        ret += (20.0 * Math.sin(6.0 * x * this.PI) + 20.0 * Math.sin(2.0 * x * this.PI)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(x * this.PI) + 40.0 * Math.sin(x / 3.0 * this.PI)) * 2.0 / 3.0;
        ret += (150.0 * Math.sin(x / 12.0 * this.PI) + 300.0 * Math.sin(x / 30.0 * this.PI)) * 2.0 / 3.0;
        return ret;
    },

    // ---- 批量转换 GeoJSON FeatureCollection（带过滤） ----
    convertFeatureCollection: function (fc) {
        if (!fc || !fc.features) return fc;
        console.log('[CoordTransform] 批量转换开始，共 ' + fc.features.length + ' 个 Feature');
        var self = this;
        var removed = 0;
        fc.features = fc.features.filter(function (f, idx) {
            if (f.geometry && f.geometry.type === 'Point') {
                var coords = f.geometry.coordinates;
                var gcj = self.wgs84ToGcj02(coords[0], coords[1]);
                if (gcj === null) {
                    console.warn('%c[CoordTransform] Feature #' + idx + ' 坐标非法，已移除: [' + coords[0] + ',' + coords[1] + ']', 'color:red');
                    removed++;
                    return false;  // 过滤掉
                }
                f.geometry.coordinates = gcj;
            }
            return true;
        });
        if (removed > 0) {
            console.warn('%c[CoordTransform] 共移除 ' + removed + ' 个非法坐标的 Feature', 'color:red;font-weight:bold');
        }
        console.log('[CoordTransform] 批量转换完成，剩余 ' + fc.features.length + ' 个 Feature');
        return fc;
    }
};
