// ==================== 护林员固定实验数据 ====================
// 18个护林员点位，严格通过 SHP 边界校验 + 最小距离约束

var ForestRangerGenerator = {
    count: 18,
    minDistanceKm: 0.3,  // 300m 最小间距（更集中）

    generate: function (polygon, rings) {
        var NAMES    = ['张建国','李明辉','王大山','陈志强','刘德才','赵文华','孙立军','周国平','吴晓明','郑国栋','钱永强','冯志远','褚建华','蒋卫东','韩晓峰','杨大伟','朱明远','秦海涛'];
        var AREAS    = ['一号林区','一号林区','二号林区','二号林区','二号林区','三号林区','三号林区','三号林区','四号林区','四号林区','四号林区','四号林区','五号林区','五号林区','五号林区','五号林区','五号林区','五号林区'];
        var STATUSES = ['在线','在线','在线','在线','在线','在线','在线','在线','巡护中','巡护中','巡护中','巡护中','巡护中','巡护中','巡护中','离线','离线','离线'];
        var PHONES   = ['13810234567','13820345678','13830456789','13840567890','13850678901','13860789012','13870890123','13880901234','13890012345','13890123456','13801234567','13812345678','13823456789','13834567890','13845678901','13856789012','13867890123','13878901234'];

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
                    id: 'HL' + String(i + 1).padStart(3, '0'),
                    name: NAMES[i],
                    status: STATUSES[i],
                    phone: PHONES[i],
                    patrolArea: AREAS[i]
                }
            });
        }
        return { type: 'FeatureCollection', features: features };
    }
};
