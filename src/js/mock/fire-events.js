// ==================== 火情固定实验数据 ====================
// 3个火情点位，严格通过 SHP 边界校验 + 最小距离约束

var FireEventGenerator = {
    count: 3,
    minDistanceKm: 2.0,  // 2000m 最小间距

    generate: function (polygon, rings) {
        var LEVELS       = ['Ⅰ级', 'Ⅱ级', 'Ⅲ级'];
        var TEMPERATURES = [62.1, 48.3, 35.7];
        var TIMES        = ['2026-06-25 15:20', '2026-06-25 11:05', '2026-06-24 08:30'];

        var points = ExperimentalPointFactory.createPointsInsidePolygon(
            polygon, this.count, this.minDistanceKm
        );

        var features = [];
        for (var i = 0; i < this.count; i++) {
            var pt = points[i];
            features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [pt.lng, pt.lat] },
                properties: {
                    id: 'FIRE-' + String(i + 1).padStart(3, '0'),
                    level: LEVELS[i],
                    temperature: TEMPERATURES[i] + '°C',
                    reportTime: TIMES[i]
                }
            });
        }
        return { type: 'FeatureCollection', features: features };
    }
};
