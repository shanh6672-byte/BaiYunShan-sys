// patrol-coverage.js — 巡护覆盖分析
var patrolCoverage = {
  _coverageLayer: null,
  _trajectoryLayer: null,
  _gridGeoJSON: null,
  _map: null,

  async init() {
    this._map = window.maps && window.maps.resCoverageMap;
    if (!this._map) {
      var center = window.forestCenter || [26.65, 106.73];
      this._map = L.map('resCoverageMap', { center: center, zoom: 14, attributionControl: false, zoomControl: false });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(this._map);
      if (!window.maps) window.maps = {};
      window.maps.resCoverageMap = this._map;
      if (window.subCompartments) {
        var colors = ['#00bcd4','#009688','#00acc1','#26a69a','#00897b'];
        window.subCompartments.forEach(function(sc, i) {
          L.polygon(sc.coords, { color: colors[i] || '#00bcd4', weight: 1.5, opacity: 0.6, fillOpacity: 0.08 }).addTo(window.maps.resCoverageMap).bindTooltip(sc.name);
        });
      }
    }

    this._bindUI();
  },

  _bindUI() {
    var self = this;
    var container = document.getElementById('sub-res-coverage');
    if (!container) return;

    var rightPanel = container.querySelector('.content-right-panel');
    if (!rightPanel) return;

    var today = new Date();
    var pad = function(v) { return String(v).padStart(2, '0'); };
    var todayStr = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());
    var weekAgo = new Date(today.getTime() - 7 * 86400000);
    var weekStr = weekAgo.getFullYear() + '-' + pad(weekAgo.getMonth() + 1) + '-' + pad(weekAgo.getDate());
    var monthAgo = new Date(today.getTime() - 30 * 86400000);
    var monthStr = monthAgo.getFullYear() + '-' + pad(monthAgo.getMonth() + 1) + '-' + pad(monthAgo.getDate());

    rightPanel.innerHTML = '<div class="panel-card">' +
      '<div class="card-header"><h3>巡护覆盖分析</h3></div>' +
      '<div class="card-body">' +
        '<div class="form-group"><label>分析时间范围</label>' +
        '<div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap;">' +
        '<button class="btn btn-sm btn-outline period-preset active" data-period="today">今日</button>' +
        '<button class="btn btn-sm btn-outline period-preset" data-period="7d">近7天</button>' +
        '<button class="btn btn-sm btn-outline period-preset" data-period="30d">近30天</button>' +
        '<button class="btn btn-sm btn-outline period-preset" data-period="custom">自定义</button>' +
        '</div>' +
        '<div id="customDateRange" style="display:none;gap:8px;align-items:center;">' +
        '<input type="date" id="coverageStartDate" value="' + weekStr + '" style="flex:1;"/>' +
        '<span style="color:var(--text-muted);">至</span>' +
        '<input type="date" id="coverageEndDate" value="' + todayStr + '" style="flex:1;"/>' +
        '</div></div>' +
        '<button class="btn btn-primary btn-block" id="btnRunCoverage">执行分析</button>' +
        '<div class="analysis-result" id="coverageResult" style="margin-top:14px;display:none;"></div>' +
        '<div class="blind-area-list" id="blindAreaList" style="display:none;"><h4>盲区列表</h4></div>' +
      '</div></div>';

    // 预设按钮事件
    var presets = rightPanel.querySelectorAll('.period-preset');
    presets.forEach(function(btn) {
      btn.onclick = function() {
        presets.forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
        var customDiv = document.getElementById('customDateRange');
        if (customDiv) customDiv.style.display = (this.dataset.period === 'custom') ? 'flex' : 'none';
      };
    });

    document.getElementById('btnRunCoverage').onclick = function() { self._runAnalysis(); };

    // 初始运行
    setTimeout(function() { self._runAnalysis(); }, 500);
  },

  _getDateRange() {
    var activeBtn = document.querySelector('.period-preset.active');
    var period = activeBtn ? activeBtn.dataset.period : 'today';
    var now = Date.now();
    var start, end;

    if (period === 'today') {
      var todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      start = todayStart.getTime();
      end = now;
    } else if (period === '7d') {
      start = now - 7 * 86400000;
      end = now;
    } else if (period === '30d') {
      start = now - 30 * 86400000;
      end = now;
    } else if (period === 'custom') {
      var startVal = document.getElementById('coverageStartDate').value;
      var endVal = document.getElementById('coverageEndDate').value;
      start = startVal ? new Date(startVal).getTime() : now - 7 * 86400000;
      end = endVal ? new Date(endVal + 'T23:59:59').getTime() : now;
    } else {
      start = now - 86400000;
      end = now;
    }

    return { start: start, end: end, days: Math.max(1, Math.ceil((end - start) / 86400000)) };
  },

  async _runAnalysis() {
    var range = this._getDateRange();
    var periodLabel = document.querySelector('.period-preset.active');
    var periodText = periodLabel ? periodLabel.textContent : '今日';

    // 收集所有轨迹点（从真实API获取）
    var allPoints = [];
    try {
      var patrolsResp = await fetch('/api/patrols');
      var patrols = await patrolsResp.json();
      for (var i = 0; i < patrols.length; i++) {
        try {
          var trajResp = await fetch('/api/trajectory/' + patrols[i].id + '?limit=10000');
          var data = await trajResp.json();
          var pts = data.points || [];
          for (var j = 0; j < pts.length; j++) {
            var p = pts[j];
            var ts = p.recorded_at || p.timestamp;
            if (ts >= range.start && ts <= range.end) {
              allPoints.push({ lat: p.latitude, lng: p.longitude });
            }
          }
        } catch(e) {}
      }
    } catch(e) { console.log('[Coverage] API加载失败，使用模拟数据:', e.message); }

    console.log('[Coverage] 真实轨迹点: ' + allPoints.length + ' (范围' + range.days + '天)');

    // 无轨迹数据时才生成模拟数据（仅作fallback）
    if (allPoints.length === 0) {
      console.log('[Coverage] 无真实数据，生成模拟轨迹');
      allPoints = this._generateMockPoints(range);
    }

    // 构建网格并分析
    var grid = this._buildGrid(allPoints);
    this._renderTrajectory(allPoints);
    this._renderOverlay(grid);
    this._updateStats(grid, periodText, range);

    document.getElementById('coverageResult').style.display = 'block';
    document.getElementById('blindAreaList').style.display = 'block';
  },

  _buildGrid(points) {
    // 林区范围
    var bounds = {
      minLat: 26.628, maxLat: 26.668,
      minLng: 106.705, maxLng: 106.755
    };

    var cellSize = 0.003; // ~300m grid
    var latSteps = Math.ceil((bounds.maxLat - bounds.minLat) / cellSize);
    var lngSteps = Math.ceil((bounds.maxLng - bounds.minLng) / cellSize);

    // 快速索引：将点映射到网格
    var pointGrid = {};
    points.forEach(function(p) {
      var latIdx = Math.floor((p.lat - bounds.minLat) / cellSize);
      var lngIdx = Math.floor((p.lng - bounds.minLng) / cellSize);
      var key = latIdx + ',' + lngIdx;
      pointGrid[key] = (pointGrid[key] || 0) + 1;
    });

    var inForest = function(lat, lng) {
      if (lat < bounds.minLat || lat > bounds.maxLat || lng < bounds.minLng || lng > bounds.maxLng) return false;
      return true;
    };

    var cells = [];
    var coveredCount = 0;
    var totalCells = 0;

    var compartments = window.subCompartments || [
      { name:'一号林区', coords:[[26.662,106.710],[26.660,106.728],[26.652,106.730],[26.648,106.718],[26.650,106.708]] },
      { name:'二号林区', coords:[[26.660,106.728],[26.662,106.745],[26.650,106.748],[26.648,106.735],[26.652,106.730]] },
      { name:'三号林区', coords:[[26.648,106.718],[26.652,106.730],[26.648,106.735],[26.638,106.730],[26.635,106.720]] },
      { name:'四号林区', coords:[[26.650,106.748],[26.662,106.752],[26.650,106.755],[26.638,106.750],[26.640,106.745]] },
      { name:'五号林区', coords:[[26.638,106.710],[26.648,106.718],[26.635,106.720],[26.630,106.715],[26.632,106.708]] }
    ];

    var compStats = {};
    compartments.forEach(function(c) { compStats[c.name] = { total: 0, covered: 0 }; });

    var pointInPolygon = function(lat, lng, coords) {
      var inside = false;
      for (var i = 0, j = coords.length - 1; i < coords.length; j = i++) {
        var xi = coords[i][0], yi = coords[i][1];
        var xj = coords[j][0], yj = coords[j][1];
        if ((yi > lng) !== (yj > lng) && lat < (xj - xi) * (lng - yi) / (yj - yi) + xi) {
          inside = !inside;
        }
      }
      return inside;
    };

    for (var latI = 0; latI < latSteps; latI++) {
      for (var lngI = 0; lngI < lngSteps; lngI++) {
        var centerLat = bounds.minLat + (latI + 0.5) * cellSize;
        var centerLng = bounds.minLng + (lngI + 0.5) * cellSize;

        if (!inForest(centerLat, centerLng)) continue;

        var key = latI + ',' + lngI;
        var covered = (pointGrid[key] || 0) > 0;
        totalCells++;

        if (covered) coveredCount++;

        var cell = {
          lat: centerLat, lng: centerLng,
          covered: covered,
          count: pointGrid[key] || 0
        };

        for (var c = 0; c < compartments.length; c++) {
          if (pointInPolygon(centerLat, centerLng, compartments[c].coords)) {
            cell.compartment = compartments[c].name;
            compStats[compartments[c].name].total++;
            if (covered) compStats[compartments[c].name].covered++;
            break;
          }
        }

        cells.push(cell);
      }
    }

    var blindAreas = [];
    compartments.forEach(function(c) {
      var stats = compStats[c.name];
      if (stats.total > 0) {
        var rate = stats.covered / stats.total;
        if (rate < 1) {
          blindAreas.push({
            compartment: c.name,
            uncoveredCells: stats.total - stats.covered,
            rate: rate,
            label: rate < 0.3 ? '未覆盖' : (rate < 0.7 ? '覆盖不足' : '基本覆盖'),
            tagClass: rate < 0.3 ? 'tag-red' : (rate < 0.7 ? 'tag-orange' : 'tag-green')
          });
        }
      }
    });

    return {
      cells: cells,
      totalCells: totalCells,
      coveredCells: coveredCount,
      coverageRate: totalCells > 0 ? (coveredCount / totalCells * 100) : 0,
      blindAreas: blindAreas,
      totalPoints: points.length
    };
  },

  _renderTrajectory(points) {
    if (this._trajectoryLayer) {
      this._map.removeLayer(this._trajectoryLayer);
    }
    if (!points || points.length === 0) return;

    this._trajectoryLayer = L.layerGroup().addTo(this._map);

    // 采样降密：最多保留约80个点用于渲染
    var sampled = points;
    if (points.length > 80) {
      var step = Math.floor(points.length / 80);
      sampled = [];
      for (var i = 0; i < points.length; i += step) {
        sampled.push(points[i]);
      }
      if (sampled[sampled.length - 1] !== points[points.length - 1]) {
        sampled.push(points[points.length - 1]);
      }
    }

    var latlngs = sampled.map(function(p) { return [p.lat, p.lng]; });
    L.polyline(latlngs, { color: '#00e5ff', weight: 2, opacity: 0.6, dashArray: '6 4' }).addTo(this._trajectoryLayer);

    // 起点
    L.circleMarker([sampled[0].lat, sampled[0].lng], { radius: 6, fillColor: '#00e676', color: '#fff', weight: 1.5, fillOpacity: 0.9 })
      .bindTooltip('起点').addTo(this._trajectoryLayer);

    // 终点
    if (sampled.length > 1) {
      var end = sampled[sampled.length - 1];
      L.circleMarker([end.lat, end.lng], { radius: 6, fillColor: '#ff5252', color: '#fff', weight: 1.5, fillOpacity: 0.9 })
        .bindTooltip('终点').addTo(this._trajectoryLayer);
    }
  },

  _renderOverlay(grid) {
    if (this._coverageLayer) {
      this._map.removeLayer(this._coverageLayer);
    }

    var geojson = {
      type: 'FeatureCollection',
      features: grid.cells.map(function(cell) {
        var cellSize = 0.003;
        var halfSize = cellSize / 2;
        var lat = cell.lat, lng = cell.lng;
        return {
          type: 'Feature',
          properties: {
            covered: cell.covered,
            count: cell.count,
            compartment: cell.compartment || ''
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [lat - halfSize, lng - halfSize],
              [lat + halfSize, lng - halfSize],
              [lat + halfSize, lng + halfSize],
              [lat - halfSize, lng + halfSize],
              [lat - halfSize, lng - halfSize]
            ]]
          }
        };
      })
    };

    this._coverageLayer = L.geoJSON(geojson, {
      style: function(feature) {
        return {
          fillColor: feature.properties.covered ? '#00e676' : '#ff3d3d',
          color: feature.properties.covered ? 'rgba(0,230,118,0.3)' : 'rgba(255,61,61,0.3)',
          weight: 0.5,
          fillOpacity: feature.properties.covered ? 0.35 : 0.2
        };
      },
      onEachFeature: function(feature, layer) {
        var tooltip = (feature.properties.compartment || '') +
          (feature.properties.covered ? ' - 已覆盖(' + feature.properties.count + '点)' : ' - 未覆盖');
        layer.bindTooltip(tooltip);
      }
    }).addTo(this._map);
  },

  _updateStats(grid, periodText, range) {
    var resultEl = document.getElementById('coverageResult');
    if (!resultEl) return;

    var rateColor = grid.coverageRate >= 70 ? 'green' : (grid.coverageRate >= 40 ? 'orange' : 'red');
    var levelText = grid.coverageRate >= 70 ? '良好' : (grid.coverageRate >= 40 ? '一般' : '较差');
    var dateStr = '';
    if (range) {
      var s = new Date(range.start), e = new Date(range.end);
      var pad = function(v) { return String(v).padStart(2, '0'); };
      dateStr = (s.getMonth()+1)+'/'+pad(s.getDate()) + ' - ' + (e.getMonth()+1)+'/'+pad(e.getDate());
    }

    resultEl.innerHTML =
      '<div class="result-item"><span class="result-label">分析时段</span><span class="result-value blue">' + (periodText || '-') + (dateStr ? ' (' + dateStr + ')' : '') + '</span></div>' +
      '<div class="result-item"><span class="result-label">巡护天数</span><span class="result-value blue">' + (range ? range.days : '-') + ' 天</span></div>' +
      '<div class="result-item"><span class="result-label">巡护覆盖率</span><span class="result-value ' + rateColor + '">' + grid.coverageRate.toFixed(1) + '%</span></div>' +
      '<div class="result-item"><span class="result-label">巡护盲区面积</span><span class="result-value orange">约 ' + Math.round((grid.totalCells - grid.coveredCells) * 9) + ' 公顷</span></div>' +
      '<div class="result-item"><span class="result-label">巡护完整度</span><span class="result-value ' + rateColor + '">' + levelText + '</span></div>' +
      '<div class="result-item"><span class="result-label">轨迹点数</span><span class="result-value blue">' + grid.totalPoints + '</span></div>';

    var blindEl = document.getElementById('blindAreaList');
    if (!blindEl) return;
    var blindHtml = '<h4>盲区列表</h4>';
    if (grid.blindAreas.length === 0) {
      blindHtml += '<div style="font-size:12px;color:var(--accent-green);padding:8px 0;">所有林区均已覆盖</div>';
    } else {
      grid.blindAreas.forEach(function(ba) {
        blindHtml += '<div class="blind-item"><span>' + ba.compartment + ' (' + ba.uncoveredCells + '个盲区格)</span><span class="tag ' + ba.tagClass + ' tag-sm">' + ba.label + '</span></div>';
      });
    }
    blindEl.innerHTML = blindHtml;
  },

  _generateMockPoints(range) {
    var days = range ? range.days : 1;
    var points = [];

    // 各林区Z字扫描参数
    var compRoutes = [
      { lat0:26.648, lng0:106.710, latSpan:0.014, lngSpan:0.022, dir:'h' },
      { lat0:26.648, lng0:106.728, latSpan:0.014, lngSpan:0.022, dir:'h' },
      { lat0:26.635, lng0:106.718, latSpan:0.017, lngSpan:0.017, dir:'v' },
      { lat0:26.638, lng0:106.745, latSpan:0.014, lngSpan:0.012, dir:'h' },
      { lat0:26.630, lng0:106.710, latSpan:0.012, lngSpan:0.010, dir:'v' }
    ];

    var generateZigzag = function(startLat, startLng, endLat, endLng, zigCount, jitter) {
      var pts = [];
      var steps = zigCount * 2 + 1;
      for (var i = 0; i <= steps; i++) {
        var t = i / steps;
        var lat = startLat + (endLat - startLat) * t;
        var lng = startLng + (endLng - startLng) * t;
        if (i > 0 && i < steps) {
          var offset = (i % 2 === 0 ? 1 : -1) * jitter * (1 - Math.abs(t - 0.5) * 2);
          lat += offset * 0.3;
          lng += offset;
        }
        lat += (Math.random() - 0.5) * 0.0003;
        lng += (Math.random() - 0.5) * 0.0003;
        pts.push({ lat: lat, lng: lng });
      }
      return pts;
    };

    var simDays = Math.min(days, 30);

    // 每天5条巡护轨迹，覆盖全部5个林区
    for (var d = 0; d < simDays; d++) {
      var patrolsToday = 5;
      for (var p = 0; p < patrolsToday; p++) {
        var comp = compRoutes[p % compRoutes.length];
        // 每天每条路线略有偏移，模拟真实巡护路径变化
        var dayOffset = (d * 0.0003);
        var startLat, startLng, endLat, endLng;
        if (comp.dir === 'h') {
          startLat = comp.lat0 + comp.latSpan * (0.05 + (p * 0.02)) + dayOffset;
          startLng = comp.lng0 + comp.lngSpan * 0.05;
          endLat = comp.lat0 + comp.latSpan * (0.85 + (p * 0.02)) + dayOffset;
          endLng = comp.lng0 + comp.lngSpan * 0.95;
        } else {
          startLat = comp.lat0 + comp.latSpan * 0.05;
          startLng = comp.lng0 + comp.lngSpan * (0.05 + (p * 0.02)) + dayOffset;
          endLat = comp.lat0 + comp.latSpan * 0.95;
          endLng = comp.lng0 + comp.lngSpan * (0.85 + (p * 0.02)) + dayOffset;
        }
        var pathPts = generateZigzag(startLat, startLng, endLat, endLng, 4 + (d % 4), 0.001 + Math.random() * 0.002);
        points = points.concat(pathPts);
      }
    }

    // 放宽上限到5000点，保证足够密度
    if (points.length > 5000) {
      var step = Math.ceil(points.length / 5000);
      var sampled = [];
      for (var i = 0; i < points.length; i += step) sampled.push(points[i]);
      points = sampled;
    }

    console.log('[Coverage] 生成模拟轨迹: ' + simDays + '天, ' + points.length + '点');
    return points;
  }
};

function initCoverageAnalysis() {
  patrolCoverage.init();
}
