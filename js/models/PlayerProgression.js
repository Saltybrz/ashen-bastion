/**
 * ============================================
 *  PLAYER PROGRESSION MODEL
 *  Manages Level, XP curves (Base * Level^Exponent),
 *  Active vs Passive XP duality, auto stat gains,
 *  Skill points pool, and Respec costs.
 * ============================================
 */

class PlayerProgression {
    /**
     * @param {Object} options
     * @param {number} [options.baseXP=100]
     * @param {number} [options.exponent=1.6]
     */
    constructor(options = {}) {
        this.baseXP   = options.baseXP || 100;
        this.exponent = options.exponent || 1.8;

        // Level & Current XP
        this.level     = 1;
        this.currentXP = 0;
        this.maxLevel  = 100;

        // Dual XP Tracking
        this.activeXP  = 0; // Gained from combat kills
        this.passiveXP = 0; // Gained from Idle Hub operations
        this.totalXP   = 0;

        // Skill points (Pontos de Glifo / Habilidade)
        this.skillPoints = 1; // 1 free skill point at Level 1 for Tier 1 skill
        this.totalSkillPointsEarned = 1;

        // Rubric points (Pontos de Rúbrica - Fase 2: Nível 40 em diante)
        this.rubricPoints = 0;
        this.totalRubricPointsEarned = 0;
        this.rubricAwakened = false;

        // Attribute points (Pontos de Atributo Livres)
        this.attributePoints = 0;

        // Automatic Stat Bonuses per Level
        this.statGainsPerLevel = {
            hp: 15,          // +15 Max HP per level
            baseDamage: 2,   // +2 Base Damage per level
            maxResource: 5,  // +5 Max Resource per level
        };

        // Respec History
        this.respecCount = 0;
    }

    get isRubricUnlocked() {
        return this.level >= 40 || this.rubricAwakened;
    }

    /**
     * Required XP formula: XP_req = Base * (Level ^ Exponent)
     * @param {number} level
     * @returns {number}
     */
    getXPRequiredForLevel(level) {
        if (level >= this.maxLevel) return Infinity;
        return Math.max(50, Math.floor(this.baseXP * Math.pow(level, this.exponent)));
    }

    /**
     * XP required for current level to reach next level.
     */
    get xpToNext() {
        return this.getXPRequiredForLevel(this.level);
    }

    get xpToNextLevel() {
        return this.xpToNext;
    }

    /**
     * Progress ratio from 0 to 1 for current level
     */
    get progressRatio() {
        if (this.level >= this.maxLevel) return 1.0;
        return Math.min(1.0, this.currentXP / this.xpToNext);
    }

    /**
     * Add Active XP (from combat monsters and dungeon bosses).
     * @param {number} amount
     * @returns {{ leveled: boolean, levelsGained: number, previousLevel: number, newLevel: number, skillPointsGained: number }}
     */
    addActiveXP(amount) {
        const positiveAmount = Math.max(0, Math.floor(amount));
        this.activeXP += positiveAmount;
        this.totalXP += positiveAmount;
        return this._processXPGain(positiveAmount, 'active');
    }

    /**
     * Add Passive XP (from Idle Hub gathering, worker shifts, or passive tick).
     * @param {number} amount
     * @returns {{ leveled: boolean, levelsGained: number, previousLevel: number, newLevel: number, skillPointsGained: number }}
     */
    addPassiveXP(amount) {
        const positiveAmount = Math.max(0, Math.floor(amount));
        this.passiveXP += positiveAmount;
        this.totalXP += positiveAmount;
        return this._processXPGain(positiveAmount, 'passive');
    }

    /**
     * Core level up processing loop.
     * @private
     */
    _processXPGain(amount, source) {
        this.currentXP += amount;
        const previousLevel = this.level;
        let levelsGained = 0;

        while (this.level < this.maxLevel && this.currentXP >= this.xpToNext) {
            this.currentXP -= this.xpToNext;
            this.level++;
            levelsGained++;

            // Fase 1: Domínio da Vocação (Níveis 1 ao 40)
            if (this.level <= 40) {
                this.skillPoints++;
                this.totalSkillPointsEarned++;
            }

            // Cada nível concede 3 Pontos de Atributos livres
            this.attributePoints += 3;

            // Fase 2: O Despertar das Rúbricas (Nível 40 em diante)
            if (this.level >= 40) {
                this.rubricAwakened = true;
                // No nível 40 concede 1 ponto inicial de rúbrica, e +1 a cada nível pós-40
                this.rubricPoints++;
                this.totalRubricPointsEarned++;
            }
        }

        const leveled = levelsGained > 0;
        return {
            leveled,
            source,
            amount,
            levelsGained,
            previousLevel,
            newLevel: this.level,
            skillPointsGained: levelsGained,
            currentPoints: this.skillPoints,
        };
    }

    /**
     * Total automatic attribute gains accumulated through leveling.
     */
    getAccumulatedStatGains() {
        const levelsPassed = this.level - 1;
        return {
            hp: levelsPassed * this.statGainsPerLevel.hp,
            baseDamage: levelsPassed * this.statGainsPerLevel.baseDamage,
            maxResource: levelsPassed * this.statGainsPerLevel.maxResource,
        };
    }

    /**
     * Calculate cost for respec (redistributing skill points).
     * Consumes Idle resources (Gold and Ore).
     */
    getRespecCost() {
        // Base cost: 50 Gold + 20 Ore, scaling gently with level and previous respecs
        const goldCost = Math.floor(50 + (this.level * 15) + (this.respecCount * 40));
        const oreCost  = Math.floor(20 + (this.level * 8) + (this.respecCount * 15));

        return {
            gold: goldCost,
            ore: oreCost,
        };
    }

    /**
     * Record a respec execution.
     */
    recordRespec() {
        this.respecCount++;
    }

    /**
     * Serialize to plain JSON.
     */
    toJSON() {
        return {
            baseXP: this.baseXP,
            exponent: this.exponent,
            level: this.level,
            currentXP: this.currentXP,
            activeXP: this.activeXP,
            passiveXP: this.passiveXP,
            totalXP: this.totalXP,
            skillPoints: this.skillPoints,
            totalSkillPointsEarned: this.totalSkillPointsEarned,
            rubricPoints: this.rubricPoints,
            totalRubricPointsEarned: this.totalRubricPointsEarned,
            rubricAwakened: this.rubricAwakened,
            attributePoints: this.attributePoints,
            respecCount: this.respecCount,
        };
    }

    /**
     * Restore from plain JSON.
     */
    static fromJSON(data) {
        if (!data) return new PlayerProgression();
        const p = new PlayerProgression({
            baseXP: data.baseXP,
            exponent: data.exponent,
        });

        p.level = data.level || 1;
        p.currentXP = data.currentXP || 0;
        p.activeXP = data.activeXP || 0;
        p.passiveXP = data.passiveXP || 0;
        p.totalXP = data.totalXP || (p.activeXP + p.passiveXP);
        p.skillPoints = data.skillPoints !== undefined ? data.skillPoints : (p.level <= 40 ? p.level : 40);
        p.totalSkillPointsEarned = data.totalSkillPointsEarned || (p.level <= 40 ? p.level : 40);
        
        // Restore or compute Rubric points
        const defaultRubricEarned = p.level >= 40 ? (p.level - 39) : 0;
        p.totalRubricPointsEarned = data.totalRubricPointsEarned !== undefined ? data.totalRubricPointsEarned : defaultRubricEarned;
        p.rubricPoints = data.rubricPoints !== undefined ? data.rubricPoints : defaultRubricEarned;
        p.rubricAwakened = data.rubricAwakened !== undefined ? data.rubricAwakened : (p.level >= 40);

        p.attributePoints = data.attributePoints !== undefined ? data.attributePoints : Math.max(0, (p.level - 1) * 3);
        p.respecCount = data.respecCount || 0;

        return p;
    }
}

console.log('[Model] PlayerProgression class loaded.');
