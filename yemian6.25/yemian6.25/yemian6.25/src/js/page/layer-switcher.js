// ==================== 底图切换桥接 ====================
// 文件：src/js/page/layer-switcher.js
// 职责：动态构建"图层管理 → 影像底图"下拉菜单，切换时联动所有地图实例

(function () {

    // ---- 底图菜单定义（显示文本 → TILE_LAYERS key） ----
    // 顺序：高德影像(默认) → 天地图地形 → Carto Dark → GF-2 → 无人机
    var BASEMAP_OPTIONS = [
        { label: '-- 在线底图 --',   value: '', disabled: true },
        { label: '高德影像（默认）',  value: 'amap-image' },
        { label: '天地图地形',        value: 'tianditu-terrain' },
        { label: 'Carto Dark',        value: 'carto-dark' },

        { label: '-- 遥感影像（预留）--', value: '', disabled: true },
        { label: 'GF-2 遥感影像',     value: 'gf2' },
        { label: '无人机影像',        value: 'drone' },

        { label: '-- 其他 --',        value: '', disabled: true },
        { label: 'OpenStreetMap',     value: 'osm' }
    ];

    // ---- 通过 parentNode 向上查找（兼容 closest） ----
    function findAncestor(el, className) {
        while (el) {
            if (el.classList && el.classList.contains(className)) return el;
            el = el.parentElement;
        }
        return null;
    }

    // ---- 定位"影像底图"下拉框 ----
    function findBasemapSelect() {
        var titles = document.querySelectorAll('.layer-group-title');
        for (var i = 0; i < titles.length; i++) {
            if (titles[i].textContent.indexOf('影像底图') !== -1) {
                var group = findAncestor(titles[i], 'layer-group');
                if (group) {
                    return group.querySelector('select');
                }
            }
        }
        return null;
    }

    // ---- 构建下拉菜单选项 ----
    function buildMenu(select) {
        // 清空旧选项
        select.innerHTML = '';
        // 按 BASEMAP_OPTIONS 重建
        BASEMAP_OPTIONS.forEach(function (opt) {
            var option = document.createElement('option');
            option.textContent = opt.label;
            option.value = opt.value;
            if (opt.disabled) {
                option.disabled = true;
            }
            select.appendChild(option);
        });
        // 默认底图从配置读取（MapConfig.defaultBasemap）
        var defaultType = (typeof MapConfig !== 'undefined' && MapConfig.defaultBasemap)
            ? MapConfig.defaultBasemap
            : 'amap-image';
        select.value = defaultType;
    }

    // ---- 初始化 ----
    function init() {
        var select = findBasemapSelect();
        if (!select) return;

        // 用新的菜单项替换原有选项
        buildMenu(select);

        // 绑定 change 事件 → 调用 setBaseMap 统一切换
        select.addEventListener('change', function () {
            var type = this.value;
            if (!type) return;

            // ★ 诊断日志
            console.log('[layer-switcher] 切换到底图:', type);
            var tileDef = BaiyunshanMap.TILE_LAYERS[type];
            if (tileDef) {
                console.log('[layer-switcher] 瓦片定义:', tileDef.name, '| URL:', tileDef.url);
            } else {
                console.warn('[layer-switcher] 未找到底图定义:', type);
            }

            // 优先使用 LeafletEngine.setBaseMap（统一入口）
            var count = 0;
            if (typeof LeafletEngine !== 'undefined' && typeof LeafletEngine.setBaseMap === 'function') {
                count = LeafletEngine.setBaseMap(type);
            } else {
                // 回退：直接遍历实例调用 switchTileLayer
                count = switchAllTileLayers(type);
            }

            // 如果地图尚未创建，定时重试
            if (count === 0) {
                var retries = 0;
                var timer = setInterval(function () {
                    retries++;
                    var c = (typeof LeafletEngine !== 'undefined' && typeof LeafletEngine.setBaseMap === 'function')
                        ? LeafletEngine.setBaseMap(type)
                        : switchAllTileLayers(type);
                    if (c > 0 || retries >= 10) {
                        clearInterval(timer);
                    }
                }, 300);
            }
        });
    }

    // ---- 回退：直接操作 BaiyunshanMap ----
    function switchAllTileLayers(key) {
        if (!key) return 0;
        var instances = MapFacade._instances;
        var count = 0;
        Object.keys(instances).forEach(function (id) {
            var leafletMap = instances[id];
            var bym = leafletMap && leafletMap._baiyunshan;
            if (bym && typeof bym.switchTileLayer === 'function') {
                bym.switchTileLayer(key);
                count++;
            }
        });
        return count;
    }

    // ---- 启动：轮询直到下拉框可用 ----
    var initRetries = 0;
    var initTimer = setInterval(function () {
        initRetries++;
        var select = findBasemapSelect();
        if (select) {
            init();
            clearInterval(initTimer);
        } else if (initRetries >= 20) {
            clearInterval(initTimer);
        }
    }, 300);

})();
