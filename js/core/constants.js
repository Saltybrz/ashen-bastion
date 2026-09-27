/**
 * ============================================
 *  CONSTANTS — Game-wide definitions
 *  The Last Bastion: Abyssal Rift
 * ============================================
 */

// ─── Loop & Timing Constants ───
const IDLE_TICK_MS  = 100;    // 10 Hz — smooth progress bars
const AUTO_TICK_MS  = 1000;   // 1 Hz — worker gathering & regeneration
const SAVE_INTERVAL = 30000;  // 30s — auto-save interval

// ─── Resource Types ───
const ResourceType = Object.freeze({
    WOOD:    'wood',
    ORE:     'ore',
    GOLD:    'gold',
    ASHES:   'ashes',    // Cinzas Sagradas (rebirth currency)
    ESSENCE: 'essence',  // Essências Mágicas
});

const RESOURCE_META = {
    [ResourceType.WOOD]:    { icon: 'ᚱ', label: 'Madeira',          color: '#825b2d' },
    [ResourceType.ORE]:     { icon: '🜛', label: 'Minério',          color: '#6b7280' },
    [ResourceType.GOLD]:    { icon: '🜚', label: 'Ouro',             color: '#c5a059' },
    [ResourceType.ASHES]:   { icon: 'ᛟ', label: 'Cinzas Sagradas',  color: '#c24b1a' },
    [ResourceType.ESSENCE]: { icon: 'ᛤ', label: 'Essências Mágicas', color: '#7e57c2' },
};

// ─── Item Rarity ───
const Rarity = Object.freeze({
    COMMON:    'common',
    MAGIC:     'magic',
    RARE:      'rare',
    EPIC:      'epic',
    LEGENDARY: 'legendary',
});

const RARITY_META = {
    [Rarity.COMMON]:    { label: 'Comum',      color: '#8a8580', maxAffixes: 0, dropWeight: 60 },
    [Rarity.MAGIC]:     { label: 'Mágico',     color: '#4a7bb0', maxAffixes: 2, dropWeight: 25 },
    [Rarity.RARE]:      { label: 'Raro',       color: '#c5a059', maxAffixes: 4, dropWeight: 10 },
    [Rarity.EPIC]:      { label: 'Épico',      color: '#864b9b', maxAffixes: 5, dropWeight: 4  },
    [Rarity.LEGENDARY]: { label: 'Lendário',   color: '#d97706', maxAffixes: 6, dropWeight: 1  },
};

// ─── Item Types ───
const ItemType = Object.freeze({
    WEAPON:     'weapon',
    HELMET:     'helmet',
    ARMOR:      'armor',
    BOOTS:      'boots',
    RING:       'ring',
    AMULET:     'amulet',
    MATERIAL:   'material',
    KEY:        'key',
    CONSUMABLE: 'consumable',
});

const ITEM_ICONS = {
    [ItemType.WEAPON]:     '†',
    [ItemType.HELMET]:     '⊓',
    [ItemType.ARMOR]:      '⛊',
    [ItemType.BOOTS]:      '⍡',
    [ItemType.RING]:       '○',
    [ItemType.AMULET]:     '◇',
    [ItemType.MATERIAL]:   'ᛟ',
    [ItemType.KEY]:        '⚿',
    [ItemType.CONSUMABLE]: '🜂',
};

// ─── Affix Pool ───
const AFFIX_POOL = [
    { id: 'flat_damage',     label: '+{v} Dano Base',         min: 3,   max: 25,  type: 'flat'    },
    { id: 'pct_attack',      label: '+{v}% Velocidade Ataque',min: 5,   max: 30,  type: 'percent' },
    { id: 'life_steal',      label: '+{v}% Roubo de Vida',    min: 1,   max: 8,   type: 'percent' },
    { id: 'crit_chance',     label: '+{v}% Chance Crítica',   min: 2,   max: 15,  type: 'percent' },
    { id: 'crit_damage',     label: '+{v}% Dano Crítico',     min: 10,  max: 80,  type: 'percent' },
    { id: 'flat_hp',         label: '+{v} Vida',              min: 10,  max: 100, type: 'flat'    },
    { id: 'flat_armor',      label: '+{v} Armadura',          min: 5,   max: 40,  type: 'flat'    },
    { id: 'pct_move_speed',  label: '+{v}% Vel. Movimento',   min: 3,   max: 15,  type: 'percent' },
    { id: 'fire_damage',     label: '+{v} Dano de Fogo',      min: 5,   max: 30,  type: 'flat'    },
    { id: 'ice_damage',      label: '+{v} Dano de Gelo',      min: 5,   max: 30,  type: 'flat'    },
    { id: 'pct_gold_find',   label: '+{v}% Ouro Encontrado',  min: 5,   max: 25,  type: 'percent' },
    { id: 'pct_xp',          label: '+{v}% XP Bônus',         min: 5,   max: 20,  type: 'percent' },
];

// ─── Difficulty Definitions ───
const DifficultyType = Object.freeze({
    PILGRIM:   'pilgrim',
    NORMAL:    'pilgrim',
    VETERAN:   'veteran',
    NIGHTMARE: 'veteran',
    ABYSSAL:   'abyssal',
    TORMENT:   'abyssal',
});

const DIFFICULTY_DEFINITIONS = {
    [DifficultyType.PILGRIM]: {
        id: DifficultyType.PILGRIM,
        name: 'Peregrino',
        subtitle: 'Normal',
        glyph: 'ᚱ',
        rune: 'ᚱ',
        description: 'Inimigos padrão. Derrota na masmorra resulta na perda de apenas 25% dos recursos coletados naquela incursão.',
        enemyHpMult: 1.0,
        enemyDmgMult: 1.0,
        magicDropBonus: 0.0,
        lootQualityBonus: 0.0,
        deathLossPercent: 0.25,
        deathLootLoss: 0.25,
        breakKeyOnDeath: false,
        breaksKeyOnDeath: false,
    },
    [DifficultyType.VETERAN]: {
        id: DifficultyType.VETERAN,
        name: 'Veterano',
        subtitle: 'Pesadelo',
        glyph: 'ᚦ',
        rune: 'ᚦ',
        description: 'Inimigos com +45% de Vida e +35% de Dano. Drop rate de itens Mágicos/Raros aumentado em +30%. Penalidade de morte: perda de 60% do loot da incursão.',
        enemyHpMult: 1.45,
        enemyDmgMult: 1.35,
        magicDropBonus: 0.30,
        lootQualityBonus: 0.30,
        deathLossPercent: 0.60,
        deathLootLoss: 0.60,
        breakKeyOnDeath: false,
        breaksKeyOnDeath: false,
    },
    [DifficultyType.ABYSSAL]: {
        id: DifficultyType.ABYSSAL,
        name: 'Abissal',
        subtitle: 'Tormento',
        glyph: 'ᛟ',
        rune: 'ᛟ',
        description: 'Inimigos com +110% de Vida e +80% de Dano, com afixos de elite ativados desde o primeiro andar. Chance de itens Raros/Lendários dobrada (+100%). Penalidade de morte: perda integral de todo o loot da expedição e quebra da Chave da Fenda.',
        enemyHpMult: 2.10,
        enemyDmgMult: 1.80,
        magicDropBonus: 1.00,
        lootQualityBonus: 1.00,
        deathLossPercent: 1.00,
        deathLootLoss: 1.00,
        breakKeyOnDeath: true,
        breaksKeyOnDeath: true,
    },
};

// ─── Class Definitions ───
const ClassType = Object.freeze({
    BARBARIAN:   'barbarian',
    PALADIN:     'paladin',
    MAGE:        'mage',
    NECROMANCER: 'necromancer',
});

const CLASS_DEFINITIONS = {
    [ClassType.BARBARIAN]: {
        id: ClassType.BARBARIAN,
        name: 'Bárbaro',
        epithet: 'O Quebrador de Hordas',
        icon: 'ᛏ',
        glyph: 'ᛏ',
        role: 'Corpo a corpo brutal, sustento via Fúria em combate',
        description: 'Especialista em carnificina física em área e sustentação violenta. Sua Fúria é forjada na dor dos golpes desferidos e sofridos.',
        primaryStat: 'strength',
        resourceType: 'fury',
        resourceLabel: 'Fúria',
        resourceMax: 100,
        resourceColor: 'fury',
        baseStats: { strength: 18, dexterity: 10, intelligence: 6, vitality: 14, faith: 4 },
        idleBonus: { type: 'gathering_speed', targets: [ResourceType.WOOD, ResourceType.ORE], value: 0.25, label: '+25% de extração de madeira e minérios por vigor bruto.' },
        skills: [
            { id: 'barb_heavy_strike',    name: 'Golpe Pesado',       icon: 'ᛏ', key: '1', tier: 1, cooldown: 0.35, cost: 0,  desc: 'Golpe potente que gera 15 de Fúria ao acertar.' },
            { id: 'barb_leap_slam',       name: 'Salto Esmagador',    icon: 'ᚦ', key: '2', tier: 2, cooldown: 5.0,  cost: 10, desc: 'Salto brutal com invulnerabilidade e atordoamento de 1.5s.' },
            { id: 'barb_whirlwind',       name: 'Torvelinho',         icon: 'ᛗ', key: '3', tier: 3, cooldown: 0.2,  cost: 12, desc: 'Gira continuamente causando dano em 360° consumindo Fúria.' },
            { id: 'barb_ancestral_wrath', name: 'Fúria Ancestral',    icon: 'ᚱ', key: '4', tier: 4, cooldown: 25.0, cost: 40, desc: 'Onda sísmica devastadora e +50% de dano e velocidade.' },
        ],
    },
    [ClassType.PALADIN]: {
        id: ClassType.PALADIN,
        name: 'Paladino',
        epithet: 'O Guardião do Crepúsculo',
        icon: 'ᛉ',
        glyph: 'ᛉ',
        role: 'Defesa impenetrável, auras sagradas e dano reflexivo',
        description: 'Baluarte de fé inabalável. Bloqueia investidas demoníacas, reflete dano contra os ímpios e canaliza luz de cura passiva.',
        primaryStat: 'strength',
        resourceType: 'faith',
        resourceLabel: 'Fé',
        resourceMax: 80,
        resourceColor: 'faith',
        baseStats: { strength: 15, dexterity: 8, intelligence: 10, vitality: 16, faith: 12 },
        idleBonus: { type: 'upgrade_discount', value: 0.15, label: '-15% no custo de ouro para erguer o acampamento.' },
        skills: [
            { id: 'pal_hammer_light',   name: 'Martelo da Luz',       icon: 'ᛉ', key: '1', tier: 1, cooldown: 0.4,  cost: 5,  desc: 'Dano físico frontal e pulso sagrado curto em arco.' },
            { id: 'pal_shield_charge',  name: 'Investida com Escudo', icon: '⛊', key: '2', tier: 2, cooldown: 4.5,  cost: 15, desc: 'Empurra inimigos com knockback e bloqueia projéteis frontais.' },
            { id: 'pal_blessed_shield', name: 'Escudo Abençoado',     icon: '☩', key: '3', tier: 3, cooldown: 5.5,  cost: 25, desc: 'Projétil sagrado que ricocheteia em até 3 alvos.' },
            { id: 'pal_consecration',   name: 'Consagração',          icon: '🜚', key: '4', tier: 4, cooldown: 22.0, cost: 45, desc: 'Solo sagrado duradouro com cura e dano contínuo.' },
        ],
    },
    [ClassType.MAGE]: {
        id: ClassType.MAGE,
        name: 'Feiticeiro',
        epithet: 'O Tecelão do Éter',
        icon: 'ᛋ',
        glyph: 'ᛋ',
        role: 'Combate à distância devastador com mana, canhão de vidro',
        description: 'Manipula as correntes instáveis da fenda mágica. Sacrifica armadura física por aniquilação elemental absoluta.',
        primaryStat: 'intelligence',
        resourceType: 'mana',
        resourceLabel: 'Mana',
        resourceMax: 120,
        resourceColor: 'mana',
        baseStats: { strength: 5, dexterity: 10, intelligence: 20, vitality: 8, faith: 6 },
        idleBonus: { type: 'essence_conversion', value: 1.0, label: 'Transmuta matéria-prima bruta em essências mágicas refinadas.' },
        skills: [
            { id: 'mage_arcane_missile', name: 'Projétil Arcano',   icon: 'ᛋ', key: '1', tier: 1, cooldown: 0.3,  cost: 8,  desc: 'Disparo veloz de energia mágica em direção ao cursor.' },
            { id: 'mage_teleport',       name: 'Teleporte',         icon: 'ᛤ', key: '2', tier: 2, cooldown: 4.0,  cost: 20, desc: 'Dash instantâneo ignorando corpos e concedendo i-frames.' },
            { id: 'mage_elemental_orb',  name: 'Orbe Elemental',    icon: '🜄', key: '3', tier: 3, cooldown: 6.0,  cost: 35, desc: 'Esfera lenta perfurante de alto impacto (Gélido ou Ígneo).' },
            { id: 'mage_meteor_shower',  name: 'Chuva de Meteoros', icon: '🜂', key: '4', tier: 4, cooldown: 20.0, cost: 60, desc: 'Impacto massivo com círculos telegrafados de destruição.' },
        ],
    },
    [ClassType.NECROMANCER]: {
        id: ClassType.NECROMANCER,
        name: 'Necromante',
        epithet: 'O Senhor das Carcaças',
        icon: 'ᛡ',
        glyph: 'ᛡ',
        role: 'Enxame de servos cadavéricos, maldições e detonação de corpos',
        description: 'Senhor dos ossos esquecidos. Extrai almas com cortes espectrais e detona carcaças deixadas na trilha de sangue.',
        primaryStat: 'intelligence',
        resourceType: 'mana',
        resourceLabel: 'Essência Sombria',
        resourceMax: 100,
        resourceColor: 'mana',
        baseStats: { strength: 6, dexterity: 8, intelligence: 17, vitality: 12, faith: 8 },
        idleBonus: { type: 'auto_collect', value: 1.0, label: 'Espíritos penados automatizam tarefas sem custo salarial.' },
        skills: [
            { id: 'necro_reaping_scythe',    name: 'Foice Ceifadora',       icon: 'ᛡ', key: '1', tier: 1, cooldown: 0.38, cost: 5,  desc: 'Corte em cone gerando fragmentos de alma ao atingir.' },
            { id: 'necro_spectral_step',     name: 'Passo Espectral',       icon: '🜛', key: '2', tier: 2, cooldown: 5.0,  cost: 15, desc: 'Invulnerabilidade temporal com +80% de velocidade.' },
            { id: 'necro_corpse_explosion',  name: 'Explosão de Cadáveres', icon: 'ᚾ', key: '3', tier: 3, cooldown: 1.5,  cost: 20, desc: 'Detona carcaças geradas pelos monstros abatidos.' },
            { id: 'necro_flesh_titan',       name: 'Titã Cadavérico',       icon: 'ᛣ', key: '4', tier: 4, cooldown: 30.0, cost: 50, desc: 'Evoca um lacaio tanque permanente com taunt e pancadas.' },
        ],
    },
};

// ─── Gathering Node Definitions ───
const NODE_DEFINITIONS = [
    {
        id: 'wood_grove',
        name: 'Bosque Rúnico',
        icon: 'ᚱ',
        resourceType: ResourceType.WOOD,
        baseTime: 2.0,
        baseYield: 3,
        baseUpgradeCost: 25,
        upgradeCostRate: 1.35,
        timeReductionPerLevel: 0.08,
        yieldBonusPerLevel: 1,
        maxLevel: 50,
        rareDrops: [
            { name: 'Fibra Rúnica', icon: 'ᛟ', chance: 0.03 },
            { name: 'Seiva Ancestral', icon: '🜄', chance: 0.01 },
        ],
        accentColor: '#386641',
        accentColorLight: '#4d8b59',
    },
    {
        id: 'iron_mine',
        name: 'Veio de Ferro Negro',
        icon: '🜛',
        resourceType: ResourceType.ORE,
        baseTime: 3.0,
        baseYield: 2,
        baseUpgradeCost: 40,
        upgradeCostRate: 1.40,
        timeReductionPerLevel: 0.07,
        yieldBonusPerLevel: 1,
        maxLevel: 50,
        rareDrops: [
            { name: 'Gema Bruta', icon: '◇', chance: 0.04 },
            { name: 'Mithril Ancestral', icon: '☩', chance: 0.008 },
        ],
        accentColor: '#4a7bb0',
        accentColorLight: '#6a9bd0',
    },
    {
        id: 'gold_stream',
        name: 'Tributo de Ouro',
        icon: '🜚',
        resourceType: ResourceType.GOLD,
        baseTime: 4.0,
        baseYield: 5,
        baseUpgradeCost: 60,
        upgradeCostRate: 1.45,
        timeReductionPerLevel: 0.06,
        yieldBonusPerLevel: 2,
        maxLevel: 50,
        rareDrops: [
            { name: 'Selo Solar Arcaico', icon: '🜚', chance: 0.02 },
        ],
        accentColor: '#c5a059',
        accentColorLight: '#dfcaa2',
    },
];

// ─── Worker Definitions ───
const WORKER_DEFINITIONS = [
    {
        id: 'lumberjack',
        name: 'Servo do Machado',
        icon: 'ᛏ',
        description: 'Extrai Madeira continuamente para a forja.',
        nodeId: 'wood_grove',
        baseCost: 50,
        costRate: 1.5,
        gatherInterval: 5,
        gatherAmount: 1,
    },
    {
        id: 'miner',
        name: 'Minerador das Profundezas',
        icon: '🜛',
        description: 'Arranca Minério das entranhas da rocha.',
        nodeId: 'iron_mine',
        baseCost: 80,
        costRate: 1.5,
        gatherInterval: 6,
        gatherAmount: 1,
    },
    {
        id: 'gold_panner',
        name: 'Cobrador de Dízimo',
        icon: '🜚',
        description: 'Recolhe Ouro das cinzas do bastião.',
        nodeId: 'gold_stream',
        baseCost: 120,
        costRate: 1.6,
        gatherInterval: 8,
        gatherAmount: 2,
    },
    {
        id: 'automaton',
        name: 'Golem de Runa Antiga',
        icon: '⚙',
        description: 'Canaliza todos os recursos sem repouso.',
        nodeId: 'all',
        baseCost: 500,
        costRate: 2.0,
        gatherInterval: 10,
        gatherAmount: 1,
    },
];

// ─── Dungeon Key Cost ───
const DUNGEON_KEY_COST = {
    [ResourceType.WOOD]: 30,
    [ResourceType.ORE]:  20,
    [ResourceType.GOLD]: 15,
};

// ─── XP Progression Formula ───
const XP_BASE = 100;
const XP_EXPONENT = 1.6;
const XP_TABLE = [];
for (let i = 0; i <= 100; i++) {
    XP_TABLE[i] = Math.max(50, Math.floor(XP_BASE * Math.pow(Math.max(1, i), XP_EXPONENT)));
}

// ─── Ascension (Rebirth) ───
const ASCENSION_BASE_ASHES = 5;
const ASCENSION_MULTIPLIER_PER_ASH = 0.05;

// ─── Elixirs & Alchemy (Caldeirão Alquímico) ───
const ELIXIR_DEFINITIONS = {
    flint_extract: {
        id: 'flint_extract',
        name: 'Extrato de Pederneira',
        icon: '🜂',
        desc: '+15% de Velocidade de Ataque por 90s',
        duration: 90,
        cost: { [ResourceType.WOOD]: 25, [ResourceType.ORE]: 15, [ResourceType.GOLD]: 20 },
        buff: { stat: 'attackSpeed', pct: 15, duration: 90 },
    },
    black_iron_oil: {
        id: 'black_iron_oil',
        name: 'Óleo de Ferro Negro',
        icon: '🜛',
        desc: '+25% de Armadura e Imunidade a atordoamentos por 60s',
        duration: 60,
        cost: { [ResourceType.ORE]: 35, [ResourceType.GOLD]: 40, [ResourceType.ESSENCE]: 2 },
        buff: { stat: 'armor', pct: 25, stunImmune: true, duration: 60 },
    },
    hidden_eye_tincture: {
        id: 'hidden_eye_tincture',
        name: 'Tintura do Olho Oculto',
        icon: '◇',
        desc: '+10% de Chance Crítica por 120s',
        duration: 120,
        cost: { [ResourceType.WOOD]: 30, [ResourceType.GOLD]: 50, [ResourceType.ESSENCE]: 3 },
        buff: { stat: 'critChance', flat: 10, duration: 120 },
    },
    unstable_ether_flask: {
        id: 'unstable_ether_flask',
        name: 'Frasco de Éter Instável',
        icon: 'ᛟ',
        desc: 'Restaura 40% do recurso de classe instantaneamente (cooldown de 30s)',
        cooldown: 30,
        cost: { [ResourceType.GOLD]: 30, [ResourceType.ESSENCE]: 5, [ResourceType.ASHES]: 1 },
        instantResource: 0.40,
    },
};

// ─── Market Barter Rates (A Feira das Cinzas) ───
const BARTER_RATES = {
    wood_to_ore: {
        id: 'wood_to_ore',
        name: 'Madeira em Minério',
        from: ResourceType.WOOD,
        to: ResourceType.ORE,
        fromAmount: 3,
        toAmount: 1,
        label: '3 Madeira → 1 Minério',
    },
    ore_to_gold: {
        id: 'ore_to_gold',
        name: 'Minério em Ouro',
        from: ResourceType.ORE,
        to: ResourceType.GOLD,
        fromAmount: 2,
        toAmount: 1,
        label: '2 Minério → 1 Ouro',
    },
    gold_to_wood: {
        id: 'gold_to_wood',
        name: 'Ouro em Madeira',
        from: ResourceType.GOLD,
        to: ResourceType.WOOD,
        fromAmount: 5,
        toAmount: 1,
        label: '5 Ouro → 1 Madeira',
    },
};

// ─── Market Provisions (Mercador de Provisões) ───
const MARKET_PROVISIONS = {
    key: {
        id: 'key',
        name: 'Chave da Fenda',
        icon: '⚿',
        goldCost: 150,
        maxStock: 99,
        desc: 'Acesso imediato às profundezas da Fenda Abissal.',
    },
    essence: {
        id: 'essence',
        name: 'Essência Arcana',
        icon: 'ᛟ',
        goldCost: 75,
        maxStock: 5,
        desc: 'Destilado etéreo para transmutações e alquimia.',
    },
    ashes: {
        id: 'ashes',
        name: 'Fragmento de Cinzas',
        icon: '🜂',
        goldCost: 300,
        maxStock: 2,
        desc: 'Resíduo sagrado de titãs para forja e ascensão.',
    },
};

// ─── Bounty Templates (O Quadro de Editais) ───
const BOUNTY_TEMPLATES = [
    {
        id: 'hunt_skeletons',
        type: 'hunt',
        title: 'Purificação dos Rastejantes',
        desc: 'Elimine 10 inimigos rastejantes na Masmorra.',
        targetType: 'any_enemy',
        targetCount: 10,
        reward: { xp: 300, gold: 80 },
    },
    {
        id: 'hunt_slaughter',
        type: 'hunt',
        title: 'Chacina das Profundezas',
        desc: 'Elimine 20 aberrações na Masmorra.',
        targetType: 'any_enemy',
        targetCount: 20,
        reward: { xp: 650, gold: 160, keys: 1 },
    },
    {
        id: 'hunt_elites',
        type: 'hunt',
        title: 'Sentença dos Campeões',
        desc: 'Elimine 4 inimigos Campeões ou Elites na Masmorra.',
        targetType: 'elite_enemy',
        targetCount: 4,
        reward: { xp: 800, gold: 200, ashes: 1 },
    },
    {
        id: 'gather_wood',
        type: 'gather',
        title: 'Tributo das Matas Mortas',
        desc: 'Extraia 60 unidades de Madeira no Acampamento.',
        targetType: ResourceType.WOOD,
        targetCount: 60,
        reward: { xp: 260, gold: 70 },
    },
    {
        id: 'gather_ore',
        type: 'gather',
        title: 'Escavação das Veias Negras',
        desc: 'Extraia 50 unidades de Minério no Acampamento.',
        targetType: ResourceType.ORE,
        targetCount: 50,
        reward: { xp: 280, gold: 75 },
    },
    {
        id: 'craft_upgrade',
        type: 'craft',
        title: 'Têmpera Ancestral',
        desc: 'Aprimore um equipamento na Forja.',
        targetType: 'upgrade',
        targetCount: 1,
        reward: { xp: 400, gold: 100 },
    },
    {
        id: 'craft_salvage',
        type: 'craft',
        title: 'Reciclagem de Espólios',
        desc: 'Desmanche 3 equipamentos descartados na Forja.',
        targetType: 'salvage',
        targetCount: 3,
        reward: { xp: 350, gold: 90 },
    },
    {
        id: 'craft_alchemy',
        type: 'craft',
        title: 'Alquimia Proibida',
        desc: 'Destile 2 tônicos no Caldeirão Alquímico.',
        targetType: 'alchemy',
        targetCount: 2,
        reward: { xp: 450, gold: 120 },
    },
];

// ─── Bloodlines (Linhagens de Sangue) ───
const BloodlineType = Object.freeze({
    CHILDREN_OF_PYRE:  'children_of_pyre',
    DECAYING_NOBILITY: 'decaying_nobility',
    VOID_TOUCHED:      'void_touched',
    FLAYED_AUTOMATON:  'flayed_automaton',
});

const BLOODLINE_DEFINITIONS = {
    [BloodlineType.CHILDREN_OF_PYRE]: {
        id: BloodlineType.CHILDREN_OF_PYRE,
        name: 'Filhos da Pira',
        epithet: 'Cinzas Imortais',
        icon: '🜂',
        glyph: '🜂',
        lore: 'Nascidos nas cinzas dos templos hereges consumidos pelas fogueiras da Inquisição Solar. Suas veias pulsam com calor incandescente e a recusa obstinada em virar cinza definitiva.',
        quote: '"Queimamos uma vez; desde então, o fogo é nosso servo, não nosso algoz."',
        bonuses: {
            maxHpPct: 15,
            fireResistPct: 25,
            burnDamageReductionPct: 30,
        },
        bonusesDescription: '+15% de Vida Máxima • +25% de Resistência a Fogo e Queimaduras',
    },
    [BloodlineType.DECAYING_NOBILITY]: {
        id: BloodlineType.DECAYING_NOBILITY,
        name: 'Nobreza Decadente',
        epithet: 'Herdeiros da Ruína',
        icon: '🜚',
        glyph: '🜚',
        lore: 'Descendentes das dinastias corrompidas que esbanjaram tesouros em ritos blasfemos antes do eclipse da Fenda. Conservam a elegância predatória de quem cobra tributo de sangue e ouro por cada sopro de vida.',
        quote: '"A realeza apodreceu, mas o sabor do ouro e da lâmina permanece refinado."',
        bonuses: {
            goldFindPct: 30,
            attackSpeedPct: 10,
        },
        bonusesDescription: '+30% de Taxa de Ouro Encontrado • +10% de Velocidade de Ataque',
    },
    [BloodlineType.VOID_TOUCHED]: {
        id: BloodlineType.VOID_TOUCHED,
        name: 'Marcados pelo Vácuo',
        epithet: 'Ecos do Abismo',
        icon: 'ᛤ',
        glyph: 'ᛤ',
        lore: 'Tocados pela maré do vácuo astral durante o alinhamento das luas sombrias. O fluido que corre em suas artérias não é sangue comum, mas um éter faminto capaz de corroer almas e rasgar o véu entre os mundos.',
        quote: '"O abismo olhou para dentro de nós, e encontrou um lar."',
        bonuses: {
            maxResourcePct: 25,
            shadowBleedDamagePct: 15,
        },
        bonusesDescription: '+25% de Mana/Recurso Máximo • +15% de Dano de Sombra e Sangramento',
    },
    [BloodlineType.FLAYED_AUTOMATON]: {
        id: BloodlineType.FLAYED_AUTOMATON,
        name: 'Autômato Esfolado',
        epithet: 'Carcaça Penitente',
        icon: '⚙',
        glyph: '⚙',
        lore: 'Constructo de ferro forjado em chamas rúnicas antigas, envolto em restos de pele morta como voto de penitência perpétua. Desconhece a hemorragia dos mortais, embora a massa maciça de seu corpo cobre um preço no ritmo de seus passos.',
        quote: '"Sem veias para sangrar. Sem coração para temer. Apenas o peso da penitência de aço."',
        bonuses: {
            flatArmor: 15,
            armorPct: 10,
            bleedImmune: true,
            moveSpeedPct: -8,
        },
        bonusesDescription: '+15 Armadura Natural (+10% Armadura) • Imunidade a Sangramento • -8% Vel. Movimento',
    },
};

// ─── Rubrics Constellation System (A Teia Astral das Rúbricas - Nível 40+) ───
const RubricNodeType = Object.freeze({
    NEXUS:       'nexus',       // O Olho das Cinzas (ponto central)
    ORIGIN:      'origin',      // Ponto de início de cada classe
    FUNDAMENTAL: 'fundamental', // Nós menores de atributos
    HYBRID:      'hybrid',      // Nós médios de travessia entre quadrantes de classe
    NOTABLE:     'notable',     // Nós maiores com efeitos especiais
    KEYSTONE:    'keystone',    // Pedras Angulares nas extremidades (modificadores de regras)
});

const RUBRICS_CONSTELLATION = {
    // ─── Central Nexus ───
    'nexus_eye': {
        id: 'nexus_eye',
        name: 'O Olho das Cinzas',
        type: RubricNodeType.NEXUS,
        x: 700, y: 700,
        icon: 'ᛟ',
        desc: 'O epicentro etéreo onde todas as almas da Fenda convergem.',
        stats: { allAttributes: 5 },
        connections: ['origin_barbarian', 'origin_paladin', 'origin_mage', 'origin_necro'],
    },

    // ─── Class Origins (Desbloqueadas para a respectiva classe ao atingir nível 40) ───
    'origin_barbarian': {
        id: 'origin_barbarian',
        name: 'Nascente do Colosso',
        classOrigin: ClassType.BARBARIAN,
        type: RubricNodeType.ORIGIN,
        x: 520, y: 880,
        icon: 'ᛏ',
        desc: 'Ponto focal da fúria primitiva e resistência brutal.',
        stats: { baseDamage: 5, maxHpPct: 5 },
        connections: ['nexus_eye', 'barb_life_1', 'barb_phys_1', 'hybrid_barb_necro_1'],
    },
    'origin_paladin': {
        id: 'origin_paladin',
        name: 'Bastião do Crepúsculo',
        classOrigin: ClassType.PALADIN,
        type: RubricNodeType.ORIGIN,
        x: 880, y: 880,
        icon: 'ᛉ',
        desc: 'Foco de devoção inabalável e couraça abençoada.',
        stats: { armor: 15, maxHpPct: 4 },
        connections: ['nexus_eye', 'pal_armor_1', 'pal_regen_1', 'hybrid_pal_barb_1'],
    },
    'origin_mage': {
        id: 'origin_mage',
        name: 'Vórtice do Éter',
        classOrigin: ClassType.MAGE,
        type: RubricNodeType.ORIGIN,
        x: 880, y: 520,
        icon: 'ᛋ',
        desc: 'Canal de convergência mágica e destruição etérea.',
        stats: { maxResourcePct: 8, baseDamage: 4 },
        connections: ['nexus_eye', 'mage_resource_1', 'mage_crit_1', 'hybrid_mage_pal_1'],
    },
    'origin_necro': {
        id: 'origin_necro',
        name: 'Abóbada da Morte',
        classOrigin: ClassType.NECROMANCER,
        type: RubricNodeType.ORIGIN,
        x: 520, y: 520,
        icon: 'ᛡ',
        desc: 'Matriz de essência fúnebre, maldições e sangue.',
        stats: { lifeSteal: 2, baseDamage: 4 },
        connections: ['nexus_eye', 'necro_leech_1', 'necro_bleed_1', 'hybrid_necro_mage_1'],
    },

    // ─── Quadrante Bárbaro (Sudoeste: Vida, Dano Físico, Força Bruta) ───
    'barb_life_1': {
        id: 'barb_life_1',
        name: 'Vigor Pétreo I',
        type: RubricNodeType.FUNDAMENTAL,
        x: 430, y: 940,
        icon: '🜂',
        desc: '+5% de Vida Máxima',
        stats: { maxHpPct: 5 },
        connections: ['origin_barbarian', 'barb_life_2', 'barb_phys_1'],
    },
    'barb_phys_1': {
        id: 'barb_phys_1',
        name: 'Gume Pesado I',
        type: RubricNodeType.FUNDAMENTAL,
        x: 540, y: 990,
        icon: 'ᛏ',
        desc: '+8 de Dano Físico Bruto',
        stats: { baseDamage: 8 },
        connections: ['origin_barbarian', 'barb_life_1', 'barb_phys_2'],
    },
    'barb_life_2': {
        id: 'barb_life_2',
        name: 'Vigor Pétreo II',
        type: RubricNodeType.FUNDAMENTAL,
        x: 340, y: 990,
        icon: '🜂',
        desc: '+6% de Vida Máxima e +10 de Vida Plana',
        stats: { maxHpPct: 6, flatHp: 10 },
        connections: ['barb_life_1', 'notable_colossus_might'],
    },
    'barb_phys_2': {
        id: 'barb_phys_2',
        name: 'Gume Pesado II',
        type: RubricNodeType.FUNDAMENTAL,
        x: 460, y: 1080,
        icon: 'ᛏ',
        desc: '+10 de Dano Físico e +2% Chance Crítica',
        stats: { baseDamage: 10, critChance: 2 },
        connections: ['barb_phys_1', 'notable_colossus_might', 'keystone_iron_reflexes'],
    },
    'notable_colossus_might': {
        id: 'notable_colossus_might',
        name: 'Fúria do Colosso',
        type: RubricNodeType.NOTABLE,
        x: 350, y: 1110,
        icon: 'ᚱ',
        desc: 'NOTÁVEL: Seus golpes ganham impacto estarrecedor. +15% de Dano Físico Global e +8% de Vida Máxima.',
        stats: { damagePct: 15, maxHpPct: 8 },
        connections: ['barb_life_2', 'barb_phys_2', 'keystone_iron_reflexes'],
    },
    'keystone_iron_reflexes': {
        id: 'keystone_iron_reflexes',
        name: 'Vigor de Ferro',
        type: RubricNodeType.KEYSTONE,
        x: 230, y: 1220,
        icon: '⛊',
        desc: 'PEDRA ANGULAR: Converte toda a sua Taxa de Esquiva em Armadura plana dobrada (+2 Armadura por 1% de Esquiva) e concede imunidade a atordoamentos, mas você não pode mais se esquivar.',
        stats: { keystoneIronReflexes: true, stunImmune: true },
        connections: ['notable_colossus_might', 'barb_phys_2'],
    },

    // ─── Quadrante Paladino (Sudeste: Armadura, Cura/Regen, Bloqueio) ───
    'pal_armor_1': {
        id: 'pal_armor_1',
        name: 'Placas Sagradas I',
        type: RubricNodeType.FUNDAMENTAL,
        x: 970, y: 940,
        icon: '⛊',
        desc: '+15 de Armadura Plana',
        stats: { armor: 15 },
        connections: ['origin_paladin', 'pal_armor_2', 'pal_regen_1'],
    },
    'pal_regen_1': {
        id: 'pal_regen_1',
        name: 'Graça Restauradora I',
        type: RubricNodeType.FUNDAMENTAL,
        x: 860, y: 990,
        icon: '🜄',
        desc: '+2.5 de Regeneração de Vida por segundo',
        stats: { hpRegen: 2.5 },
        connections: ['origin_paladin', 'pal_armor_1', 'pal_regen_2'],
    },
    'pal_armor_2': {
        id: 'pal_armor_2',
        name: 'Placas Sagradas II',
        type: RubricNodeType.FUNDAMENTAL,
        x: 1060, y: 990,
        icon: '⛊',
        desc: '+20 de Armadura e +5% de Armadura Total',
        stats: { armor: 20, armorPct: 5 },
        connections: ['pal_armor_1', 'notable_spiked_bastion'],
    },
    'pal_regen_2': {
        id: 'pal_regen_2',
        name: 'Graça Restauradora II',
        type: RubricNodeType.FUNDAMENTAL,
        x: 940, y: 1080,
        icon: '🜄',
        desc: '+3.5 de Regeneração de Vida/s e +4% de Vida Máxima',
        stats: { hpRegen: 3.5, maxHpPct: 4 },
        connections: ['pal_regen_1', 'notable_spiked_bastion', 'keystone_apotheosis'],
    },
    'notable_spiked_bastion': {
        id: 'notable_spiked_bastion',
        name: 'Baluarte Espinhoso',
        type: RubricNodeType.NOTABLE,
        x: 1050, y: 1110,
        icon: '☩',
        desc: 'NOTÁVEL: Reflete 40% do dano mitigado pela armadura de volta aos agressores e concede +25 de Armadura Plana.',
        stats: { thornsPct: 40, armor: 25 },
        connections: ['pal_armor_2', 'pal_regen_2', 'keystone_apotheosis'],
    },
    'keystone_apotheosis': {
        id: 'keystone_apotheosis',
        name: 'Apoteose das Cinzas',
        type: RubricNodeType.KEYSTONE,
        x: 1170, y: 1220,
        icon: '🜚',
        desc: 'PEDRA ANGULAR: Quando sua vida cai abaixo de 35%, você acende com chamas divinas: +40% de Dano Global e +25% de Redução de Dano Absoluto por 8 segundos (recarga: 45s).',
        stats: { keystoneApotheosis: true },
        connections: ['notable_spiked_bastion', 'pal_regen_2'],
    },

    // ─── Quadrante Feiticeiro (Nordeste: Mana, Crítico, Dano Elemental) ───
    'mage_resource_1': {
        id: 'mage_resource_1',
        name: 'Canal de Éter I',
        type: RubricNodeType.FUNDAMENTAL,
        x: 970, y: 460,
        icon: 'ᛋ',
        desc: '+12% de Mana Máxima',
        stats: { maxResourcePct: 12 },
        connections: ['origin_mage', 'mage_resource_2', 'mage_crit_1'],
    },
    'mage_crit_1': {
        id: 'mage_crit_1',
        name: 'Foco Preciso I',
        type: RubricNodeType.FUNDAMENTAL,
        x: 860, y: 410,
        icon: '◇',
        desc: '+3% de Chance Crítica e +15% de Dano Crítico',
        stats: { critChance: 3, critDamage: 15 },
        connections: ['origin_mage', 'mage_resource_1', 'mage_crit_2'],
    },
    'mage_resource_2': {
        id: 'mage_resource_2',
        name: 'Canal de Éter II',
        type: RubricNodeType.FUNDAMENTAL,
        x: 1060, y: 410,
        icon: 'ᛋ',
        desc: '+15% de Mana Máxima e +8 de Dano Elemental',
        stats: { maxResourcePct: 15, baseDamage: 8 },
        connections: ['mage_resource_1', 'notable_arcane_surge'],
    },
    'mage_crit_2': {
        id: 'mage_crit_2',
        name: 'Foco Preciso II',
        type: RubricNodeType.FUNDAMENTAL,
        x: 940, y: 320,
        icon: '◇',
        desc: '+4% de Chance Crítica e +25% de Dano Crítico',
        stats: { critChance: 4, critDamage: 25 },
        connections: ['mage_crit_1', 'notable_arcane_surge', 'keystone_arcane_gnosis'],
    },
    'notable_arcane_surge': {
        id: 'notable_arcane_surge',
        name: 'Surto Arcano',
        type: RubricNodeType.NOTABLE,
        x: 1050, y: 290,
        icon: '🜂',
        desc: 'NOTÁVEL: Abater um inimigo concede Surto Arcano (+25% de Dano Mágico e +15% de Velocidade de Ataque) por 6 segundos.',
        stats: { damagePct: 12, critChance: 4, critDamage: 20 },
        connections: ['mage_resource_2', 'mage_crit_2', 'keystone_arcane_gnosis'],
    },
    'keystone_arcane_gnosis': {
        id: 'keystone_arcane_gnosis',
        name: 'Gnose Arcana',
        type: RubricNodeType.KEYSTONE,
        x: 1170, y: 180,
        icon: 'ᛤ',
        desc: 'PEDRA ANGULAR: Converte 50% de toda a sua Armadura em Dano Crítico amplificado (+1% Dano Crítico por 2 de Armadura), mas sua Vida Máxima é reduzida em 12%.',
        stats: { keystoneArcaneGnosis: true },
        connections: ['notable_arcane_surge', 'mage_crit_2'],
    },

    // ─── Quadrante Necromante (Noroeste: Sangria, Roubo de Vida, Vácuo) ───
    'necro_leech_1': {
        id: 'necro_leech_1',
        name: 'Drenagem Espiritual I',
        type: RubricNodeType.FUNDAMENTAL,
        x: 430, y: 460,
        icon: 'ᛡ',
        desc: '+2% de Roubo de Vida',
        stats: { lifeSteal: 2 },
        connections: ['origin_necro', 'necro_leech_2', 'necro_bleed_1'],
    },
    'necro_bleed_1': {
        id: 'necro_bleed_1',
        name: 'Feridas Profundas I',
        type: RubricNodeType.FUNDAMENTAL,
        x: 540, y: 410,
        icon: 'ᚾ',
        desc: '+10% de Dano de Sangramento e Sombra',
        stats: { shadowBleedDamagePct: 10, baseDamage: 4 },
        connections: ['origin_necro', 'necro_leech_1', 'necro_bleed_2'],
    },
    'necro_leech_2': {
        id: 'necro_leech_2',
        name: 'Drenagem Espiritual II',
        type: RubricNodeType.FUNDAMENTAL,
        x: 340, y: 410,
        icon: 'ᛡ',
        desc: '+3% de Roubo de Vida e +5% de Vida Máxima',
        stats: { lifeSteal: 3, maxHpPct: 5 },
        connections: ['necro_leech_1', 'notable_blood_siphon'],
    },
    'necro_bleed_2': {
        id: 'necro_bleed_2',
        name: 'Feridas Profundas II',
        type: RubricNodeType.FUNDAMENTAL,
        x: 460, y: 320,
        icon: 'ᚾ',
        desc: '+15% de Dano de Sombra e +3% Chance Crítica',
        stats: { shadowBleedDamagePct: 15, critChance: 3 },
        connections: ['necro_bleed_1', 'notable_blood_siphon', 'keystone_blood_pact'],
    },
    'notable_blood_siphon': {
        id: 'notable_blood_siphon',
        name: 'Sifão Sangrento',
        type: RubricNodeType.NOTABLE,
        x: 350, y: 290,
        icon: '🜛',
        desc: 'NOTÁVEL: +4% de Roubo de Vida global e +20% de dano contra inimigos sangrando ou abaixo de 50% de vida.',
        stats: { lifeSteal: 4, damagePct: 10 },
        connections: ['necro_leech_2', 'necro_bleed_2', 'keystone_blood_pact'],
    },
    'keystone_blood_pact': {
        id: 'keystone_blood_pact',
        name: 'Pacto de Sangue',
        type: RubricNodeType.KEYSTONE,
        x: 230, y: 180,
        icon: 'ᛡ',
        desc: 'PEDRA ANGULAR: Habilidades consomem Vida em vez de Mana ou Fé (custo reduzido pela metade), e você ganha +8% de Roubo de Vida irrestrito.',
        stats: { keystoneBloodPact: true, lifeSteal: 8 },
        connections: ['notable_blood_siphon', 'necro_bleed_2'],
    },

    // ─── Nós Híbridos de Travessia (Conectores entre Classes) ───
    // Conector Bárbaro <-> Necromante (Oeste)
    'hybrid_barb_necro_1': {
        id: 'hybrid_barb_necro_1',
        name: 'Tendões Sangrentos',
        type: RubricNodeType.HYBRID,
        x: 380, y: 700,
        icon: 'ᛏ',
        desc: 'TRAVESSIA BÁRBARO-NECROMANTE: +10% de Dano de Sangramento e +12 de Armadura Plana.',
        stats: { shadowBleedDamagePct: 10, armor: 12 },
        connections: ['origin_barbarian', 'origin_necro', 'notable_necrotic_venom'],
    },
    'notable_necrotic_venom': {
        id: 'notable_necrotic_venom',
        name: 'Peçonha Necrótica',
        type: RubricNodeType.NOTABLE,
        x: 270, y: 700,
        icon: 'ᚾ',
        desc: 'NOTÁVEL: Acertos críticos aplicam veneno cáustico que causa 35% do dano da arma ao longo de 4s.',
        stats: { poisonOnCrit: true, critChance: 4 },
        connections: ['hybrid_barb_necro_1', 'keystone_ghost_dance'],
    },
    'keystone_ghost_dance': {
        id: 'keystone_ghost_dance',
        name: 'Dança dos Espectros',
        type: RubricNodeType.KEYSTONE,
        x: 150, y: 700,
        icon: 'ᛤ',
        desc: 'PEDRA ANGULAR: Concede +12% de Chance de Esquiva. Ao esquivar com sucesso de um golpe, recupera 10% do seu recurso máximo e ganha +25% de Velocidade de Movimento por 3 segundos.',
        stats: { keystoneGhostDance: true, dodgeChance: 12 },
        connections: ['notable_necrotic_venom'],
    },

    // Conector Paladino <-> Bárbaro (Sul)
    'hybrid_pal_barb_1': {
        id: 'hybrid_pal_barb_1',
        name: 'Garras do Baluarte',
        type: RubricNodeType.HYBRID,
        x: 700, y: 1020,
        icon: '⛊',
        desc: 'TRAVESSIA PALADINO-BÁRBARO: +18 de Armadura e +6 de Dano Físico.',
        stats: { armor: 18, baseDamage: 6 },
        connections: ['origin_paladin', 'origin_barbarian', 'notable_iron_stance'],
    },
    'notable_iron_stance': {
        id: 'notable_iron_stance',
        name: 'Postura Inabalável',
        type: RubricNodeType.NOTABLE,
        x: 700, y: 1140,
        icon: 'ᛏ',
        desc: 'NOTÁVEL: +8% de Vida Máxima e +20 de Armadura Plana.',
        stats: { maxHpPct: 8, armor: 20 },
        connections: ['hybrid_pal_barb_1'],
    },

    // Conector Paladino <-> Feiticeiro (Leste)
    'hybrid_mage_pal_1': {
        id: 'hybrid_mage_pal_1',
        name: 'Zelo Iluminado',
        type: RubricNodeType.HYBRID,
        x: 1020, y: 700,
        icon: '🜚',
        desc: 'TRAVESSIA PALADINO-FEITICEIRO: +15 de Mana/Fé e +10 de Dano Sacro/Arcano.',
        stats: { maxResourcePct: 10, baseDamage: 7 },
        connections: ['origin_paladin', 'origin_mage', 'notable_eldritch_conduit'],
    },
    'notable_eldritch_conduit': {
        id: 'notable_eldritch_conduit',
        name: 'Conduíte Sobrenatural',
        type: RubricNodeType.NOTABLE,
        x: 1140, y: 700,
        icon: 'ᛋ',
        desc: 'NOTÁVEL: Suas habilidades recarregam 15% mais rápido e consomem 15% menos de recurso.',
        stats: { cdrPct: 15, resourceCostReductionPct: 15 },
        connections: ['hybrid_mage_pal_1', 'notable_shadow_riposte'],
    },
    'notable_shadow_riposte': {
        id: 'notable_shadow_riposte',
        name: 'Retaliação da Sombra',
        type: RubricNodeType.NOTABLE,
        x: 1250, y: 700,
        icon: '†',
        desc: 'NOTÁVEL: Concede +6% de Chance de Esquiva. Ao esquivar com sucesso, contra-ataca instantaneamente com uma lâmina espectral causando 150% do dano base.',
        stats: { dodgeChance: 6, riposteOnDodge: true },
        connections: ['notable_eldritch_conduit'],
    },

    // Conector Feiticeiro <-> Necromante (Norte)
    'hybrid_necro_mage_1': {
        id: 'hybrid_necro_mage_1',
        name: 'Canalização do Éter Negro',
        type: RubricNodeType.HYBRID,
        x: 700, y: 380,
        icon: 'ᛤ',
        desc: 'TRAVESSIA FEITICEIRO-NECROMANTE: +10% de Mana Máxima e +2.5% de Roubo de Vida Mágico.',
        stats: { maxResourcePct: 10, lifeSteal: 2.5 },
        connections: ['origin_mage', 'origin_necro', 'notable_void_convergence'],
    },
    'notable_void_convergence': {
        id: 'notable_void_convergence',
        name: 'Convergência do Vácuo',
        type: RubricNodeType.NOTABLE,
        x: 700, y: 260,
        icon: '🜛',
        desc: 'NOTÁVEL: +15% de Dano de Sombra/Arcano e +4% de Chance Crítica.',
        stats: { damagePct: 10, shadowBleedDamagePct: 15, critChance: 4 },
        connections: ['hybrid_necro_mage_1'],
    },
};

console.log('[Constants] Dark Fantasy constants loaded.');

