/**
 * ============================================
 *  PART 2 INTEGRATION VERIFICATION SCRIPT
 *  Tests:
 *  1. PlayerProgression (XP curve, active vs passive duality, auto stat gains)
 *  2. SkillTree & SkillTreeManager (4 classes, 4 tiers, mutations, respec)
 *  3. CombatController (state machine, damage formula, crit, knockback, hit flash, floating text)
 * ============================================
 */

// Minimal DOM / Browser Mocks if running under Node.js
if (typeof window === 'undefined') {
    global.window = {
        addEventListener: () => {},
        removeEventListener: () => {},
        innerWidth: 1024,
        innerHeight: 768,
    };
    global.document = {
        getElementById: () => null,
        querySelectorAll: () => [],
        createElement: () => ({ classList: { add: () => {}, remove: () => {} }, appendChild: () => {}, style: {} }),
    };
    global.localStorage = {
        _data: {},
        getItem(k) { return this._data[k] || null; },
        setItem(k, v) { this._data[k] = String(v); },
        removeItem(k) { delete this._data[k]; },
    };
    global.performance = { now: () => Date.now() };
}

// Load scripts in order
const fs = require('fs');
const path = require('path');

function loadScript(relPath) {
    const fullPath = path.join(__dirname, relPath);
    const code = fs.readFileSync(fullPath, 'utf8');
    eval.call(global, code);
}

loadScript('core/constants.js');
loadScript('core/utils.js');
loadScript('models/PlayerProgression.js');
loadScript('models/SkillTree.js');
loadScript('models/Character.js');
loadScript('models/Item.js');
loadScript('models/GatheringNode.js');
loadScript('models/LootTable.js');
loadScript('systems/StateManager.js');
loadScript('systems/SkillTreeManager.js');
loadScript('systems/CombatController.js');

console.log('\n========================================');
console.log('RUNNING THE LAST BASTION - PART 2 TESTS');
console.log('========================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
    totalTests++;
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        throw new Error(`Assertion failed: ${message}`);
    }
    console.log(`✅ PASS: ${message}`);
    passedTests++;
}

// ─────────────────────────────────────────────
// TEST 1: PlayerProgression & XP Curve
// ─────────────────────────────────────────────
console.log('--- TEST 1: PlayerProgression & XP Curve ---');
const prog = new PlayerProgression({ baseXP: 100, exponent: 1.6 });

const xpLvl1 = prog.getXPRequiredForLevel(1);
const xpLvl2 = prog.getXPRequiredForLevel(2);
const xpLvl5 = prog.getXPRequiredForLevel(5);
assert(xpLvl1 === 100, `Level 1 required XP should be 100 (got ${xpLvl1})`);
assert(xpLvl2 === Math.floor(100 * Math.pow(2, 1.6)), `Level 2 required XP follows Base * Level^1.6 (got ${xpLvl2})`);
assert(xpLvl5 > xpLvl2, `Level 5 XP (${xpLvl5}) should be greater than Level 2 XP (${xpLvl2})`);

// Active XP leveling
const resActive = prog.addActiveXP(105);
assert(resActive.leveled === true, 'Player should level up after gaining 105 active XP at Level 1');
assert(prog.level === 2, `Player level should now be 2 (got ${prog.level})`);
assert(prog.skillPoints === 2, `Player should have 2 skill points (1 initial + 1 from level 2, got ${prog.skillPoints})`);
assert(prog.activeXP === 105, `Active XP tracked correctly (${prog.activeXP})`);

// Passive XP leveling
const resPassive = prog.addPassiveXP(500);
assert(prog.passiveXP === 500, `Passive XP tracked correctly (${prog.passiveXP})`);
assert(prog.level >= 3, `Player should have reached level >= 3 with passive XP (got ${prog.level})`);

// Auto stat gains
const statGains = prog.getAccumulatedStatGains();
assert(statGains.hp === (prog.level - 1) * 15, `Accumulated HP gain is +15 per level (got ${statGains.hp})`);
assert(statGains.baseDamage === (prog.level - 1) * 2, `Accumulated base damage gain is +2 per level (got ${statGains.baseDamage})`);
assert(statGains.maxResource === (prog.level - 1) * 5, `Accumulated max resource gain is +5 per level (got ${statGains.maxResource})`);

// ─────────────────────────────────────────────
// TEST 2: Skill Tree Architecture for all 4 classes
// ─────────────────────────────────────────────
console.log('\n--- TEST 2: Skill Tree Architecture for all 4 classes ---');
const classes = ['barbarian', 'paladin', 'mage', 'necromancer'];

classes.forEach(cls => {
    const tree = SkillTree.createForClass(cls);
    assert(tree !== null, `SkillTree created for ${cls}`);
    assert(tree.nodes.length === 4, `${cls} tree should have exactly 4 tiers (got ${tree.nodes.length})`);

    const t1 = tree.getSkillByTier(1);
    const t2 = tree.getSkillByTier(2);
    const t3 = tree.getSkillByTier(3);
    const t4 = tree.getSkillByTier(4);

    assert(t1 && t1.unlocked === true, `${cls} Tier 1 starts unlocked`);
    assert(t1.requiredLevel === 1, `${cls} Tier 1 requires Level 1`);
    assert(t2 && t2.requiredLevel === 5, `${cls} Tier 2 requires Level 5`);
    assert(t3 && t3.requiredLevel === 10, `${cls} Tier 3 requires Level 10`);
    assert(t4 && t4.requiredLevel === 20, `${cls} Tier 4 requires Level 20`);

    // Tier 3 modifier check (at least 2 mutations)
    assert(t3.modifiers.length >= 2, `${cls} Tier 3 core skill has at least 2 modifier variants (got ${t3.modifiers.length})`);
    assert(t3.getActiveModifier() !== null, `${cls} Tier 3 has an active modifier selected`);
});

// Specific class skills verification
const barbTree = SkillTree.createForClass('barbarian');
assert(barbTree.getSkillByTier(1).name === 'Golpe Pesado', 'Barbarian T1 is Golpe Pesado');
assert(barbTree.getSkillByTier(2).name.includes('Investida') || barbTree.getSkillByTier(2).name.includes('Salto'), 'Barbarian T2 is Investida / Salto');
assert(barbTree.getSkillByTier(3).name === 'Torvelinho', 'Barbarian T3 is Torvelinho');
assert(barbTree.getSkillByTier(4).name === 'Fúria Ancestral', 'Barbarian T4 is Fúria Ancestral');
const barbT3Mods = barbTree.getSkillByTier(3).modifiers.map(m => m.mutationType);
assert(barbT3Mods.includes('vortex_pull') && barbT3Mods.includes('wind_slash'), 'Barbarian T3 modifiers are vortex_pull and wind_slash');

const palTree = SkillTree.createForClass('paladin');
assert(palTree.getSkillByTier(1).name === 'Martelo da Luz', 'Paladin T1 is Martelo da Luz');
assert(palTree.getSkillByTier(2).name === 'Investida com Escudo', 'Paladin T2 is Investida com Escudo');
assert(palTree.getSkillByTier(3).name === 'Escudo Abençoado', 'Paladin T3 is Escudo Abençoado');
assert(palTree.getSkillByTier(4).name === 'Consagração', 'Paladin T4 is Consagração');
const palT3Mods = palTree.getSkillByTier(3).modifiers.map(m => m.mutationType);
assert(palT3Mods.includes('holy_slow') && palT3Mods.includes('heal_ricochet'), 'Paladin T3 modifiers are holy_slow and heal_ricochet');

const mageTree = SkillTree.createForClass('mage');
assert(mageTree.getSkillByTier(1).name === 'Projétil Arcano', 'Mage T1 is Projétil Arcano');
assert(mageTree.getSkillByTier(2).name === 'Teleporte', 'Mage T2 is Teleporte');
assert(mageTree.getSkillByTier(3).name === 'Orbe Elemental', 'Mage T3 is Orbe Elemental');
assert(mageTree.getSkillByTier(4).name === 'Chuva de Meteoros', 'Mage T4 is Chuva de Meteoros');
const mageT3Mods = mageTree.getSkillByTier(3).modifiers.map(m => m.mutationType);
assert(mageT3Mods.includes('freeze') && mageT3Mods.includes('fire_explosion'), 'Mage T3 modifiers are freeze and fire_explosion');

const necroTree = SkillTree.createForClass('necromancer');
assert(necroTree.getSkillByTier(1).name === 'Foice Ceifadora', 'Necromancer T1 is Foice Ceifadora');
assert(necroTree.getSkillByTier(2).name === 'Passo Espectral', 'Necromancer T2 is Passo Espectral');
assert(necroTree.getSkillByTier(3).name === 'Explosão de Cadáveres', 'Necromancer T3 is Explosão de Cadáveres');
assert(necroTree.getSkillByTier(4).name === 'Evocação de Titã Cadavérico', 'Necromancer T4 is Evocação de Titã Cadavérico');
const necroT3Mods = necroTree.getSkillByTier(3).modifiers.map(m => m.mutationType);
assert(necroT3Mods.includes('poison_cloud') && necroT3Mods.includes('life_steal'), 'Necromancer T3 modifiers are poison_cloud and life_steal');

// ─────────────────────────────────────────────
// TEST 3: SkillTreeManager (validation, spending, modifier toggle, respec)
// ─────────────────────────────────────────────
console.log('\n--- TEST 3: SkillTreeManager ---');
const state = new StateManager();
state.initNewGame('barbarian');
const skillMgr = new SkillTreeManager(state);

// Level 1: try unlocking Tier 2 (requires Level 5) -> should fail
const valT2 = skillMgr.validatePrereqs('barb_leap_slam');
assert(valT2.valid === false, 'T2 unlock fails at level 1 due to level prerequisite');

// Level up barbarian to level 12
state.character.level = 12;
state.character.progression.level = 12;
state.character.progression.skillPoints = 11;

// Spend point on Tier 2
const spendT2 = skillMgr.spendPoint('barb_leap_slam');
assert(spendT2.success === true, 'T2 unlocks successfully at Level 12');
assert(state.character.skillTree.getSkillByTier(2).unlocked === true, 'T2 skill is unlocked');

// Spend point on Tier 3
const spendT3 = skillMgr.spendPoint('barb_whirlwind');
assert(spendT3.success === true, 'T3 unlocks successfully');

// Toggle modifier between Vórtice Brutal and Lâminas de Vento
const modT1 = skillMgr.toggleModifier('barb_whirlwind', 'mod_wind_slashes');
assert(modT1.success === true, 'Modifier toggled to mod_wind_slashes');
assert(state.character.skillTree.getSkill('barb_whirlwind').activeModifierId === 'mod_wind_slashes', 'Active modifier is now mod_wind_slashes');

// Respec check
state.resources[ResourceType.GOLD] = 200;
state.resources[ResourceType.ORE] = 100;
const goldBefore = state.resources[ResourceType.GOLD];
const oreBefore = state.resources[ResourceType.ORE];
const pointsBefore = state.character.progression.skillPoints;

const respecRes = skillMgr.respec();
assert(respecRes.success === true, 'Respec executed successfully');
assert(state.resources[ResourceType.GOLD] < goldBefore, 'Gold deducted for respec');
assert(state.resources[ResourceType.ORE] < oreBefore, 'Ore deducted for respec');
assert(state.character.progression.skillPoints === pointsBefore + 2, 'Spent points refunded (T2 and T3 refunded, T1 stays base unlocked)');
assert(state.character.skillTree.getSkillByTier(2).unlocked === false, 'T2 is locked again after respec');
assert(state.character.skillTree.getSkillByTier(3).unlocked === false, 'T3 is locked again after respec');

// ─────────────────────────────────────────────
// TEST 4: CombatController (State Machine, Formula, Feedback, Dummy Enemy)
// ─────────────────────────────────────────────
console.log('\n--- TEST 4: CombatController ---');
const combat = new CombatController(state);

// State machine verification
assert(combat.currentState === PlayerCombatState.IDLE, 'Initial combat state is IDLE');

// Walking transition
combat.update(0.1, { moving: true });
assert(combat.currentState === PlayerCombatState.WALKING, 'Moving transitions to WALKING');

combat.update(0.1, { moving: false });
assert(combat.currentState === PlayerCombatState.IDLE, 'Stopping transitions to IDLE');

// Real Damage Formula verification:
// Dano Real = (DanoBase + DanoArma) * (1 + BonusAtributo)
const dummy = combat.createDummyEnemy({ hp: 100, armor: 0 }); // 0 armor for raw check
const char = state.character;
char.baseDamage = 20;
char.equipment.weapon = { baseDamage: 10 };
char.stats.strength = 25; // 25 * 0.02 = 0.5 bonus (50% bonus)

// (20 + 10) * (1 + 0.5) = 30 * 1.5 = 45 base raw damage
const dmgCalc = combat.calculateDamage(char, dummy, 1.0);
assert(dmgCalc.baseTotal === 30, `Base + Weapon damage is 30 (got ${dmgCalc.baseTotal})`);
assert(dmgCalc.attributeBonus === 0.5, `Attribute bonus is 0.5 (got ${dmgCalc.attributeBonus})`);
if (!dmgCalc.isCrit) {
    assert(dmgCalc.damage === 45, `Non-crit damage matches exactly (20+10)*(1+0.5) = 45 (got ${dmgCalc.damage})`);
} else {
    assert(dmgCalc.damage === Math.floor(45 * (char.critDamage / 100)), `Crit damage matches formula with crit multiplier`);
}

// Full Combat cycle with Knockback, Hit Flash, and Floating Damage Numbers
const testCombat = combat.testCombatDamage();
assert(testCombat.calculation.damage > 0, `Combat calculation returned positive damage (${testCombat.calculation.damage})`);
assert(testCombat.enemyStateAfterHit.finalHp < testCombat.enemyStateAfterHit.initialHp, 'Dummy enemy lost HP');
assert(testCombat.enemyStateAfterHit.hitFlash === true, 'Enemy hit flash was triggered');
assert(testCombat.enemyStateAfterHit.vx > 0, 'Enemy received proportional knockback vector');
assert(testCombat.floatingText !== undefined, 'Floating damage number was emitted');
assert(testCombat.floatingText.color === (testCombat.calculation.isCrit ? '#fbbf24' : '#ffffff'), 'Floating text color is white for normal and gold for crit');

console.log('\n========================================');
console.log(`ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY! 🎯`);
console.log('========================================\n');
