// ==================== 松材线虫病疫情固定实验数据 ====================
// 7个疫情点位，严格通过 SHP 边界校验 + 最小距离约束

var DiseaseEventGenerator = {
    count: 7,
    minDistanceKm: 0.5,  // 500m 最小间距

    generate: function (polygon, rings) {
        var SEVERITIES = ['轻度','中度','重度','轻度','中度','轻度','重度'];
        var TREES      = [15, 42, 8, 23, 67, 12, 55];
        var TIMES      = ['2026-06-25 08:30', '2026-06-24 10:15', '2026-06-24 07:00', '2026-06-23 14:00', '2026-06-23 11:45', '2026-06-22 09:20', '2026-06-21 16:30'];

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
                    id: 'PEST-' + String(i + 1).padStart(3, '0'),
                    infectedTrees: TREES[i],
                    severity: SEVERITIES[i],
                    reportTime: TIMES[i]
                }
            });
        }
        return { type: 'FeatureCollection', features: features };
    }
};
