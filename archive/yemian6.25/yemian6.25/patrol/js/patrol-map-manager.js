// patrol-map-manager.js — Leaflet地图：实时护林员/无人机标记 + 轨迹线
class PatrolMapManager {
    constructor(mapElementId, forestCenter) {
        const existing = window.maps && window.maps[mapElementId];
        if (existing) {
            this.map = existing;
        } else {
            this.map = L.map(mapElementId, {
                center: forestCenter || [26.65, 106.73],
                zoom: 14,
                attributionControl: false,
                zoomControl: false
            });
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(this.map);
            if (window.maps) window.maps[mapElementId] = this.map;
        }

        this.rangerMarkers = new Map();
        this.droneMarkers = new Map();
        this.trajectoryLines = new Map();
        this._currentViewMode = 'ranger';

        this._initIcons();
        this._bindListeners();
    }

    _initIcons() {
        this.rangerOnlineIcon = L.divIcon({
            html: '<div style="width:14px;height:14px;background:#00e676;border:2px solid #fff;border-radius:50%;box-shadow:0 0 10px rgba(0,230,118,0.7);animation:patrolPulse 2s infinite;"></div>',
            className: '', iconSize: [14, 14], iconAnchor: [7, 7]
        });
        this.rangerOfflineIcon = L.divIcon({
            html: '<div style="width:12px;height:12px;background:#556677;border:2px solid #8899aa;border-radius:50%;"></div>',
            className: '', iconSize: [12, 12], iconAnchor: [6, 6]
        });
        this.droneIcon = L.divIcon({
            html: '<div style="width:14px;height:14px;background:#448aff;border:2px solid #fff;border-radius:3px;box-shadow:0 0 8px rgba(68,138,255,0.7);transform:rotate(45deg);animation:patrolPulse 2s infinite;"></div>',
            className: '', iconSize: [14, 14], iconAnchor: [7, 7]
        });
    }

    _bindListeners() {
        patrolState.on('ranger-updated', ({ userId, data }) => this.updateRangerMarker(userId, data));
        patrolState.on('drone-updated', ({ droneId, data }) => this.updateDroneMarker(droneId, data));
        patrolState.on('trajectory-appended', ({ userId, point }) => this.appendTrajectoryPoint(userId, point));
        patrolState.on('ranger-status-changed', ({ userId, online }) => this._updateMarkerAppearance(userId, online));
    }

    setViewMode(mode) {
        this._currentViewMode = mode;
        if (mode === 'ranger') {
            this.droneMarkers.forEach(m => { if (this.map.hasLayer(m)) this.map.removeLayer(m); });
            this.rangerMarkers.forEach((m, uid) => { if (!this.map.hasLayer(m)) m.addTo(this.map); });
            this._updateTrajectoryLinesVisibility();
        } else if (mode === 'drone') {
            this.rangerMarkers.forEach(m => { if (this.map.hasLayer(m)) this.map.removeLayer(m); });
            this.droneMarkers.forEach((m, did) => { if (!this.map.hasLayer(m)) m.addTo(this.map); });
            this._updateTrajectoryLinesVisibility();
        } else if (mode === 'history') {
            this.rangerMarkers.forEach(m => { if (!this.map.hasLayer(m)) m.addTo(this.map); });
            this.droneMarkers.forEach(m => { if (!this.map.hasLayer(m)) m.addTo(this.map); });
            this._updateTrajectoryLinesVisibility();
        }
    }

    updateRangerMarker(userId, data) {
        const latlng = L.latLng(data.lat, data.lng);
        const isOnline = data.status === '在线';
        let marker = this.rangerMarkers.get(userId);
        if (!marker) {
            marker = L.marker(latlng, {
                icon: isOnline ? this.rangerOnlineIcon : this.rangerOfflineIcon
            }).addTo(this.map);
            marker.bindPopup('', { closeButton: false });
            this.rangerMarkers.set(userId, marker);
        } else {
            marker.setLatLng(latlng);
            marker.setIcon(isOnline ? this.rangerOnlineIcon : this.rangerOfflineIcon);
        }
        marker.setPopupContent(this._rangerPopup(userId, data));
        if (this._currentViewMode === 'drone' && !this.map.hasLayer(marker)) {
            // don't show ranger in drone-only mode
        }
    }

    updateDroneMarker(droneId, data) {
        const latlng = L.latLng(data.lat, data.lng);
        let marker = this.droneMarkers.get(droneId);
        if (!marker) {
            marker = L.marker(latlng, { icon: this.droneIcon }).addTo(this.map);
            marker.bindPopup('', { closeButton: false });
            this.droneMarkers.set(droneId, marker);
        } else {
            marker.setLatLng(latlng);
        }
        marker.setPopupContent(this._dronePopup(droneId, data));
        if (this._currentViewMode === 'ranger' && this.map.hasLayer(marker)) {
            this.map.removeLayer(marker);
        }
    }

    appendTrajectoryPoint(userId, point) {
        const paths = patrolState.activeTrajectories;
        const allPoints = paths.get(userId);
        if (!allPoints || allPoints.length < 2) return;

        const latlngs = allPoints.map(p => L.latLng(p.lat, p.lng));
        let line = this.trajectoryLines.get(userId);
        if (!line) {
            const isDrone = userId.startsWith('UAV');
            const color = isDrone ? '#448aff' : '#00e676';
            line = L.polyline(latlngs, {
                color, weight: 2, opacity: 0.7, dashArray: isDrone ? '6,3' : null
            }).addTo(this.map);
            this.trajectoryLines.set(userId, line);
        } else {
            line.setLatLngs(latlngs);
        }
    }

    _updateMarkerAppearance(userId, online) {
        const marker = this.rangerMarkers.get(userId);
        if (marker) {
            marker.setIcon(online ? this.rangerOnlineIcon : this.rangerOfflineIcon);
        }
    }

    _updateTrajectoryLinesVisibility() {
        this.trajectoryLines.forEach((line, uid) => {
            const isDrone = uid.startsWith('UAV');
            if (this._currentViewMode === 'ranger' && isDrone) {
                if (this.map.hasLayer(line)) this.map.removeLayer(line);
            } else if (this._currentViewMode === 'drone' && !isDrone) {
                if (this.map.hasLayer(line)) this.map.removeLayer(line);
            } else {
                if (!this.map.hasLayer(line)) line.addTo(this.map);
            }
        });
    }

    _rangerPopup(userId, data) {
        const statusTag = data.status === '在线'
            ? '<span class="tag tag-green tag-sm">在线</span>'
            : '<span class="tag tag-gray tag-sm">离线</span>';
        return `<div class="popup-info">
            <div class="popup-title" style="color:#00e676;">护林员</div>
            <div class="popup-row"><span class="popup-label">姓名</span><span class="popup-val">${data.name}</span></div>
            <div class="popup-row"><span class="popup-label">工号</span><span class="popup-val">${userId}</span></div>
            <div class="popup-row"><span class="popup-label">区域</span><span class="popup-val">${data.area || '-'}</span></div>
            <div class="popup-row"><span class="popup-label">状态</span><span class="popup-val">${statusTag}</span></div>
            <div class="popup-row"><span class="popup-label">速度</span><span class="popup-val">${(data.speed || 0).toFixed(1)} km/h</span></div>
            <div class="popup-row"><span class="popup-label">电量</span><span class="popup-val">${(data.battery || 0).toFixed(0)}%</span></div>
            <div class="popup-row"><span class="popup-label">经度</span><span class="popup-val">${data.lng.toFixed(6)}</span></div>
            <div class="popup-row"><span class="popup-label">纬度</span><span class="popup-val">${data.lat.toFixed(6)}</span></div>
        </div>`;
    }

    _dronePopup(droneId, data) {
        return `<div class="popup-info">
            <div class="popup-title" style="color:#448aff;">无人机</div>
            <div class="popup-row"><span class="popup-label">编号</span><span class="popup-val">${droneId}</span></div>
            <div class="popup-row"><span class="popup-label">型号</span><span class="popup-val">${data.model || '-'}</span></div>
            <div class="popup-row"><span class="popup-label">高度</span><span class="popup-val">${data.alt || '-'}m</span></div>
            <div class="popup-row"><span class="popup-label">航向</span><span class="popup-val">${(data.heading || 0).toFixed(0)}°</span></div>
            <div class="popup-row"><span class="popup-label">电量</span><span class="popup-val">${(data.battery || 0).toFixed(0)}%</span></div>
            <div class="popup-row"><span class="popup-label">状态</span><span class="popup-val"><span class="tag tag-blue tag-sm">${data.status || '-'}</span></span></div>
            <div class="popup-row"><span class="popup-label">经度</span><span class="popup-val">${data.lng.toFixed(6)}</span></div>
            <div class="popup-row"><span class="popup-label">纬度</span><span class="popup-val">${data.lat.toFixed(6)}</span></div>
        </div>`;
    }

    focusUser(userId) {
        const marker = this.rangerMarkers.get(userId) || this.droneMarkers.get(userId);
        if (marker) {
            this.map.setView(marker.getLatLng(), 16, { animate: true });
            marker.openPopup();
        }
    }

    fitAllActive() {
        const bounds = [];
        this.rangerMarkers.forEach(m => bounds.push(m.getLatLng()));
        this.droneMarkers.forEach(m => bounds.push(m.getLatLng()));
        if (bounds.length > 0) {
            this.map.fitBounds(L.latLngBounds(bounds).pad(0.2));
        }
    }

    addReplayMarkerAndLine(points) {
        this.clearReplay();
        if (!points || points.length === 0) return;

        const latlngs = points.map(p => L.latLng(p.lat, p.lng));
        this._replayLine = L.polyline(latlngs, {
            color: '#ff9800', weight: 3, opacity: 0.8
        }).addTo(this.map);

        this._replayMarker = L.circleMarker(latlngs[0], {
            radius: 8, color: '#ff9800', weight: 2, fillColor: '#fff', fillOpacity: 1
        }).addTo(this.map);

        this._replayPoints = latlngs;
        this.map.fitBounds(L.latLngBounds(latlngs).pad(0.1));
    }

    updateReplayPosition(index) {
        if (this._replayMarker && this._replayPoints && index < this._replayPoints.length) {
            this._replayMarker.setLatLng(this._replayPoints[index]);
        }
    }

    clearReplay() {
        if (this._replayMarker) { this.map.removeLayer(this._replayMarker); this._replayMarker = null; }
        if (this._replayLine) { this.map.removeLayer(this._replayLine); this._replayLine = null; }
        this._replayPoints = null;
    }

    clearAll() {
        this.rangerMarkers.forEach(m => this.map.removeLayer(m));
        this.droneMarkers.forEach(m => this.map.removeLayer(m));
        this.trajectoryLines.forEach(l => this.map.removeLayer(l));
        this.rangerMarkers.clear();
        this.droneMarkers.clear();
        this.trajectoryLines.clear();
    }
}
