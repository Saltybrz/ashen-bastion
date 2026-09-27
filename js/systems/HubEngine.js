/**
 * ============================================
 *  HUB ENGINE
 *  Coordinates the hub world, map assets, and
 *  bridges the courtyard rendering with HubUI.
 * ============================================
 */
const HubEngine = {
    hubMapAsset: null,

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
    }
};

window.HubEngine = HubEngine;
