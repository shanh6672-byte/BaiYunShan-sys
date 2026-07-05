// ==================== 巡护轨迹动态生成器 v3 ====================
// 职责：生成5条单向推进巡护路线（不自交、不折返、≤5km）
// 策略：固定主方向 bearing + 小角度扰动 ±35°，turf.destination 逐步延伸

function generatePatrolRoutes(polygon) {
    var bbox = turf.bbox(polygon);

    var propsPool = [
        { routeId:'RT-001', rangerName:'张建国', patrolDate:'2026-06-25', duration:'2.5 小时', status:'已完成' },
        { routeId:'RT-002', rangerName:'李明辉', patrolDate:'2026-06-25', duration:'3.0 小时', status:'已完成' },
        { routeId:'RT-003', rangerName:'王大山', patrolDate:'2026-06-24', duration:'1.8 小时', status:'已完成' },
        { routeId:'RT-004', rangerName:'陈志强', patrolDate:'2026-06-25', duration:'3.5 小时', status:'进行中' },
        { routeId:'RT-005', rangerName:'刘德才', patrolDate:'2026-06-24', duration:'2.2 小时', status:'已完成' }
    ];

    var TARGET = 5, MAX_RETRIES = 5000, MAX_LENGTH_KM = 5.0;
    var outOfBoundsNodes = 0, selfIntersectCount = 0, backtrackCount = 0, totalRetries = 0;
    var maxLength = 0, minEndpointDist = Infinity;

    // ---- 校验函数 ----

    function pointInside(lng, lat) {
        return turf.booleanPointInPolygon(turf.point([lng, lat]), polygon);
    }

    function randomPointInside() {
        for (var t = 0; t < 5000; t++) {
            var lng = bbox[0] + Math.random() * (bbox[2] - bbox[0]);
            var lat = bbox[1] + Math.random() * (bbox[3] - bbox[1]);
            if (pointInside(lng, lat)) return [lng, lat];
        }
        return null;
    }

    // 检查 LineString 是否自相交（非相邻线段）
    function isLineSelfIntersect(coords) {
        // 将坐标转为线段
        var segments = [];
        for (var i = 0; i < coords.length - 1; i++) {
            segments.push([coords[i], coords[i + 1]]);
        }
        // 检查非相邻线段是否相交
        for (var a = 0; a < segments.length; a++) {
            for (var b = a + 2; b < segments.length; b++) {
                // 跳过共享端点的相邻段
                if (b === a + 1) continue;
                if (segmentsIntersect(segments[a][0], segments[a][1], segments[b][0], segments[b][1])) {
                    return true;
                }
            }
        }
        return false;
    }

    // 两条线段是否相交（不含端点接触）
    function segmentsIntersect(a, b, c, d) {
        var d1 = cross(c, d, a), d2 = cross(c, d, b);
        var d3 = cross(a, b, c), d4 = cross(a, b, d);
        if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
            ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
            return true;
        }
        return false;
    }

    function cross(o, a, b) {
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    }

    // 检查路线是否出现折返（连续两段方向差 > 120° 视为折返）
    function isRouteBacktracking(coords) {
        var backtracks = 0;
        for (var i = 1; i < coords.length - 1; i++) {
            var prevBearing = turf.bearing(
                turf.point([coords[i - 1][0], coords[i - 1][1]]),
                turf.point([coords[i][0], coords[i][1]])
            );
            var nextBearing = turf.bearing(
                turf.point([coords[i][0], coords[i][1]]),
                turf.point([coords[i + 1][0], coords[i + 1][1]])
            );
            var diff = Math.abs(nextBearing - prevBearing);
            if (diff > 180) diff = 360 - diff;
            if (diff > 120) backtracks++;
        }
        return backtracks > 0;
    }

    function isRouteInsidePolygon(coords) {
        for (var i = 0; i < coords.length; i++) {
            if (!pointInside(coords[i][0], coords[i][1])) {
                outOfBoundsNodes++;
                return false;
            }
        }
        return true;
    }

    function isRouteEndpointFarEnough(coords, totalLenKm) {
        var start = turf.point([coords[0][0], coords[0][1]]);
        var end = turf.point([coords[coords.length - 1][0], coords[coords.length - 1][1]]);
        var dist = turf.distance(start, end, { units: 'kilometers' });
        return dist >= totalLenKm * 0.5;
    }

    // ---- 生成一条路线 ----
    function generateOneRoute() {
        var start = randomPointInside();
        if (!start) return null;

        var numNodes = 4 + Math.floor(Math.random() * 3); // 4-6
        var mainBearing = Math.random() * 360; // 整条路线的主方向
        var coords = [[start[0], start[1]]];
        var allInside = true;

        for (var i = 1; i < numNodes; i++) {
            var prev = coords[coords.length - 1];
            var prevPt = turf.point([prev[0], prev[1]]);
            var stepKm = 0.4 + Math.random() * 0.6; // 0.4-1.0 km
            var bearing = mainBearing + (Math.random() - 0.5) * 70; // 主方向 ±35°

            var found = false;
            for (var attempt = 0; attempt < 20; attempt++) {
                var dest = turf.destination(prevPt, stepKm, bearing, { units: 'kilometers' });
                var dc = turf.getCoord(dest);
                if (pointInside(dc[0], dc[1])) {
                    coords.push([dc[0], dc[1]]);
                    found = true;
                    break;
                }
                bearing = mainBearing + (Math.random() - 0.5) * 70;
            }
            if (!found) { allInside = false; break; }
        }

        if (coords.length < 4 || !allInside) return null;

        // 全节点边界校验
        if (!isRouteInsidePolygon(coords)) return null;

        // 自相交
        if (isLineSelfIntersect(coords)) { selfIntersectCount++; return null; }

        // 折返
        if (isRouteBacktracking(coords)) { backtrackCount++; return null; }

        // 长度
        var line = turf.lineString(coords);
        var totalLen = turf.length(line, { units: 'kilometers' });
        if (totalLen > MAX_LENGTH_KM) return null;
        if (totalLen < 1.5) return null; // 太短也不行

        // 起终点距离
        if (!isRouteEndpointFarEnough(coords, totalLen)) return null;

        return { coords: coords, length: totalLen };
    }

    // ---- 主循环 ----
    var results = [];
    while (results.length < TARGET && totalRetries < MAX_RETRIES) {
        totalRetries++;
        var route = generateOneRoute();
        if (route) {
            results.push(route);
            if (route.length > maxLength) maxLength = route.length;
            var s = turf.point([route.coords[0][0], route.coords[0][1]]);
            var e = turf.point([route.coords[route.coords.length - 1][0], route.coords[route.coords.length - 1][1]]);
            var epDist = turf.distance(s, e, { units: 'kilometers' });
            if (epDist < minEndpointDist) minEndpointDist = epDist;
        }
    }

    var features = [];
    for (var i = 0; i < results.length; i++) {
        var r = results[i], p = propsPool[i];
        p.distance = r.length.toFixed(1) + ' km';
        features.push({ type:'Feature', properties:p, geometry:{ type:'LineString', coordinates:r.coords } });
    }

    console.log('[ExpLayer] 巡护路线目标数量：' + TARGET);
    console.log('[ExpLayer] 巡护路线实际数量：' + features.length);
    console.log('[ExpLayer] 巡护路线最大长度：' + maxLength.toFixed(2) + ' km');
    console.log('[ExpLayer] 巡护路线最小起终点距离：' + (features.length > 0 ? minEndpointDist.toFixed(2) : 'N/A') + ' km');
    console.log('[ExpLayer] 巡护路线自相交数量：' + selfIntersectCount);
    console.log('[ExpLayer] 巡护路线折返数量：' + backtrackCount);
    console.log('[ExpLayer] 巡护路线越界节点数量：' + outOfBoundsNodes);
    console.log('[ExpLayer] 巡护路线重试次数：' + totalRetries);

    if (features.length < TARGET) {
        console.warn('[ExpLayer] ⚠ 巡护路线未达目标！已重试 ' + totalRetries + ' 次，仅生成 ' + features.length + ' 条');
    }

    return { type: 'FeatureCollection', features: features };
}
