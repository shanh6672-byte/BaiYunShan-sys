// ==================== 林业小班动态生成器 v3 ====================
// 职责：生成8个不重叠不规则小班（面积1.0-2.5 km²，半径0.6-1.0km）
// 策略：随机中心点 → turf.destination 大半径不规则多边形 → 面积/边界/重叠校验

function generateSubcompartments(polygon) {
    var bbox = turf.bbox(polygon);
    var minLng = bbox[0], minLat = bbox[1], maxLng = bbox[2], maxLat = bbox[3];
    var lngSpan = maxLng - minLng, latSpan = maxLat - minLat;

    var propsPool = [
        { subId:'XB-001', forestType:'针叶林', area:'235.6 亩', dominantSpecies:'马尾松', ageGroup:'近熟林', canopyDensity:'0.78', managementUnit:'一号林区' },
        { subId:'XB-002', forestType:'混交林', area:'312.4 亩', dominantSpecies:'杉木',   ageGroup:'成熟林', canopyDensity:'0.82', managementUnit:'一号林区' },
        { subId:'XB-003', forestType:'阔叶林', area:'198.2 亩', dominantSpecies:'青冈',   ageGroup:'中龄林', canopyDensity:'0.65', managementUnit:'二号林区' },
        { subId:'XB-004', forestType:'竹林',   area:'156.8 亩', dominantSpecies:'毛竹',   ageGroup:'中龄林', canopyDensity:'0.72', managementUnit:'二号林区' },
        { subId:'XB-005', forestType:'针叶林', area:'287.3 亩', dominantSpecies:'杉木',   ageGroup:'近熟林', canopyDensity:'0.75', managementUnit:'三号林区' },
        { subId:'XB-006', forestType:'经济林', area:'176.5 亩', dominantSpecies:'油茶',   ageGroup:'幼龄林', canopyDensity:'0.55', managementUnit:'三号林区' },
        { subId:'XB-007', forestType:'混交林', area:'268.9 亩', dominantSpecies:'马尾松', ageGroup:'成熟林', canopyDensity:'0.85', managementUnit:'四号林区' },
        { subId:'XB-008', forestType:'阔叶林', area:'203.7 亩', dominantSpecies:'青冈',   ageGroup:'中龄林', canopyDensity:'0.68', managementUnit:'四号林区' }
    ];

    var TARGET = 8, MAX_RETRIES = 5000;
    var MIN_AREA_KM2 = 1.0, MAX_AREA_KM2 = 2.5;
    var results = [], outOfBounds = 0, overlapCount = 0, retries = 0;
    var minArea = Infinity, maxArea = 0;

    // 检查当前 SHP 面积是否足够
    var shpAreaKm2 = turf.area(polygon) / 1000000;
    var effectiveMaxArea = MAX_AREA_KM2;
    if (shpAreaKm2 < TARGET * MIN_AREA_KM2 * 1.5) {
        console.warn('[ExpLayer] ⚠ 警告：当前 SHP 面积仅 ' + shpAreaKm2.toFixed(2) + ' km²，不足以容纳 8 个 1km² 以上小班');
        effectiveMaxArea = Math.max(MIN_AREA_KM2, shpAreaKm2 / TARGET * 0.7);
        console.warn('[ExpLayer]   自动调整最大面积为 ' + effectiveMaxArea.toFixed(2) + ' km²');
    }

    function randomPointInside() {
        for (var t = 0; t < 5000; t++) {
            var lng = minLng + Math.random() * lngSpan;
            var lat = minLat + Math.random() * latSpan;
            if (turf.booleanPointInPolygon(turf.point([lng, lat]), polygon)) {
                return [lng, lat];
            }
        }
        return null;
    }

    // 以中心点生成不规则多边形（5-8顶点，半径0.6-1.0km）
    function makeIrregularPoly(centerLng, centerLat) {
        var center = turf.point([centerLng, centerLat]);
        var numVerts = 5 + Math.floor(Math.random() * 4); // 5-8
        var baseRadius = 0.6 + Math.random() * 0.4; // 0.6-1.0 km
        var coords = [];

        for (var v = 0; v < numVerts; v++) {
            var baseAngle = (360 / numVerts) * v;
            var bearing = baseAngle + (Math.random() - 0.5) * 50; // ±25° 扰动
            var distKm = baseRadius * (0.75 + Math.random() * 0.5); // 半径 0.75-1.25 倍
            var dest = turf.destination(center, distKm, bearing, { units: 'kilometers' });
            var dc = turf.getCoord(dest);
            coords.push([dc[0], dc[1]]);
        }
        coords.push(coords[0].slice()); // 闭合
        return turf.polygon([coords]);
    }

    // ---- 主循环 ----
    while (results.length < TARGET && retries < MAX_RETRIES) {
        retries++;
        var center = randomPointInside();
        if (!center) continue;

        var subPoly = makeIrregularPoly(center[0], center[1]);
        var ring = turf.getCoords(subPoly)[0];

        // 校验1：完全在边界内
        if (!turf.booleanWithin(subPoly, polygon)) { outOfBounds++; continue; }

        // 校验2：面积在范围内
        var areaM2 = turf.area(subPoly);
        var areaKm2 = areaM2 / 1000000;
        if (areaKm2 < MIN_AREA_KM2 || areaKm2 > effectiveMaxArea) continue;

        // 校验3：不与已有小班重叠
        var overlaps = false;
        for (var k = 0; k < results.length; k++) {
            if (turf.booleanOverlap(subPoly, results[k].poly)) { overlaps = true; overlapCount++; break; }
            var inter = turf.intersect(subPoly, results[k].poly);
            if (inter) {
                var interArea = turf.area(inter) / 1000000;
                if (interArea > 0.01) { overlaps = true; overlapCount++; break; } // > 0.01 km² 视为重叠
            }
        }
        if (overlaps) continue;

        results.push({ poly: subPoly, ring: ring, areaKm2: areaKm2 });
        if (areaKm2 < minArea) minArea = areaKm2;
        if (areaKm2 > maxArea) maxArea = areaKm2;
    }

    var features = [];
    for (var i = 0; i < results.length; i++) {
        features.push({
            type: 'Feature',
            properties: propsPool[i],
            geometry: { type: 'Polygon', coordinates: [results[i].ring] }
        });
    }

    console.log('[ExpLayer] 林业小班目标数量：' + TARGET);
    console.log('[ExpLayer] 林业小班实际数量：' + features.length);
    console.log('[ExpLayer] 林业小班最小面积：' + (features.length > 0 ? minArea.toFixed(3) : 'N/A') + ' km²');
    console.log('[ExpLayer] 林业小班最大面积：' + (features.length > 0 ? maxArea.toFixed(3) : 'N/A') + ' km²');
    console.log('[ExpLayer] 林业小班越界数量：' + outOfBounds);
    console.log('[ExpLayer] 林业小班重叠数量：' + overlapCount);
    console.log('[ExpLayer] 林业小班重试次数：' + retries);

    if (features.length < TARGET) {
        console.warn('[ExpLayer] ⚠ 林业小班未达目标！SHP面积:' + shpAreaKm2.toFixed(2) + ' km²，已重试 ' + retries + ' 次，仅生成 ' + features.length + ' 个');
    }

    return { type: 'FeatureCollection', features: features };
}
