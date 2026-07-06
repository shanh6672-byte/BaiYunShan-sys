// ==================== 无人机固定实验数据 ====================
// 6个无人机点位，严格通过 SHP 边界校验 + 最小距离约束

var DroneGenerator = {
    count: 6,
    minDistanceKm: 0.8,  // 800m 最小间距

    generate: function (polygon, rings) {
        var MODELS    = ['大疆M300','大疆M350','大疆M30T','极飞V40','大疆Mavic 3E','大疆M300'];
        var STATUSES  = ['巡航中','巡航中','巡航中','待命','巡航中','返航'];
        var ALTITUDES = [120, 150, 100, 80, 200, 110];

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
                    id: 'UAV-' + String(i + 1).padStart(2, '0'),
                    name: 'UAV-' + String(i + 1).padStart(2, '0'),
                    model: MODELS[i],
                    battery: Math.floor(Math.random() * 60 + 30) + '%',
                    status: STATUSES[i],
                    altitude: ALTITUDES[i] + 'm'
                }
            });
        }
        return { type: 'FeatureCollection', features: features };
    }
};
