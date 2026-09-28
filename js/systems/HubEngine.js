/**
 * ============================================
 *  HUB ENGINE
 *  Coordinates the hub world, map assets, and
 *  bridges the courtyard rendering with HubUI.
 * ============================================
 */
const HubEngine = {
    hubMapAsset: null,
    activeMapId: 'HUB_VILLAGE',

    /**
     * Initializes the hub with the preloaded map asset.
     * @param {{ img: HTMLImageElement|null, loaded: boolean }} hubMap
     */
    init(hubMap) {
        this.hubMapAsset = hubMap;
        if (window.hubUI && typeof window.hubUI.initCourtyardMap === 'function') {
            window.hubUI.initCourtyardMap(hubMap);
        }
        console.log('[HubEngine] Initialized with map asset:', hubMap?.loaded ? 'OK (Primary)' : 'Fallback/Procedural');
    },

    /**
     * Returns current active map ID.
     * @returns {string}
     */
    getActiveMapId() {
        return window.hubUI?.activeHubMapId || this.activeMapId;
    },

    /**
     * Teleports player between Hub areas (Village Courtyard vs Cathedral Sanctuary).
     * @param {'HUB_VILLAGE'|'HUB_CATHEDRAL'} targetMapId
     */
    teleportTo(targetMapId) {
        if (!window.hubUI) return;
        if (targetMapId === 'HUB_CATHEDRAL') {
            window.hubUI.teleportToCathedral();
        } else if (targetMapId === 'HUB_VILLAGE') {
            window.hubUI.teleportToVillage();
        }
        this.activeMapId = targetMapId;
    }
};

window.HubEngine = HubEngine;
