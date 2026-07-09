// ==================== 历史轨迹查询与回放 ====================

const TrackPlayback = {
    // 当前轨迹数据
    _rangerTracks: [],
    _droneTracks: [],
    // 播放状态
    _playing: false,
    _playIndex: 0,
    _playSpeed: 1,
    _playTimer: null,
    _playMarker: null,
    _playPolyline: null,
    _playType: null,  // 'ranger' | 'drone'

    /**
     * 获取轨迹回放面板DOM引用
     */
    _getPanel() {
        return document.getElementById('inner-history');
    },

    // 已缓存的护林员/无人机数据（避免重复请求）
    _rangerCache: null,
    _droneCache: null,

    /**
     * 绑定实时巡护面板中"轨迹"/"航线"按钮的点击事件
     * 点击后自动飞地图到该实体当前位置
     */
    _bindRealtimeButtons() {
        // 使用document委托，因为面板内容可能动态渲染
        document.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const text = btn.textContent.trim();

            // 是"轨迹"或"航线"按钮，且在实时面板中
            const isTrackBtn = text === '轨迹';
            const isRouteBtn = text === '航线';
            if (!isTrackBtn && !isRouteBtn) return;

            const card = btn.closest('.rt-person-item');
            if (!card) return;

            // 从卡片中提取名称
            const nameEl = card.querySelector('.rt-name');
            if (!nameEl) return;
            const name = nameEl.childNodes[0]?.textContent?.trim() || '';
            if (!name) return;

            e.preventDefault();
            e.stopPropagation();

            try {
                if (isTrackBtn) {
                    await this._flyToRanger(name);
                } else {
                    await this._flyToDrone(name);
                }
            } catch (err) {
                console.warn('[TrackPlayback] 定位失败:', err);
            }
        });
    },

    /**
     * 从地图上 ExperimentalLayerManager 的 marker 读取坐标并跳转
     */
    _findMapMarker(name, isDrone) {
        const map = MapFacade.getMap();
        if (!map) return null;
        let found = null;
        map.eachLayer(layer => {
            if (found || !layer.getLatLng) return;
            const tooltip = layer.getTooltip();
            const ttContent = tooltip && tooltip.getContent ? tooltip.getContent() : '';
            // ExperimentalLayerManager 的护林员 tooltip 是人名，无人机是 UAV-xx
            if (ttContent === name) {
                const ll = layer.getLatLng();
                found = { lat: ll.lat, lng: ll.lng };
            }
        });
        return found;
    },

    /**
     * 飞地图到护林员在地图上的真实标记位置
     */
    async _flyToRanger(name) {
        // 优先从地图标记取位置（ExperimentalLayerManager 的真实SHP坐标）
        const mapPos = this._findMapMarker(name, false);
        if (mapPos) {
            this._flyMapTo(mapPos.lat, mapPos.lng, 16, name);
            return;
        }
        // 降级：从API取
        if (!this._rangerCache) this._rangerCache = await ApiService.getRangers();
        const ranger = (this._rangerCache || []).find(r => r.name === name);
        if (ranger) {
            this._flyMapTo(ranger.lat, ranger.lng, 16, ranger.name);
        }
    },

    /**
     * 飞地图到无人机在地图上的真实标记位置
     */
    async _flyToDrone(name) {
        const mapPos = this._findMapMarker(name, true);
        if (mapPos) {
            this._flyMapTo(mapPos.lat, mapPos.lng, 16, name);
            return;
        }
        if (!this._droneCache) this._droneCache = await ApiService.getDrones();
        const drone = (this._droneCache || []).find(d => d.code === name);
        if (drone) {
            this._flyMapTo(drone.lat, drone.lng, 16, drone.code);
        }
    },

    /**
     * 执行地图飞行定位
     */
    _flyMapTo(lat, lng, zoom, label) {
        const map = MapFacade.getMap();
        if (map && typeof L !== 'undefined') {
            map.flyTo([lat, lng], zoom || 16, { duration: 1.2 });
            // 短暂显示一个脉冲圆标记
            const pulseIcon = L.divIcon({
                html: '<div style="width:24px;height:24px;border:3px solid #ffeb3b;border-radius:50%;background:rgba(255,235,59,0.2);animation:pulse 0.6s ease-out 3;"></div>',
                className: '', iconSize: [24, 24], iconAnchor: [12, 12]
            });
            const pulse = L.marker([lat, lng], { icon: pulseIcon, zIndexOffset: 2000 }).addTo(map);
            setTimeout(() => map.removeLayer(pulse), 2000);
            console.log('[TrackPlayback] 定位到 ' + label + ': ' + lat.toFixed(5) + ', ' + lng.toFixed(5));
        }
    },

    _initialized: false,

    /**
     * 初始化：加载人员/无人机下拉列表，绑定事件
     */
    async init() {
        if (this._initialized) { this._bindEvents(); return; }

        if (typeof currentUser === 'undefined' || !currentUser) {
            setTimeout(() => this.init(), 500);
            return;
        }

        // 绑定实时面板的"轨迹"/"航线"按钮（直接飞地图定位）
        this._bindRealtimeButtons();

        // 检查轨迹回放面板是否已渲染
        const panel = this._getPanel();
        if (!panel || !panel.querySelector('select')) {
            setTimeout(() => this.init(), 1000);
            return;
        }

        try {
            const rangers = await ApiService.getRangers();
            const selects = panel.querySelectorAll('select.select-full');
            if (selects[0] && rangers.length) {
                selects[0].innerHTML = '';
                rangers.forEach(r => {
                    const opt = document.createElement('option');
                    opt.value = r.id;
                    opt.textContent = r.name;
                    selects[0].appendChild(opt);
                });
            }

            const drones = await ApiService.getDrones();
            if (selects[1] && drones.length) {
                selects[1].innerHTML = '';
                drones.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.id;
                    opt.textContent = d.code;
                    selects[1].appendChild(opt);
                });
            }
        } catch (e) {
            console.warn('[TrackPlayback] 加载列表失败', e);
        }

        this._bindEvents();
        this._initialized = true;
        console.log('[TrackPlayback] 初始化完成');
    },

    /**
     * 绑定事件（使用事件委托，因为面板可能在DOM中但按钮需要查找）
     */
    _bindEvents() {
        // 使用document级委托确保总是能捕获到点击
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const text = btn.textContent.trim();

            if (text.includes('人员轨迹') || text.includes('查询人员')) {
                e.preventDefault();
                this._queryRangerTracks();
            } else if (text.includes('无人机轨迹') || text.includes('查询无人机')) {
                e.preventDefault();
                this._queryDroneTracks();
            } else if (text.includes('播放')) {
                this._startPlayback();
            } else if (text.includes('⏮')) {
                this._stepPrev();
            } else if (text.includes('⏭')) {
                this._stepNext();
            }
        });

        // change事件委托：速度选择器
        document.addEventListener('change', (e) => {
            if (e.target.tagName === 'SELECT' && e.target.closest('.playback-controls')) {
                this._playSpeed = parseFloat(e.target.value) || 1;
            }
        });
    },

    // 每日颜色
    _dayColors: ['#00e676', '#00d5ff', '#ffab00', '#ff6e40', '#b388ff', '#4fc3f7'],

    /**
     * 查询人员历史轨迹 — 按日期分色渲染
     */
    async _queryRangerTracks() {
        const panel = this._getPanel();
        if (!panel) return;

        const selects = panel.querySelectorAll('select.select-full');
        const rangerId = selects[0]?.value || 'HL001';
        const numId = parseInt(String(rangerId).replace(/\D/g, '')) || 1;

        // 读取日期范围
        const dateInputs = panel.querySelectorAll('input[type="date"]');
        const startDate = dateInputs[0]?.value || '2026-06-28';
        const endDate = dateInputs[1]?.value || '2026-07-03';

        try {
            console.log('[TrackPlayback] 正在查询护林员轨迹...');
            const tracks = await ApiService.getRangerTracks(numId, '', '');
            console.log(`[TrackPlayback] 已获取 ${tracks.length} 条轨迹，开始渲染...`);
            this._rangerTracks = tracks || [];
            this._playType = 'ranger';
            this._playIndex = 0;

            this._drawMultiDayTracks(tracks || [], startDate, endDate, 'ranger');
        } catch (e) {
            console.error('[TrackPlayback] 查询失败:', e);
            alert('查询轨迹失败: ' + e.message);
        }
    },

    async _queryDroneTracks() {
        const panel = this._getPanel();
        if (!panel) return;

        const selects = panel.querySelectorAll('select.select-full');
        const droneId = selects[1]?.value || 'UAV01';
        const numId = parseInt(String(droneId).replace(/\D/g, '')) || 1;

        const dateInputs = panel.querySelectorAll('input[type="date"]');
        const startDate = dateInputs[2]?.value || '2026-06-28';
        const endDate = dateInputs[3]?.value || '2026-07-03';

        try {
            const tracks = await ApiService.getDroneTracks(numId, '', '');
            this._droneTracks = tracks || [];
            this._playType = 'drone';
            this._playIndex = 0;

            this._drawMultiDayTracks(tracks || [], startDate, endDate, 'drone');
        } catch (e) {
            console.error('[TrackPlayback] 查询失败:', e);
            alert('查询轨迹失败: ' + e.message);
        }
    },

    /**
     * 按日期分组绘制多日轨迹，每天不同颜色
     */
    _drawMultiDayTracks(tracks, startDate, endDate, entityType) {
        if (!tracks || tracks.length < 2) { console.warn('[TrackPlayback] 无轨迹数据'); return; }

        // 清除旧轨迹
        this._clearPlaybackMarker();
        if (this._multiLines) { this._multiLines.forEach(l => { try { MapFacade.removeLayer(l); } catch(e){} }); }
        this._multiLines = [];
        if (this._legend) { try { MapFacade.getMap().removeControl(this._legend); } catch(e){} }

        // 优先resRealtimeMap，降级dashMap
        const map = MapFacade.getMap('resRealtimeMap') || MapFacade.getMap('dashMap') || MapFacade.getMap();
        console.log('[TrackPlayback] 目标地图:', map ? (map._container?.id || 'unknown') : 'NULL');
        if (!map || typeof L === 'undefined') { console.error('[TrackPlayback] 地图或Leaflet不可用'); return; }
        map.invalidateSize();

        // 创建顶层Pane确保轨迹不被其他图层遮挡
        if (!map._trackPane) {
            map.createPane('trackPane');
            map.getPane('trackPane').style.zIndex = '650';
            map.getPane('trackPane').style.pointerEvents = 'none';
        }

        // 按日期分组
        const groups = {};
        tracks.forEach(t => {
            const day = (t.timestamp || '').slice(0, 10);
            if (!day) return;
            if (startDate && day < startDate) return;
            if (endDate && day > endDate) return;
            if (!groups[day]) groups[day] = [];
            groups[day].push([t.lat, t.lng]);
        });

        const days = Object.keys(groups).sort();
        console.log('[TrackPlayback] 日期:', days.join(', '), '| 点数:', days.map(d=>groups[d].length).join(','));
        if (days.length === 0) { console.warn('[TrackPlayback] 日期范围内无数据'); return; }

        try {
            // 每天一条彩色轨迹线
            days.forEach((day, i) => {
                const coords = groups[day];
                if (coords.length < 2) return;
                const color = this._dayColors[i % this._dayColors.length];
                const line = L.polyline(coords, { color, weight: 5, opacity: 0.95, pane: 'trackPane' }).addTo(map);
                this._multiLines.push(line);
                console.log(`[TrackPlayback] ${day}: ${coords.length}点, color=${color}, 首=[${coords[0][0].toFixed(4)},${coords[0][1].toFixed(4)}]`);
            });

            // 缩放
            const allCoords = [];
            days.forEach(d => { groups[d].forEach(c => allCoords.push(c)); });
            if (allCoords.length > 0) {
                const bounds = L.latLngBounds(allCoords);
                console.log(`[TrackPlayback] bounds: ${bounds.toBBoxString()}`);
                map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
            }

            // 图例
            this._legend = L.control({ position: 'bottomright' });
            this._legend.onAdd = function () {
                const div = L.DomUtil.create('div', 'info-legend');
                div.style.cssText = 'background:rgba(10,22,40,0.9);padding:8px 12px;border-radius:6px;font-size:11px;color:#c8d6e5;border:1px solid rgba(0,213,255,0.2)';
                div.innerHTML = '<b>巡护轨迹</b><br>' + days.map((d, i) =>
                    '<span style=\"color:' + TrackPlayback._dayColors[i % 6] + '\">● ' + d + '</span>').join('<br>');
                return div;
            };
            this._legend.addTo(map);
        } catch(e) {
            console.error('[TrackPlayback] 渲染异常:', e.message, e.stack);
        }

        console.log(`[TrackPlayback] ${days.length}天轨迹: ${Object.values(groups).reduce((s,g)=>s+g.length,0)}点 渲染完成`);
    },

    /**
     * 在地图上绘制轨迹线 + 仅最新位置标记
     */
    _drawTrackOnMap(tracks, color) {
        if (!tracks || tracks.length < 2) {
            console.warn('[TrackPlayback] 轨迹点不足');
            return;
        }

        try {
            this._clearPlaybackMarker();
            if (this._playPolyline) {
                MapFacade.removeLayer(this._playPolyline);
                this._playPolyline = null;
            }

            const coords = tracks.map(t => [t.lat, t.lng]);
            const isRanger = this._playType === 'ranger';
            const last = tracks[tracks.length - 1];

            // 优先使用实时巡护地图
            const map = MapFacade.getMap('resRealtimeMap') || MapFacade.getMap();
            if (!map) return;

            // 轨迹线
            this._playPolyline = MapFacade.addPolyline(coords, { color, weight: 3, opacity: 0.85 });

            // 最新位置标记
            if (typeof L !== 'undefined') {
                if (isRanger) {
                    this._endMarker = L.marker([last.lat, last.lng], {
                        icon: L.icon({ iconUrl: './forest-ranger.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] }),
                        zIndexOffset: 500
                    }).addTo(map).bindTooltip(last.timestamp || '最新');
                } else {
                    this._endMarker = L.marker([last.lat, last.lng], {
                        icon: L.icon({ iconUrl: './drone.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] }),
                        zIndexOffset: 500
                    }).addTo(map).bindTooltip(last.timestamp || '最新');
                }
            }

            MapFacade.fitBounds(coords);
            console.log(`[TrackPlayback] 轨迹绘制完成: ${coords.length} 点`);
        } catch (e) {
            console.error('[TrackPlayback] 绘制失败:', e);
        }
    },

    /**
     * 清除上次的标记
     */
    _clearPlaybackMarker() {
        const map = MapFacade.getMap();
        if (map) {
            if (this._startMarker) { map.removeLayer(this._startMarker); this._startMarker = null; }
            if (this._endMarker)   { map.removeLayer(this._endMarker);   this._endMarker = null; }
            if (this._cursorMarker) { map.removeLayer(this._cursorMarker); this._cursorMarker = null; }
        }
    },

    // ===== 轨迹动线播放 =====

    /**
     * 开始播放轨迹动画 — 标记沿轨迹从起点移动到终点
     */
    _startPlayback() {
        const tracks = this._playType === 'ranger' ? this._rangerTracks : this._droneTracks;
        if (!tracks || tracks.length < 2) return;

        if (this._playing) { this._stopPlayback(); return; }

        this._playing = true;
        if (this._playIndex >= tracks.length) this._playIndex = 0;

        const map = MapFacade.getMap('resRealtimeMap') || MapFacade.getMap();
        if (!map || typeof L === 'undefined') { this._stopPlayback(); return; }

        const isRanger = this._playType === 'ranger';
        const icon = isRanger
            ? L.icon({ iconUrl: './forest-ranger.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] })
            : L.icon({ iconUrl: './drone.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });

        // 创建移动标记
        if (this._cursorMarker) map.removeLayer(this._cursorMarker);
        const pt = tracks[this._playIndex];
        this._cursorMarker = L.marker([pt.lat, pt.lng], { icon, zIndexOffset: 1000 }).addTo(map)
            .bindTooltip(isRanger ? '▶ 播放中' : '▶ 飞行中');

        const step = () => {
            if (!this._playing || this._playIndex >= tracks.length) {
                this._stopPlayback();
                if (this._cursorMarker) {
                    this._cursorMarker.setTooltipContent(isRanger ? '终点' : '返航点');
                }
                return;
            }
            const p = tracks[this._playIndex];
            if (p && this._cursorMarker) {
                this._cursorMarker.setLatLng([p.lat, p.lng]);
            }
            this._playIndex++;
            // 播放速度：快速（40ms/帧 ≈ 25帧/秒）
            this._playTimer = setTimeout(step, Math.max(20, Math.floor(160 / this._playSpeed)));
        };
        step();
        console.log(`[TrackPlayback] 播放开始 (${this._playSpeed}x, ${tracks.length}帧)`);
    },

    _stopPlayback() {
        this._playing = false;
        if (this._playTimer) { clearTimeout(this._playTimer); this._playTimer = null; }
    },

    _stepPrev() {
        const tracks = this._playType === 'ranger' ? this._rangerTracks : this._droneTracks;
        if (!tracks?.length || !this._cursorMarker) return;
        this._stopPlayback();
        this._playIndex = Math.max(0, this._playIndex - 20);
        this._cursorMarker.setLatLng([tracks[this._playIndex].lat, tracks[this._playIndex].lng]);
    },

    _stepNext() {
        const tracks = this._playType === 'ranger' ? this._rangerTracks : this._droneTracks;
        if (!tracks?.length || !this._cursorMarker) return;
        this._stopPlayback();
        this._playIndex = Math.min(tracks.length - 1, this._playIndex + 20);
        this._cursorMarker.setLatLng([tracks[this._playIndex].lat, tracks[this._playIndex].lng]);
    },

    _addEndpointMarkers() {},
};
