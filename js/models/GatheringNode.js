/**
 * ============================================
 *  GATHERING NODE MODEL
 *  Represents a resource node with level,
 *  timer state, yield, and automation status.
 * ============================================
 */

class GatheringNode {
    /**
     * @param {Object} definition — from NODE_DEFINITIONS
     */
    constructor(definition) {
        this.id             = definition.id;
        this.name           = definition.name;
        this.icon           = definition.icon;
        this.resourceType   = definition.resourceType;
        this.accentColor    = definition.accentColor;
        this.accentColorLight = definition.accentColorLight;

        // Level & scaling config
        this.level          = 1;
        this.maxLevel       = definition.maxLevel;
        this.baseTime       = definition.baseTime;
        this.baseYield      = definition.baseYield;
        this.baseUpgradeCost= definition.baseUpgradeCost;
        this.upgradeCostRate= definition.upgradeCostRate;
        this.timeReductionPerLevel = definition.timeReductionPerLevel;
        this.yieldBonusPerLevel    = definition.yieldBonusPerLevel;
        this.rareDrops      = definition.rareDrops || [];

        // Runtime state
        this.isGathering    = false;   // Is the player actively gathering?
        this.gatherProgress = 0;       // 0..1
        this.gatherElapsed  = 0;       // seconds elapsed in current gather
        this.totalGathered  = 0;       // lifetime counter

        // Gathering XP (separate from character XP)
        this.gatherXP       = 0;

        // Workers/automations assigned to this node (0 = strictly manual)
        this.workers        = definition.workers || 0;
    }

    // ─── Computed Properties ───

    /**
     * Current gather time in seconds (reduced by level).
     */
    get currentTime() {
        const reduction = 1 - (this.level - 1) * this.timeReductionPerLevel;
        return Math.max(0.3, this.baseTime * Math.max(0.1, reduction));
    }

    /**
     * Current yield per gather.
     */
    get currentYield() {
        return this.baseYield + (this.level - 1) * this.yieldBonusPerLevel;
    }

    /**
     * Gold cost to upgrade to next level.
     */
    get upgradeCost() {
        return Utils.expCost(this.baseUpgradeCost, this.upgradeCostRate, this.level);
    }

    /**
     * Can the node be upgraded?
     */
    get canUpgrade() {
        return this.level < this.maxLevel;
    }

    /**
     * Resources per second at current level (for display & automation).
     */
    get resourcesPerSecond() {
        return this.currentYield / this.currentTime;
    }

    // ─── Methods ───

    /**
     * Start manual gathering. Returns false if already gathering.
     */
    startGather() {
        if (this.isGathering) return false;
        this.isGathering    = true;
        this.gatherProgress = 0;
        this.gatherElapsed  = 0;
        return true;
    }

    /**
     * Tick the gather timer by dt seconds.
     * Returns reward object if gather completes, null otherwise.
     * @param {number} dt — delta time in seconds
     * @param {number} speedMultiplier — from class bonus, ascension, etc.
     * @returns {Object|null} { resource, amount, rareDrops: [] }
     */
    tick(dt, speedMultiplier = 1.0) {
        if (!this.isGathering) return null;

        this.gatherElapsed += dt * speedMultiplier;
        this.gatherProgress = Utils.clamp(this.gatherElapsed / this.currentTime, 0, 1);

        if (this.gatherProgress >= 1) {
            // Gather complete!
            this.isGathering    = false;
            this.gatherProgress = 0;
            this.gatherElapsed  = 0;
            this.totalGathered += this.currentYield;
            this.gatherXP      += 1;

            // Check rare drops
            const rareResults = [];
            for (const drop of this.rareDrops) {
                if (Math.random() < drop.chance * (1 + this.level * 0.01)) {
                    rareResults.push({ ...drop });
                }
            }

            return {
                resource: this.resourceType,
                amount: this.currentYield,
                rareDrops: rareResults,
            };
        }

        return null;
    }

    /**
     * Upgrade the node. Returns true if successful.
     * @param {Function} spendGold — callback(amount) => boolean
     */
    upgrade(spendGold) {
        if (!this.canUpgrade) return false;
        const cost = this.upgradeCost;
        if (!spendGold(cost)) return false;
        this.level++;
        return true;
    }

    /**
     * Cancel an active gather (e.g. when starting a different action).
     */
    cancelGather() {
        this.isGathering    = false;
        this.gatherProgress = 0;
        this.gatherElapsed  = 0;
    }

    /**
     * Reset node for Ascension.
     */
    reset() {
        this.level          = 1;
        this.isGathering    = false;
        this.gatherProgress = 0;
        this.gatherElapsed  = 0;
        this.totalGathered  = 0;
        this.gatherXP       = 0;
    }

    // ─── Serialization ───

    toJSON() {
        return {
            id: this.id,
            level: this.level,
            totalGathered: this.totalGathered,
            gatherXP: this.gatherXP,
            workers: this.workers,
        };
    }

    static fromJSON(data, definition) {
        const node = new GatheringNode(definition);
        node.level         = data.level || 1;
        node.totalGathered = data.totalGathered || 0;
        node.gatherXP      = data.gatherXP || 0;
        node.workers       = data.workers || 0;
        return node;
    }
}

console.log('[Model] GatheringNode class loaded.');
