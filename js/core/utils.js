/**
 * ============================================
 *  UTILS — Pure utility functions
 * ============================================
 */

const Utils = {
    /**
     * Generate a v4-like unique ID.
     */
    uid() {
        return 'xxxx-xxxx'.replace(/x/g, () =>
            ((Math.random() * 16) | 0).toString(16)
        );
    },

    /**
     * Clamp a value between min and max.
     */
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    /**
     * Random integer in [min, max] inclusive.
     */
    randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /**
     * Random float in [min, max).
     */
    randFloat(min, max) {
        return Math.random() * (max - min) + min;
    },

    /**
     * Weighted random pick from an array of { weight, ... } objects.
     */
    weightedRandom(items, weightKey = 'weight') {
        const total = items.reduce((sum, item) => sum + item[weightKey], 0);
        let roll = Math.random() * total;
        for (const item of items) {
            roll -= item[weightKey];
            if (roll <= 0) return item;
        }
        return items[items.length - 1];
    },

    /**
     * Format a number with K/M suffixes for display.
     */
    formatNumber(n) {
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
        if (n >= 10_000)    return (n / 1_000).toFixed(1) + 'K';
        if (n >= 1_000)     return (n / 1_000).toFixed(2) + 'K';
        return Math.floor(n).toLocaleString('pt-BR');
    },

    /**
     * Format seconds as mm:ss or just seconds.
     */
    formatTime(seconds) {
        if (seconds < 60) return seconds.toFixed(1) + 's';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}m ${s.toString().padStart(2, '0')}s`;
    },

    /**
     * Calculate the cost for a given level using exponential scaling.
     * cost = baseCost * rate^level
     */
    expCost(baseCost, rate, level) {
        return Math.floor(baseCost * Math.pow(rate, level));
    },

    /**
     * Deep clone an object (simple JSON-safe objects).
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    /**
     * Linear interpolation.
     */
    lerp(a, b, t) {
        return a + (b - a) * t;
    },

    /**
     * Distance between two 2D points.
     */
    distance(x1, y1, x2, y2) {
        return Math.hypot(x2 - x1, y2 - y1);
    },

    /**
     * Check circle collision.
     */
    circleCollision(x1, y1, r1, x2, y2, r2) {
        return Utils.distance(x1, y1, x2, y2) < r1 + r2;
    },

    /**
     * AABB collision.
     */
    aabbCollision(a, b) {
        return a.x < b.x + b.w &&
               a.x + a.w > b.x &&
               a.y < b.y + b.h &&
               a.y + a.h > b.y;
    },

    /**
     * Get timestamp in seconds.
     */
    now() {
        return Date.now() / 1000;
    },
};

console.log('[Utils] Utility functions loaded.');
