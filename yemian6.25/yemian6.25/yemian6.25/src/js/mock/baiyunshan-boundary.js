// ==================== 白云山林场 SHP 边界解析器 ====================
// 文件：src/js/mock/baiyunshan-boundary.js
// 职责：加载 baiyunshan(1)/baiyunshan.shp，解析为 GeoJSON，
//       提供 point-in-polygon 判断，供实验数据随机点生成使用
//
// 导出：
//   window.BAIYUNSHAN_BOUNDARY_GEOJSON  — GeoJSON FeatureCollection
//   window.BAIYUNSHAN_BOUNDARY_READY     — Promise，resolve 后 boundary 可用
//   window.baiyunshanPointInPolygon(lat, lng) — 判断点是否在林场内

(function () {
    'use strict';

    // ---- SHP 二进制解析 ----

    function parseShp(buffer) {
        var dv = new DataView(buffer);
        var fileLength = dv.getInt32(24, false) * 2; // big-endian, 16-bit words → bytes
        var shapeType = dv.getInt32(32, true);       // little-endian

        var allPolygons = [];
        var offset = 100; // skip header

        while (offset < fileLength) {
            // Record header (8 bytes)
            var recNum   = dv.getInt32(offset, false);     // big-endian
            var recLen   = dv.getInt32(offset + 4, false) * 2; // 16-bit words → bytes
            offset += 8;

            var recShapeType = dv.getInt32(offset, true);
            offset += 4;

            if (recShapeType === 5) { // Polygon
                var minX = dv.getFloat64(offset, true);      offset += 8;
                var minY = dv.getFloat64(offset, true);      offset += 8;
                var maxX = dv.getFloat64(offset, true);      offset += 8;
                var maxY = dv.getFloat64(offset, true);      offset += 8;
                var numParts  = dv.getInt32(offset, true);   offset += 4;
                var numPoints = dv.getInt32(offset, true);   offset += 4;

                // Part indices
                var parts = [];
                for (var p = 0; p < numParts; p++) {
                    parts.push(dv.getInt32(offset, true));
                    offset += 4;
                }
                parts.push(numPoints); // sentinel

                // Extract each ring
                for (p = 0; p < numParts; p++) {
                    var startIdx = parts[p];
                    var endIdx = parts[p + 1];
                    var ring = [];
                    for (var q = startIdx; q < endIdx; q++) {
                        var px = dv.getFloat64(offset + q * 16, true);
                        var py = dv.getFloat64(offset + q * 16 + 8, true);
                        ring.push([py, px]); // [lat, lng] — Leaflet 格式
                    }
                    allPolygons.push(ring);
                }
                offset += numPoints * 16;
            } else if (recShapeType === 0) { // Null shape
                // skip
            } else {
                // Unknown type, skip this record
                offset = offset - 4 + recLen;
            }
        }

        return allPolygons;
    }

    // ---- 构建 GeoJSON ----
    function buildGeoJSON(polygons) {
        if (polygons.length === 0) return null;

        var features = [];
        // 找出外环（面积最大的为主多边形，其余为洞）
        // 简化处理：所有 ring 都作为独立 Polygon
        for (var i = 0; i < polygons.length; i++) {
            // GeoJSON: [lng, lat]
            var coords = polygons[i].map(function (p) { return [p[1], p[0]]; });
            // 闭合环
            if (coords.length > 0) {
                var first = coords[0], last = coords[coords.length - 1];
                if (first[0] !== last[0] || first[1] !== last[1]) {
                    coords.push([first[0], first[1]]);
                }
            }
            features.push({
                type: 'Feature',
                properties: { name: '白云山林场', ring: i },
                geometry: { type: 'Polygon', coordinates: [coords] }
            });
        }

        return { type: 'FeatureCollection', features: features };
    }

    // ---- 射线法 Point-In-Polygon ----
    function pointInPolygon(lat, lng, rings) {
        for (var r = 0; r < rings.length; r++) {
            var ring = rings[r];
            var inside = false;
            for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                var yi = ring[i][0], xi = ring[i][1]; // ring[i] = [lat, lng]
                var yj = ring[j][0], xj = ring[j][1];
                if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) {
                    inside = !inside;
                }
            }
            if (inside) return true; // 在任意一个环内即返回 true
        }
        return false;
    }

    // ---- 计算边界包围盒 ----
    function computeBounds(rings) {
        var minLat = Infinity, maxLat = -Infinity;
        var minLng = Infinity, maxLng = -Infinity;
        rings.forEach(function (ring) {
            ring.forEach(function (p) {
                if (p[0] < minLat) minLat = p[0];
                if (p[0] > maxLat) maxLat = p[0];
                if (p[1] < minLng) minLng = p[1];
                if (p[1] > maxLng) maxLng = p[1];
            });
        });
        return { minLat: minLat, maxLat: maxLat, minLng: minLng, maxLng: maxLng, rings: rings };
    }

    // ---- 加载 SHP 文件 ----
    function loadShp(url, callback) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = function () {
            if (xhr.status === 200 || xhr.status === 0) {
                callback(null, xhr.response);
            } else {
                callback(new Error('SHP load failed: ' + xhr.status));
            }
        };
        xhr.onerror = function () {
            callback(new Error('SHP XHR error'));
        };
        xhr.send();
    }

    // ---- 公开 API ----
    var _rings = null;
    var _bounds = null;
    var _geoJSON = null;

    window.BAIYUNSHAN_BOUNDARY_READY = new Promise(function (resolve, reject) {
        loadShp('baiyunshan(1)/baiyunshan.shp', function (err, buffer) {
            if (err) {
                console.error('[BaiyunshanBoundary] SHP 加载失败:', err.message);
                reject(err);
                return;
            }
            try {
                _rings = parseShp(buffer);
                _geoJSON = buildGeoJSON(_rings);
                _bounds = computeBounds(_rings);

                window.BAIYUNSHAN_BOUNDARY_GEOJSON = _geoJSON;
                window.BAIYUNSHAN_BOUNDARY_RINGS = _rings;
                window.BAIYUNSHAN_BOUNDARY_BOUNDS = _bounds;

                console.log('[BaiyunshanBoundary] SHP 解析完成');
                console.log('  坐标系: WGS84 (EPSG:4326)');
                console.log('  Polygon/环数: ' + _rings.length);
                console.log('  主环顶点数: ' + (_rings[0] ? _rings[0].length : 0));
                console.log('  包围盒: lat ' + _bounds.minLat.toFixed(4) + '~' + _bounds.maxLat.toFixed(4) +
                            ', lng ' + _bounds.minLng.toFixed(4) + '~' + _bounds.maxLng.toFixed(4));

                resolve(_geoJSON);
            } catch (e) {
                console.error('[BaiyunshanBoundary] 解析失败:', e);
                reject(e);
            }
        });
    });

    // 同步 point-in-polygon（需确保 boundary 已加载）
    window.baiyunshanPointInPolygon = function (lat, lng) {
        if (!_rings) return false;
        return pointInPolygon(lat, lng, _rings);
    };

})();
