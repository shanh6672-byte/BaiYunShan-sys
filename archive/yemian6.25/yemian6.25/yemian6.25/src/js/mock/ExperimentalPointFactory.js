// ==================== 实验点位统一工厂 ====================
// 文件：src/js/mock/ExperimentalPointFactory.js
// 职责：所有实验点位必须通过此工厂生成，严格保证落在 SHP 边界内部
// 流程：SHP边界 → Turf Polygon → bbox随机候选 → booleanPointInPolygon → 距离过滤 → 输出

var ExperimentalPointFactory = {

    // ---- 生成单个位于多边形内的随机点 ----
    // 参数：polygon — Turf Polygon（[lng, lat] 格式）
    // 返回：{lng, lat} 或 null
    createPointInsidePolygon: function (polygon) {
        var bbox = turf.bbox(polygon); // [minLng, minLat, maxLng, maxLat]
        var minLng = bbox[0], minLat = bbox[1];
        var lngRange = bbox[2] - bbox[0];
        var latRange = bbox[3] - bbox[1];

        for (var tries = 0; tries < 5000; tries++) {
            var lng = minLng + Math.random() * lngRange;
            var lat = minLat + Math.random() * latRange;
            var pt = turf.point([lng, lat]);
            if (turf.booleanPointInPolygon(pt, polygon)) {
                return { lng: lng, lat: lat };
            }
        }
        return null; // 5000次都失败（极端情况）
    },

    // ---- 生成 count 个点，带最小距离约束 ----
    // 参数：
    //   polygon       — Turf Polygon
    //   count         — 需要的点数
    //   minDistanceKm — 最小间距（千米），默认 0
    // 返回：[{lng, lat}, ...]  长度 = count
    createPointsInsidePolygon: function (polygon, count, minDistanceKm) {
        minDistanceKm = minDistanceKm || 0;
        var bbox = turf.bbox(polygon);
        var minLng = bbox[0], minLat = bbox[1];
        var lngRange = bbox[2] - bbox[0];
        var latRange = bbox[3] - bbox[1];

        var points = [];
        var maxTriesPerPoint = 1500;
        var maxGlobalTries = count * 3000;
        var globalTries = 0;

        for (var i = 0; i < count; i++) {
            var accepted = false;
            var tries = 0;

            // 第一轮：严格距离约束
            while (!accepted && tries < maxTriesPerPoint && globalTries < maxGlobalTries) {
                var candidateLng = minLng + Math.random() * lngRange;
                var candidateLat = minLat + Math.random() * latRange;
                var candidatePoint = turf.point([candidateLng, candidateLat]);

                // 必须严格在 SHP 边界内
                if (!turf.booleanPointInPolygon(candidatePoint, polygon)) {
                    tries++;
                    globalTries++;
                    continue;
                }

                // 最小距离检查
                var tooClose = false;
                if (minDistanceKm > 0) {
                    for (var j = 0; j < points.length; j++) {
                        var existingPoint = turf.point([points[j].lng, points[j].lat]);
                        var dist = turf.distance(candidatePoint, existingPoint, { units: 'kilometers' });
                        if (dist < minDistanceKm) {
                            tooClose = true;
                            break;
                        }
                    }
                }

                if (!tooClose) {
                    points.push({ lng: candidateLng, lat: candidateLat });
                    accepted = true;
                }

                tries++;
                globalTries++;
            }

            // 第二轮：放宽距离到 30%
            if (!accepted) {
                for (var rt = 0; rt < 2000 && !accepted; rt++) {
                    var cLng = minLng + Math.random() * lngRange;
                    var cLat = minLat + Math.random() * latRange;
                    var cPt = turf.point([cLng, cLat]);

                    if (!turf.booleanPointInPolygon(cPt, polygon)) continue;

                    var tooCloseRelaxed = false;
                    if (minDistanceKm > 0) {
                        for (var k = 0; k < points.length; k++) {
                            var ePt = turf.point([points[k].lng, points[k].lat]);
                            if (turf.distance(cPt, ePt, { units: 'kilometers' }) < minDistanceKm * 0.3) {
                                tooCloseRelaxed = true;
                                break;
                            }
                        }
                    }
                    if (!tooCloseRelaxed) {
                        points.push({ lng: cLng, lat: cLat });
                        accepted = true;
                    }
                }
            }

            // 第三轮：最终保底，仅要求点在边界内
            if (!accepted) {
                for (var ft = 0; ft < 5000; ft++) {
                    var fLng = minLng + Math.random() * lngRange;
                    var fLat = minLat + Math.random() * latRange;
                    var fPt = turf.point([fLng, fLat]);
                    if (turf.booleanPointInPolygon(fPt, polygon)) {
                        points.push({ lng: fLng, lat: fLat });
                        accepted = true;
                        break;
                    }
                }
            }
        }

        return points;
    }
};
