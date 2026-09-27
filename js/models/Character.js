/**
 * ============================================
 *  CHARACTER MODEL
 *  Represents the player's hero with stats,
 *  class, progression, skill tree, inventory,
 *  and resource pool.
 * ============================================
 */

class Character {
    /**
     * @param {string} classId — one of ClassType values
     * @param {string} [bloodlineId='children_of_pyre'] — one of BloodlineType values
     */
    constructor(classId, bloodlineId = 'children_of_pyre') {
        // Alias normalization
        let normClassId = (classId || '').toLowerCase();
        if (normClassId === 'warrior' || normClassId === 'warmaster') normClassId = ClassType.BARBARIAN;
        else if (normClassId === 'flagellant' || normClassId === 'rogue') normClassId = ClassType.BARBARIAN;

        let normBloodlineId = (bloodlineId || 'children_of_pyre').toLowerCase();
        if (normBloodlineId === 'flame_born') normBloodlineId = 'children_of_pyre';
        else if (normBloodlineId === 'nobility') normBloodlineId = 'decaying_nobility';
        else if (normBloodlineId === 'void') normBloodlineId = 'void_touched';
        else if (normBloodlineId === 'automaton') normBloodlineId = 'flayed_automaton';

        const def = CLASS_DEFINITIONS[normClassId];
        if (!def) throw new Error(`Unknown class: ${classId}`);

        // Identity
        this.id           = Utils.uid();
        this.classId      = normClassId;
        this.className    = def.name;
        this.classIcon    = def.icon;

        // Bloodline (Linhagem Ancestral)
        this.bloodlineId  = normBloodlineId;

        // Rubrics Astral Constellation (Teia das Rúbricas - Nv. 40+)
        this.rubricsAllocated = []; // Array of node IDs

        // Progression System (XP Curve, Dual XP, Level, Skill Points, Rubric Points)
        this.progression  = new PlayerProgression();

        // Skill Tree (4 Tiers with Mutations)
        this.skillTree    = SkillTree.createForClass(normClassId);

        // Base Attributes (mutable — grow with level / gear)
        this.baseStats = { ...def.baseStats };
        this.allocatedStats = { strength: 0, dexterity: 0, vitality: 0, faith: 0, intelligence: 0 };

        // Computed Attributes (recalculated from base + gear + bloodline + rubrics)
        this.stats = {};

        // Vitals
        this.maxHp        = 0;
        this.hp           = 0;
        this.hpRegen      = 0;
        this.resourceType = def.resourceType;
        this.resourceLabel= def.resourceLabel;
        this.maxResource  = def.resourceMax;
        this.resource     = def.resourceType === 'fury' ? 0 : def.resourceMax;

        // Combat
        this.baseDamage   = 10;
        this.armor        = 5;
        this.critChance   = 5;   // %
        this.critDamage   = 150; // %
        this.moveSpeed    = 200; // px/s in dungeon
        this.attackSpeed  = 1.0; // attacks/s
        this.lifeSteal    = 0;
        this.dodgeChance  = 0;   // %

        // Bloodline & Specialty Passives
        this.fireResist         = 0; // %
        this.burnReduction      = 0; // %
        this.goldFindBonus      = 0; // %
        this.shadowBleedBonus   = 0; // %
        this.bleedImmune        = false;
        this.thornsPct          = 0;
        this.cdrPct             = 0;
        this.resourceCostReductionPct = 0;

        // Keystones
        this.keystoneIronReflexes = false;
        this.keystoneArcaneGnosis = false;
        this.keystoneBloodPact    = false;
        this.keystoneGhostDance   = false;
        this.keystoneApotheosis   = false;
        this.poisonOnCrit         = false;
        this.riposteOnDodge       = false;

        // Inventory (flat array, max 40 slots)
        this.inventory    = [];
        this.maxInventory = 40;

        // Equipment slots
        this.equipment = {
            weapon: null,
            helmet: null,
            armor:  null,
            boots:  null,
            ring:   null,
            amulet: null,
        };

        // Starter Equipment (Section 9 & Section 35)
        if (typeof Item !== 'undefined' && typeof ItemType !== 'undefined' && typeof Rarity !== 'undefined') {
            let starterWeaponName = 'Espadão das Cinzas';
            let starterDmg = 14;
            if (this.classId === 'paladin') { starterWeaponName = 'Espada Lacerante'; starterDmg = 12; }
            else if (this.classId === 'mage') { starterWeaponName = 'Cajado de Éter Quebrado'; starterDmg = 15; }
            else if (this.classId === 'necromancer') { starterWeaponName = 'Ceifadora de Ossos'; starterDmg = 13; }

            this.equipment.weapon = new Item({
                name: starterWeaponName,
                type: ItemType.WEAPON,
                rarity: Rarity.COMMON,
                baseDamage: starterDmg,
                itemLevel: 1,
                upgradeLevel: 0,
            });

            this.equipment.armor = new Item({
                name: 'Couraça de Ferro Batido',
                type: ItemType.ARMOR,
                rarity: Rarity.COMMON,
                baseArmor: 8,
                itemLevel: 1,
                upgradeLevel: 0,
            });
        }

        // Idle Bonus (from class)
        this.idleBonus = def.idleBonus;

        // Active Potion Buffs & Status
        this.activeBuffs = {};
        this.stunImmune  = false;

        // Recalculate
        this.recalculate();
    }

    // ─── Forwarded Progression Properties ───
    get level() {
        return this.progression.level;
    }
    set level(val) {
        this.progression.level = val;
    }

    get xp() {
        return this.progression.currentXP;
    }
    set xp(val) {
        this.progression.currentXP = val;
    }

    get xpToNext() {
        return this.progression.xpToNext;
    }

    get skillPoints() {
        return this.progression.skillPoints;
    }
    set skillPoints(val) {
        this.progression.skillPoints = val;
    }

    get attributePoints() {
        return this.progression ? this.progression.attributePoints : 0;
    }
    set attributePoints(val) {
        if (this.progression) this.progression.attributePoints = val;
    }

    get activeXP() {
        return this.progression.activeXP;
    }

    get passiveXP() {
        return this.progression.passiveXP;
    }

    // Backward compatibility for skills array
    get skills() {
        return this.skillTree ? this.skillTree.getAllSkills() : [];
    }

    get unspentRubricPoints() {
        if (!this.progression) return 0;
        const total = this.progression.totalRubricPointsEarned || 0;
        return Math.max(0, total - (this.rubricsAllocated ? this.rubricsAllocated.length : 0));
    }

    get rubricPoints() {
        return this.unspentRubricPoints;
    }

    /**
     * Check if a rubric node can be allocated.
     * @param {string} nodeId
     * @returns {boolean}
     */
    canAllocateRubric(nodeId) {
        if (!this.progression || !this.progression.isRubricUnlocked) return false;
        if (this.unspentRubricPoints <= 0) return false;
        if (!this.rubricsAllocated) this.rubricsAllocated = [];
        if (this.rubricsAllocated.includes(nodeId)) return false;

        const node = typeof RUBRICS_CONSTELLATION !== 'undefined' ? RUBRICS_CONSTELLATION[nodeId] : null;
        if (!node) return false;

        // If no nodes allocated yet, can start from class origin or nexus
        if (this.rubricsAllocated.length === 0) {
            const classOriginId = `origin_${this.classId === 'barbarian' ? 'barbarian' : this.classId === 'paladin' ? 'paladin' : this.classId === 'mage' ? 'mage' : 'necro'}`;
            return nodeId === classOriginId || nodeId === 'nexus_eye';
        }

        // Must connect to an already allocated node
        for (const connId of (node.connections || [])) {
            if (this.rubricsAllocated.includes(connId)) return true;
        }

        // Also check if any allocated node lists this node in its connections
        for (const allocId of this.rubricsAllocated) {
            const allocNode = RUBRICS_CONSTELLATION[allocId];
            if (allocNode && allocNode.connections && allocNode.connections.includes(nodeId)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Allocate a rubric node in the constellation.
     * @param {string} nodeId
     * @returns {{ success: boolean, reason?: string }}
     */
    allocateRubric(nodeId) {
        if (!this.canAllocateRubric(nodeId)) {
            return { success: false, reason: 'Nó inalcançável ou sem pontos de rúbrica disponíveis.' };
        }

        this.rubricsAllocated.push(nodeId);
        this.recalculate();
        return { success: true, node: RUBRICS_CONSTELLATION[nodeId] };
    }

    /**
     * Reset all allocated rubrics and refund all points.
     */
    respecRubrics() {
        const refunded = this.rubricsAllocated ? this.rubricsAllocated.length : 0;
        this.rubricsAllocated = [];
        this.recalculate();
        return refunded;
    }

    /**
     * Recalculate all derived stats from base + equipment + level progression + bloodline + rubrics.
     */
    recalculate() {
        const def = CLASS_DEFINITIONS[this.classId] || {};
        const defBase = def.baseStats || { strength: 10, dexterity: 10, vitality: 10, faith: 10, intelligence: 10 };

        // Allocated Attribute Points bonuses
        const alloc = this.allocatedStats || {};
        const allocStr = alloc.strength || 0;
        const allocDex = alloc.dexterity || 0;
        const allocVit = alloc.vitality || 0;
        const allocFaith = (alloc.faith || 0) + (alloc.intelligence || 0);

        // Update primary baseStats on sheet (Initial class base + player allocated)
        const s = {
            strength: (defBase.strength || 10) + allocStr,
            dexterity: (defBase.dexterity || 10) + allocDex,
            vitality: (defBase.vitality || 10) + allocVit,
            faith: (defBase.faith || 10) + (alloc.faith || 0),
            intelligence: (defBase.intelligence || 10) + (alloc.intelligence || 0),
        };
        this.baseStats = { ...s };
        // Automatic stat progression from PlayerProgression
        // Primary Attribute Allocation Formulas (Phase 5 & 6):
        // - Força: +2.5 Dano Físico plano, +0.4% Multiplicador Crítico
        // - Destreza: +0.4% Vel. Ataque plano, +0.3% Chance Crítica, +0.2% Esquiva
        // - Vitalidade: +18 Vida Máxima plana, +0.8 Armadura plana
        // - Fé / Éter: +12 Recurso Máximo, +1.8 Dano Arcano/Elemental
        const bonusDamageFromAlloc = allocStr * 2.5;
        const bonusCritDmgFromAlloc = allocStr * 0.4;
        const bonusAttackSpeedFromAlloc = allocDex * 0.004; // +0.4% per point
        const bonusCritChanceFromAlloc = allocDex * 0.3;     // +0.3% per point
        const bonusDodgeFromAlloc = allocDex * 0.2;          // +0.2% per point
        const bonusHpFromAlloc = allocVit * 18;              // +18 HP per point
        const bonusArmorFromAlloc = allocVit * 0.8;          // +0.8 Armor per point
        const bonusResourceFromAlloc = allocFaith * 12;      // +12 Max Mana/Resource per point
        const bonusArcaneDmgFromAlloc = allocFaith * 1.8;    // +1.8 Arcane Dmg per point

        // Add gear bonuses
        let flatDamage = 0, flatHp = 0, flatArmor = 0;
        let pctAttack = 0, pctCrit = 0, pctCritDmg = 0, pctMoveSpeed = 0;
        let lifeSteal = 0;

        for (const slot of Object.values(this.equipment)) {
            if (!slot) continue;
            flatDamage += slot.effectiveDamage !== undefined ? slot.effectiveDamage : (slot.baseDamage || 0);
            flatArmor  += slot.effectiveArmor !== undefined ? slot.effectiveArmor : (slot.baseArmor || 0);
            for (const affix of (slot.affixes || [])) {
                switch (affix.id) {
                    case 'flat_damage':    flatDamage   += affix.value; break;
                    case 'pct_attack':     pctAttack    += affix.value; break;
                    case 'life_steal':     lifeSteal    += affix.value; break;
                    case 'crit_chance':    pctCrit      += affix.value; break;
                    case 'crit_damage':    pctCritDmg   += affix.value; break;
                    case 'flat_hp':        flatHp       += affix.value; break;
                    case 'flat_armor':     flatArmor    += affix.value; break;
                    case 'pct_move_speed': pctMoveSpeed += affix.value; break;
                }
            }
        }

        // Apply potion buffs
        let buffArmorPct = 0;
        this.stunImmune = false;
        if (this.activeBuffs) {
            for (const b of Object.values(this.activeBuffs)) {
                if (!b) continue;
                if (b.stat === 'attackSpeed') pctAttack += (b.pct || 0);
                if (b.stat === 'armor') buffArmorPct += (b.pct || 0);
                if (b.stat === 'critChance') pctCrit += (b.flat || 0);
                if (b.stunImmune) this.stunImmune = true;
            }
        }

        // ─── Apply Bloodline Bonuses ───
        let bloodlineHpPct = 0;
        let bloodlineResPct = 0;
        let bloodlineArmorFlat = 0;
        let bloodlineArmorPct = 0;
        let bloodlineAttackSpeedPct = 0;
        let bloodlineMoveSpeedPct = 0;
        this.fireResist = 0;
        this.burnReduction = 0;
        this.goldFindBonus = 0;
        this.shadowBleedBonus = 0;
        this.bleedImmune = false;

        const bDef = (typeof BLOODLINE_DEFINITIONS !== 'undefined' && BLOODLINE_DEFINITIONS[this.bloodlineId]) ? BLOODLINE_DEFINITIONS[this.bloodlineId] : null;
        if (bDef && bDef.bonuses) {
            const bb = bDef.bonuses;
            if (bb.maxHpPct) bloodlineHpPct += bb.maxHpPct;
            if (bb.fireResistPct) this.fireResist += bb.fireResistPct;
            if (bb.burnDamageReductionPct) this.burnReduction += bb.burnDamageReductionPct;
            if (bb.goldFindPct) this.goldFindBonus += bb.goldFindPct;
            if (bb.attackSpeedPct) bloodlineAttackSpeedPct += bb.attackSpeedPct;
            if (bb.maxResourcePct) bloodlineResPct += bb.maxResourcePct;
            if (bb.shadowBleedDamagePct) this.shadowBleedBonus += bb.shadowBleedDamagePct;
            if (bb.flatArmor) bloodlineArmorFlat += bb.flatArmor;
            if (bb.armorPct) bloodlineArmorPct += bb.armorPct;
            if (bb.bleedImmune) this.bleedImmune = true;
            if (bb.moveSpeedPct) bloodlineMoveSpeedPct += bb.moveSpeedPct;
        }

        // ─── Apply Rubrics Constellation Bonuses ───
        let rubricHpPct = 0;
        let rubricHpFlat = 0;
        let rubricHpRegen = 0;
        let rubricDmgFlat = 0;
        let rubricDmgPct = 0;
        let rubricArmorFlat = 0;
        let rubricArmorPct = 0;
        let rubricResourcePct = 0;
        let rubricCritChance = 0;
        let rubricCritDamage = 0;
        let rubricLifeSteal = 0;
        let rubricDodgeChance = 0;

        this.thornsPct = 0;
        this.cdrPct = 0;
        this.resourceCostReductionPct = 0;
        this.keystoneIronReflexes = false;
        this.keystoneArcaneGnosis = false;
        this.keystoneBloodPact    = false;
        this.keystoneGhostDance   = false;
        this.keystoneApotheosis   = false;
        this.poisonOnCrit         = false;
        this.riposteOnDodge       = false;

        if (this.rubricsAllocated && typeof RUBRICS_CONSTELLATION !== 'undefined') {
            for (const rId of this.rubricsAllocated) {
                const rNode = RUBRICS_CONSTELLATION[rId];
                if (!rNode || !rNode.stats) continue;
                const rst = rNode.stats;

                if (rst.maxHpPct) rubricHpPct += rst.maxHpPct;
                if (rst.flatHp) rubricHpFlat += rst.flatHp;
                if (rst.hpRegen) rubricHpRegen += rst.hpRegen;
                if (rst.baseDamage) rubricDmgFlat += rst.baseDamage;
                if (rst.damagePct) rubricDmgPct += rst.damagePct;
                if (rst.armor) rubricArmorFlat += rst.armor;
                if (rst.armorPct) rubricArmorPct += rst.armorPct;
                if (rst.maxResourcePct) rubricResourcePct += rst.maxResourcePct;
                if (rst.critChance) rubricCritChance += rst.critChance;
                if (rst.critDamage) rubricCritDamage += rst.critDamage;
                if (rst.lifeSteal) rubricLifeSteal += rst.lifeSteal;
                if (rst.dodgeChance) rubricDodgeChance += rst.dodgeChance;
                if (rst.shadowBleedDamagePct) this.shadowBleedBonus += rst.shadowBleedDamagePct;
                if (rst.thornsPct) this.thornsPct += rst.thornsPct;
                if (rst.cdrPct) this.cdrPct += rst.cdrPct;
                if (rst.resourceCostReductionPct) this.resourceCostReductionPct += rst.resourceCostReductionPct;

                // Keystones and special notables
                if (rst.keystoneIronReflexes) this.keystoneIronReflexes = true;
                if (rst.keystoneArcaneGnosis) this.keystoneArcaneGnosis = true;
                if (rst.keystoneBloodPact)    this.keystoneBloodPact = true;
                if (rst.keystoneGhostDance)   this.keystoneGhostDance = true;
                if (rst.keystoneApotheosis)   this.keystoneApotheosis = true;
                if (rst.poisonOnCrit)         this.poisonOnCrit = true;
                if (rst.riposteOnDodge)       this.riposteOnDodge = true;
                if (rst.stunImmune)           this.stunImmune = true;
            }
        }

        // Base Calculations
        const autoGains = (this.progression && typeof this.progression.getAccumulatedStatGains === 'function')
            ? this.progression.getAccumulatedStatGains()
            : {
                hp: ((this.level || 1) - 1) * 15,
                baseDamage: ((this.level || 1) - 1) * 2,
                maxResource: ((this.level || 1) - 1) * 5,
            };

        const primaryKey = def.primaryStat || 'strength';
        const basePrimaryVal = defBase[primaryKey] || 10;

        // Damage Calculation
        const rawBaseDamage = 10 + Math.floor(basePrimaryVal * 1.5) + autoGains.baseDamage + flatDamage + bonusDamageFromAlloc + rubricDmgFlat;
        this.baseDamage = Math.round(rawBaseDamage * (1 + (rubricDmgPct / 100)));
        this.arcaneDamage = bonusArcaneDmgFromAlloc;

        // Max HP Calculation (Base + Vitality + Gear + AutoGains + Rubrics + Bloodline)
        const baseHpCalc = 50 + (defBase.vitality || 10) * 8 + autoGains.hp + flatHp + bonusHpFromAlloc + rubricHpFlat;
        const totalHpPct = bloodlineHpPct + rubricHpPct;
        this.maxHp = Math.round(baseHpCalc * (1 + totalHpPct / 100));

        // HP Regeneration
        this.hpRegen = rubricHpRegen;

        // Max Resource Calculation
        const baseResCalc = def.resourceMax + autoGains.maxResource + bonusResourceFromAlloc;
        const totalResPct = bloodlineResPct + rubricResourcePct;
        this.maxResource = Math.round(baseResCalc * (1 + totalResPct / 100));

        // Armor Calculation
        const rawArmor = 5 + Math.floor((defBase.vitality || 10) * 0.5) + flatArmor + bonusArmorFromAlloc + bloodlineArmorFlat + rubricArmorFlat;
        const totalArmorPct = buffArmorPct + bloodlineArmorPct + rubricArmorPct;
        this.armor = Math.round(rawArmor * (1 + totalArmorPct / 100));

        // Crit Chance & Damage
        this.critChance = Math.min(95, 5 + Math.floor((defBase.dexterity || 10) * 0.3) + pctCrit + bonusCritChanceFromAlloc + rubricCritChance);
        this.critDamage = 150 + pctCritDmg + bonusCritDmgFromAlloc + rubricCritDamage;

        // Attack & Move Speed
        const totalAttackPct = pctAttack + bloodlineAttackSpeedPct;
        this.attackSpeed = (1.0 + bonusAttackSpeedFromAlloc) * (1 + totalAttackPct / 100);
        const totalMovePct = pctMoveSpeed + bloodlineMoveSpeedPct;
        this.moveSpeed = 200 * (1 + totalMovePct / 100);

        // Life Steal
        this.lifeSteal = lifeSteal + rubricLifeSteal;
        if (this.keystoneBloodPact) {
            this.lifeSteal += 8;
        }

        // Dodge Chance
        this.dodgeChance = Math.min(75, Math.floor((defBase.dexterity || 10) * 0.2) + bonusDodgeFromAlloc + rubricDodgeChance);

        // Keystone Conversions:
        // Keystone 1: Iron Reflexes (Vigor de Ferro) -> Converte toda a esquiva em armadura plana (+2 armor / 1% dodge), dodge = 0, stunImmune = true
        if (this.keystoneIronReflexes) {
            this.armor += Math.round(this.dodgeChance * 2);
            this.dodgeChance = 0;
            this.stunImmune = true;
        }

        // Keystone 2: Arcane Gnosis (Gnose Arcana) -> 50% de armadura vira Dano Crítico (+1% crit dmg por 2 de armor), -12% Max HP
        if (this.keystoneArcaneGnosis) {
            const convertedArmor = Math.floor(this.armor * 0.5);
            this.critDamage += Math.round(convertedArmor * 0.5);
            this.maxHp = Math.max(1, Math.round(this.maxHp * 0.88));
        }

        // Ensure HP & Resource don't exceed new max
        if (this.hp === 0 || this.hp > this.maxHp) {
            this.hp = this.maxHp;
        }
        if (this.resource > this.maxResource) {
            this.resource = this.maxResource;
        }

        this.rubricPoisonCrit = this.poisonOnCrit;
        this.rubricRiposte = this.riposteOnDodge;

        this.stats = {
            ...s,
            damage: this.baseDamage,
            critDamage: this.critDamage,
            attackSpeed: this.attackSpeed,
            critChance: this.critChance,
            maxHp: this.maxHp,
            hpRegen: this.hpRegen,
            armor: this.armor,
            maxResource: this.maxResource,
            arcaneDamage: this.arcaneDamage,
            dodgeChance: this.dodgeChance,
            lifeSteal: this.lifeSteal,
            fireResist: this.fireResist,
            goldFindBonus: this.goldFindBonus,
            shadowBleedBonus: this.shadowBleedBonus,
        };
    }

    /**
     * Alias for recalculate to conform to specification.
     */
    recalculateDerivedStats() {
        return this.recalculate();
    }

    /**
     * Award XP with support for Active vs Passive sources.
     * @param {number} amount
     * @param {'active'|'passive'} [source='active']
     * @returns {boolean} true if leveled up
     */
    addXP(amount, source = 'active') {
        const result = source === 'passive'
            ? this.progression.addPassiveXP(amount)
            : this.progression.addActiveXP(amount);

        if (result.leveled) {
            this.recalculate();
            this.hp = this.maxHp; // Full heal on level up
            if (this.resourceType !== 'fury') {
                this.resource = this.maxResource;
            }
        }

        return result.leveled;
    }

    /**
     * Try to add an item to inventory. Returns false if full.
     */
    addItem(item) {
        if (this.inventory.length >= this.maxInventory) return false;
        this.inventory.push(item);
        return true;
    }

    /**
     * Equip an item from inventory.
     */
    equipItem(itemId) {
        const idx = this.inventory.findIndex(it => it.id === itemId);
        if (idx === -1) return false;

        const item = this.inventory[idx];
        const slot = this._getEquipSlot(item.type);
        if (!slot) return false;

        // Unequip current if any
        if (this.equipment[slot]) {
            this.inventory.push(this.equipment[slot]);
        }

        this.equipment[slot] = item;
        this.inventory.splice(idx, 1);
        this.recalculateDerivedStats();
        return true;
    }

    /**
     * Unequip an item from an equipment slot back to inventory.
     * @param {'weapon'|'armor'|'ring'|'amulet'|'helmet'|'boots'} slot
     * @returns {boolean}
     */
    unequipItem(slot) {
        if (!this.equipment || !this.equipment[slot]) return false;
        if (this.inventory.length >= this.maxInventory) return false;

        const item = this.equipment[slot];
        this.equipment[slot] = null;
        this.inventory.push(item);
        this.recalculateDerivedStats();
        return true;
    }

    _getEquipSlot(itemType) {
        const map = {
            [ItemType.WEAPON]: 'weapon',
            [ItemType.HELMET]: 'helmet',
            [ItemType.ARMOR]:  'armor',
            [ItemType.BOOTS]:  'boots',
            [ItemType.RING]:   'ring',
            [ItemType.AMULET]: 'amulet',
        };
        return map[itemType] || null;
    }

    /**
     * Serialize for save/load.
     */
    toJSON() {
        return {
            id: this.id,
            classId: this.classId,
            bloodlineId: this.bloodlineId,
            rubricsAllocated: [...(this.rubricsAllocated || [])],
            progression: this.progression.toJSON(),
            skillTree: this.skillTree ? this.skillTree.toJSON() : null,
            hp: this.hp,
            resource: this.resource,
            attributePoints: this.attributePoints,
            baseStats: this.baseStats,
            allocatedStats: this.allocatedStats,
            inventory: this.inventory,
            equipment: this.equipment,
        };
    }

    /**
     * Restore from saved data.
     */
    static fromJSON(data) {
        const char = new Character(data.classId, data.bloodlineId || 'children_of_pyre');
        char.id = data.id;
        char.bloodlineId = data.bloodlineId || 'children_of_pyre';
        char.rubricsAllocated = Array.isArray(data.rubricsAllocated) ? [...data.rubricsAllocated] : [];

        if (data.progression) {
            char.progression = PlayerProgression.fromJSON(data.progression);
        } else {
            char.progression.level = data.level || 1;
            char.progression.currentXP = data.xp || 0;
            char.progression.skillPoints = data.skillPoints || (char.progression.level <= 40 ? char.progression.level : 40);
            char.progression.attributePoints = data.attributePoints || ((char.progression.level - 1) * 3);
        }

        if (data.attributePoints !== undefined) {
            char.attributePoints = data.attributePoints;
        }

        if (data.skillTree) {
            char.skillTree = SkillTree.fromJSON(data.skillTree);
        } else {
            char.skillTree = SkillTree.createForClass(data.classId);
        }

        char.baseStats = data.baseStats || char.baseStats;
        char.allocatedStats = data.allocatedStats || { strength: 0, dexterity: 0, vitality: 0, faith: 0, intelligence: 0 };
        char.inventory = (data.inventory || []).map(Item.fromJSON);
        char.equipment = {};
        for (const [slot, itemData] of Object.entries(data.equipment || {})) {
            char.equipment[slot] = itemData ? Item.fromJSON(itemData) : null;
        }

        char.recalculate();
        char.hp = data.hp || char.maxHp;
        char.resource = data.resource !== undefined ? data.resource : char.maxResource;
        return char;
    }
}

console.log('[Model] Character class loaded.');
