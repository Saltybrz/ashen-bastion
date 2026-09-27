/**
 * ============================================
 *  ITEM MODEL
 *  Items with type, rarity, base stats,
 *  and procedural random affixes.
 * ============================================
 */

class Item {
    /**
     * @param {Object} opts
     * @param {string} opts.name
     * @param {string} opts.type     — ItemType
     * @param {string} opts.rarity   — Rarity
     * @param {number} opts.baseDamage
     * @param {Array}  opts.affixes  — [{ id, label, value }]
     * @param {string} opts.icon
     * @param {number} opts.itemLevel
     */
    constructor(opts = {}) {
        this.id        = opts.id        || Utils.uid();
        this.name      = opts.name      || 'Item Desconhecido';
        this.type      = opts.type      || ItemType.MATERIAL;
        this.rarity    = opts.rarity    || Rarity.COMMON;
        this.icon      = opts.icon      || ITEM_ICONS[this.type] || '❓';
        this.baseDamage= opts.baseDamage|| 0;
        this.baseArmor = opts.baseArmor || 0;
        this.affixes   = opts.affixes   || [];
        this.itemLevel = opts.itemLevel || 1;
        this.upgradeLevel = opts.upgradeLevel || 0;
        this.stackable = opts.stackable || false;
        this.quantity  = opts.quantity   || 1;
    }

    /**
     * Effective base damage including +10% per upgrade level.
     */
    get effectiveDamage() {
        if (!this.baseDamage) return 0;
        return Math.round(this.baseDamage * (1 + (this.upgradeLevel || 0) * 0.10));
    }

    /**
     * Effective base armor including +10% per upgrade level.
     */
    get effectiveArmor() {
        if (!this.baseArmor) return 0;
        return Math.round(this.baseArmor * (1 + (this.upgradeLevel || 0) * 0.10));
    }

    /**
     * Display name including +N suffix if upgraded.
     */
    get displayName() {
        return this.upgradeLevel > 0 ? `${this.name} +${this.upgradeLevel}` : this.name;
    }

    /**
     * Generate a random item with procedural affixes.
     * @param {number} itemLevel
     * @param {string} [forcedRarity]
     * @returns {Item}
     */
    static generate(itemLevel = 1, forcedRarity = null) {
        // Determine rarity
        const rarity = forcedRarity || Item._rollRarity();
        const rarityMeta = RARITY_META[rarity];

        // Determine type (equipment only)
        const equipTypes = [
            ItemType.WEAPON, ItemType.HELMET, ItemType.ARMOR,
            ItemType.BOOTS, ItemType.RING, ItemType.AMULET,
        ];
        const type = equipTypes[Utils.randInt(0, equipTypes.length - 1)];

        // Base stats scale with item level
        const baseDamage = type === ItemType.WEAPON
            ? Utils.randInt(5 + itemLevel, 10 + itemLevel * 2)
            : 0;
        const baseArmor = [ItemType.HELMET, ItemType.ARMOR, ItemType.BOOTS].includes(type)
            ? Utils.randInt(2 + itemLevel, 5 + itemLevel)
            : 0;

        // Roll affixes
        const numAffixes = Utils.randInt(0, rarityMeta.maxAffixes);
        const affixes = Item._rollAffixes(numAffixes, itemLevel);

        // Generate name
        const name = Item._generateName(type, rarity, affixes);

        return new Item({
            name,
            type,
            rarity,
            baseDamage,
            baseArmor,
            affixes,
            itemLevel,
            icon: ITEM_ICONS[type],
        });
    }

    /**
     * Roll rarity using weighted probabilities.
     */
    static _rollRarity() {
        const entries = Object.entries(RARITY_META).map(([key, meta]) => ({
            rarity: key,
            weight: meta.dropWeight,
        }));
        return Utils.weightedRandom(entries, 'weight').rarity;
    }

    /**
     * Roll N random affixes.
     */
    static _rollAffixes(count, itemLevel) {
        if (count <= 0) return [];
        const pool = [...AFFIX_POOL];
        const picked = [];
        for (let i = 0; i < count && pool.length > 0; i++) {
            const idx = Utils.randInt(0, pool.length - 1);
            const template = pool.splice(idx, 1)[0];
            const scaledMin = Math.floor(template.min * (1 + itemLevel * 0.1));
            const scaledMax = Math.floor(template.max * (1 + itemLevel * 0.15));
            const value = Utils.randInt(scaledMin, scaledMax);
            picked.push({
                id: template.id,
                label: template.label.replace('{v}', value),
                value,
                type: template.type,
            });
        }
        return picked;
    }

    /**
     * Generate a thematic item name.
     */
    static _generateName(type, rarity, affixes) {
        const prefixes = {
            [Rarity.COMMON]:    ['Simples', 'Rústico', 'Tosco'],
            [Rarity.MAGIC]:     ['Encantado', 'Brilhante', 'Arcano'],
            [Rarity.RARE]:      ['Forjado', 'Antigo', 'Nobre'],
            [Rarity.EPIC]:      ['Abissal', 'Sombrio', 'Infernal'],
            [Rarity.LEGENDARY]: ['Lendário', 'Divino', 'Eterno'],
        };
        const typeNames = {
            [ItemType.WEAPON]: ['Espada', 'Machado', 'Lâmina', 'Cetro', 'Arco'],
            [ItemType.HELMET]: ['Elmo', 'Capuz', 'Coroa', 'Tiara'],
            [ItemType.ARMOR]:  ['Armadura', 'Couraça', 'Túnica', 'Manto'],
            [ItemType.BOOTS]:  ['Botas', 'Grevas', 'Sandálias'],
            [ItemType.RING]:   ['Anel', 'Aliança', 'Argola'],
            [ItemType.AMULET]: ['Amuleto', 'Colar', 'Talismã'],
        };

        const prefix = prefixes[rarity][Utils.randInt(0, prefixes[rarity].length - 1)];
        const base   = typeNames[type][Utils.randInt(0, typeNames[type].length - 1)];

        // Legendary gets a unique suffix
        if (rarity === Rarity.LEGENDARY) {
            const suffixes = ['do Abismo', 'das Cinzas', 'do Titã', 'da Eternidade', 'do Crepúsculo'];
            return `${base} ${suffixes[Utils.randInt(0, suffixes.length - 1)]}`;
        }

        return `${prefix} ${base}`;
    }

    /**
     * Serialize.
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            rarity: this.rarity,
            icon: this.icon,
            baseDamage: this.baseDamage,
            baseArmor: this.baseArmor,
            affixes: this.affixes,
            itemLevel: this.itemLevel,
            upgradeLevel: this.upgradeLevel,
            stackable: this.stackable,
            quantity: this.quantity,
        };
    }

    static fromJSON(data) {
        if (!data) return null;
        return new Item(data);
    }
}

console.log('[Model] Item class loaded.');
