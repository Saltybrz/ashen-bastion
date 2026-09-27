/**
 * ============================================
 *  STATE MANAGER
 *  Centralized game state with pub/sub events.
 *  Synchronizes idle gathering + dungeon combat.
 * ============================================
 */

const SAVE_KEY = 'in_search_of_hope_save';
const ASHEN_SAVE_KEY = 'ashen_bastion_save';
const LEGACY_SAVE_KEY = 'tlb_save';

class StateManager {
    constructor() {
        // ─── Core State ───
        this.character     = null;   // Character instance
        this.nodes         = [];     // GatheringNode[]
        this.resources     = {
            [ResourceType.WOOD]:    0,
            [ResourceType.ORE]:     0,
            [ResourceType.GOLD]:    0,
            [ResourceType.ASHES]:   0,
            [ResourceType.ESSENCE]: 0,
        };

        // Workers owned: { workerId: count }
        this.workers       = {};
        WORKER_DEFINITIONS.forEach(w => { this.workers[w.id] = 0; });

        // Dungeon state
        this.dungeonKeys   = 0;
        this.inDungeon     = false;
        this.dungeonFloor  = 0;
        this.totalDungeonClears = 0;

        // Ascension
        this.ascensionCount = 0;
        this.totalAshes     = 0; // Lifetime ashes earned

        // Difficulty Oath: 'pilgrim' | 'veteran' | 'abyssal'
        this.difficulty     = 'pilgrim';

        // ─── Camp Services: Potions & Belt ───
        this.potions = {
            flint_extract: 0,
            black_iron_oil: 0,
            hidden_eye_tincture: 0,
            unstable_ether_flask: 0,
        };
        this.potionBelt = ['flint_extract', 'black_iron_oil'];
        this.activeBuffs = {};

        // ─── Camp Services: Market Stock ───
        this.marketStock = {
            essence: 5,
            ashes: 2,
            lastRestock: Date.now(),
        };

        // ─── Camp Services: Bounties ───
        this.bounties = [];

        // ─── World State (Stations, Bosses, Floor) ───
        this.worldState = {
            floor: 1,
            stations: { forge: 1, alchemy: 1, market: 1, bounties: 1 },
            activeBounties: [],
            defeatedBosses: [],
        };

        // ─── Volatile Dungeon Expedition Session ───
        this.dungeonSession = {
            active: false,
            floor: 1,
            currentHp: 100,
            potionsRemaining: {},
            monstersRemaining: 0,
            keySpent: false,
            bossEncounterActive: false,
            runLoot: { gold: 0, materials: {}, items: [] },
        };

        // Timestamps for offline earnings
        this.lastTickTimestamp = Utils.now();
        this.gameStartTimestamp = Utils.now();

        // ─── Event Bus ───
        this._listeners = {};

        console.log('[StateManager] Initialized for In Search of Hope.');
    }

    get keys() {
        return this.dungeonKeys;
    }
    set keys(v) {
        this.dungeonKeys = v;
    }

    /**
     * Active difficulty configuration object.
     * @returns {Object}
     */
    get difficultyConfig() {
        return (typeof DIFFICULTY_DEFINITIONS !== 'undefined' && DIFFICULTY_DEFINITIONS[this.difficulty])
            ? DIFFICULTY_DEFINITIONS[this.difficulty]
            : { id: 'pilgrim', enemyHpMult: 1.0, enemyDmgMult: 1.0, magicDropBonus: 0, deathLossPercent: 0.25, deathPenalty: 0.25, breakKeyOnDeath: false };
    }

    // ═══════════════════════════════════════════
    //  EVENT BUS
    // ═══════════════════════════════════════════

    /**
     * Subscribe to a game event.
     * @param {string} event
     * @param {Function} callback
     */
    on(event, callback) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(callback);
    }

    /**
     * Emit a game event.
     * @param {string} event
     * @param {*} data
     */
    emit(event, data) {
        const cbs = this._listeners[event];
        if (cbs) cbs.forEach(cb => cb(data));
    }

    // ═══════════════════════════════════════════
    //  INITIALIZATION
    // ═══════════════════════════════════════════

    /**
     * Initialize a new game with the selected class, difficulty, and bloodline.
     * @param {string} classId
     * @param {string} [difficulty='pilgrim']
     * @param {string} [bloodlineId='children_of_pyre']
     */
    initNewGame(classId, difficulty = 'pilgrim', bloodlineId = 'children_of_pyre') {
        this.difficulty = difficulty;
        this.character = new Character(classId, bloodlineId);

        // Create gathering nodes from definitions
        this.nodes = NODE_DEFINITIONS.map(def => new GatheringNode(def));

        // Reset resources
        for (const key of Object.keys(this.resources)) {
            this.resources[key] = 0;
        }

        // Starting resources
        this.resources[ResourceType.GOLD] = 10;

        this.lastTickTimestamp = Utils.now();
        this.gameStartTimestamp = Utils.now();

        this.emit('game:init', { classId, difficulty, bloodlineId });
        this.emit('resources:changed', this.resources);
        this.emit('character:changed', this.character);
    }

    // ═══════════════════════════════════════════
    //  RESOURCES
    // ═══════════════════════════════════════════

    addResource(type, amount) {
        this.resources[type] = (this.resources[type] || 0) + amount;
        this.emit('resources:changed', this.resources);
        this.emit('resource:gained', { type, amount });
    }

    spendResource(type, amount) {
        if ((this.resources[type] || 0) < amount) return false;
        this.resources[type] -= amount;
        this.emit('resources:changed', this.resources);
        return true;
    }

    canAfford(costs) {
        for (const [type, amount] of Object.entries(costs)) {
            if ((this.resources[type] || 0) < amount) return false;
        }
        return true;
    }

    spendMultiple(costs) {
        if (!this.canAfford(costs)) return false;
        for (const [type, amount] of Object.entries(costs)) {
            this.resources[type] -= amount;
        }
        this.emit('resources:changed', this.resources);
        return true;
    }

    // ═══════════════════════════════════════════
    //  IDLE SPEED MULTIPLIER
    // ═══════════════════════════════════════════

    /**
     * Get the current gathering speed multiplier
     * based on class bonus + ascension ashes.
     */
    getGatherSpeedMultiplier(nodeResourceType) {
        let mult = 1.0;

        // Ascension bonus
        mult += this.resources[ResourceType.ASHES] * ASCENSION_MULTIPLIER_PER_ASH;

        // Class bonus
        if (this.character) {
            const bonus = this.character.idleBonus;
            if (bonus.type === 'gathering_speed') {
                if (bonus.targets.includes(nodeResourceType)) {
                    mult += bonus.value;
                }
            }
        }

        return mult;
    }

    /**
     * Get the gold cost multiplier (Paladin discount).
     */
    getGoldCostMultiplier() {
        if (this.character && this.character.idleBonus.type === 'upgrade_discount') {
            return 1 - this.character.idleBonus.value;
        }
        return 1.0;
    }

    // ═══════════════════════════════════════════
    //  WORKERS
    // ═══════════════════════════════════════════

    getWorkerCount(workerId) {
        return this.workers[workerId] || 0;
    }

    getWorkerCost(workerId) {
        const def = WORKER_DEFINITIONS.find(w => w.id === workerId);
        if (!def) return Infinity;
        return Utils.expCost(def.baseCost, def.costRate, this.getWorkerCount(workerId));
    }

    buyWorker(workerId) {
        const cost = this.getWorkerCost(workerId);
        const discountedCost = Math.floor(cost * this.getGoldCostMultiplier());
        if (!this.spendResource(ResourceType.GOLD, discountedCost)) return false;
        this.workers[workerId] = (this.workers[workerId] || 0) + 1;
        this.emit('workers:changed', this.workers);
        return true;
    }

    // ═══════════════════════════════════════════
    //  DUNGEON KEYS
    // ═══════════════════════════════════════════

    canForgeKey() {
        return this.canAfford(DUNGEON_KEY_COST);
    }

    forgeKey() {
        if (!this.spendMultiple(DUNGEON_KEY_COST)) return false;
        this.dungeonKeys++;
        this.emit('keys:changed', this.dungeonKeys);
        return true;
    }

    useKey() {
        if (this.dungeonKeys <= 0) return false;
        this.dungeonKeys--;
        this.emit('keys:changed', this.dungeonKeys);
        return true;
    }

    addKeys(count = 1) {
        this.dungeonKeys = (this.dungeonKeys || 0) + count;
        this.emit('keys:changed', this.dungeonKeys);
        return this.dungeonKeys;
    }

    // ═══════════════════════════════════════════
    //  ASCENSION (REBIRTH)
    // ═══════════════════════════════════════════

    getAscensionAshesReward() {
        // Based on total resources gathered + dungeon clears
        const totalRes = Object.values(this.resources).reduce((s, v) => s + v, 0);
        return Math.max(1, Math.floor(
            ASCENSION_BASE_ASHES +
            Math.log2(1 + totalRes / 100) +
            this.totalDungeonClears * 2
        ));
    }

    performAscension() {
        const reward = this.getAscensionAshesReward();

        // Reset nodes
        this.nodes.forEach(n => n.reset());

        // Reset resources (except ashes)
        this.resources[ResourceType.WOOD]    = 0;
        this.resources[ResourceType.ORE]     = 0;
        this.resources[ResourceType.GOLD]    = 10;
        this.resources[ResourceType.ESSENCE] = 0;
        this.resources[ResourceType.ASHES]  += reward;

        // Reset workers
        for (const key of Object.keys(this.workers)) {
            this.workers[key] = 0;
        }

        // Reset dungeon keys
        this.dungeonKeys = 0;

        this.ascensionCount++;
        this.totalAshes += reward;

        this.emit('ascension:complete', { reward, total: this.resources[ResourceType.ASHES] });
        this.emit('resources:changed', this.resources);
        this.emit('workers:changed', this.workers);
        this.emit('keys:changed', this.dungeonKeys);
        this.emit('nodes:reset');
    }

    // ═══════════════════════════════════════════
    //  SAVE / LOAD
    // ═══════════════════════════════════════════

    save() {
        const data = {
            version: 3,
            timestamp: Date.now(),
            character: this.character?.toJSON(),
            resources: { ...this.resources },
            nodes: this.nodes.map(n => n.toJSON()),
            workers: { ...this.workers },
            dungeonKeys: this.dungeonKeys,
            difficulty: this.difficulty || 'pilgrim',
            ascensionCount: this.ascensionCount,
            totalAshes: this.totalAshes,
            totalDungeonClears: this.totalDungeonClears,
            potions: { ...this.potions },
            potionBelt: [...this.potionBelt],
            marketStock: { ...this.marketStock },
            bounties: this.bounties ? this.bounties.map(b => ({ ...b })) : [],
            worldState: this.worldState ? { ...this.worldState } : {
                floor: 1,
                stations: { forge: 1, alchemy: 1, market: 1, bounties: 1 },
                activeBounties: [],
                defeatedBosses: [],
            },
        };
        try {
            const serialized = JSON.stringify(data);
            localStorage.setItem(SAVE_KEY, serialized);
            // Also mirror to ashen_bastion_save for cross-key integrity (Section 49)
            localStorage.setItem(ASHEN_SAVE_KEY, serialized);
            this.emit('game:saved');
            console.log('[StateManager] Game saved to In Search of Hope registry (synchronized to ashen_bastion_save).');
        } catch (e) {
            console.error('[StateManager] Save failed:', e);
        }
    }

    /**
     * Static loader to support StateManager.load() invocation safely.
     * @returns {boolean}
     */
    static load() {
        if (typeof gameState !== 'undefined' && typeof gameState.load === 'function') {
            return gameState.load();
        }
        return false;
    }

    load() {
        try {
            let raw = localStorage.getItem(SAVE_KEY);
            if (!raw) {
                // Secondary check: ashen_bastion_save
                raw = localStorage.getItem(ASHEN_SAVE_KEY);
            }
            if (!raw) {
                // Migration check from legacy storage key
                raw = localStorage.getItem(LEGACY_SAVE_KEY);
                if (raw) {
                    console.log('[StateManager] Migrating save from legacy key (tlb_save) to in_search_of_hope_save and ashen_bastion_save.');
                    try {
                        localStorage.setItem(SAVE_KEY, raw);
                        localStorage.setItem(ASHEN_SAVE_KEY, raw);
                    } catch (migErr) {
                        console.warn('[StateManager] Migration save warning:', migErr);
                    }
                }
            }

            if (!raw) return false;
            
            // Default Schema Fallback (Schema Migration / Hydration)
            const defaultState = {
                version: 3,
                difficulty: 'pilgrim',
                resources: {
                    [ResourceType.WOOD]: 0,
                    [ResourceType.ORE]: 0,
                    [ResourceType.GOLD]: 0,
                    [ResourceType.ASHES]: 0,
                    [ResourceType.ESSENCE]: 0,
                },
                workers: {},
                dungeonKeys: 0,
                ascensionCount: 0,
                totalAshes: 0,
                totalDungeonClears: 0,
                potions: { flint_extract: 0, black_iron_oil: 0, hidden_eye_tincture: 0, unstable_ether_flask: 0 },
                potionBelt: ['flint_extract', 'black_iron_oil'],
                marketStock: { essence: 5, ashes: 2, lastRestock: Date.now() },
                bounties: [],
                worldState: {
                    floor: 1,
                    stations: { forge: 1, alchemy: 1, market: 1, bounties: 1 },
                    activeBounties: [],
                    defeatedBosses: [],
                },
            };
            if (typeof WORKER_DEFINITIONS !== 'undefined') {
                WORKER_DEFINITIONS.forEach(w => { defaultState.workers[w.id] = 0; });
            }

            const parsedData = JSON.parse(raw);
            const data = Object.assign({}, defaultState, parsedData);

            // Restore difficulty
            this.difficulty = data.difficulty || 'pilgrim';

            // Restore character
            if (data.character) {
                this.character = Character.fromJSON(data.character);
            }

            // Restore resources
            this.resources = { ...defaultState.resources, ...data.resources };

            // Restore nodes
            if (typeof NODE_DEFINITIONS !== 'undefined') {
                this.nodes = NODE_DEFINITIONS.map(def => {
                    const saved = (data.nodes || []).find(n => n.id === def.id);
                    return saved ? GatheringNode.fromJSON(saved, def) : new GatheringNode(def);
                });
            }

            // Restore workers
            this.workers = { ...defaultState.workers, ...data.workers };

            // Restore dungeon & world state
            this.dungeonKeys = data.dungeonKeys || 0;
            this.ascensionCount = data.ascensionCount || 0;
            this.totalAshes = data.totalAshes || 0;
            this.totalDungeonClears = data.totalDungeonClears || 0;
            this.worldState = Object.assign({}, defaultState.worldState, data.worldState);

            // Restore Camp Services
            if (data.potions) {
                this.potions = { ...defaultState.potions, ...data.potions };
            }
            if (data.potionBelt) {
                this.potionBelt = [...data.potionBelt];
            }
            if (data.marketStock) {
                this.marketStock = { ...defaultState.marketStock, ...data.marketStock };
            }
            if (data.bounties) {
                this.bounties = data.bounties.map(b => ({ ...b }));
            }

            // Calculate offline earnings
            if (data.timestamp) {
                const offlineSeconds = (Date.now() - data.timestamp) / 1000;
                this._applyOfflineEarnings(offlineSeconds);
            }

            this.lastTickTimestamp = Utils.now();

            this.emit('game:loaded');
            this.emit('resources:changed', this.resources);
            this.emit('character:changed', this.character);
            this.emit('workers:changed', this.workers);
            this.emit('keys:changed', this.dungeonKeys);
            this.emit('potions:changed', this.potions);
            this.emit('bounties:changed', this.bounties);
            this.emit('worldState:changed', this.worldState);

            console.log('[StateManager] Game loaded successfully with schema hydration.');
            return true;
        } catch (e) {
            console.error('[StateManager] Load failed:', e);
            return false;
        }
    }

    /**
     * Apply offline resource earnings based on workers.
     */
    _applyOfflineEarnings(seconds) {
        if (seconds <= 0) return;
        // Cap at 8 hours
        const cappedSeconds = Math.min(seconds, 8 * 3600);
        let totalEarned = {};

        for (const wDef of WORKER_DEFINITIONS) {
            const count = this.workers[wDef.id] || 0;
            if (count <= 0) continue;

            const ticks = Math.floor(cappedSeconds / wDef.gatherInterval);
            const amount = ticks * wDef.gatherAmount * count;

            if (wDef.nodeId === 'all') {
                // Automaton distributes to all resource types
                for (const nodeDef of NODE_DEFINITIONS) {
                    const resType = nodeDef.resourceType;
                    totalEarned[resType] = (totalEarned[resType] || 0) + amount;
                }
            } else {
                const nodeDef = NODE_DEFINITIONS.find(n => n.id === wDef.nodeId);
                if (nodeDef) {
                    const resType = nodeDef.resourceType;
                    totalEarned[resType] = (totalEarned[resType] || 0) + amount;
                }
            }
        }

        // Award offline passive XP
        if (this.character) {
            const totalWorkers = Object.values(this.workers).reduce((s, v) => s + (v || 0), 0);
            const xpPerMin = 15 + (totalWorkers * 6);
            const passiveXPGain = Math.floor((cappedSeconds / 60) * xpPerMin);
            if (passiveXPGain > 0) {
                this.character.addXP(passiveXPGain, 'passive');
            }
        }

        for (const [resType, amount] of Object.entries(totalEarned)) {
            this.resources[resType] += amount;
        }

        const totalAmount = Object.values(totalEarned).reduce((s, v) => s + v, 0);
        if (totalAmount > 0) {
            this.emit('offline:earnings', { seconds: cappedSeconds, earned: totalEarned });
        }
    }

    hasSave() {
        return !!(localStorage.getItem(SAVE_KEY) || localStorage.getItem(ASHEN_SAVE_KEY) || localStorage.getItem(LEGACY_SAVE_KEY));
    }

    deleteSave() {
        localStorage.removeItem(SAVE_KEY);
        localStorage.removeItem(ASHEN_SAVE_KEY);
        localStorage.removeItem(LEGACY_SAVE_KEY);
    }

    clearSave() {
        this.deleteSave();
    }
}

// Singleton
const gameState = new StateManager();
if (typeof window !== 'undefined') {
    window.gameState = gameState;
    window.stateManager = gameState;
}

console.log('[StateManager] Singleton created.');
