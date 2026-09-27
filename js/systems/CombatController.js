/**
 * ============================================
 *  COMBAT CONTROLLER
 *  Core 2D Action RPG Combat system:
 *  - Player state machine (Idle, Walking, UsingSkill, Dashing)
 *  - Vectorial WASD + Mouse Aiming
 *  - Damage cycle: (BaseDamage + WeaponDamage) * (1 + AttributeBonus) with Crit
 *  - Hitbox and Hurtbox collision & resolution
 *  - Proportional Knockback & Hit Flash
 *  - Floating Damage Numbers (White for normal, Gold for crit)
 *  - Skill execution for all 4 classes & mutations
 * ============================================
 */

// ─── Player Combat States ───
const PlayerCombatState = Object.freeze({
    IDLE:        'IDLE',
    WALKING:     'WALKING',
    USING_SKILL: 'USING_SKILL',
    DASHING:     'DASHING',
});

// ─── Hitbox Class ───
class Hitbox {
    /**
     * @param {Object} options
     */
    constructor(options) {
        this.id             = Utils.uid();
        this.x              = options.x || 0;
        this.y              = options.y || 0;
        this.radius         = options.radius || 20;
        this.damage         = options.damage || 10;
        this.isCrit         = options.isCrit || false;
        this.knockbackForce = options.knockbackForce || 100;
        this.dirX           = options.dirX || 1;
        this.dirY           = options.dirY || 0;
        this.duration       = options.duration || 0.15; // Lifetime in seconds
        this.lifetime       = this.duration;
        this.isPlayer       = options.isPlayer !== undefined ? options.isPlayer : true;
        this.onHitEffect    = options.onHitEffect || null; // Callback function(target, controller)
        this.hitTargets     = new Set(); // Prevent multi-hitting same target in single frame
        this.color          = options.color || '#fbbf24';
        this.renderShape    = options.renderShape || 'circle'; // 'circle', 'arc', 'rect'
    }

    update(dt) {
        this.lifetime -= dt;
        return this.lifetime > 0;
    }
}

// ─── Hurtbox Class ───
class Hurtbox {
    /**
     * @param {Object} owner
     * @param {number} width
     * @param {number} height
     */
    constructor(owner, width = 24, height = 24) {
        this.owner  = owner;
        this.width  = width;
        this.height = height;
    }

    get x() { return this.owner.x; }
    get y() { return this.owner.y; }
    get radius() { return Math.max(this.width, this.height) / 2; }

    /**
     * Test collision against a circular Hitbox.
     * @param {Hitbox} hitbox
     * @returns {boolean}
     */
    intersectsHitbox(hitbox) {
        const dist = Math.hypot(this.x - hitbox.x, this.y - hitbox.y);
        return dist < (this.radius + hitbox.radius);
    }
}

// ─── Combat Controller System ───
class CombatController {
    /**
     * @param {StateManager} state
     * @param {DungeonEngine} [engine=null]
     */
    constructor(state, engine = null) {
        /** @type {StateManager} */
        this.state  = state;
        /** @type {DungeonEngine|null} */
        this.engine = engine;

        // Player State Machine
        this.currentState = PlayerCombatState.IDLE;
        this.stateTimer   = 0;

        // Active combat collections
        this.hitboxes     = [];
        this.floatingTexts= []; // Floating damage numbers
        this.groundEffects= []; // Consecration, Poison clouds, Burning ground
        this.minions      = []; // Necromancer Titan, Skeletons

        // Internal cast state
        this.currentSkillExecution = null;

        console.log('[CombatController] Initialized.');
    }

    setEngine(engine) {
        this.engine = engine;
    }

    /**
     * Get player entity from engine or fallback.
     */
    get player() {
        if (this.engine && this.engine.player) return this.engine.player;
        if (!this._fallbackPlayer) {
            this._fallbackPlayer = {
                x: 0, y: 0, width: 24, height: 32, vx: 0, vy: 0, iFrames: 0, isDashing: false
            };
        }
        return this._fallbackPlayer;
    }

    /**
     * Current character model.
     */
    get character() {
        return this.state.character;
    }

    // ═══════════════════════════════════════════
    //  DAMAGE CALCULATION FORMULA
    //  DanoReal = (DanoBase + DanoArma) * (1 + BonusAtributo)
    // ═══════════════════════════════════════════

    /**
     * Calculate damage based on the exact formula:
     * Dano Real = (DanoBase + DanoArma) * (1 + BonusAtributo)
     * with Critical Chance and Critical Multiplier check.
     * 
     * @param {Character} attacker
     * @param {Object} defender
     * @param {number} [skillMultiplier=1.0]
     * @returns {{ damage: number, isCrit: boolean, rawDamage: number, baseTotal: number, attributeBonus: number }}
     */
    calculateDamage(attacker, defender, skillMultiplier = 1.0) {
        const char = attacker || this.character;
        if (!char) return { damage: 10, isCrit: false, rawDamage: 10, baseTotal: 10, attributeBonus: 0 };

        // 1. DanoBase: character base damage (grows with level/base stats)
        const baseDamage = char.baseDamage || 10;

        // 2. DanoArma: weapon damage from equipped weapon
        const weaponDamage = (char.equipment && char.equipment.weapon) ? (char.equipment.weapon.baseDamage || 0) : 0;

        // 3. BonusAtributo: from primary class attribute
        // Barbarian/Paladin -> Strength, Mage/Necromancer -> Intelligence
        const classDef = CLASS_DEFINITIONS[char.classId] || {};
        const primaryStat = classDef.primaryStat || 'strength';
        const primaryStatValue = (char.stats && char.stats[primaryStat]) ? char.stats[primaryStat] : 15;

        // Attribute scaling: e.g. 2% increased damage per point of primary stat
        const attributeBonus = (primaryStatValue * 0.02);

        // 4. Raw Real Damage: (DanoBase + DanoArma) * (1 + BonusAtributo) * SkillMultiplier
        const baseTotal = (baseDamage + weaponDamage);
        let rawDamage = baseTotal * (1 + attributeBonus) * skillMultiplier;

        // 5. Critical Check
        const critChance = char.critChance || 5;
        const isCrit = (Math.random() * 100) < critChance;
        const critMultiplier = (char.critDamage || 150) / 100;

        if (isCrit) {
            rawDamage *= critMultiplier;
        }

        // 6. Target Armor Mitigation (if defender has armor)
        const defenderArmor = defender.armor || 0;
        const reduction = defenderArmor / (defenderArmor + 100);
        const finalDamage = Math.max(1, Math.floor(rawDamage * (1 - reduction)));

        return {
            damage: finalDamage,
            isCrit,
            rawDamage,
            baseTotal,
            attributeBonus,
        };
    }

    // ═══════════════════════════════════════════
    //  IMPACT FEEDBACK: KNOCKBACK, HIT FLASH, FLOATING NUMBERS
    // ═══════════════════════════════════════════

    /**
     * Apply proportional vector knockback to an entity.
     * @param {Object} target
     * @param {number} dirX
     * @param {number} dirY
     * @param {number} force
     */
    applyKnockback(target, dirX, dirY, force) {
        if (!target) return;
        const len = Math.hypot(dirX, dirY) || 1;
        target.vx = (dirX / len) * force;
        target.vy = (dirY / len) * force;
    }

    /**
     * Trigger Hit Flash (boolean signal and duration timer).
     * @param {Object} target
     * @param {number} [duration=0.12]
     */
    applyHitFlash(target, duration = 0.12) {
        if (!target) return;
        target.hitFlash = true;
        target.hitFlashTimer = duration;
    }

    /**
     * Emit Floating Damage Number.
     * White (#ffffff) for normal damage, Gold (#fbbf24) for critical hits.
     * 
     * @param {number} x
     * @param {number} y
     * @param {number|string} value
     * @param {boolean} isCrit
     * @param {string} [customColor=null]
     */
    emitFloatingText(x, y, value, isCrit = false, customColor = null) {
        const text = isCrit ? `${value}!` : `${value}`;
        const color = customColor || (isCrit ? '#fbbf24' : '#ffffff');

        const floatObj = {
            x: x + Utils.randFloat(-10, 10),
            y: y - 15,
            text,
            isCrit,
            color,
            vy: isCrit ? -65 : -45,
            lifetime: 0.8,
            maxLife: 0.8,
        };

        this.floatingTexts.push(floatObj);

        // Also push to dungeon engine particles if available
        if (this.engine) {
            this.engine.particles.push({
                x: floatObj.x,
                y: floatObj.y,
                lifetime: floatObj.lifetime,
                maxLife: floatObj.maxLife,
                text: floatObj.text,
                color: floatObj.color,
                type: 'text',
                vy: floatObj.vy,
            });
        }
    }

    // ═══════════════════════════════════════════
    //  STATE MACHINE UPDATE
    // ═══════════════════════════════════════════

    /**
     * Update player combat state machine.
     * @param {number} dt
     * @param {Object} input - { keys, mousePos, mouseDown }
     */
    update(dt, input) {
        const p = this.player;
        if (!p) return;

        // Apply knockback decay to player
        if (p.vx && !input.moving) p.vx *= Math.pow(0.1, dt);
        if (p.vy && !input.moving) p.vy *= Math.pow(0.1, dt);

        // State Machine evaluation
        switch (this.currentState) {
            case PlayerCombatState.DASHING:
                this.stateTimer -= dt;
                p.iFrames = Math.max(p.iFrames, this.stateTimer);
                if (this.stateTimer <= 0) {
                    p.isDashing = false;
                    this.currentState = input.moving ? PlayerCombatState.WALKING : PlayerCombatState.IDLE;
                }
                break;

            case PlayerCombatState.USING_SKILL:
                this.stateTimer -= dt;
                if (this.stateTimer <= 0) {
                    this.currentState = input.moving ? PlayerCombatState.WALKING : PlayerCombatState.IDLE;
                }
                break;

            case PlayerCombatState.WALKING:
                if (!input.moving) {
                    this.currentState = PlayerCombatState.IDLE;
                }
                break;

            case PlayerCombatState.IDLE:
            default:
                if (input.moving) {
                    this.currentState = PlayerCombatState.WALKING;
                }
                break;
        }

        // Update Hitboxes
        this._updateHitboxes(dt);

        // Update Ground Effects (Consecration, Poison Clouds, etc.)
        this._updateGroundEffects(dt);

        // Update Minions (Titan)
        this._updateMinions(dt);

        // Update Floating text objects internal lifetime
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.lifetime -= dt;
            ft.y += ft.vy * dt;
            if (ft.lifetime <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }
    }

    // ═══════════════════════════════════════════
    //  HITBOX RESOLUTION & DAMAGE EXECUTION
    // ═══════════════════════════════════════════

    /**
     * Register a new active hitbox in the combat arena.
     * @param {Hitbox} hitbox
     */
    addHitbox(hitbox) {
        this.hitboxes.push(hitbox);
    }

    _updateHitboxes(dt) {
        if (!this.engine) return;
        const enemies = this.engine.enemies;

        for (let i = this.hitboxes.length - 1; i >= 0; i--) {
            const hitbox = this.hitboxes[i];
            const alive = hitbox.update(dt);

            if (hitbox.isPlayer) {
                // Check against each enemy's hurtbox
                for (const enemy of enemies) {
                    if (hitbox.hitTargets.has(enemy.id)) continue;

                    const hurtbox = new Hurtbox(enemy, enemy.w || 24, enemy.h || 24);
                    if (hurtbox.intersectsHitbox(hitbox)) {
                        hitbox.hitTargets.add(enemy.id);
                        this.resolveEnemyDamage(enemy, hitbox);
                    }
                }
            }

            if (!alive) {
                this.hitboxes.splice(i, 1);
            }
        }
    }

    /**
     * Resolve damage against an enemy from a hitbox.
     * @param {Object} enemy
     * @param {Hitbox} hitbox
     */
    resolveEnemyDamage(enemy, hitbox) {
        // Calculate knockback direction
        let dirX = hitbox.dirX;
        let dirY = hitbox.dirY;
        if (!dirX && !dirY) {
            const dx = enemy.x - hitbox.x;
            const dy = enemy.y - hitbox.y;
            const len = Math.hypot(dx, dy) || 1;
            dirX = dx / len;
            dirY = dy / len;
        }

        // Apply Damage
        enemy.hp -= hitbox.damage;

        // Apply Hit-Stun (140ms interrupt) and state change
        enemy.hitStun = 0.14;
        if (enemy.state && enemy.state !== 'DEAD') {
            enemy.state = 'HURT';
        }

        // Apply Hit Flash (boolean + duration)
        this.applyHitFlash(enemy, 0.14);

        // Apply Knockback (proportional vector)
        this.applyKnockback(enemy, dirX, dirY, hitbox.knockbackForce);

        // Emit Floating Damage Number (White for normal, Gold for crit)
        this.emitFloatingText(enemy.x, enemy.y, hitbox.damage, hitbox.isCrit);

        // Trigger on-hit effects (e.g. Life Steal, Stun, Slow, Poison)
        if (hitbox.onHitEffect) {
            hitbox.onHitEffect(enemy, this);
        }

        // Check if enemy died
        if (enemy.hp <= 0 && this.engine) {
            this.engine._onEnemyDeath(enemy);
        }
    }

    // ═══════════════════════════════════════════
    //  GROUND EFFECTS & MINIONS
    // ═══════════════════════════════════════════

    _updateGroundEffects(dt) {
        for (let i = this.groundEffects.length - 1; i >= 0; i--) {
            const effect = this.groundEffects[i];
            effect.lifetime -= dt;
            effect.tickTimer = (effect.tickTimer || 0) + dt;

            // Tick effect
            if (effect.tickTimer >= effect.tickRate) {
                effect.tickTimer = 0;
                if (effect.onTick) effect.onTick(this, effect);
            }

            if (effect.lifetime <= 0) {
                this.groundEffects.splice(i, 1);
            }
        }
    }

    _updateMinions(dt) {
        if (!this.engine) return;
        const enemies = this.engine.enemies;

        for (let i = this.minions.length - 1; i >= 0; i--) {
            const minion = this.minions[i];
            minion.lifetime -= dt;

            // Taunt: draw enemies towards minion
            if (minion.tauntRadius) {
                for (const enemy of enemies) {
                    const dist = Math.hypot(enemy.x - minion.x, enemy.y - minion.y);
                    if (dist < minion.tauntRadius) {
                        const dx = minion.x - enemy.x;
                        const dy = minion.y - enemy.y;
                        const len = Math.hypot(dx, dy) || 1;
                        enemy.x += (dx / len) * enemy.speed * 0.4 * dt;
                        enemy.y += (dy / len) * enemy.speed * 0.4 * dt;
                    }
                }
            }

            // Attack nearby enemies
            minion.attackTimer = (minion.attackTimer || 0) - dt;
            if (minion.attackTimer <= 0) {
                minion.attackTimer = 1.2;
                for (const enemy of enemies) {
                    if (Math.hypot(enemy.x - minion.x, enemy.y - minion.y) < 70) {
                        const hit = new Hitbox({
                            x: minion.x,
                            y: minion.y,
                            radius: 60,
                            damage: minion.damage,
                            isCrit: false,
                            knockbackForce: 150,
                            duration: 0.1,
                            isPlayer: true,
                        });
                        this.addHitbox(hit);
                        break;
                    }
                }
            }

            if (minion.lifetime <= 0) {
                this.minions.splice(i, 1);
            }
        }
    }

    // ═══════════════════════════════════════════
    //  SKILL ACTIVATION & CLASS COMBAT ACTIONS
    // ═══════════════════════════════════════════

    /**
     * Execute a skill by its tier number (1, 2, 3, 4).
     * @param {number} tier
     * @param {Object} mousePos
     * @returns {boolean}
     */
    useSkillByTier(tier, mousePos) {
        const char = this.character;
        if (!char || !char.skillTree) return false;

        const skill = char.skillTree.getSkillByTier(tier);
        if (!skill || !skill.unlocked) return false;

        return this.executeSkill(skill, mousePos);
    }

    /**
     * Execute a skill instance toward mouse direction.
     * @param {Skill} skill
     * @param {Object} mousePos
     * @returns {boolean}
     */
    executeSkill(skill, mousePos) {
        const char = this.character;
        const p = this.player;
        if (!char || !p || !skill.isReady) return false;

        // Resource check & consumption
        if (skill.cost > 0) {
            if (char.resource < skill.cost) return false;
            char.resource -= skill.cost;
            this.state.emit('character:changed', char);
        }

        // Trigger cooldown
        skill.startCooldown();

        // Aiming vector from player to mouse
        const dx = mousePos.x - p.x;
        const dy = mousePos.y - p.y;
        const dist = Math.hypot(dx, dy) || 1;
        const aimDirX = dx / dist;
        const aimDirY = dy / dist;

        // Update player facing
        p.facing.x = aimDirX;
        p.facing.y = aimDirY;

        // Set state to USING_SKILL unless it's a dash
        if (skill.skillType === 'utility' && skill.iFramesDuration > 0) {
            this.currentState = PlayerCombatState.DASHING;
            this.stateTimer = skill.iFramesDuration;
            p.isDashing = true;
            p.iFrames = skill.iFramesDuration;
        } else {
            this.currentState = PlayerCombatState.USING_SKILL;
            this.stateTimer = 0.2; // brief skill cast animation
        }

        // Delegate execution based on skill ID & class
        this._dispatchSkillAction(skill, mousePos, aimDirX, aimDirY);

        return true;
    }

    _dispatchSkillAction(skill, mousePos, aimDirX, aimDirY) {
        const char = this.character;
        const p = this.player;

        switch (skill.id) {
            // ──────────────────────────────
            //  BÁRBARO
            // ──────────────────────────────
            case 'barb_heavy_strike': { // T1
                const dmgInfo = this.calculateDamage(char, {}, skill.damageMultiplier);
                const hitX = p.x + aimDirX * 45;
                const hitY = p.y + aimDirY * 45;

                const hitbox = new Hitbox({
                    x: hitX,
                    y: hitY,
                    radius: skill.radius,
                    damage: dmgInfo.damage,
                    isCrit: dmgInfo.isCrit,
                    knockbackForce: skill.knockbackForce,
                    dirX: aimDirX,
                    dirY: aimDirY,
                    duration: 0.15,
                    onHitEffect: (enemy, ctrl) => {
                        // Generate fury on hit
                        char.resource = Math.min(char.maxResource, char.resource + 15);
                        ctrl.state.emit('character:changed', char);
                    },
                });
                this.addHitbox(hitbox);
                break;
            }

            case 'barb_leap_slam': { // T2
                // Leap towards mouse
                const targetDist = Math.min(skill.range, Math.hypot(mousePos.x - p.x, mousePos.y - p.y));
                p.x += aimDirX * targetDist;
                p.y += aimDirY * targetDist;
                if (this.engine) {
                    p.x = Utils.clamp(p.x, p.w / 2, this.engine.roomW - p.w / 2);
                    p.y = Utils.clamp(p.y, p.h / 2, this.engine.roomH - p.h / 2);
                }

                // Stun slam at landing point
                const dmgInfo = this.calculateDamage(char, {}, skill.damageMultiplier);
                const hitbox = new Hitbox({
                    x: p.x,
                    y: p.y,
                    radius: skill.radius,
                    damage: dmgInfo.damage,
                    isCrit: dmgInfo.isCrit,
                    knockbackForce: skill.knockbackForce,
                    duration: 0.2,
                    onHitEffect: (enemy, ctrl) => {
                        enemy.speed *= 0.1; // Stun
                        setTimeout(() => { enemy.speed = 50; }, 1500);
                    },
                });
                this.addHitbox(hitbox);
                break;
            }

            case 'barb_whirlwind': { // T3
                const activeMod = skill.getActiveModifier();
                const isVortex = activeMod && activeMod.mutationType === 'vortex_pull';
                const isWindSlash = activeMod && activeMod.mutationType === 'wind_slash';

                const dmgInfo = this.calculateDamage(char, {}, skill.damageMultiplier);

                const hitbox = new Hitbox({
                    x: p.x,
                    y: p.y,
                    radius: skill.radius,
                    damage: dmgInfo.damage,
                    isCrit: dmgInfo.isCrit,
                    knockbackForce: isVortex ? -120 : skill.knockbackForce, // Negative knockback pulls!
                    duration: 0.25,
                    onHitEffect: (enemy, ctrl) => {
                        if (isVortex) {
                            // Pull towards player
                            const dx = p.x - enemy.x;
                            const dy = p.y - enemy.y;
                            const len = Math.hypot(dx, dy) || 1;
                            enemy.vx = (dx / len) * 160;
                            enemy.vy = (dy / len) * 160;
                        }
                    },
                });
                this.addHitbox(hitbox);

                // If Wind Slashes modifier is active, launch cutting waves outward
                if (isWindSlash && this.engine) {
                    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3) {
                        this.engine.projectiles.push({
                            x: p.x,
                            y: p.y,
                            vx: Math.cos(angle) * 320,
                            vy: Math.sin(angle) * 320,
                            w: 12, h: 12,
                            damage: Math.floor(dmgInfo.damage * 0.7),
                            lifetime: 0.7,
                            isPlayer: true,
                            color: '#e2e8f0',
                        });
                    }
                }
                break;
            }

            case 'barb_ancestral_wrath': { // T4
                // Massive screen earthquake blast
                const dmgInfo = this.calculateDamage(char, {}, skill.damageMultiplier);
                const hitbox = new Hitbox({
                    x: p.x,
                    y: p.y,
                    radius: skill.radius,
                    damage: dmgInfo.damage,
                    isCrit: true, // Guaranteed epic impact
                    knockbackForce: skill.knockbackForce,
                    duration: 0.35,
                });
                this.addHitbox(hitbox);

                // Temporary fury buff
                char.moveSpeed *= 1.5;
                char.baseDamage += 20;
                this.state.emit('character:changed', char);
                setTimeout(() => {
                    char.recalculate();
                    this.state.emit('character:changed', char);
                }, 8000);
                break;
            }

            // ──────────────────────────────
            //  PALADINO
            // ──────────────────────────────
            case 'pal_hammer_light': { // T1
                const dmgInfo = this.calculateDamage(char, {}, skill.damageMultiplier);
                const hitX = p.x + aimDirX * 45;
                const hitY = p.y + aimDirY * 45;

                const hitbox = new Hitbox({
                    x: hitX,
                    y: hitY,
                    radius: skill.radius,
                    damage: dmgInfo.damage,
                    isCrit: dmgInfo.isCrit,
                    knockbackForce: skill.knockbackForce,
                    dirX: aimDirX,
                    dirY: aimDirY,
                    duration: 0.15,
                    onHitEffect: (enemy, ctrl) => {
                        char.resource = Math.min(char.maxResource, char.resource + 10);
                        ctrl.state.emit('character:changed', char);
                    },
                });
                this.addHitbox(hitbox);
                break;
            }

            case 'pal_shield_charge': { // T2
                // Dash with shield
                p.x += aimDirX * 140;
                p.y += aimDirY * 140;
                if (this.engine) {
                    p.x = Utils.clamp(p.x, p.w / 2, this.engine.roomW - p.w / 2);
                    p.y = Utils.clamp(p.y, p.h / 2, this.engine.roomH - p.h / 2);
                    // Destroy incoming hostile projectiles
                    this.engine.projectiles = this.engine.projectiles.filter(pr => pr.isPlayer);
                }

                const dmgInfo = this.calculateDamage(char, {}, skill.damageMultiplier);
                const hitbox = new Hitbox({
                    x: p.x,
                    y: p.y,
                    radius: skill.radius,
                    damage: dmgInfo.damage,
                    isCrit: dmgInfo.isCrit,
                    knockbackForce: skill.knockbackForce,
                    duration: 0.2,
                });
                this.addHitbox(hitbox);
                break;
            }

            case 'pal_blessed_shield': { // T3
                const activeMod = skill.getActiveModifier();
                const isSlow = activeMod && activeMod.mutationType === 'holy_slow';
                const isHeal = activeMod && activeMod.mutationType === 'heal_ricochet';

                const dmgInfo = this.calculateDamage(char, {}, skill.damageMultiplier);

                if (this.engine) {
                    // Spawn bouncing shield projectile
                    this.engine.projectiles.push({
                        x: p.x,
                        y: p.y,
                        vx: aimDirX * 360,
                        vy: aimDirY * 360,
                        w: 18, h: 18,
                        damage: dmgInfo.damage,
                        lifetime: 1.8,
                        isPlayer: true,
                        color: '#f0c850',
                        bouncesRemaining: 3,
                        onHitTarget: (enemy) => {
                            if (isSlow) {
                                enemy.speed *= 0.4; // 60% slow
                            }
                            if (isHeal) {
                                char.hp = Math.min(char.maxHp, char.hp + Math.floor(char.maxHp * 0.12));
                                this.state.emit('character:changed', char);
                            }
                        }
                    });
                }
                break;
            }

            case 'pal_consecration': { // T4
                // Sanctified ground
                this.groundEffects.push({
                    x: p.x,
                    y: p.y,
                    radius: skill.radius,
                    lifetime: 6.0,
                    tickRate: 0.5,
                    tickTimer: 0,
                    color: 'rgba(240, 200, 80, 0.25)',
                    onTick: (ctrl, eff) => {
                        // Heal player if in area
                        if (Math.hypot(p.x - eff.x, p.y - eff.y) < eff.radius) {
                            char.hp = Math.min(char.maxHp, char.hp + 8);
                            ctrl.state.emit('character:changed', char);
                        }
                        // Damage enemies in area
                        const tickDmg = ctrl.calculateDamage(char, {}, 0.45);
                        ctrl.addHitbox(new Hitbox({
                            x: eff.x,
                            y: eff.y,
                            radius: eff.radius,
                            damage: tickDmg.damage,
                            isCrit: false,
                            knockbackForce: 10,
                            duration: 0.1,
                        }));
                    },
                });
                break;
            }

            // ──────────────────────────────
            //  MAGO
            // ──────────────────────────────
            case 'mage_arcane_missile': { // T1
                const dmgInfo = this.calculateDamage(char, {}, skill.damageMultiplier);
                if (this.engine) {
                    this.engine.projectiles.push({
                        x: p.x,
                        y: p.y,
                        vx: aimDirX * 480,
                        vy: aimDirY * 480,
                        w: 10, h: 10,
                        damage: dmgInfo.damage,
                        lifetime: 1.2,
                        isPlayer: true,
                        color: '#a855f7',
                    });
                }
                break;
            }

            case 'mage_teleport': { // T2
                // Instant blink
                const blinkDist = Math.min(skill.range, Math.hypot(mousePos.x - p.x, mousePos.y - p.y));
                p.x += aimDirX * blinkDist;
                p.y += aimDirY * blinkDist;
                if (this.engine) {
                    p.x = Utils.clamp(p.x, p.w / 2, this.engine.roomW - p.w / 2);
                    p.y = Utils.clamp(p.y, p.h / 2, this.engine.roomH - p.h / 2);
                }
                break;
            }

            case 'mage_elemental_orb': { // T3
                const activeMod = skill.getActiveModifier();
                const isGlacial = activeMod && activeMod.mutationType === 'freeze';
                const isPyro = activeMod && activeMod.mutationType === 'fire_explosion';

                const dmgInfo = this.calculateDamage(char, {}, skill.damageMultiplier);

                if (this.engine) {
                    this.engine.projectiles.push({
                        x: p.x,
                        y: p.y,
                        vx: aimDirX * 180,
                        vy: aimDirY * 180,
                        w: 26, h: 26,
                        damage: dmgInfo.damage,
                        lifetime: 2.5,
                        isPlayer: true,
                        pierce: true,
                        color: isGlacial ? '#38bdf8' : isPyro ? '#f97316' : '#a855f7',
                        onHitTarget: (enemy) => {
                            if (isGlacial) {
                                enemy.speed = 0;
                                setTimeout(() => { enemy.speed = 45; }, 2000);
                            }
                            if (isPyro) {
                                this.groundEffects.push({
                                    x: enemy.x,
                                    y: enemy.y,
                                    radius: 50,
                                    lifetime: 3.5,
                                    tickRate: 0.5,
                                    color: 'rgba(249, 115, 22, 0.3)',
                                    onTick: (ctrl, eff) => {
                                        ctrl.addHitbox(new Hitbox({
                                            x: eff.x, y: eff.y, radius: eff.radius,
                                            damage: 15, isCrit: false, knockbackForce: 10, duration: 0.1
                                        }));
                                    }
                                });
                            }
                        }
                    });
                }
                break;
            }

            case 'mage_meteor_shower': { // T4
                // Telegraph impact area around cursor
                const targetX = mousePos.x;
                const targetY = mousePos.y;

                setTimeout(() => {
                    const dmgInfo = this.calculateDamage(char, {}, skill.damageMultiplier);
                    this.addHitbox(new Hitbox({
                        x: targetX,
                        y: targetY,
                        radius: skill.radius,
                        damage: dmgInfo.damage,
                        isCrit: true,
                        knockbackForce: skill.knockbackForce,
                        duration: 0.3,
                    }));
                }, 700);
                break;
            }

            // ──────────────────────────────
            //  NECROMANTE
            // ──────────────────────────────
            case 'necro_reaping_scythe': { // T1
                const dmgInfo = this.calculateDamage(char, {}, skill.damageMultiplier);
                const hitX = p.x + aimDirX * 50;
                const hitY = p.y + aimDirY * 50;

                const hitbox = new Hitbox({
                    x: hitX,
                    y: hitY,
                    radius: skill.radius,
                    damage: dmgInfo.damage,
                    isCrit: dmgInfo.isCrit,
                    knockbackForce: skill.knockbackForce,
                    dirX: aimDirX,
                    dirY: aimDirY,
                    duration: 0.18,
                    onHitEffect: (enemy, ctrl) => {
                        char.resource = Math.min(char.maxResource, char.resource + 12);
                        ctrl.state.emit('character:changed', char);
                    },
                });
                this.addHitbox(hitbox);
                break;
            }

            case 'necro_spectral_step': { // T2
                p.iFrames = skill.duration;
                char.moveSpeed *= 1.8;
                setTimeout(() => {
                    char.recalculate();
                }, skill.duration * 1000);
                break;
            }

            case 'necro_corpse_explosion': { // T3
                const activeMod = skill.getActiveModifier();
                const isToxic = activeMod && activeMod.mutationType === 'poison_cloud';
                const isLeech = activeMod && activeMod.mutationType === 'life_steal';

                // Look for corpses in engine near mouse
                let explodedAny = false;
                if (this.engine && this.engine.corpses) {
                    for (let i = this.engine.corpses.length - 1; i >= 0; i--) {
                        const corpse = this.engine.corpses[i];
                        if (Math.hypot(corpse.x - mousePos.x, corpse.y - mousePos.y) < skill.range) {
                            explodedAny = true;
                            const dmgInfo = this.calculateDamage(char, {}, skill.damageMultiplier);

                            this.addHitbox(new Hitbox({
                                x: corpse.x,
                                y: corpse.y,
                                radius: skill.radius,
                                damage: dmgInfo.damage,
                                isCrit: dmgInfo.isCrit,
                                knockbackForce: skill.knockbackForce,
                                duration: 0.25,
                                onHitEffect: (enemy, ctrl) => {
                                    if (isLeech) {
                                        char.hp = Math.min(char.maxHp, char.hp + Math.floor(dmgInfo.damage * 0.25));
                                        ctrl.state.emit('character:changed', char);
                                    }
                                }
                            }));

                            if (isToxic) {
                                this.groundEffects.push({
                                    x: corpse.x,
                                    y: corpse.y,
                                    radius: 70,
                                    lifetime: 4.5,
                                    tickRate: 0.5,
                                    color: 'rgba(34, 197, 94, 0.3)',
                                    onTick: (ctrl, eff) => {
                                        ctrl.addHitbox(new Hitbox({
                                            x: eff.x, y: eff.y, radius: eff.radius,
                                            damage: 18, isCrit: false, knockbackForce: 10, duration: 0.1
                                        }));
                                    }
                                });
                            }

                            // Remove detonated corpse
                            this.engine.corpses.splice(i, 1);
                        }
                    }
                }

                // If no corpses were on floor, detonates at cursor with base essence cost
                if (!explodedAny) {
                    const dmgInfo = this.calculateDamage(char, {}, skill.damageMultiplier * 0.7);
                    this.addHitbox(new Hitbox({
                        x: mousePos.x,
                        y: mousePos.y,
                        radius: skill.radius * 0.75,
                        damage: dmgInfo.damage,
                        isCrit: dmgInfo.isCrit,
                        knockbackForce: skill.knockbackForce,
                        duration: 0.2,
                    }));
                }
                break;
            }

            case 'necro_flesh_titan': { // T4
                // Summon Flesh Titan
                this.minions.push({
                    x: p.x + aimDirX * 60,
                    y: p.y + aimDirY * 60,
                    damage: 40,
                    lifetime: 20.0,
                    tauntRadius: 220,
                    attackTimer: 0.5,
                });
                break;
            }
        }
    }

    // ═══════════════════════════════════════════
    //  TEST COMBAT ENTITY & UNIT VALIDATION
    // ═══════════════════════════════════════════

    /**
     * Create a standalone dummy enemy entity for combat validation.
     * @param {Object} [overrides={}]
     * @returns {Object}
     */
    createDummyEnemy(overrides = {}) {
        return {
            id: Utils.uid(),
            x: overrides.x || 100,
            y: overrides.y || 100,
            w: 28,
            h: 28,
            hp: overrides.hp || 100,
            maxHp: overrides.maxHp || 100,
            armor: overrides.armor || 20,
            speed: overrides.speed || 50,
            vx: 0,
            vy: 0,
            hitFlash: false,
            hitFlashTimer: 0,
        };
    }

    /**
     * Perform an isolated test attack against an enemy entity,
     * demonstrating the damage formula, crit check, knockback vector,
     * hit flash, and floating damage emission.
     * 
     * @param {Object} [testEnemy=null]
     * @returns {{ calculation: Object, enemyStateAfterHit: Object, floatingText: Object }}
     */
    testCombatDamage(testEnemy = null) {
        const enemy = testEnemy || this.createDummyEnemy();
        const char = this.character || new Character('barbarian');

        // 1. Calculate Real Damage
        const calculation = this.calculateDamage(char, enemy, 1.0);

        // 2. Apply Damage
        const initialHp = enemy.hp;
        enemy.hp = Math.max(0, enemy.hp - calculation.damage);

        // 3. Apply Knockback (e.g. forward hit vector)
        const dirX = 1, dirY = 0, force = 140;
        this.applyKnockback(enemy, dirX, dirY, force);

        // 4. Apply Hit Flash
        this.applyHitFlash(enemy, 0.12);

        // 5. Emit Floating Text
        this.emitFloatingText(enemy.x, enemy.y, calculation.damage, calculation.isCrit);
        const emitted = this.floatingTexts[this.floatingTexts.length - 1];

        return {
            calculation,
            enemyStateAfterHit: {
                initialHp,
                finalHp: enemy.hp,
                damageTaken: calculation.damage,
                vx: enemy.vx,
                vy: enemy.vy,
                hitFlash: enemy.hitFlash,
            },
            floatingText: emitted,
        };
    }
}

console.log('[System] CombatController loaded.');
