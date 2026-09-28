/**
 * ============================================
 *  DUNGEON ENGINE
 *  Procedural dungeon with real-time ARPG combat
 *  on a 2D canvas. Movement, enemies, dash,
 *  hitbox/hurtbox, loot drops.
 * ============================================
 */

// ─── Enemy FSM States ───
const EnemyState = Object.freeze({
    IDLE:   'STATE_IDLE',
    CHASE:  'STATE_CHASE',
    ATTACK: 'STATE_ATTACK',
    HURT:   'STATE_HURT',
    DEAD:   'STATE_DEAD',
});
window.EnemyState = EnemyState;

// ─── Base Enemy Class ───
class Enemy {
    constructor(options) {
        this.id = options.id || Utils.uid();
        this.name = options.name || 'Inimigo da Fenda';
        this.archetype = options.archetype || 'melee';
        this.x = options.x || 0;
        this.y = options.y || 0;
        this.vx = 0;
        this.vy = 0;
        this.w = options.w || 26;
        this.h = options.h || 26;
        this.radius = options.radius || (this.w / 2);
        this.speed = options.speed || 50;
        this.maxHp = options.maxHp || options.hp || 30;
        this.hp = this.maxHp;
        this.armor = options.armor || 8;
        this.damage = options.damage || 7;
        this.attackRange = options.attackRange || 45;
        this.attackCooldown = options.attackCooldown || 1.2;
        this.currentCooldown = Math.random() * 0.4;
        this.perceptionRadius = options.perceptionRadius || 280;
        this.xpValue = options.xpValue || (8 + (options.floor || 1) * 2);
        this.isBoss = !!options.isBoss;
        this.isElite = !!options.isElite;
        this.color = options.color || '#8e8c89';
        this.icon = options.icon || 'ᚦ';
        this.facing = { x: 0, y: 1 };
        this.familyId = options.familyId || null;
        this.variantTier = options.variantTier || (options.isBoss ? 'boss' : (options.isChampion ? 'champion' : (options.isElite ? 'elite' : 'common')));
        this.bossType = options.bossType || null;
        this.bossScale = options.bossScale || null;

        // FSM & Combat
        this.state = EnemyState.IDLE;
        this.stateTimer = 0;
        this.windUpTimer = 0;
        this.windUpDuration = options.windUpDuration || 0.3;
        this.hitStun = 0;
        this.hitFlash = false;
        this.hitFlashTimer = 0;

        // Wander / Patrol
        this.wanderDir = { x: 0, y: 0 };
        this.wanderTimer = Utils.randFloat(1.0, 2.5);

        // 2D Sprite Asset Direct Binding
        this.spriteKey = options.spriteKey || (typeof EntityRenderer !== 'undefined' ? EntityRenderer.getEnemySpriteKey(this) : 'ashen_monk');
        this.frameWidth = this.isBoss ? 180 : (this.isElite ? 80 : 64);
        this.frameHeight = this.isBoss ? 180 : (this.isElite ? 80 : 64);
        this.width = options.width || this.frameWidth;
        this.height = options.height || this.frameHeight;
        this._sprite = (typeof AssetManager !== 'undefined') ? AssetManager.get(this.spriteKey) : null;
    }

    get sprite() {
        if (!this._sprite && typeof AssetManager !== 'undefined') {
            this._sprite = AssetManager.get(this.spriteKey);
        }
        return this._sprite;
    }

    set sprite(val) {
        this._sprite = val;
    }

    update(dt, player, engine) {
        if (this.state === EnemyState.DEAD) return;

        // Knockback physics
        if (this.vx || this.vy) {
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.vx *= Math.pow(0.04, dt);
            this.vy *= Math.pow(0.04, dt);
            if (Math.abs(this.vx) < 1) this.vx = 0;
            if (Math.abs(this.vy) < 1) this.vy = 0;
        }

        // Clamp to room bounds
        this.x = Utils.clamp(this.x, this.radius, engine.roomW - this.radius);
        this.y = Utils.clamp(this.y, this.radius, engine.roomH - this.radius);

        // Hit flash decay
        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer -= dt;
            if (this.hitFlashTimer <= 0) this.hitFlash = false;
        }

        // Attack cooldown decay
        if (this.currentCooldown > 0) {
            this.currentCooldown -= dt;
        }

        // Vector to player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 5) {
            this.facing.x = dx / dist;
            this.facing.y = dy / dist;
        }

        // FSM Execution
        switch (this.state) {
            case EnemyState.HURT:
                this.hitStun -= dt;
                if (this.hitStun <= 0) {
                    this.state = (dist <= this.perceptionRadius) ? EnemyState.CHASE : EnemyState.IDLE;
                }
                break;

            case EnemyState.IDLE:
                this.wanderTimer -= dt;
                if (this.wanderTimer <= 0) {
                    this.wanderTimer = Utils.randFloat(1.5, 3.5);
                    const ang = Math.random() * Math.PI * 2;
                    this.wanderDir.x = Math.cos(ang) * (Math.random() < 0.4 ? 0 : 1);
                    this.wanderDir.y = Math.sin(ang) * (Math.random() < 0.4 ? 0 : 1);
                }
                this.x += this.wanderDir.x * (this.speed * 0.35) * dt;
                this.y += this.wanderDir.y * (this.speed * 0.35) * dt;

                if (dist <= this.perceptionRadius) {
                    this.state = EnemyState.CHASE;
                }
                break;

            case EnemyState.CHASE:
                this._handleChase(dt, player, engine, dx, dy, dist);
                break;

            case EnemyState.ATTACK:
                this._handleAttack(dt, player, engine, dx, dy, dist);
                break;
        }
    }

    _handleChase(dt, player, engine, dx, dy, dist) {
        if (dist > this.perceptionRadius * 1.6) {
            this.state = EnemyState.IDLE;
            return;
        }

        if (dist > 0) {
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;
        }

        if (dist <= this.attackRange && this.currentCooldown <= 0) {
            this.state = EnemyState.ATTACK;
            this.windUpTimer = this.windUpDuration;
        }
    }

    _handleAttack(dt, player, engine, dx, dy, dist) {
        this.windUpTimer -= dt;
        if (this.windUpTimer <= 0) {
            this.executeAttack(player, engine);
            this.currentCooldown = this.attackCooldown;
            this.state = EnemyState.CHASE;
        }
    }

    executeAttack(player, engine) {
        const dist = Math.hypot(player.x - this.x, player.y - this.y);
        if (dist <= this.attackRange + 15 && player.iFrames <= 0) {
            engine._damagePlayer(this.damage);
        }
    }
}

// ─── Archetype 1: Rastejante da Fenda (Melee Básico) ───
class RiftCrawlerEnemy extends Enemy {
    constructor(options) {
        super({
            ...options,
            name: options.name || 'Rastejante do Vazio',
            archetype: 'crawler',
            familyId: 'void_spawn',
            spriteKey: 'void_skitterer',
            frameWidth: 50,
            frameHeight: 50,
            width: 50,
            height: 50,
            speed: options.isElite ? 92 : 82,
            armor: options.isElite ? 12 : 6,
            attackRange: 45,
            attackCooldown: 1.1,
            windUpDuration: 0.2,
            w: options.isElite ? 28 : 22,
            h: options.isElite ? 28 : 22,
            icon: 'ᚦ',
            color: options.isElite ? '#c5a059' : '#8b5cf6',
        });
    }

    _handleChase(dt, player, engine, dx, dy, dist) {
        if (dist > this.perceptionRadius * 1.6) {
            this.state = EnemyState.IDLE;
            return;
        }

        if (dist > 0) {
            // Movimentação rápida em zigue-zague (Void Skitterer)
            const perpX = -dy / dist;
            const perpY = dx / dist;
            const zigzag = Math.sin(performance.now() / 130 + (this.x % 50)) * 0.55;
            this.x += ((dx / dist) + perpX * zigzag) * this.speed * dt;
            this.y += ((dy / dist) + perpY * zigzag) * this.speed * dt;
        }

        if (dist <= this.attackRange && this.currentCooldown <= 0) {
            this.state = EnemyState.ATTACK;
            this.windUpTimer = this.windUpDuration;
        }
    }

    executeAttack(player, engine) {
        const dist = Math.hypot(player.x - this.x, player.y - this.y);
        if (dist <= this.attackRange + 15 && player.iFrames <= 0) {
            engine._damagePlayer(this.damage);
            engine.particles.push({
                x: player.x, y: player.y,
                lifetime: 0.25, maxLife: 0.25,
                size: 24, color: '#a855f7',
                type: 'slash',
            });
        }
    }
}

// ─── Archetype 2: Atirador Flebotomista (Ranged) ───
class PhlebotomistEnemy extends Enemy {
    constructor(options) {
        super({
            ...options,
            name: options.name || 'Atirador Flebotomista',
            archetype: 'phlebotomist',
            speed: options.isElite ? 58 : 50,
            armor: options.isElite ? 14 : 8,
            attackRange: 260,
            attackCooldown: 2.0,
            windUpDuration: 0.35,
            w: options.isElite ? 28 : 24,
            h: options.isElite ? 28 : 24,
            icon: '🜄',
            color: options.isElite ? '#c5a059' : '#059669',
        });
    }

    _handleChase(dt, player, engine, dx, dy, dist) {
        if (dist > this.perceptionRadius * 1.6) {
            this.state = EnemyState.IDLE;
            return;
        }

        // Kite if player is too close (< 160px)
        if (dist < 160) {
            const retreatSpeed = this.speed * 0.85;
            this.x -= (dx / dist) * retreatSpeed * dt;
            this.y -= (dy / dist) * retreatSpeed * dt;
        } else if (dist > 230) {
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;
        }

        if (dist <= this.attackRange && dist >= 100 && this.currentCooldown <= 0) {
            this.state = EnemyState.ATTACK;
            this.windUpTimer = this.windUpDuration;
        }
    }

    executeAttack(player, engine) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const len = Math.hypot(dx, dy) || 1;

        engine.projectiles.push({
            x: this.x, y: this.y,
            vx: (dx / len) * 200,
            vy: (dy / len) * 200,
            w: 10, h: 10,
            damage: this.damage,
            lifetime: 2.2,
            isPlayer: false,
            color: '#10b981',
            type: 'acid',
        });
    }
}

// ─── Archetype 3: Monge das Cinzas (Infanteria / Médios) ───
class PenitentAutomatonEnemy extends Enemy {
    constructor(options) {
        super({
            ...options,
            name: options.name || 'Monge das Cinzas',
            archetype: 'monk',
            familyId: 'ashen_coven',
            spriteKey: 'ashen_monk',
            frameWidth: 58,
            frameHeight: 58,
            width: 58,
            height: 58,
            speed: options.isElite ? 36 : 30,
            armor: options.isElite ? 54 : 44,
            attackRange: 65,
            attackCooldown: 2.2,
            windUpDuration: 0.45,
            w: options.isElite ? 34 : 28,
            h: options.isElite ? 34 : 28,
            icon: 'ᛏ',
            color: options.isElite ? '#c5a059' : '#d97706',
        });
        this.slamTelegraph = null;
    }

    _handleAttack(dt, player, engine, dx, dy, dist) {
        if (!this.slamTelegraph) {
            this.slamTelegraph = {
                x: this.x + this.facing.x * 25,
                y: this.y + this.facing.y * 25,
                radius: 75,
                duration: this.windUpDuration,
                timer: this.windUpDuration,
            };
        }
        this.slamTelegraph.timer -= dt;

        super._handleAttack(dt, player, engine, dx, dy, dist);
    }

    executeAttack(player, engine) {
        const tx = this.slamTelegraph ? this.slamTelegraph.x : (this.x + this.facing.x * 25);
        const ty = this.slamTelegraph ? this.slamTelegraph.y : (this.y + this.facing.y * 25);
        this.slamTelegraph = null;

        engine.particles.push({
            x: tx, y: ty,
            lifetime: 0.4, maxLife: 0.4,
            size: 75, color: '#f59e0b',
            type: 'circle',
        });

        const dist = Math.hypot(player.x - tx, player.y - ty);
        if (dist <= 75 && player.iFrames <= 0) {
            const heavyDmg = Math.floor(this.damage * 1.35);
            engine._damagePlayer(heavyDmg);
            const pLen = dist || 1;
            player.vx = ((player.x - tx) / pLen) * 220;
            player.vy = ((player.y - ty) / pLen) * 220;
        }
    }
}

// ─── Archetype 4: Cão da Peste (Blighted Brood) ───
class BlightHoundEnemy extends Enemy {
    constructor(options) {
        super({
            ...options,
            name: options.name || 'Cão da Peste',
            archetype: 'brood',
            familyId: 'blighted_brood',
            speed: options.isElite ? 92 : 80,
            armor: options.isElite ? 8 : 4,
            attackRange: 42,
            attackCooldown: 1.1,
            windUpDuration: 0.2,
            w: options.isElite ? 28 : 22,
            h: options.isElite ? 28 : 22,
            icon: 'ᚱ',
            color: options.isElite ? '#c5a059' : '#827717',
        });
    }

    executeAttack(player, engine) {
        const dist = Math.hypot(player.x - this.x, player.y - this.y);
        if (dist <= this.attackRange + 15 && player.iFrames <= 0) {
            engine._damagePlayer(this.damage);
            engine.particles.push({
                x: player.x, y: player.y,
                lifetime: 0.3, maxLife: 0.3,
                size: 24, color: '#827717',
                type: 'slash',
            });
        }
    }
}

// ─── Archetype 5: Bruto Esfolado (Flayed Brute com Cutelo) ───
class FlayedBruteEnemy extends Enemy {
    constructor(options) {
        super({
            ...options,
            name: options.name || 'Bruto Esfolado',
            archetype: 'brute',
            familyId: 'the_flayed',
            spriteKey: 'flayed_brute',
            frameWidth: 80,
            frameHeight: 80,
            width: 80,
            height: 80,
            speed: options.isElite ? 46 : 38,
            armor: options.isElite ? 38 : 26,
            attackRange: 75,
            attackCooldown: 2.2,
            windUpDuration: 0.45,
            w: 42, h: 42,
            radius: 28,
            isElite: true,
            icon: 'ᛝ',
            color: '#dc2626',
        });
        this.cleaveTelegraph = null;
    }

    _handleAttack(dt, player, engine, dx, dy, dist) {
        this.facing = { x: dx / (dist || 1), y: dy / (dist || 1) };
        if (!this.cleaveTelegraph) {
            this.cleaveTelegraph = {
                x: this.x,
                y: this.y,
                dirX: this.facing.x,
                dirY: this.facing.y,
                length: 85,
                width: 28,
                duration: this.windUpDuration,
            };
        }
        super._handleAttack(dt, player, engine, dx, dy, dist);
    }

    executeAttack(player, engine) {
        this.cleaveTelegraph = null;
        const dist = Math.hypot(player.x - this.x, player.y - this.y);
        const dot = ((player.x - this.x) * this.facing.x + (player.y - this.y) * this.facing.y) / (dist || 1);

        if (dist <= this.attackRange + 15 && dot > 0.35 && player.iFrames <= 0) {
            const heavyDmg = Math.floor(this.damage * 1.35);
            engine._damagePlayer(heavyDmg);
            engine.triggerHitstop(0.060);
            engine.triggerScreenShake(5, 0.120);
        }

        // Heavy cutelo visual on ground
        engine.particles.push({
            x: this.x + this.facing.x * 40,
            y: this.y + this.facing.y * 40,
            lifetime: 0.3, maxLife: 0.3,
            size: 55, color: '#dc2626',
            type: 'slash',
            facing: { ...this.facing }
        });
    }
}

// ─── Boss: O Carrasco de Ferro Negro ───
class IronExecutionerBoss extends Enemy {
    constructor(options) {
        super({
            ...options,
            name: 'O Carrasco de Ferro Negro',
            title: 'O CARRASCO DE FERRO NEGRO — GUARDIÃO DA FORNALHA MORTA',
            archetype: 'boss',
            spriteKey: 'ironbound_executioner',
            frameWidth: 180,
            frameHeight: 180,
            width: 180,
            height: 180,
            speed: 40,
            armor: 35,
            attackRange: 95,
            attackCooldown: 1.8,
            windUpDuration: 0.4,
            perceptionRadius: 650,
            w: 180, h: 180,
            radius: 48,
            icon: 'ᛟ',
            color: '#cf3a3a',
            isBoss: true,
            isElite: true,
            xpValue: 120 + (options.floor || 1) * 40,
        });

        this.phase = 1;
        this.chargeTimer = 0;
        this.isCharging = false;
        this.chargeCooldown = 4.0;
        this.funeralTollCooldown = 5.0; // Phase 1 & 2 Bell Toll shockwave
        this.shockwaveCooldown = 3.5;
        this.cleaveTelegraph = null;
        this.isDying = false;
        this.deathTimer = 0;
        this.deathDuration = 2.2;
    }

    update(dt, player, engine) {
        // Boss Death Sequence Staging (Section 32)
        if (this.isDying) {
            this.deathTimer -= dt;
            this.vx = 0;
            this.vy = 0;

            // Emit ash, embers, and dark smoke during dying sequence
            if (Math.random() < 0.45) {
                engine.particles.push({
                    x: this.x + Utils.randFloat(-35, 35),
                    y: this.y - 40 + Utils.randFloat(-20, 20),
                    vx: Utils.randFloat(-25, 25),
                    vy: Utils.randFloat(-50, -15),
                    lifetime: 0.85, maxLife: 0.85,
                    size: Utils.randFloat(8, 20),
                    color: Math.random() < 0.6 ? '#1c1917' : '#d97706',
                    type: 'circle',
                });
            }

            if (this.deathTimer <= 0) {
                engine._finishBossDeath(this);
            }
            return;
        }

        // Phase transition check at 50% HP (Section 30)
        if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
            this.phase = 2;
            this.speed = Math.floor(this.speed * 1.25); // +25% frenzy speed
            this.attackCooldown = 1.3; // Increased aggression
            engine.triggerScreenShake(12, 0.45);
            engine.triggerHitstop(0.080);
            engine.combat.emitFloatingText(this.x, this.y - 45, 'FRENESI DA CALDEIRA! FORNALHA ABERTA!', true, '#ef4444');
            for (let i = 0; i < 24; i++) {
                engine.particles.push({
                    x: this.x, y: this.y - 20,
                    vx: Utils.randFloat(-120, 120),
                    vy: Utils.randFloat(-120, 120),
                    lifetime: 0.9, maxLife: 0.9,
                    size: Utils.randFloat(8, 18),
                    color: Math.random() < 0.5 ? '#f97316' : '#dc2626',
                    type: 'circle',
                });
            }
        }

        // Funeral Toll Attack (Badalada Fúnebre - Section 29)
        this.funeralTollCooldown -= dt;
        if (this.funeralTollCooldown <= 0 && this.state !== EnemyState.HURT) {
            this.funeralTollCooldown = (this.phase === 2 ? 4.5 : 7.0);
            // Emits expanding concentric shockwave from boss position
            engine.shockwaves.push({
                x: this.x,
                y: this.y,
                radius: 18,
                maxRadius: 320,
                speed: 220,
                damage: 16,
                hitPlayer: false,
            });
            engine.combat.emitFloatingText(this.x, this.y - 45, '🔔 BADALADA FÚNEBRE!', true, '#fde047');
            engine.triggerScreenShake(6.5, 0.200);
            if (window.AudioManager) window.AudioManager.playClash(true);
            for (let i = 0; i < 12; i++) {
                engine.particles.push({
                    x: this.x, y: this.y - 50,
                    vx: Utils.randFloat(-60, 60),
                    vy: Utils.randFloat(-60, 60),
                    lifetime: 0.5, maxLife: 0.5,
                    size: Utils.randFloat(6, 12),
                    color: '#facc15',
                    type: 'circle',
                });
            }
        }

        // Carga da Caldeira (Boiler Charge - Section 31)
        if (this.isCharging) {
            this.chargeTimer -= dt;
            this.x += this.chargeDir.x * 260 * dt;
            this.y += this.chargeDir.y * 260 * dt;

            // Dense trail of ash & embers behind boss
            engine.particles.push({
                x: this.x - this.chargeDir.x * 35 + Utils.randFloat(-12, 12),
                y: this.y - this.chargeDir.y * 35 + Utils.randFloat(-12, 12),
                vx: -this.chargeDir.x * 50,
                vy: -this.chargeDir.y * 50,
                lifetime: 0.55, maxLife: 0.55,
                size: Utils.randFloat(10, 22),
                color: Math.random() < 0.6 ? '#18181b' : '#ea580c',
                type: 'circle',
            });

            const dist = Math.hypot(player.x - this.x, player.y - this.y);
            if (dist < 50 && player.iFrames <= 0) {
                engine._damagePlayer(Math.floor(this.damage * 1.25));
                player.vx = this.chargeDir.x * 260;
                player.vy = this.chargeDir.y * 260;
                engine.triggerHitstop(0.060);
                engine.triggerScreenShake(7, 0.180);
            }

            if (this.chargeTimer <= 0) {
                this.isCharging = false;
                this.currentCooldown = 1.0;
            }
            return;
        }

        // Phase 2 Central Shockwaves
        if (this.phase === 2) {
            this.shockwaveCooldown -= dt;
            if (this.shockwaveCooldown <= 0) {
                this.shockwaveCooldown = 4.0;
                engine.shockwaves.push({
                    x: 1376, y: 220,
                    radius: 12,
                    maxRadius: 280,
                    speed: 210,
                    damage: 18,
                    hitPlayer: false,
                });
                engine.particles.push({
                    x: 1376, y: 220,
                    lifetime: 0.5, maxLife: 0.5,
                    size: 30, color: '#ef4444',
                    type: 'circle',
                });
            }
        }

        if (this.chargeCooldown > 0) {
            this.chargeCooldown -= dt;
        }

        super.update(dt, player, engine);
    }

    _handleChase(dt, player, engine, dx, dy, dist) {
        if (dist > 180 && this.chargeCooldown <= 0 && this.currentCooldown <= 0) {
            this.chargeCooldown = 4.5;
            this.isCharging = true;
            this.chargeTimer = 0.58;
            const len = dist || 1;
            this.chargeDir = { x: dx / len, y: dy / len };
            engine.particles.push({
                x: this.x, y: this.y,
                lifetime: 0.35, maxLife: 0.35,
                size: 50, color: '#ea580c',
                type: 'circle',
            });
            return;
        }

        super._handleChase(dt, player, engine, dx, dy, dist);
    }

    _handleAttack(dt, player, engine, dx, dy, dist) {
        if (!this.cleaveTelegraph) {
            this.cleaveTelegraph = {
                x: this.x,
                y: this.y,
                dirX: this.facing.x,
                dirY: this.facing.y,
                length: 110,
                width: 44,
                duration: this.windUpDuration,
                timer: this.windUpDuration,
            };
        }
        this.cleaveTelegraph.timer -= dt;

        super._handleAttack(dt, player, engine, dx, dy, dist);
    }

    executeAttack(player, engine) {
        this.cleaveTelegraph = null;

        const ax = this.x + this.facing.x * 50;
        const ay = this.y + this.facing.y * 50;

        engine.particles.push({
            x: ax, y: ay,
            lifetime: 0.35, maxLife: 0.35,
            size: 70, color: '#cf3a3a',
            type: 'slash',
        });

        const dist = Math.hypot(player.x - this.x, player.y - this.y);
        const toPlayerX = player.x - this.x;
        const toPlayerY = player.y - this.y;
        const pLen = dist || 1;
        const dot = (toPlayerX / pLen) * this.facing.x + (toPlayerY / pLen) * this.facing.y;

        if (dist <= 100 && dot > 0.3 && player.iFrames <= 0) {
            const cleaveDmg = Math.floor(this.damage * (this.phase === 2 ? 1.35 : 1.15));
            engine._damagePlayer(cleaveDmg);
            player.vx = this.facing.x * 240;
            player.vy = this.facing.y * 240;
            engine.triggerHitstop(0.060);
            engine.triggerScreenShake(5.5, 0.150);
        }
    }
}

// ─── Boss 2: A Matriarca dos Tecidos Cegos ───
class BlindWeftMatriarchBoss extends Enemy {
    constructor(options) {
        super({
            ...options,
            name: 'A Matriarca dos Tecidos Cegos',
            title: 'Sacerdotisa das Teias Proibidas',
            archetype: 'boss',
            bossType: 'blind_weft_matriarch',
            familyId: 'the_flayed',
            speed: 52,
            armor: 26,
            attackRange: 75,
            attackCooldown: 1.4,
            windUpDuration: 0.28,
            perceptionRadius: 650,
            w: 56, h: 56,
            radius: 28,
            icon: '🜏',
            color: '#4a154b',
            isBoss: true,
            isElite: true,
            xpValue: 150 + (options.floor || 1) * 45,
        });

        this.phase = 1;
        this.wireCooldown = 4.0;
        this.teleportCooldown = 6.0;
    }

    update(dt, player, engine) {
        // Transição de Fase aos 40% de HP
        if (this.phase === 1 && this.hp <= this.maxHp * 0.4) {
            this.phase = 2;
            this.speed = Math.floor(this.speed * 1.35); // +35% agilidade
            this.attackCooldown = 1.0;
            engine.screenShakeTimer = 0.45;
            engine.screenShakeIntensity = 14;
            engine.combat.emitFloatingText(this.x, this.y - 30, 'MÁSCARA ROMPIDA: VÁCUO VIVO!', true, '#b388ff');

            for (let i = 0; i < 20; i++) {
                engine.particles.push({
                    x: this.x, y: this.y,
                    vx: Utils.randFloat(-120, 120),
                    vy: Utils.randFloat(-120, 120),
                    lifetime: 0.9, maxLife: 0.9,
                    size: Utils.randFloat(5, 12),
                    color: '#4b1e6d',
                    type: 'circle',
                });
            }
        }

        // Ataques de tecelagem de arame farpado no solo
        this.wireCooldown -= dt;
        if (this.wireCooldown <= 0) {
            this.wireCooldown = this.phase === 2 ? 3.0 : 4.5;
            // Cria armadilha de arame que causa sangramento se o jogador pisar
            if (engine.combat && engine.combat.groundEffects) {
                engine.combat.groundEffects.push({
                    x: player.x,
                    y: player.y,
                    radius: 40,
                    duration: 5.0,
                    timer: 5.0,
                    damage: Math.floor(this.damage * 0.5),
                    color: 'rgba(78, 17, 17, 0.4)',
                    name: 'Arame Farpado Eclesiástico',
                });
            }
        }

        super.update(dt, player, engine);
    }

    executeAttack(player, engine) {
        // Estocada vertical com os fusos de tear de ferro
        const dist = Math.hypot(player.x - this.x, player.y - this.y);
        if (dist <= this.attackRange + 20 && player.iFrames <= 0) {
            const spindleDmg = Math.floor(this.damage * (this.phase === 2 ? 1.4 : 1.15));
            engine._damagePlayer(spindleDmg);
            engine.particles.push({
                x: player.x, y: player.y,
                lifetime: 0.35, maxLife: 0.35,
                size: 45, color: '#b388ff',
                type: 'slash',
            });
        }
    }
}

// ─── Boss 3: O Observador da Fenda Estilhaçada ───
class ShatteredGazerBoss extends Enemy {
    constructor(options) {
        super({
            ...options,
            name: 'O Observador da Fenda Estilhaçada',
            title: 'Sentinela do Vácuo Primitivo',
            archetype: 'boss',
            bossType: 'shattered_gazer',
            familyId: 'void_spawn',
            speed: 32,
            armor: 44,
            attackRange: 280,
            attackCooldown: 2.2,
            windUpDuration: 0.45,
            perceptionRadius: 700,
            w: 60, h: 60,
            radius: 30,
            icon: '🜛',
            color: '#7b1fa2',
            isBoss: true,
            isElite: true,
            xpValue: 180 + (options.floor || 1) * 50,
        });

        this.phase = 1;
        this.pulseCooldown = 3.5;
        this.splitNodes = [];
    }

    update(dt, player, engine) {
        // Transição de Fase aos 60% de HP: Fragmentação Trina
        if (this.phase === 1 && this.hp <= this.maxHp * 0.6) {
            this.phase = 2;
            engine.screenShakeTimer = 0.5;
            engine.screenShakeIntensity = 15;
            engine.combat.emitFloatingText(this.x, this.y - 30, 'FRATURA TRINA!', true, '#df5418');

            for (let i = 0; i < 24; i++) {
                engine.particles.push({
                    x: this.x, y: this.y,
                    vx: Utils.randFloat(-140, 140),
                    vy: Utils.randFloat(-140, 140),
                    lifetime: 0.8, maxLife: 0.8,
                    size: Utils.randFloat(6, 14),
                    color: '#7b1fa2',
                    type: 'circle',
                });
            }
        }

        // Disparo de projéteis de vácuo gravitacional
        this.pulseCooldown -= dt;
        if (this.pulseCooldown <= 0 && this.state !== EnemyState.DEAD) {
            this.pulseCooldown = this.phase === 2 ? 2.2 : 3.4;

            // Dispara 5 a 7 agulhas de vidro escuro em arco
            const bladeCount = this.phase === 2 ? 7 : 5;
            const baseAngle = Math.atan2(player.y - this.y, player.x - this.x);
            const spread = Math.PI * 0.5;

            for (let i = 0; i < bladeCount; i++) {
                const angle = baseAngle - spread / 2 + (i * spread) / (bladeCount - 1);
                engine.projectiles.push({
                    x: this.x, y: this.y,
                    vx: Math.cos(angle) * 190,
                    vy: Math.sin(angle) * 190,
                    w: 12, h: 12,
                    damage: Math.floor(this.damage * 0.85),
                    lifetime: 2.5,
                    isPlayer: false,
                    color: '#b388ff',
                    type: 'void_shard',
                });
            }
        }

        super.update(dt, player, engine);
    }

    executeAttack(player, engine) {
        // Feixe gravitacional que atrai o jogador
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist <= 300 && player.iFrames <= 0) {
            engine._damagePlayer(this.damage);
            // Puxa o jogador levemente em direção à fenda
            player.vx = -(dx / dist) * 150;
            player.vy = -(dy / dist) * 150;
        }
    }
}

// ─── Boss 2: O Colosso das Forjas (As Forjas Mortas) ───
class ForgeColossusBoss extends Enemy {
    constructor(options) {
        super({
            ...options,
            name: 'O Colosso das Forjas',
            title: 'GUARDIÃO DA FUNDIÇÃO INCANDESCENTE',
            archetype: 'boss',
            spriteKey: 'automaton_heavy',
            frameWidth: 160,
            frameHeight: 160,
            width: 160,
            height: 160,
            speed: 36,
            armor: 42,
            attackRange: 100,
            attackCooldown: 1.8,
            windUpDuration: 0.45,
            perceptionRadius: 650,
            w: 160, h: 160,
            radius: 46,
            icon: '🜛',
            color: '#e65100',
            isBoss: true,
            isElite: true,
            xpValue: 240 + (options.floor || 1) * 60,
        });

        this.phase = 1;
        this.slamCooldown = 3.5;
        this.moltenVolleyCooldown = 4.2;
        this.isDying = false;
        this.deathTimer = 0;
        this.deathDuration = 2.2;
    }

    update(dt, player, engine) {
        if (this.isDying) {
            this.deathTimer -= dt;
            this.vx = 0;
            this.vy = 0;
            if (Math.random() < 0.45) {
                engine.particles.push({
                    x: this.x + Utils.randFloat(-30, 30),
                    y: this.y - 30 + Utils.randFloat(-20, 20),
                    vx: Utils.randFloat(-30, 30),
                    vy: Utils.randFloat(-60, -20),
                    lifetime: 0.85, maxLife: 0.85,
                    size: Utils.randFloat(6, 16),
                    color: Math.random() < 0.5 ? '#ff5722' : '#ffb74d',
                    type: 'circle',
                });
            }
            if (this.deathTimer <= 0) {
                engine._finishBossDeath(this);
            }
            return;
        }

        // Phase 2 at <= 50% HP: Core Overheat
        if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
            this.phase = 2;
            this.speed = Math.floor(this.speed * 1.3);
            this.attackCooldown = 1.2;
            engine.triggerScreenShake(14, 0.45);
            engine.triggerHitstop(0.080);
            engine.combat.emitFloatingText(this.x, this.y - 45, 'NÚCLEO SUPER-AQUECIDO! FORNALHA EM FRENESI!', true, '#ff5722');
            for (let i = 0; i < 28; i++) {
                engine.particles.push({
                    x: this.x, y: this.y - 20,
                    vx: Utils.randFloat(-140, 140),
                    vy: Utils.randFloat(-140, 140),
                    lifetime: 0.9, maxLife: 0.9,
                    size: Utils.randFloat(7, 18),
                    color: Math.random() < 0.5 ? '#ff9800' : '#f44336',
                    type: 'circle',
                });
            }
        }

        // Molten Slag Volley
        this.moltenVolleyCooldown -= dt;
        if (this.moltenVolleyCooldown <= 0 && this.state !== EnemyState.DEAD) {
            this.moltenVolleyCooldown = this.phase === 2 ? 2.8 : 4.2;
            const count = this.phase === 2 ? 5 : 3;
            const baseAngle = Math.atan2(player.y - this.y, player.x - this.x);
            const spread = Math.PI * 0.35;
            for (let i = 0; i < count; i++) {
                const ang = baseAngle - spread / 2 + (i * spread) / Math.max(1, count - 1);
                engine.projectiles.push({
                    x: this.x, y: this.y,
                    vx: Math.cos(ang) * 210,
                    vy: Math.sin(ang) * 210,
                    w: 14, h: 14,
                    damage: Math.floor(this.damage * 0.8),
                    lifetime: 2.5,
                    isPlayer: false,
                    color: '#ff5722',
                    type: 'fireball'
                });
            }
        }

        // Slag Ground Slam
        this.slamCooldown -= dt;
        if (this.slamCooldown <= 0 && this.state !== EnemyState.DEAD) {
            this.slamCooldown = this.phase === 2 ? 3.0 : 4.5;
            engine.shockwaves.push({
                x: this.x, y: this.y,
                r: 10, maxR: 120,
                speed: 180,
                damage: Math.floor(this.damage * 0.9),
                hitPlayer: false,
                color: '#ff7043'
            });
            engine.triggerScreenShake(8, 0.2);
        }

        super.update(dt, player, engine);
    }
}

// ─── Boss 3: O Soberano do Vazio (O Trono do Vazio) ───
class VoidSovereignBoss extends Enemy {
    constructor(options) {
        super({
            ...options,
            name: 'O Soberano do Vazio',
            title: 'TITÃ CÓSMICO DO HORIZONTE DE EVENTOS',
            archetype: 'boss',
            spriteKey: 'void_horror',
            frameWidth: 200,
            frameHeight: 200,
            width: 200,
            height: 200,
            speed: 32,
            armor: 36,
            attackRange: 220,
            attackCooldown: 1.9,
            windUpDuration: 0.5,
            perceptionRadius: 800,
            w: 200, h: 200,
            radius: 54,
            icon: '🌌',
            color: '#9333ea',
            isBoss: true,
            isElite: true,
            xpValue: 500 + (options.floor || 1) * 100,
        });

        this.phase = 1;
        this.beamCooldown = 4.0;
        this.vortexCooldown = 6.0;
        this.summonCooldown = 8.0;
        this.isDying = false;
        this.deathTimer = 0;
        this.deathDuration = 2.5;
    }

    update(dt, player, engine) {
        if (this.isDying) {
            this.deathTimer -= dt;
            this.vx = 0;
            this.vy = 0;
            if (Math.random() < 0.5) {
                engine.particles.push({
                    x: this.x + Utils.randFloat(-40, 40),
                    y: this.y - 40 + Utils.randFloat(-30, 30),
                    vx: Utils.randFloat(-40, 40),
                    vy: Utils.randFloat(-70, -20),
                    lifetime: 1.0, maxLife: 1.0,
                    size: Utils.randFloat(8, 22),
                    color: Math.random() < 0.5 ? '#9333ea' : '#3b82f6',
                    type: 'circle',
                });
            }
            if (this.deathTimer <= 0) {
                engine._finishBossDeath(this);
            }
            return;
        }

        // Phase 2 at <= 50% HP: Colapso do Vazio
        if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
            this.phase = 2;
            this.speed = Math.floor(this.speed * 1.25);
            this.attackCooldown = 1.4;
            engine.triggerScreenShake(18, 0.6);
            engine.triggerHitstop(0.090);
            engine.combat.emitFloatingText(this.x, this.y - 50, 'COLAPSO DO HORIZONTE DE EVENTOS!', true, '#c084fc');
            for (let i = 0; i < 35; i++) {
                engine.particles.push({
                    x: this.x, y: this.y - 30,
                    vx: Utils.randFloat(-160, 160),
                    vy: Utils.randFloat(-160, 160),
                    lifetime: 1.1, maxLife: 1.1,
                    size: Utils.randFloat(8, 20),
                    color: Math.random() < 0.5 ? '#c084fc' : '#3b82f6',
                    type: 'circle',
                });
            }
        }

        // Cosmic Ray / Gravitational Beam attack
        this.beamCooldown -= dt;
        if (this.beamCooldown <= 0 && this.state !== EnemyState.DEAD) {
            this.beamCooldown = this.phase === 2 ? 2.5 : 4.0;
            const count = this.phase === 2 ? 8 : 6;
            const baseAngle = Math.atan2(player.y - this.y, player.x - this.x);
            for (let i = 0; i < count; i++) {
                const ang = baseAngle + ((i - count / 2) * 0.16);
                engine.projectiles.push({
                    x: this.x, y: this.y,
                    vx: Math.cos(ang) * 240,
                    vy: Math.sin(ang) * 240,
                    w: 16, h: 16,
                    damage: Math.floor(this.damage * 0.9),
                    lifetime: 3.0,
                    isPlayer: false,
                    color: '#c084fc',
                    type: 'void_shard'
                });
            }
            engine.triggerScreenShake(6, 0.15);
        }

        // Gravitational Vortex Pull toward center
        this.vortexCooldown -= dt;
        if (this.vortexCooldown <= 0 && this.state !== EnemyState.DEAD) {
            this.vortexCooldown = this.phase === 2 ? 4.5 : 7.0;
            const pullDx = this.x - player.x;
            const pullDy = this.y - player.y;
            const dist = Math.hypot(pullDx, pullDy) || 1;
            if (dist < 550) {
                player.vx += (pullDx / dist) * 140;
                player.vy += (pullDy / dist) * 140;
                engine.combat.emitFloatingText(player.x, player.y - 25, 'PUXÃO GRAVITACIONAL!', false, '#a855f7');
            }
        }

        super.update(dt, player, engine);
    }
}

class DungeonEngine {
    constructor(state) {
        /** @type {StateManager} */
        this.state   = state;
        this.canvas  = null;
        this.ctx     = null;
        this.running = false;
        this._animFrame = null;
        this._lastFrame = 0;
        this.isPaused = false;

        // Dungeon data
        this.floor   = 1;
        this.rooms   = [];
        this.currentRoom = 0;

        // Arena & Boss Systems
        this.fogGateActive = false;
        this.bossFightActive = false;
        this.extractionMonolith = null;
        this.shockwaves = [];

        // Player in dungeon (South Entrance of Abyssal Rift)
        const self = this;
        this.player = {
            x: 1376, y: 1420,
            w: 28, h: 28,
            radius: 14,
            vx: 0, vy: 0,
            facing: { x: 0, y: -1 },
            isDashing: false,
            dashTimer: 0,
            dashCooldown: 0,
            iFrames: 0,
            hitFlashTimer: 0,
            attackCooldown: 0,
            get spriteKey() {
                return (typeof EntityRenderer !== 'undefined' ? EntityRenderer.getPlayerSpriteKey(self.state.character) : 'base_mannequin');
            },
            get sprite() {
                const key = this.spriteKey;
                return (typeof AssetManager !== 'undefined' ? AssetManager.get(key) : null);
            },
            frameWidth: 64,
            frameHeight: 64,
            width: 64,
            height: 64,
            get hp() { return self.state.character ? self.state.character.hp : 100; },
            set hp(v) { if (self.state.character) self.state.character.hp = v; },
            get maxHp() { return self.state.character ? self.state.character.maxHp : 100; },
        };

        // Enemies & Combat
        this.enemies = [];
        this.boss = null;
        this.projectiles = [];
        this.particles = [];
        this.lootDrops = [];
        this.corpses = []; // Ground corpses for Necromancer explosion

        // Combat Controller
        this.combat = new CombatController(this.state, this);

        // Input
        this.keys = {};
        this.mousePos = { x: 0, y: 0 };
        this.rawMouseScreen = { x: 0, y: 0 };
        this.rightMouseDown = false;

        // Roguelike Camera & Dynamic Zoom (default 1.6x for close, atmospheric roguelike immersion)
        this.camera = { x: 1376, y: 1420 };
        this.zoom = 1.6;
        this.targetZoom = 1.6;
        this.minZoom = 1.15;
        this.maxZoom = 2.25;

        // Room dimensions: Linear Dungeon Map (2752 x 1536)
        this.roomW = 2752;
        this.roomH = 1536;

        // 2D Graphical Map Background
        this.mapImage = new Image();
        this.mapImage.src = 'assets/maps/dungeon_level_1.jpg';

        // Atmospheric Roguelike Lighting, Particles, Decals & Braziers
        this.lightCanvas = document.createElement('canvas');
        this.lightCtx = this.lightCanvas.getContext('2d');
        this.bloodDecals = [];
        this.ambientMotes = this._initAmbientMotes(50);
        this.braziers = [
            // South Entrance
            { x: 1310, y: 1420 }, { x: 1442, y: 1420 },
            // Central Corridor
            { x: 1310, y: 1200 }, { x: 1442, y: 1200 },
            { x: 1310, y: 950 },  { x: 1442, y: 950 },
            { x: 1310, y: 750 },  { x: 1442, y: 750 },
            { x: 1310, y: 520 },  { x: 1442, y: 520 },
            // West Wing
            { x: 950, y: 1250 }, { x: 950, y: 900 }, { x: 740, y: 750 }, { x: 550, y: 600 }, { x: 550, y: 350 },
            // East Wing
            { x: 1650, y: 1150 }, { x: 1850, y: 1150 }, { x: 1750, y: 850 }, { x: 2100, y: 750 }, { x: 2100, y: 500 }, { x: 1700, y: 450 },
            // North Fog Gate & Boss Arena
            { x: 1240, y: 430 }, { x: 1512, y: 430 },
            { x: 1200, y: 220 }, { x: 1552, y: 220 }, { x: 1376, y: 70 }
        ];

        // Survival & Kinetic Combat Feedback (Hitstop, Screen Shake, Damage Vignette)
        this.hitstopTimer = 0;
        this.damageVignetteTimer = 0;
        this.screenShakeTimer = 0;
        this.screenShakeIntensity = 0;
        this.screenShakeMaxDuration = 0.120;

        // Interactive Chests
        this.chests = [];

        // Dynamic Map & Progression Support
        this.currentMapId = 'DUNGEON_RIFT';
        this.slagHazards = [];
        this.voidBarrierActive = false;
        this.voidObelisks = { west: false, east: false };
        this.obelisks = [];

        console.log('[DungeonEngine] Initialized with Roguelike Zoom, Dynamic Lighting & Combat Feel.');
    }

    /**
     * Kinetic Hitstop / Frame Freeze:
     * Freezes physical simulation for duration (e.g. 60ms) while keeping Canvas active.
     */
    triggerHitstop(duration = 0.060) {
        this.hitstopTimer = Math.max(this.hitstopTimer, duration);
    }

    /**
     * Screen Shake with smooth damping.
     */
    triggerScreenShake(intensity = 5, duration = 0.120) {
        this.screenShakeIntensity = intensity;
        this.screenShakeTimer = duration;
        this.screenShakeMaxDuration = duration;
    }

    /**
     * Enter a new dungeon.
     * @param {HTMLCanvasElement} canvasEl
     * @param {string} [mapId=null]
     */
    enter(canvasEl, mapId = null) {
        if (!this.state.useKey()) return false;

        this.canvas = canvasEl;
        this.ctx    = canvasEl.getContext('2d');
        this.running = true;
        this.isPaused = false;
        this.floor   = 1;
        this.runLoot = { gold: 0, items: [] };

        // Set active map definition
        if (mapId) {
            this.currentMapId = mapId;
        } else if (window.MapManager && window.MapManager.activeDungeonMapId) {
            this.currentMapId = window.MapManager.activeDungeonMapId;
        } else {
            this.currentMapId = 'DUNGEON_RIFT';
        }

        const mapDef = (window.MapManager && window.MapManager.getMap(this.currentMapId))
            || (window.WORLD_MAPS && window.WORLD_MAPS[this.currentMapId])
            || { width: 2752, height: 1536, spawn: { x: 0.5, y: 0.92 }, src: 'assets/maps/dungeon_level_1.jpg' };

        this.roomW = mapDef.width || 2752;
        this.roomH = mapDef.height || 1536;
        this.mapImage = new Image();
        this.mapImage.src = mapDef.src || 'assets/maps/dungeon_level_1.jpg';

        // Deep Memory Cleanup on level entry (clears stale particles, shockwaves, enemies)
        if (window.MapManager && typeof window.MapManager.cleanupMemory === 'function') {
            window.MapManager.cleanupMemory(this);
        }

        // Reset Boss and Arena state
        this.fogGateActive = false;
        this.bossFightActive = false;
        this.extractionMonolith = null;
        this.shockwaves = [];

        // Resize canvas
        this._resizeCanvas();
        window.addEventListener('resize', this._onResize);

        // Generate floor elements
        this._generateFloor();

        // Place player according to map spawn point
        this.player.x = Math.round((mapDef.spawn ? mapDef.spawn.x : 0.5) * this.roomW);
        this.player.y = Math.round((mapDef.spawn ? mapDef.spawn.y : 0.92) * this.roomH);
        this.player.vx = 0;
        this.player.vy = 0;

        // Reset Roguelike Camera & Zoom
        this.zoom = (this.currentMapId === 'DUNGEON_FORGES' ? 1.4 : 1.6);
        this.targetZoom = this.zoom;
        this.camera.x = this.player.x;
        this.camera.y = this.player.y;
        this.rawMouseScreen = { x: this.canvas.width / 2, y: this.canvas.height / 2 };
        this._updateWorldMouse();

        // Bind input
        this._bindInput();

        // Start loop
        this._lastFrame = performance.now();
        this._loop();

        this.state.inDungeon = true;
        this.state.dungeonFloor = this.floor;
        this.state.emit('dungeon:entered', { floor: this.floor });

        // Trigger dungeon music theme (Chrome_Capture_2026-09-27_17-44-27.mp3)
        if (window.AudioManager && typeof window.AudioManager.playMusic === 'function') {
            window.AudioManager.playMusic('dungeon');
        }

        return true;
    }

    /**
     * Exit the dungeon (retreat, death or victory).
     */
    exit(reason = 'retreat') {
        this.running = false;
        this.isPaused = false;
        this.state.inDungeon = false;
        this.fogGateActive = false;
        this.bossFightActive = false;

        // Trigger general game music theme (Chrome_Capture_2026-09-27_17-48-18.mp3)
        if (window.AudioManager && typeof window.AudioManager.playMusic === 'function') {
            window.AudioManager.playMusic('general');
        }

        const bossHud = document.getElementById('boss-hud-container');
        if (bossHud) bossHud.classList.add('hidden');

        if (this._animFrame) cancelAnimationFrame(this._animFrame);

        window.removeEventListener('resize', this._onResize);
        this._unbindInput();

        let penaltyInfo = null;

        if (reason === 'death') {
            const diff = this.state.difficultyConfig || { deathLossPercent: 0.25, id: 'pilgrim' };
            const lossFraction = diff.deathLossPercent ?? diff.deathPenalty ?? diff.deathLootLoss ?? 0.25;

            // Penalty on gold gathered during this expedition
            const lostGold = Math.floor((this.runLoot?.gold || 0) * lossFraction);
            if (lostGold > 0) {
                this.state.spendResource(ResourceType.GOLD, lostGold);
            }

            // Items lost from this expedition
            let lostItemsCount = 0;
            if (this.runLoot?.items?.length) {
                let toRemove = 0;
                if (diff.id === 'abyssal') {
                    // Abissal: 100% loss of expedition loot
                    toRemove = this.runLoot.items.length;
                } else if (diff.id === 'veteran') {
                    // Veterano: 60% loss of expedition loot
                    toRemove = Math.ceil(this.runLoot.items.length * 0.60);
                } else {
                    // Peregrino: 25% loss of expedition loot
                    toRemove = Math.ceil(this.runLoot.items.length * 0.25);
                }

                for (let i = 0; i < toRemove && i < this.runLoot.items.length; i++) {
                    const it = this.runLoot.items[i];
                    const idx = this.state.character.inventory.findIndex(inv => inv && inv.id === it.id);
                    if (idx !== -1) {
                        this.state.character.inventory[idx] = null;
                        lostItemsCount++;
                    }
                }
            }

            // Abissal: quebra da Chave da Fenda
            let keyBroken = false;
            if (diff.id === 'abyssal') {
                if (this.state.dungeonKeys > 0) {
                    this.state.dungeonKeys--;
                    keyBroken = true;
                    this.state.emit('keys:changed', this.state.dungeonKeys);
                }
            }

            penaltyInfo = {
                lostGold,
                lostItemsCount,
                keyBroken,
                difficulty: diff.id,
                penaltyPct: Math.round(lossFraction * 100),
            };
        }

        this.state.emit('dungeon:exited', { reason, floor: this.floor, penaltyInfo });
    }

    // ═══════════════════════════════════════════
    //  GENERATION
    // ═══════════════════════════════════════════

    _generateFloor() {
        this.enemies = [];
        this.projectiles = [];
        this.particles = [];
        this.lootDrops = [];
        this.corpses = [];
        this.shockwaves = [];
        this.bloodDecals = [];
        this.fogGateActive = false;
        this.bossFightActive = false;
        this.extractionMonolith = null;
        if (this.combat) {
            this.combat.hitboxes = [];
            this.combat.groundEffects = [];
        }

        if (this.currentMapId === 'DUNGEON_FORGES') {
            this._generateForgesDungeon();
        } else if (this.currentMapId === 'DUNGEON_VOID') {
            this._generateVoidDungeon();
        } else {
            this._generateRiftDungeon();
        }

        this.state.emit('dungeon:floor', { floor: this.floor, enemies: this.enemies.length });
    }

    _generateRiftDungeon() {
        // 4 Interactive Relic Chests in side chambers
        this.chests = [
            { id: 'chest_nw', x: 550, y: 350, opened: false },
            { id: 'chest_w',  x: 950, y: 900, opened: false },
            { id: 'chest_se', x: 1850, y: 1150, opened: false },
            { id: 'chest_ne', x: 2100, y: 500, opened: false },
        ];

        this.braziers = [
            // South Entrance
            { x: 1310, y: 1420 }, { x: 1442, y: 1420 },
            // Central Corridor
            { x: 1310, y: 1200 }, { x: 1442, y: 1200 },
            { x: 1310, y: 950 },  { x: 1442, y: 950 },
            { x: 1310, y: 750 },  { x: 1442, y: 750 },
            { x: 1310, y: 520 },  { x: 1442, y: 520 },
            // West Wing
            { x: 950, y: 1250 }, { x: 950, y: 900 }, { x: 740, y: 750 }, { x: 550, y: 600 }, { x: 550, y: 350 },
            // East Wing
            { x: 1650, y: 1150 }, { x: 1850, y: 1150 }, { x: 1750, y: 850 }, { x: 2100, y: 750 }, { x: 2100, y: 500 }, { x: 1700, y: 450 },
            // North Fog Gate & Boss Arena
            { x: 1240, y: 430 }, { x: 1512, y: 430 },
            { x: 1200, y: 220 }, { x: 1552, y: 220 }, { x: 1376, y: 70 }
        ];

        // Boss in North Chamber
        this.boss = this._spawnBoss();
        this.enemies.push(this.boss);

        // Spawn corridor & side room enemies using the 4 Families
        const corridorPoints = [
            { x: 1376, y: 1200, type: 'crawler' },
            { x: 1376, y: 950,  type: 'phlebotomist' },
            { x: 1376, y: 750,  type: 'brood' },
            { x: 1376, y: 480,  type: 'automaton' },
            { x: 920,  y: 1250, type: 'crawler' },
            { x: 950,  y: 900,  type: 'phlebotomist' },
            { x: 740,  y: 750,  type: 'brood' },
            { x: 550,  y: 600,  type: 'automaton' },
            { x: 550,  y: 350,  type: 'phlebotomist' },
            { x: 1000, y: 500,  type: 'crawler' },
            { x: 1650, y: 1150, type: 'brood' },
            { x: 1850, y: 1150, type: 'phlebotomist' },
            { x: 1750, y: 850,  type: 'automaton' },
            { x: 2100, y: 750,  type: 'crawler' },
            { x: 2100, y: 500,  type: 'brood' },
            { x: 1700, y: 450,  type: 'automaton' },
        ];

        const enemyCount = Math.min(16, 6 + this.floor * 2);
        for (let i = 0; i < enemyCount; i++) {
            const pt = corridorPoints[i % corridorPoints.length];
            const enemy = this._spawnEnemy(pt.type);
            enemy.x = pt.x + Utils.randFloat(-35, 35);
            enemy.y = pt.y + Utils.randFloat(-35, 35);
            this.enemies.push(enemy);
        }
    }

    _generateForgesDungeon() {
        // Lateral Slag Vats (Continuous burn hazard when stepping inside or near edges)
        this.slagHazards = [
            { x: 220, y: 380, w: 140, h: 65, name: 'Bacia de Escória Ocidental' },
            { x: 990, y: 380, w: 140, h: 65, name: 'Bacia de Escória Oriental' }
        ];

        // Workshop Rooms with Black Iron Ingots and keys
        this.chests = [
            { id: 'forge_chest_sw', x: 200, y: 640, opened: false, rewardType: 'black_iron' },
            { id: 'forge_chest_se', x: 1150, y: 640, opened: false, rewardType: 'black_iron' },
            { id: 'forge_chest_nw', x: 200, y: 150, opened: false, rewardType: 'black_iron' },
            { id: 'forge_chest_ne', x: 1150, y: 150, opened: false, rewardType: 'black_iron' },
        ];

        this.braziers = [
            { x: 640, y: 720 }, { x: 736, y: 720 },
            { x: 688, y: 550 }, { x: 688, y: 400 }, { x: 688, y: 300 },
            { x: 290, y: 412 }, { x: 1070, y: 412 },
            { x: 688, y: 195 }
        ];

        this.boss = this._spawnBoss();
        this.enemies.push(this.boss);

        // Heavy Automaton and Ashen monsters patrolling tracks & workshops
        const forgePoints = [
            { x: 688, y: 560, type: 'automaton' },
            { x: 688, y: 430, type: 'automaton' },
            { x: 420, y: 620, type: 'phlebotomist' },
            { x: 950, y: 620, type: 'phlebotomist' },
            { x: 300, y: 360, type: 'crawler' },
            { x: 1060, y: 360, type: 'crawler' },
            { x: 400, y: 220, type: 'automaton' },
            { x: 970, y: 220, type: 'automaton' },
            { x: 250, y: 500, type: 'brood' },
            { x: 1120, y: 500, type: 'brood' },
        ];

        for (const pt of forgePoints) {
            const enemy = this._spawnEnemy(pt.type);
            enemy.x = pt.x + Utils.randFloat(-25, 25);
            enemy.y = pt.y + Utils.randFloat(-25, 25);
            this.enemies.push(enemy);
        }
    }

    _generateVoidDungeon() {
        // Gravitational barrier active across central crossroads (blocking North Throne)
        this.voidBarrierActive = true;
        this.voidObelisks = { west: false, east: false };

        this.obelisks = [
            { id: 'obelisk_west', x: 780, y: 1008, radius: 75, name: 'Obelisco do Vácuo Ocidental', attuned: false },
            { id: 'obelisk_east', x: 2804, y: 1008, radius: 75, name: 'Obelisco do Vácuo Oriental', attuned: false }
        ];

        this.chests = [
            { id: 'void_chest_w', x: 700, y: 1008, opened: false, rewardType: 'void_relic' },
            { id: 'void_chest_e', x: 2880, y: 1008, opened: false, rewardType: 'void_relic' },
        ];

        this.braziers = [
            { x: 1792, y: 1915 }, { x: 1792, y: 1500 }, { x: 1792, y: 1250 },
            { x: 1792, y: 1100 },
            { x: 1300, y: 1050 }, { x: 2284, y: 1050 },
            { x: 780, y: 1008 }, { x: 2804, y: 1008 },
            { x: 1792, y: 750 }, { x: 1792, y: 350 }
        ];

        this.boss = this._spawnBoss();
        this.enemies.push(this.boss);

        // Void Spawns guarding the lateral wings and bridges
        const voidPoints = [
            { x: 1792, y: 1600, type: 'crawler' },
            { x: 1792, y: 1350, type: 'crawler' },
            { x: 1300, y: 1050, type: 'crawler' },
            { x: 950,  y: 1008, type: 'crawler' },
            { x: 800,  y: 920,  type: 'phlebotomist' },
            { x: 800,  y: 1090, type: 'brood' },
            { x: 2284, y: 1050, type: 'crawler' },
            { x: 2630, y: 1008, type: 'crawler' },
            { x: 2780, y: 920,  type: 'phlebotomist' },
            { x: 2780, y: 1090, type: 'brood' },
            { x: 1792, y: 800,  type: 'phlebotomist' },
            { x: 1792, y: 600,  type: 'crawler' },
        ];

        for (const pt of voidPoints) {
            const enemy = this._spawnEnemy(pt.type);
            enemy.x = pt.x + Utils.randFloat(-35, 35);
            enemy.y = pt.y + Utils.randFloat(-35, 35);
            this.enemies.push(enemy);
        }
    }

    _spawnEnemy(type, opts = {}) {
        const diff = this.state.difficultyConfig || { enemyHpMult: 1.0, enemyDmgMult: 1.0 };
        const baseHp = Math.floor((35 + this.floor * 14) * diff.enemyHpMult);
        const baseDmg = Math.floor((6 + this.floor * 2.2) * diff.enemyDmgMult);
        const isElite = opts.isElite || (Math.random() < 0.15);

        const options = {
            hp: isElite ? Math.floor(baseHp * 1.8) : baseHp,
            damage: isElite ? Math.floor(baseDmg * 1.4) : baseDmg,
            floor: this.floor,
            isElite,
            ...opts
        };

        switch (type) {
            case 'phlebotomist':
                return new PhlebotomistEnemy(options);
            case 'automaton':
            case 'monk':
                return new PenitentAutomatonEnemy(options);
            case 'brood':
            case 'hound':
                return new BlightHoundEnemy(options);
            case 'crawler':
            case 'skitterer':
            default:
                return new RiftCrawlerEnemy(options);
        }
    }

    _spawnBoss() {
        const diff = this.state.difficultyConfig || { enemyHpMult: 1.0, enemyDmgMult: 1.0 };
        const bossHp = Math.floor((320 + this.floor * 80) * diff.enemyHpMult);
        const bossDmg = Math.floor((18 + this.floor * 5) * diff.enemyDmgMult);

        if (this.currentMapId === 'DUNGEON_FORGES') {
            return new ForgeColossusBoss({
                x: 688,
                y: 185,
                hp: Math.floor(bossHp * 1.35),
                damage: Math.floor(bossDmg * 1.2),
                floor: this.floor,
            });
        } else if (this.currentMapId === 'DUNGEON_VOID') {
            return new VoidSovereignBoss({
                x: 1792,
                y: 350,
                hp: Math.floor(bossHp * 1.9),
                damage: Math.floor(bossDmg * 1.45),
                floor: this.floor,
            });
        }

        // Rotação dos 3 Grandes Chefes por Andar da Fenda Abissal
        const bossCycle = ((this.floor - 1) % 3);

        if (bossCycle === 1) {
            return new BlindWeftMatriarchBoss({
                x: 1376, // North Circular Crimson Arena
                y: 220,
                hp: Math.floor(bossHp * 0.9),
                damage: Math.floor(bossDmg * 1.15),
                floor: this.floor,
            });
        } else if (bossCycle === 2) {
            return new ShatteredGazerBoss({
                x: 1376,
                y: 220,
                hp: Math.floor(bossHp * 1.1),
                damage: bossDmg,
                floor: this.floor,
            });
        }

        // Chefe 1 Padrão: O Carrasco de Ferro Negro
        return new IronExecutionerBoss({
            x: 1376,
            y: 220,
            hp: bossHp,
            damage: bossDmg,
            floor: this.floor,
        });
    }

    // ═══════════════════════════════════════════
    //  GAME LOOP
    // ═══════════════════════════════════════════

    _loop() {
        if (!this.running) return;

        const now = performance.now();
        const dt  = Math.min((now - this._lastFrame) / 1000, 0.05); // Cap at 50ms
        this._lastFrame = now;

        // Hitstop / Frame Freeze: freeze physical simulation for 60ms while keeping Canvas active!
        if (this.hitstopTimer > 0) {
            this.hitstopTimer -= dt;
        } else if (!this.isPaused) {
            this._update(dt);
        }
        this._render();

        this._animFrame = requestAnimationFrame(() => this._loop());
    }

    _update(dt) {
        if (this.isPaused || this.isPausedBySettings) return;

        // Feedback timers
        if (this.damageVignetteTimer > 0) this.damageVignetteTimer -= dt;
        if (this.screenShakeTimer > 0) this.screenShakeTimer -= dt;
        if (this.player.hitFlashTimer > 0) this.player.hitFlashTimer -= dt;
        for (let i = 0; i < this.enemies.length; i++) {
            if (this.enemies[i].hitFlashTimer > 0) this.enemies[i].hitFlashTimer -= dt;
        }

        this._updatePlayer(dt);
        this._updateEnemies(dt);
        this._updateProjectiles(dt);
        this._updateParticles(dt);
        this._updateShockwaves(dt);
        this._updateCamera(dt);
        this._updateAmbientMotes(dt);
        this._checkLootPickups();
        this._checkBossArena();
        this._checkMonolithInteraction();
        this._updateBossHud();

        // Check Chest Pickups
        for (const chest of this.chests) {
            if (!chest.opened && Math.hypot(this.player.x - chest.x, this.player.y - chest.y) < 38) {
                chest.opened = true;
                const diff = this.state.difficultyConfig;
                const loot = LootTable.rollEnemyLoot(this.floor, diff);
                for (const item of loot) {
                    this.lootDrops.push({
                        x: chest.x + Utils.randFloat(-15, 15),
                        y: chest.y + Utils.randFloat(-15, 15),
                        item,
                        lifetime: 30,
                        collected: false,
                        bobPhase: Math.random() * Math.PI * 2,
                    });
                }

                if (chest.rewardType === 'black_iron') {
                    // Forjas Mortas: Lingotes de ferro negro e chave extra
                    this.state.gainResource('iron', 35);
                    this.state.gainResource('gold', 25);
                    if (Math.random() < 0.5) {
                        this.state.dungeonKeys++;
                        this.state.emit('keys:changed', this.state.dungeonKeys);
                        if (window.uiManager) window.uiManager.notify('Oficina das Forjas: Lingotes de Ferro Negro e Chave extra!', 'loot');
                    } else {
                        if (window.uiManager) window.uiManager.notify('Oficina das Forjas: Lingotes de Ferro Negro e Ouro!', 'loot');
                    }
                } else if (chest.rewardType === 'void_relic') {
                    this.state.gainResource('essence', 2);
                    this.state.gainResource('sacred_ashes', 3);
                    if (window.uiManager) window.uiManager.notify('Relicário do Vazio: Essências Cósmicas e Cinzas Sagradas!', 'loot');
                } else {
                    if (window.uiManager) {
                        window.uiManager.notify('Baú ancestral aberto nas ruínas!', 'loot');
                    }
                }
            }
        }

        // Check Molten Slag Continuous Damage Hazard (As Forjas Mortas)
        if (this.currentMapId === 'DUNGEON_FORGES' && this.slagHazards && this.slagHazards.length > 0) {
            for (const vat of this.slagHazards) {
                if (this.player.x >= vat.x - 8 && this.player.x <= vat.x + vat.w + 8 &&
                    this.player.y >= vat.y - 8 && this.player.y <= vat.y + vat.h + 8) {
                    this._burnTick = (this._burnTick || 0) + dt;
                    if (this._burnTick >= 0.25) {
                        this._burnTick = 0;
                        const burnDmg = Math.max(2, Math.floor(3 * (this.state.difficultyConfig?.enemyDmgMult || 1)));
                        this.player.hp = Math.max(1, this.player.hp - burnDmg);
                        this.damageVignetteTimer = 0.25;
                        if (this.combat && typeof this.combat.emitFloatingText === 'function') {
                            this.combat.emitFloatingText(this.player.x, this.player.y - 20, `-${burnDmg} Escória`, false, '#ff5722');
                        }
                        for (let i = 0; i < 3; i++) {
                            this.particles.push({
                                x: this.player.x + Utils.randFloat(-10, 10),
                                y: this.player.y + Utils.randFloat(-10, 10),
                                vx: Utils.randFloat(-20, 20),
                                vy: Utils.randFloat(-40, -10),
                                lifetime: 0.5, maxLife: 0.5,
                                size: Utils.randFloat(3, 7),
                                color: '#ff7043',
                                type: 'circle'
                            });
                        }
                    }
                }
            }
        }

        // Update active alchemy buffs and potion cooldowns
        if (window.alchemyManager) {
            window.alchemyManager.update(dt);
        }
    }

    // ─── Player Update ───
    _updatePlayer(dt) {
        const char = this.state.character;
        const p = this.player;
        const speed = char.moveSpeed || 150;

        // Update skill tree cooldowns
        if (char.skillTree) {
            char.skillTree.update(dt);
        }

        // Movement input
        let moveX = 0, moveY = 0;
        const sm = window.SettingsManager;
        if (sm ? sm.isActionActive('moveUp', this.keys) : (this.keys['w'] || this.keys['arrowup'])) moveY -= 1;
        if (sm ? sm.isActionActive('moveDown', this.keys) : (this.keys['s'] || this.keys['arrowdown'])) moveY += 1;
        if (sm ? sm.isActionActive('moveLeft', this.keys) : (this.keys['a'] || this.keys['arrowleft'])) moveX -= 1;
        if (sm ? sm.isActionActive('moveRight', this.keys) : (this.keys['d'] || this.keys['arrowright'])) moveX += 1;

        const isMoving = (moveX !== 0 || moveY !== 0);
        if (isMoving && moveX !== 0 && moveY !== 0) {
            const inv = 1 / Math.SQRT2;
            moveX *= inv;
            moveY *= inv;
        }

        // Update CombatController state machine and systems
        this.combat.update(dt, {
            moving: isMoving,
            keys: this.keys,
            mousePos: this.mousePos,
            mouseDown: this.mouseDown,
        });

        // Facing / Aiming direction (Mirar no Mouse vs Mirar na Movimentação)
        const aimMode = (sm ? sm.get('gameplay.attackAim', 'mouse') : 'mouse');
        if (aimMode === 'movement' && isMoving) {
            p.facing.x = moveX;
            p.facing.y = moveY;
        } else {
            const toMouseX = this.mousePos.x - p.x;
            const toMouseY = this.mousePos.y - p.y;
            const mouseDist = Math.hypot(toMouseX, toMouseY);
            if (mouseDist > 5) {
                p.facing.x = toMouseX / mouseDist;
                p.facing.y = toMouseY / mouseDist;
            }
        }

        // Dash / Tactical Dodge ([Shift] or [Space] when moving or custom key)
        if (p.dashCooldown > 0) p.dashCooldown -= dt;

        const wantsDodge = sm ? sm.isActionActive('dodge', this.keys) : (this.keys['shift'] || (this.keys[' '] && isMoving));
        if (wantsDodge && !p.isDashing && p.dashCooldown <= 0) {
            p.isDashing = true;
            p.dashTimer = 0.20; // 200ms dash
            p.dashCooldown = 0.8;
            p.iFrames = 0.20; // 200ms absolute i-frames
            p.dashDirX = moveX || p.facing.x;
            p.dashDirY = moveY || p.facing.y;
            const len = Math.hypot(p.dashDirX, p.dashDirY) || 1;
            p.dashDirX /= len;
            p.dashDirY /= len;

            if (window.AudioManager) {
                window.AudioManager.playDash();
            }

            // Spawn dodge ghost/dust particles
            for (let i = 0; i < 4; i++) {
                this.particles.push({
                    x: p.x + Utils.randFloat(-10, 10),
                    y: p.y + Utils.randFloat(-10, 10),
                    lifetime: 0.3, maxLife: 0.3,
                    size: Utils.randFloat(8, 14),
                    color: 'rgba(217, 119, 6, 0.4)',
                    type: 'circle',
                });
            }
        }

        if (p.isDashing) {
            p.dashTimer -= dt;
            // 150px displacement over 200ms = 750 px/s
            p.x += p.dashDirX * 750 * dt;
            p.y += p.dashDirY * 750 * dt;
            if (p.dashTimer <= 0) {
                p.isDashing = false;
            }
        } else if (isMoving) {
            p.vx = moveX;
            p.vy = moveY;
            p.x += p.vx * speed * dt;
            p.y += p.vy * speed * dt;
        } else {
            p.vx = 0;
            p.vy = 0;
        }

        // Clamp to room bounds
        p.x = Utils.clamp(p.x, p.w / 2, this.roomW - p.w / 2);
        p.y = Utils.clamp(p.y, p.h / 2, this.roomH - p.h / 2);

        // iFrames decay
        if (p.iFrames > 0) p.iFrames -= dt;

        // Attack cooldown decay
        if (p.attackCooldown > 0) p.attackCooldown -= dt;

        // HP Regeneration
        if (char.hpRegen > 0 && char.hp < char.maxHp) {
            char.hp = Math.min(char.maxHp, char.hp + char.hpRegen * dt);
        }

        // Primary Attack (LMB or Space when stationary)
        const wantsAttack = (this.mouseDown || (this.keys[' '] && !isMoving));
        if (wantsAttack && p.attackCooldown <= 0 && !p.isDashing) {
            const usedSkill = this.combat.useSkillByTier(1, this.mousePos);
            if (!usedSkill) {
                this._playerAttack();
            }
            p.attackCooldown = 1 / (char.attackSpeed || 1.2);
        }
    }

    _playerAttack() {
        const char = this.state.character;
        const p = this.player;

        // Spend slight resource if available
        if (char.resource && char.resource >= 2) {
            char.resource -= 2;
            this.state.emit('character:changed', char);
        }

        const projSpeed = (char.classId === ClassType.MAGE || char.classId === ClassType.NECROMANCER)
            ? 420 : 0; // Ranged vs melee

        if (projSpeed > 0) {
            // Ranged projectile
            const color = char.classId === ClassType.MAGE ? '#f97316' : '#a855f7';
            this.projectiles.push({
                x: p.x, y: p.y,
                vx: p.facing.x * projSpeed,
                vy: p.facing.y * projSpeed,
                w: 10, h: 10,
                damage: char.baseDamage || 12,
                lifetime: 1.2,
                isPlayer: true,
                color,
            });
        } else {
            // Melee Arc Hitbox in front of hero
            const arcRange = 55;
            const ax = p.x + p.facing.x * (arcRange * 0.7);
            const ay = p.y + p.facing.y * (arcRange * 0.7);

            // Add Hitbox to CombatController
            const baseCalc = this.combat.calculateDamage(char, { armor: 0 }, 1.0);
            const hitbox = new Hitbox({
                x: ax,
                y: ay,
                radius: 36,
                damage: baseCalc.damage,
                isCrit: baseCalc.isCrit,
                knockbackForce: 130,
                dirX: p.facing.x,
                dirY: p.facing.y,
                duration: 0.18,
                isPlayer: true,
                color: '#fbbf24',
                renderShape: 'arc',
            });
            this.combat.addHitbox(hitbox);

            // Melee slash visual particle (triggers additive VFX from combat_vfx.jpg)
            this.particles.push({
                x: ax, y: ay,
                lifetime: 0.22,
                maxLife: 0.22,
                size: 60,
                color: '#fbbf24',
                type: 'slash',
                vfxType: baseCalc.isCrit ? 'fire' : 'slash',
                facing: { ...p.facing },
            });
        }
    }

    _damageEnemy(enemy, rawDamage) {
        const char = this.state.character;

        // Dano Real = max(1, Dano Atacante * (1 - Armadura / (Armadura + 100)))
        const isCrit = (Math.random() * 100) < (char.critChance || 5);
        const critMult = (char.critDamage || 150) / 100;
        let attackerDmg = rawDamage * (isCrit ? critMult : 1.0);

        const armor = enemy.armor || 0;
        const reduction = armor / (armor + 100);
        const damage = Math.max(1, Math.floor(attackerDmg * (1 - reduction)));

        enemy.hp -= damage;

        // 1. Hit Flash: 80ms white flash (ctx.filter = "brightness(2.5)")
        enemy.hitFlashTimer = 0.080;
        this.combat.applyHitFlash(enemy, 0.080);

        // 2. Hitstop / Frame Freeze: 60ms freeze of affected entities
        this.triggerHitstop(0.060);

        // 3. Screen Shake: 4 to 6px on crits or heavy hits for 120ms with smooth damping
        if (isCrit || enemy.isBoss) {
            this.triggerScreenShake(Utils.randFloat(4.5, 6.0), 0.120);
        }

        // 4. Knockback & Hit Stun
        this.combat.applyKnockback(enemy, this.player.facing.x, this.player.facing.y, 130);
        enemy.hitStun = 0.14;
        if (enemy.state && enemy.state !== EnemyState.DEAD && !enemy.isBoss) {
            enemy.state = EnemyState.HURT;
        }

        // 5. Additive Combat VFX (Arcs of blood, fire explosion, void bursts)
        this.particles.push({
            x: enemy.x,
            y: enemy.y - 10,
            lifetime: 0.22,
            maxLife: 0.22,
            size: isCrit ? 85 : 65,
            angle: Math.atan2(this.player.facing.y, this.player.facing.x),
            vfxType: isCrit ? 'fire' : 'slash',
            type: 'vfx',
        });

        // 6. Ballistic Floating Damage Numbers (Rise with decelerating upward velocity & alpha fade)
        this.particles.push({
            x: enemy.x + Utils.randFloat(-8, 8),
            y: enemy.y - 20,
            vx: Utils.randFloat(-15, 15),
            vy: isCrit ? -110 : -85,
            lifetime: 0.85,
            maxLife: 0.85,
            text: isCrit ? `${damage}!` : `${damage}`,
            color: isCrit ? '#facc15' : '#ffffff',
            type: 'text',
        });

        // Rubric Notable: Poison on Critical Hits
        if (isCrit && char.rubricPoisonCrit) {
            const poisonDmg = Math.max(1, Math.floor(damage * 0.35));
            enemy.hp -= poisonDmg;
            this.particles.push({
                x: enemy.x, y: enemy.y - 15,
                lifetime: 0.7,
                maxLife: 0.7,
                text: `VENENO -${poisonDmg}`,
                color: '#10b981',
                type: 'text',
                vy: -35,
            });
        }

        // Life steal
        if (char.lifeSteal > 0) {
            const heal = Math.floor(damage * char.lifeSteal / 100);
            char.hp = Math.min(char.maxHp, char.hp + heal);
        }

        // Kill check
        if (enemy.hp <= 0) {
            if (enemy.isBoss && !enemy.isDying) {
                enemy.hp = 0;
                enemy.isDying = true;
                enemy.deathTimer = 2.2;
                enemy.deathDuration = 2.2;
                enemy.speed = 0;
                enemy.vx = 0;
                enemy.vy = 0;
                enemy.state = EnemyState.DEAD;
                this.triggerScreenShake(9, 0.45);
                this.triggerHitstop(0.080);
                this.combat.emitFloatingText(enemy.x, enemy.y - 45, 'O SINO SILENCIA...', true, '#facc15');
                if (window.AudioManager) window.AudioManager.playClash(true);
                return;
            }
            this._onEnemyDeath(enemy);
        }
    }

    _finishBossDeath(enemy) {
        if (!enemy) return;
        this._onEnemyDeath(enemy);
    }

    _onEnemyDeath(enemy) {
        const idx = this.enemies.indexOf(enemy);
        if (idx !== -1) this.enemies.splice(idx, 1);
        enemy.state = EnemyState.DEAD;

        // Spawn corpse for Necromancer mechanics
        this.corpses.push({
            id: Utils.uid(),
            x: enemy.x,
            y: enemy.y,
            icon: 'ᛣ',
            lifetime: 60,
        });

        // Spawn persistent blood splatters on floor (Roguelike combat persistence)
        this.bloodDecals.push({
            x: enemy.x,
            y: enemy.y,
            radius: Utils.randFloat(18, 32),
            color: Math.random() < 0.35 ? '#3b080d' : '#570d13',
            splats: Array.from({ length: 5 }, () => ({
                dx: Utils.randFloat(-22, 22),
                dy: Utils.randFloat(-22, 22),
                r: Utils.randFloat(2.5, 7.5),
            })),
            alpha: 0.82
        });
        if (this.bloodDecals.length > 50) this.bloodDecals.shift();

        // XP Reward: 120+40*floor for Boss, 8+2*floor for normal
        const xp = enemy.xpValue || (enemy.isBoss ? 120 + this.floor * 40 : 8 + this.floor * 2);
        const leveled = this.state.character.addXP(xp, 'combat');
        if (leveled) {
            this.state.emit('character:levelup', {
                level: this.state.character.level,
                source: 'combat',
            });
            if (window.uiManager) {
                window.uiManager.notify(`Ascensão Alcançada! Nível ${this.state.character.level}! (+1 Habilidade, +3 Atributos)`, 'levelup');
            }
        }

        // Loot scaled by difficulty
        const diff = this.state.difficultyConfig;
        const loot = enemy.isBoss
            ? LootTable.rollBossLoot(this.floor, diff)
            : LootTable.rollEnemyLoot(this.floor, diff);

        for (const item of loot) {
            this.lootDrops.push({
                x: enemy.x + Utils.randFloat(-25, 25),
                y: enemy.y + Utils.randFloat(-25, 25),
                item,
                lifetime: 60,
                collected: false,
                bobPhase: Math.random() * Math.PI * 2,
            });
        }

        if (enemy.isBoss) {
            this.state.totalDungeonClears++;
            this.bossFightActive = false;
            this.fogGateActive = false;

            // Hide Boss Health HUD
            const bossHud = document.getElementById('boss-hud-container');
            if (bossHud) bossHud.classList.add('hidden');

            // Spawn Extraction Monolith at center of arena
            let monoX = 1376;
            let monoY = 220;
            let defeatMsg = 'O Carrasco de Ferro Negro foi derrotado! O Monólito de Extração despertou!';
            this.state.character = this.state.character || {};
            this.state.character.bossesDefeated = this.state.character.bossesDefeated || {};

            if (this.currentMapId === 'DUNGEON_FORGES') {
                monoX = 688;
                monoY = 150;
                defeatMsg = 'O Colosso de Escória ruiu! O Monólito de Extração das Forjas despertou!';
                this.state.character.bossesDefeated.forge_colossus = true;
            } else if (this.currentMapId === 'DUNGEON_VOID') {
                monoX = 1792;
                monoY = 240;
                defeatMsg = 'O Soberano do Vazio foi banido! O Portal Cósmico de Extração despertou!';
                this.state.character.bossesDefeated.void_sovereign = true;
            } else {
                this.state.character.bossesDefeated.ironbound_executioner = true;
            }

            this.extractionMonolith = {
                x: monoX,
                y: monoY,
                radius: 32,
                pulseTimer: 0,
            };

            this.state.emit('dungeon:bossdeath', { floor: this.floor });
            if (window.uiManager) {
                window.uiManager.notify(defeatMsg, 'legendary');
            }
        }

        // Notify systems of enemy death
        this.state.emit('dungeon:enemy_killed', {
            enemy,
            isElite: !!(enemy.isBoss || enemy.isElite),
            isBoss: !!enemy.isBoss,
            floor: this.floor,
        });

        // Death particles
        for (let i = 0; i < (enemy.isBoss ? 24 : 8); i++) {
            this.particles.push({
                x: enemy.x + Utils.randFloat(-15, 15),
                y: enemy.y + Utils.randFloat(-15, 15),
                vx: Utils.randFloat(-60, 60),
                vy: Utils.randFloat(-80, -10),
                lifetime: 0.7,
                maxLife: 0.7,
                size: Utils.randFloat(4, enemy.isBoss ? 12 : 7),
                color: enemy.color || '#dc2626',
                type: 'circle',
            });
        }
    }

    // ─── Enemy AI ───
    _updateEnemies(dt) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.update(dt, this.player, this);
        }
    }

    _damagePlayer(damage) {
        const char = this.state.character;
        const p = this.player;

        if (p.iFrames > 0) return;

        // Dodge Check (from Dexterity or Bloodline/Rubrics)
        const dodgeChance = (char.dodgeChance || 0) / 100;
        if (dodgeChance > 0 && Math.random() < dodgeChance) {
            p.iFrames = 0.35; // Brief invulnerability after successful dodge
            this.particles.push({
                x: p.x, y: p.y - 25,
                lifetime: 0.8,
                maxLife: 0.8,
                text: 'ESQUIVA!',
                color: '#38bdf8',
                type: 'text',
                vy: -40,
            });

            // Riposte Notable: Counter-attack on dodge
            if (char.rubricRiposte) {
                const riposteDmg = Math.floor((char.baseDamage || 12) * 1.5);
                for (const enemy of this.enemies) {
                    if (Utils.distance(p.x, p.y, enemy.x, enemy.y) < 75) {
                        this._damageEnemy(enemy, riposteDmg);
                    }
                }
            }
            return;
        }

        // Armor reduction: Dano Real = max(1, Dano * (1 - Armadura / (Armadura + 100)))
        const reduction = (char.armor || 0) / ((char.armor || 0) + 100);
        const finalDamage = Math.max(1, Math.floor(damage * (1 - reduction)));

        char.hp -= finalDamage;
        p.iFrames = 0.35; // Brief invulnerability after hit

        // Feedback de Dano Cinético:
        // 1. Hit Flash (80ms white flash filter)
        p.hitFlashTimer = 0.080;

        // 2. Hitstop / Frame Freeze (60ms)
        this.triggerHitstop(0.060);

        // 3. Screen Shake (4-6px for 120ms with smooth damping)
        this.triggerScreenShake(5.0, 0.120);
        this.damageVignetteTimer = 0.15;

        this.state.emit('character:changed', char);

        // 4. Ballistic Damage Number (Upward decelerating velocity + alpha fade)
        this.particles.push({
            x: p.x + Utils.randFloat(-6, 6),
            y: p.y - 20,
            vx: Utils.randFloat(-10, 10),
            vy: -85,
            lifetime: 0.8,
            maxLife: 0.8,
            text: `-${finalDamage}`,
            color: '#ef4444',
            type: 'text',
        });

        // Death check
        if (char.hp <= 0) {
            char.hp = 0;
            this.handlePlayerDeath();
        }
    }

    handlePlayerDeath() {
        if (!this.running) return;
        this.isPaused = true;

        const diff = this.state.difficultyConfig || { id: 'pilgrim', deathLossPercent: 0.25 };
        const lossFraction = diff.deathLossPercent ?? 0.25;
        const lostGold = Math.floor((this.runLoot?.gold || 0) * lossFraction);

        const deathData = {
            penaltyDesc: `Penalidade do Juramento: perda de ${Math.round(lossFraction * 100)}% do ouro coletado na masmorra (-${lostGold} ouro).`,
            lostGold,
            lostItemsCount: 0,
        };

        if (window.uiManager && window.uiManager.showFuneralModal) {
            window.uiManager.showFuneralModal(deathData, () => {
                this.exit('death');
                // Restore 100% HP and Mana
                const c = this.state.character;
                if (c) {
                    c.hp = c.maxHp;
                    c.resource = c.maxResource;
                    this.state.emit('character:changed', c);
                }
                if (window.hubEngine) {
                    window.hubEngine.player.x = 688;
                    window.hubEngine.player.y = 384;
                }
                if (window.stateManager) {
                    window.stateManager.save();
                }
            });
        } else {
            this.exit('death');
        }
    }

    triggerExtraction() {
        if (!this.running) return;
        this.isPaused = true;

        let bossDefeatedName = 'O Carrasco de Ferro Negro';
        if (this.currentMapId === 'DUNGEON_FORGES') {
            bossDefeatedName = 'O Colosso de Escória';
        } else if (this.currentMapId === 'DUNGEON_VOID') {
            bossDefeatedName = 'O Soberano do Vazio';
        }

        const spoils = {
            gold: this.runLoot?.gold || 0,
            items: this.runLoot?.items || [],
            bossDefeated: bossDefeatedName,
            floor: this.floor,
        };

        if (window.uiManager && window.uiManager.showVictorySummaryModal) {
            window.uiManager.showVictorySummaryModal(spoils, () => {
                this.exit('victory');
                if (window.hubEngine) {
                    window.hubEngine.player.x = 688;
                    window.hubEngine.player.y = 384;
                }
                if (window.stateManager) {
                    window.stateManager.save();
                }
            });
        } else {
            this.exit('victory');
        }
    }

    _checkBossArena() {
        if (!this.boss || this.boss.hp <= 0) return;

        if (this.currentMapId === 'DUNGEON_FORGES') {
            // Forjas Mortas: North circular furnace arena (y <= 250)
            if (this.player.y <= 250 && !this.bossFightActive) {
                this.bossFightActive = true;
                this.fogGateActive = true;
                if (window.uiManager) {
                    window.uiManager.notify('As comportas de ferro caem sobre os trilhos! A Fornalha desperta!', 'danger');
                }
            }
            if (this.fogGateActive) {
                if (this.player.y >= 248 && this.player.y <= 275 && this.player.x >= 630 && this.player.x <= 745) {
                    this.player.y = 246;
                }
            }
            return;
        }

        if (this.currentMapId === 'DUNGEON_VOID') {
            // Gravitational barrier collision at central junction (y ~ 1100)
            if (this.voidBarrierActive) {
                if (this.player.y <= 1115 && this.player.y >= 1060 && this.player.x >= 1690 && this.player.x <= 1895) {
                    this.player.y = 1120;
                }
            }

            // North Throne Arena (y <= 450)
            if (this.player.y <= 450 && !this.bossFightActive) {
                this.bossFightActive = true;
                this.fogGateActive = true;
                if (window.uiManager) {
                    window.uiManager.notify('O Horizonte de Eventos se fecha! O Soberano do Vazio ergue-se do Trono!', 'danger');
                }
            }
            if (this.fogGateActive) {
                if (this.player.y >= 445 && this.player.y <= 475 && this.player.x >= 1690 && this.player.x <= 1895) {
                    this.player.y = 442;
                }
            }
            return;
        }

        // Dungeon 1: A Fenda Abissal
        // Player entered North Arena (y <= 420)
        if (this.player.y <= 420 && !this.bossFightActive) {
            this.bossFightActive = true;
            this.fogGateActive = true;
            if (window.uiManager) {
                window.uiManager.notify('A Névoa Abissal se ergue! O Carrasco de Ferro Negro bloqueia a saída!', 'danger');
            }
        }

        // Impassable Fog Gate at entrance corridor y = 430
        if (this.fogGateActive) {
            if (this.player.y >= 415 && this.player.y <= 460 && this.player.x >= 1240 && this.player.x <= 1512) {
                this.player.y = 414;
            }
        }
    }

    _updateBossHud() {
        const bossHud = document.getElementById('boss-hud-container');
        if (!bossHud) return;

        if (this.bossFightActive && this.boss && this.boss.hp > 0) {
            bossHud.classList.remove('hidden');
            const fill = document.getElementById('boss-hud-fill') || document.getElementById('boss-health-fill');
            const nameEl = document.getElementById('boss-hud-name');
            const titleEl = document.getElementById('boss-hud-title') || document.getElementById('boss-title');
            const textEl = document.getElementById('boss-hud-text');
            const pct = Utils.clamp((this.boss.hp / this.boss.maxHp) * 100, 0, 100);

            if (fill) fill.style.width = `${pct}%`;
            if (textEl) textEl.textContent = `${Math.round(pct)}%`;
            if (nameEl) {
                nameEl.textContent = this.boss.name || 'O Carrasco de Ferro Negro';
            }
            if (titleEl) {
                titleEl.textContent = this.boss.phase === 2
                    ? `${this.boss.title || 'GUARDIÃO DA FORNALHA'} (FRENESI SANGRENTO)`
                    : (this.boss.title || 'GUARDIÃO DA FORNALHA');
            }
        } else {
            bossHud.classList.add('hidden');
        }
    }

    _updateShockwaves(dt) {
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const sw = this.shockwaves[i];
            sw.radius += sw.speed * dt;

            if (!sw.hitPlayer && this.player.iFrames <= 0) {
                const d = Math.hypot(this.player.x - sw.x, this.player.y - sw.y);
                if (Math.abs(d - sw.radius) < 26) {
                    sw.hitPlayer = true;
                    this._damagePlayer(sw.damage);
                }
            }

            if (sw.radius >= sw.maxRadius) {
                this.shockwaves.splice(i, 1);
            }
        }
    }

    _checkMonolithInteraction() {
        if (!this.extractionMonolith) return;
        this.extractionMonolith.pulseTimer = (this.extractionMonolith.pulseTimer || 0) + 0.016;
        const dist = Math.hypot(this.player.x - this.extractionMonolith.x, this.player.y - this.extractionMonolith.y);
        if (dist < 55) {
            if (this.keys['e']) {
                this.keys['e'] = false;
                this.triggerExtraction();
            }
        }
    }

    // ─── Projectiles ───
    _updateProjectiles(dt) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            proj.x += proj.vx * dt;
            proj.y += proj.vy * dt;
            proj.lifetime -= dt;

            if (proj.lifetime <= 0 || proj.x < 0 || proj.x > this.roomW || proj.y < 0 || proj.y > this.roomH) {
                this.projectiles.splice(i, 1);
                continue;
            }

            // Check collision with enemies (player projectiles)
            if (proj.isPlayer) {
                for (const enemy of this.enemies) {
                    if (Utils.distance(proj.x, proj.y, enemy.x, enemy.y) < 20) {
                        this._damageEnemy(enemy, proj.damage);
                        this.projectiles.splice(i, 1);
                        break;
                    }
                }
            } else {
                // Enemy projectile hitting player
                if (this.player.iFrames <= 0 && Utils.distance(proj.x, proj.y, this.player.x, this.player.y) < 18) {
                    this._damagePlayer(proj.damage);
                    this.projectiles.splice(i, 1);
                }
            }
        }
    }

    // ─── Particles ───
    _updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const part = this.particles[i];
            part.lifetime -= dt;

            // Ballistic velocity deceleration for damage numbers
            if (part.type === 'text') {
                if (part.vy) {
                    part.y += part.vy * dt;
                    part.vy *= Math.pow(0.18, dt); // Decelerates smoothly upward
                }
                if (part.vx) {
                    part.x += part.vx * dt;
                    part.vx *= Math.pow(0.25, dt);
                }
            } else {
                if (part.vx) part.x += part.vx * dt;
                if (part.vy) part.y += part.vy * dt;
            }

            if (part.lifetime <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    // ─── Loot Pickups ───
    _checkLootPickups() {
        const p = this.player;
        for (let i = this.lootDrops.length - 1; i >= 0; i--) {
            const drop = this.lootDrops[i];
            if (drop.collected) continue;

            if (Utils.distance(p.x, p.y, drop.x, drop.y) < 35) {
                drop.collected = true;

                if (!this.runLoot) this.runLoot = { gold: 0, items: [] };

                // Handle gold/materials directly
                if (drop.item.type === ItemType.MATERIAL && (drop.item.icon === '🜚' || drop.item.name.toLowerCase().includes('ouro'))) {
                    this.state.addResource(ResourceType.GOLD, drop.item.quantity);
                    this.runLoot.gold += drop.item.quantity;
                    this.state.emit('loot:picked', { item: drop.item });
                } else if (drop.item.type === ItemType.MATERIAL && (drop.item.icon === 'ᛟ' || drop.item.name.includes('Núcleo') || drop.item.name.includes('Material'))) {
                    this.state.addResource(ResourceType.TITAN_CORE, drop.item.quantity);
                    this.state.emit('loot:picked', { item: drop.item });
                } else if (drop.item.type !== ItemType.MATERIAL) {
                    // Equipment → inventory
                    const added = this.state.character.addItem(drop.item);
                    if (added) {
                        this.runLoot.items.push(drop.item);
                        this.state.emit('loot:picked', { item: drop.item });
                    }
                }

                this.lootDrops.splice(i, 1);
            }
        }
    }

    // ═══════════════════════════════════════════
    //  RENDERING
    // ═══════════════════════════════════════════

    _render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Pipeline de Limpeza Absoluto anti-smearing (Reset de projeção + Fundo absoluto #080708)
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#080708';
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        let shakeX = 0, shakeY = 0;
        if (this.screenShakeTimer > 0) {
            const shakeMult = (window.SettingsManager ? window.SettingsManager.get('visual.screenShakeIntensity', 1.0) : 1.0);
            const damp = Math.max(0, this.screenShakeTimer / (this.screenShakeMaxDuration || 0.12));
            shakeX = (Math.random() - 0.5) * this.screenShakeIntensity * shakeMult * damp * 2;
            shakeY = (Math.random() - 0.5) * this.screenShakeIntensity * shakeMult * damp * 2;
        }

        // Roguelike Cinematic World Transform (Screen Center -> Dynamic Zoom -> Camera World Coordinates)
        ctx.translate(w / 2 + shakeX, h / 2 + shakeY);
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-this.camera.x, -this.camera.y);

        // Background (2D Graphical Dungeon Map & Blood Decals)
        this._drawBackground(ctx);

        // Dungeon Braziers & Torches
        this._drawBraziers(ctx);

        // Dynamic Map Features: Slag Vats, Falling Portcullis, Void Obelisks & Gravitational Barrier
        this._drawMapSpecificFeatures(ctx);

        // Interactive Chests
        for (const chest of this.chests) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(chest.x, chest.y, 16, 0, Math.PI * 2);
            ctx.fillStyle = chest.opened ? '#1a181b' : '#2b2317';
            ctx.fill();
            ctx.strokeStyle = chest.opened ? '#4a3f35' : '#c5a059';
            ctx.lineWidth = 1.5;
            if (!chest.opened) {
                ctx.shadowColor = 'rgba(197, 160, 89, 0.7)';
                ctx.shadowBlur = 8;
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.font = '14px "Cinzel", serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = chest.opened ? '#665d50' : '#e8d8b0';
            ctx.fillText(chest.opened ? '☩' : '⛊', chest.x, chest.y);
            ctx.restore();
        }

        // Loot drops
        for (const drop of this.lootDrops) {
            if (drop.collected) continue;
            const bob = Math.sin(performance.now() / 300 + drop.bobPhase) * 3;
            const rarityColor = RARITY_META[drop.item.rarity]?.color || '#c5a059';

            // Rarity aura
            ctx.beginPath();
            ctx.arc(drop.x, drop.y + bob, 14, 0, Math.PI * 2);
            ctx.fillStyle = rarityColor + '22';
            ctx.fill();
            ctx.strokeStyle = rarityColor + '66';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Runemark glyph
            ctx.font = '15px "Cinzel", serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = rarityColor;
            ctx.fillText(drop.item.icon, drop.x, drop.y + bob);
        }

        // Corpses on floor
        for (const corpse of this.corpses) {
            ctx.font = '14px "Cinzel", serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#5a5048';
            ctx.fillText(corpse.icon || 'ᛣ', corpse.x, corpse.y);
        }

        // Ground Effects (Consecration, Poison Clouds, Fire residual)
        for (const eff of this.combat.groundEffects) {
            ctx.beginPath();
            ctx.arc(eff.x, eff.y, eff.radius, 0, Math.PI * 2);
            ctx.fillStyle = eff.color || 'rgba(197, 160, 89, 0.2)';
            ctx.fill();
            ctx.strokeStyle = '#c5a059';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        // Minions
        for (const minion of this.combat.minions) {
            ctx.beginPath();
            ctx.arc(minion.x, minion.y, 16, 0, Math.PI * 2);
            ctx.fillStyle = '#181619';
            ctx.fill();
            ctx.strokeStyle = '#8b1e1e';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.font = '14px "Cinzel", serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#c5a059';
            ctx.fillText(minion.icon || 'ᛡ', minion.x, minion.y);
        }

        // Enemy Attack Telegraphs on Ground
        for (const enemy of this.enemies) {
            if (enemy.slamTelegraph) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(enemy.slamTelegraph.x, enemy.slamTelegraph.y, enemy.slamTelegraph.radius, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
                ctx.fill();
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 6]);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();
            }
            if (enemy.cleaveTelegraph) {
                ctx.save();
                ctx.translate(enemy.cleaveTelegraph.x, enemy.cleaveTelegraph.y);
                const ang = Math.atan2(enemy.cleaveTelegraph.dirY, enemy.cleaveTelegraph.dirX);
                ctx.rotate(ang);
                ctx.fillStyle = 'rgba(220, 38, 38, 0.3)';
                ctx.fillRect(0, -enemy.cleaveTelegraph.width / 2, enemy.cleaveTelegraph.length, enemy.cleaveTelegraph.width);
                ctx.strokeStyle = '#dc2626';
                ctx.lineWidth = 2;
                ctx.strokeRect(0, -enemy.cleaveTelegraph.width / 2, enemy.cleaveTelegraph.length, enemy.cleaveTelegraph.width);
                ctx.restore();
            }
        }

        // Boss Phase 2 Expanding Crimson Shockwaves
        for (const sw of this.shockwaves) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
            const alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);
            ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.9})`;
            ctx.lineWidth = 4;
            ctx.shadowColor = 'rgba(239, 68, 68, 0.8)';
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        // Impassable Fog Gate at Entrance to North Boss Chamber
        if (this.fogGateActive) {
            ctx.save();
            const fogGrad = ctx.createLinearGradient(1240, 410, 1240, 450);
            fogGrad.addColorStop(0, 'rgba(30, 10, 25, 0)');
            fogGrad.addColorStop(0.5, 'rgba(90, 15, 45, 0.85)');
            fogGrad.addColorStop(1, 'rgba(30, 10, 25, 0)');
            ctx.fillStyle = fogGrad;
            ctx.fillRect(1240, 410, 272, 40);

            const time = performance.now() / 350;
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            for (let fx = 1240; fx <= 1512; fx += 10) {
                const fy = 430 + Math.sin(time + fx * 0.04) * 6;
                if (fx === 1240) ctx.moveTo(fx, fy);
                else ctx.lineTo(fx, fy);
            }
            ctx.stroke();

            ctx.font = 'bold 11px "Cinzel", serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#fca5a5';
            ctx.fillText('⚡ NÉVOA ABISSAL ⚡', 1376, 434);
            ctx.restore();
        }

        // Monólito de Extração (Spawns at North Arena center upon boss defeat)
        if (this.extractionMonolith) {
            const mono = this.extractionMonolith;
            ctx.save();
            const monoPulse = Math.sin(performance.now() / 400) * 0.15 + 0.85;

            // Consecrated gold ground seal
            ctx.beginPath();
            ctx.arc(mono.x, mono.y, 48 * monoPulse, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(234, 179, 8, 0.18)';
            ctx.fill();
            ctx.strokeStyle = '#eab308';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Obsidian Monolith Pillar
            ctx.fillStyle = '#0f0e13';
            ctx.fillRect(mono.x - 16, mono.y - 36, 32, 54);
            ctx.strokeStyle = '#ca8a04';
            ctx.lineWidth = 2;
            ctx.shadowColor = 'rgba(234, 179, 8, 0.7)';
            ctx.shadowBlur = 12;
            ctx.strokeRect(mono.x - 16, mono.y - 36, 32, 54);
            ctx.shadowBlur = 0;

            // Celestial Glyphs
            ctx.font = 'bold 20px "Cinzel", serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fde047';
            ctx.fillText('☩', mono.x, mono.y - 10);

            // Interaction Prompt
            ctx.font = 'bold 12px "Cinzel", serif';
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur = 4;
            ctx.fillText('MONÓLITO DE EXTRAÇÃO', mono.x, mono.y - 48);
            ctx.fillStyle = '#facc15';
            ctx.font = '11px "Cinzel", serif';
            ctx.fillText('[E] ou Clique para Extrair', mono.x, mono.y - 34);
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        // Y-Sorted World Entity Pass (Player & Enemies in Top-Down 15°-20°)
        const entities = [
            { y: this.player.y, draw: () => this._drawPlayer(ctx) },
            ...this.enemies.map(e => ({ y: e.y, draw: () => this._drawEnemy(ctx, e) }))
        ];
        entities.sort((a, b) => a.y - b.y);
        for (const ent of entities) {
            ent.draw();
        }

        // Projectiles
        for (const proj of this.projectiles) {
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, proj.w / 2, 0, Math.PI * 2);
            ctx.fillStyle = proj.color;
            ctx.fill();
            // Glow
            ctx.shadowColor = proj.color;
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Particles & Additive Visual Effects (combat_vfx.jpg)
        for (const part of this.particles) {
            const alpha = Utils.clamp(part.lifetime / part.maxLife, 0, 1);

            if (part.type === 'vfx') {
                if (typeof EntityRenderer !== 'undefined' && EntityRenderer.drawCombatVFX) {
                    EntityRenderer.drawCombatVFX(ctx, {
                        x: part.x,
                        y: part.y,
                        size: part.size || 60,
                        angle: part.angle || 0,
                        vfxType: part.vfxType || 'slash',
                        progress: 1 - alpha,
                    });
                }
            } else if (part.type === 'text') {
                if (!window.SettingsManager || window.SettingsManager.get('gameplay.showDamageNumbers') !== false) {
                    ctx.save();
                    ctx.globalAlpha = alpha;
                    ctx.font = `bold 14px 'Cinzel', serif`;
                    ctx.shadowColor = 'rgba(0,0,0,0.85)';
                    ctx.shadowBlur = 5;
                    ctx.fillStyle = part.color || '#ffffff';
                    ctx.textAlign = 'center';
                    ctx.fillText(part.text, part.x, part.y);
                    ctx.restore();
                }
            } else if (part.type === 'circle') {
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.arc(part.x, part.y, part.size * alpha, 0, Math.PI * 2);
                ctx.fillStyle = part.color;
                ctx.fill();
                ctx.globalAlpha = 1;
            } else if (part.type === 'slash') {
                if (typeof EntityRenderer !== 'undefined' && EntityRenderer.drawCombatVFX) {
                    EntityRenderer.drawCombatVFX(ctx, {
                        x: part.x,
                        y: part.y,
                        size: part.size || 55,
                        angle: part.facing ? Math.atan2(part.facing.y, part.facing.x) : (part.angle || 0),
                        vfxType: part.vfxType || 'slash',
                        progress: 1 - alpha,
                    });
                } else {
                    ctx.globalAlpha = alpha * 0.6;
                    ctx.beginPath();
                    ctx.arc(part.x, part.y, part.size * (1 - alpha * 0.5), 0, Math.PI * 2);
                    ctx.strokeStyle = part.color;
                    ctx.lineWidth = 2.5;
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }
            }
        }

        // Ambient Ash Embers & Dungeon Motes
        this._drawAmbientMotes(ctx);

        // Combat & Entity Debug Visualization in World Space (F1)
        if (window.ASHEN_COMBAT_DEBUG) {
            this._drawCombatDebugWorld(ctx);
        }

        ctx.restore();

        // Roguelike Dynamic Lighting & Darkness Shroud Pass (Screen-Space)
        this._drawLighting(ctx, w, h, shakeX, shakeY);

        // Screen HUD
        this._drawHUD(ctx, w, h);

        // Combat & Entity Telemetry in Screen Space (F1)
        if (window.ASHEN_COMBAT_DEBUG) {
            this._drawCombatDebugScreen(ctx, w, h);
        }

        // Ashen Asset Debug Pipeline Overlay in Screen Space (F3)
        if (window.ASHEN_ASSET_DEBUG && typeof AssetManager !== 'undefined' && typeof AssetManager.drawDebugOverlay === 'function') {
            AssetManager.drawDebugOverlay(ctx, w, h);
        }
    }

    _drawBackground(ctx) {
        if (this.mapImage && this.mapImage.complete && this.mapImage.naturalWidth > 0) {
            ctx.drawImage(this.mapImage, 0, 0, this.roomW, this.roomH);
        } else {
            // Dark stone floor with grid fallback
            ctx.fillStyle = '#111014';
            ctx.fillRect(0, 0, this.roomW, this.roomH);

            ctx.strokeStyle = 'rgba(255,255,255,0.03)';
            ctx.lineWidth = 1;
            const gridSize = 40;
            for (let x = 0; x <= this.roomW; x += gridSize) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.roomH); ctx.stroke();
            }
            for (let y = 0; y <= this.roomH; y += gridSize) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.roomW, y); ctx.stroke();
            }
        }

        // Room border
        ctx.strokeStyle = '#2a2227';
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, this.roomW - 6, this.roomH - 6);

        // Persistent Roguelike Floor Decals & Blood Splatters
        for (let i = 0; i < this.bloodDecals.length; i++) {
            const decal = this.bloodDecals[i];
            ctx.save();
            ctx.globalAlpha = decal.alpha;
            ctx.fillStyle = decal.color;

            // Main blood pool
            ctx.beginPath();
            ctx.ellipse(decal.x, decal.y, decal.radius, decal.radius * 0.65, 0, 0, Math.PI * 2);
            ctx.fill();

            // Scattered droplets
            for (let j = 0; j < decal.splats.length; j++) {
                const sp = decal.splats[j];
                ctx.beginPath();
                ctx.arc(decal.x + sp.dx, decal.y + sp.dy, sp.r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    _drawPlayer(ctx) {
        const p = this.player;
        const char = this.state.character;

        // 2D Official Sprite Pipeline with Spatial Anchoring (Feet Pivot + Projected Shadow)
        // NOTE: EntityRenderer.drawPlayer handles i-frame blinking internally.
        // Do NOT duplicate the i-frames check here or the aim reticle will ghost on invisible frames.
        if (typeof EntityRenderer !== 'undefined' && EntityRenderer.drawPlayer) {
            EntityRenderer.drawPlayer(ctx, p, char, 0.016);
        } else if (typeof PaperdollSystem !== 'undefined' && PaperdollSystem.drawCharacter) {
            // Fallback: check i-frames for procedural renderers
            if (p.iFrames > 0 && Math.floor(p.iFrames * 25) % 2 === 0) return;
            PaperdollSystem.drawCharacter(ctx, p, char, 0.016);
        } else {
            // Fallback Circle Rig
            const now = performance.now();
            const sealAngle = (now / 2000) % (Math.PI * 2);
            const sealRadius = 24;

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(sealAngle);
            ctx.beginPath();
            ctx.arc(0, 0, sealRadius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(197, 160, 89, 0.35)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.w / 2, 0, Math.PI * 2);
            ctx.fillStyle = '#181619';
            ctx.fill();
            ctx.strokeStyle = '#c5a059';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.font = 'bold 15px "Cinzel", serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#e8d8b0';
            ctx.fillText(char?.classIcon || 'ᛏ', p.x, p.y);
        }

        // Minimalist aim reticle arrow pointing to mouse vector
        const fx = p.facing?.x || 1;
        const fy = p.facing?.y || 0;
        const aimAngle = Math.atan2(fy, fx);
        const aimDist = 34;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(aimAngle);

        ctx.beginPath();
        ctx.moveTo(aimDist + 8, 0); // Tip
        ctx.lineTo(aimDist, -5);   // Left wing
        ctx.lineTo(aimDist + 2, 0); // Inner notch
        ctx.lineTo(aimDist, 5);    // Right wing
        ctx.closePath();

        ctx.fillStyle = '#c5a059';
        ctx.shadowColor = 'rgba(197, 160, 89, 0.8)';
        ctx.shadowBlur = 5;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.restore();
    }

    _drawEnemy(ctx, enemy) {
        // 2D Official Sprite Pipeline (Void Skitterer, Ashen Monk, Flayed Brute, Ironbound Executioner)
        if (typeof EntityRenderer !== 'undefined' && EntityRenderer.drawEnemy) {
            EntityRenderer.drawEnemy(ctx, enemy, 0.016);
            return;
        }

        // Data-Driven Enemy Visual Renderer (4 Families, 5 Tiers, 3 Bosses)
        if (typeof EnemyVisualRenderer !== 'undefined' && EnemyVisualRenderer.drawEnemy) {
            EnemyVisualRenderer.drawEnemy(ctx, enemy, 0.016);
            return;
        }

        // Fallback Octagonal Enemy Rig
        const isBoss = enemy.isBoss;
        const isElite = enemy.isElite;
        let borderGlow = '#8e8c89';
        let glyphColor = '#dcd8d0';

        if (isBoss) {
            borderGlow = '#cf3a3a';
            glyphColor = '#ff6b6b';
        } else if (isElite) {
            borderGlow = '#c5a059';
            glyphColor = '#f5dfa8';
        }

        const r = (isBoss ? 26 : (isElite ? 15 : 12));
        ctx.save();
        ctx.beginPath();
        const points = 8;
        const angleStep = (Math.PI * 2) / points;
        for (let i = 0; i < points; i++) {
            const angle = i * angleStep;
            const rad = (!isBoss && !isElite && (i % 2 !== 0)) ? r * 0.72 : r;
            const px = enemy.x + Math.cos(angle) * rad;
            const py = enemy.y + Math.sin(angle) * rad;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();

        if (enemy.hitFlash || enemy.hitFlashTimer > 0) {
            ctx.fillStyle = '#ffffff';
        } else {
            ctx.fillStyle = '#141215';
        }
        ctx.fill();

        ctx.strokeStyle = borderGlow;
        ctx.lineWidth = isBoss ? 2.5 : 1.5;
        ctx.stroke();

        ctx.font = (isBoss ? 'bold 22px' : 'bold 12px') + ' "Cinzel", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = glyphColor;
        ctx.fillText(enemy.icon || 'ᚦ', enemy.x, enemy.y);
        ctx.restore();

        const barW = isBoss ? 64 : 26;
        const barH = 4;
        const barX = enemy.x - barW / 2;
        const barY = enemy.y - r - 9;
        const hpPct = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));

        ctx.fillStyle = '#121113';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = '#8b1e1e';
        ctx.fillRect(barX, barY, barW * hpPct, barH);
        ctx.strokeStyle = '#2a2220';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);
    }

    _drawHUD(ctx, w, h) {
        const char = this.state.character;
        if (!char) return;

        // 1. Damage Feedback: Crimson Vignette on Screen Borders (rgba(139, 30, 30, 0.35) for 150ms)
        if (this.damageVignetteTimer > 0 && (!window.SettingsManager || window.SettingsManager.get('visual.hitFlashEnabled') !== false)) {
            ctx.save();
            const grad = ctx.createRadialGradient(
                w / 2, h / 2, Math.min(w, h) * 0.32,
                w / 2, h / 2, Math.max(w, h) * 0.72
            );
            grad.addColorStop(0, 'rgba(139, 30, 30, 0)');
            grad.addColorStop(1, 'rgba(139, 30, 30, 0.35)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            ctx.strokeStyle = 'rgba(139, 30, 30, 0.55)';
            ctx.lineWidth = 14;
            ctx.strokeRect(0, 0, w, h);
            ctx.restore();
        }

        // Roguelike Critical Health Heartbeat Pulse (HP < 30%)
        const hpFraction = char.hp / char.maxHp;
        if (hpFraction < 0.30 && char.hp > 0) {
            const beatFreq = 1.0 - (hpFraction / 0.30) * 0.4;
            const pulse = Math.pow(Math.max(0, Math.sin(performance.now() / 320 * beatFreq)), 3);
            const intensity = (0.28 + pulse * 0.45) * (1 - hpFraction / 0.30);
            ctx.save();
            const grad = ctx.createRadialGradient(
                w / 2, h / 2, Math.min(w, h) * 0.28,
                w / 2, h / 2, Math.max(w, h) * 0.72
            );
            grad.addColorStop(0, 'rgba(120, 15, 20, 0)');
            grad.addColorStop(0.65, `rgba(139, 20, 25, ${intensity * 0.35})`);
            grad.addColorStop(1, `rgba(90, 8, 12, ${intensity * 0.85})`);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
        }

        ctx.save();

        // 2. Barra de Vida (Canto Inferior Esquerdo)
        // Barra espessa com fundo escuro e preenchimento carmesim (#8b1e1e),
        // exibindo Vida: ${Math.ceil(player.hp)} / ${player.maxHp}
        const barMargin = 22;
        const hpBarW = 270;
        const hpBarH = 22;
        const hpBarX = barMargin;
        const hpBarY = h - 68;

        const hpPct = Utils.clamp(char.hp / char.maxHp, 0, 1);

        // Stone shadow & background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(hpBarX - 4, hpBarY - 4, hpBarW + 8, hpBarH + 8);

        ctx.fillStyle = '#110f13';
        ctx.fillRect(hpBarX, hpBarY, hpBarW, hpBarH);

        // Carmesim Fill (#8b1e1e)
        ctx.fillStyle = '#8b1e1e';
        ctx.fillRect(hpBarX, hpBarY, hpBarW * hpPct, hpBarH);

        // Subtle gradient highlight on fill
        const hpGrad = ctx.createLinearGradient(hpBarX, hpBarY, hpBarX, hpBarY + hpBarH);
        hpGrad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
        hpGrad.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
        ctx.fillStyle = hpGrad;
        ctx.fillRect(hpBarX, hpBarY, hpBarW * hpPct, hpBarH);

        // Gothic brass beveled border
        ctx.strokeStyle = '#8c6f36';
        ctx.lineWidth = 2;
        ctx.strokeRect(hpBarX, hpBarY, hpBarW, hpBarH);

        // Text: Vida: ${Math.ceil(player.hp)} / ${player.maxHp}
        ctx.font = 'bold 12px "Cinzel", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000000';
        ctx.fillText(`Vida: ${Math.ceil(char.hp)} / ${char.maxHp}`, hpBarX + hpBarW / 2 + 1, hpBarY + hpBarH / 2 + 1);
        ctx.fillStyle = '#f5e8d0';
        ctx.fillText(`Vida: ${Math.ceil(char.hp)} / ${char.maxHp}`, hpBarX + hpBarW / 2, hpBarY + hpBarH / 2);

        // 3. Barra de Recurso (Adjacente: Mana ou Fúria atual)
        const resBarW = 210;
        const resBarH = 15;
        const resBarX = barMargin;
        const resBarY = h - 38;

        const resPct = Utils.clamp(char.resource / char.maxResource, 0, 1);
        let resColor = '#2b6cb0'; // Mana blue
        if (char.resourceType === 'fury') resColor = '#c0392b'; // Fury red
        else if (char.resourceType === 'faith') resColor = '#c5a059'; // Faith gold

        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(resBarX - 3, resBarY - 3, resBarW + 6, resBarH + 6);

        ctx.fillStyle = '#100e12';
        ctx.fillRect(resBarX, resBarY, resBarW, resBarH);

        ctx.fillStyle = resColor;
        ctx.fillRect(resBarX, resBarY, resBarW * resPct, resBarH);

        ctx.strokeStyle = '#61503c';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(resBarX, resBarY, resBarW, resBarH);

        const resLabel = char.resourceLabel || 'Mana';
        ctx.font = '10px "Cinzel", serif';
        ctx.fillStyle = '#000000';
        ctx.fillText(`${resLabel}: ${Math.floor(char.resource)} / ${char.maxResource}`, resBarX + resBarW / 2 + 1, resBarY + resBarH / 2 + 1);
        ctx.fillStyle = '#f0e6d2';
        ctx.fillText(`${resLabel}: ${Math.floor(char.resource)} / ${char.maxResource}`, resBarX + resBarW / 2, resBarY + resBarH / 2);

        // 4. Slots de Atalho: Visualização de recarga das habilidades ([Q] [W] [E] [R]) e frascos ([1] [2])
        const quickslots = [
            { type: 'potion', key: '1', slot: 0, label: 'Frasco 1' },
            { type: 'potion', key: '2', slot: 1, label: 'Frasco 2' },
            { type: 'skill',  key: 'Q', tier: 1 },
            { type: 'skill',  key: 'W', tier: 2 },
            { type: 'skill',  key: 'E', tier: 3 },
            { type: 'skill',  key: 'R', tier: 4 },
        ];

        const slotSize = 42;
        const slotGap = 7;
        const totalW = quickslots.length * slotSize + (quickslots.length - 1) * slotGap + 12;
        const startX = Math.max(hpBarX + hpBarW + 28, Math.floor((w - totalW) / 2));
        const slotY = h - 64;

        let curX = startX;
        for (let i = 0; i < quickslots.length; i++) {
            const slot = quickslots[i];
            if (i === 2) curX += 12; // Extra gap between potions and skills

            // Slot Background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.fillRect(curX - 2, slotY - 2, slotSize + 4, slotSize + 4);

            ctx.fillStyle = '#141216';
            ctx.fillRect(curX, slotY, slotSize, slotSize);

            let icon = '';
            let isReady = true;
            let cdRatio = 0;
            let subtext = '';

            if (slot.type === 'potion') {
                const potionId = (this.state.potionBelt && this.state.potionBelt[slot.slot]) || null;
                const def = (potionId && window.alchemyManager && window.alchemyManager.definitions[potionId]) || null;
                const count = potionId ? (this.state.potions[potionId] || 0) : 0;
                icon = def ? def.icon : '🜄';
                subtext = `${count}`;
                const cd = (window.alchemyManager && window.alchemyManager.cooldowns[potionId]) || 0;
                if (cd > 0 && def && def.cooldown) {
                    cdRatio = cd / def.cooldown;
                    isReady = false;
                }
                if (count <= 0) isReady = false;
            } else if (slot.type === 'skill') {
                const skill = char.skillTree ? char.skillTree.getSkillByTier(slot.tier) : null;
                if (skill) {
                    icon = skill.icon;
                    if (skill.currentCooldown > 0 && skill.cooldown > 0) {
                        cdRatio = skill.currentCooldown / skill.cooldown;
                        isReady = false;
                        subtext = skill.currentCooldown.toFixed(1) + 's';
                    } else if (!skill.unlocked) {
                        isReady = false;
                        subtext = 'Bloq';
                    }
                }
            }

            // Draw Icon
            ctx.font = '16px "Cinzel", serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = isReady ? '#e8d8b0' : '#5a554d';
            ctx.fillText(icon, curX + slotSize / 2, slotY + slotSize / 2);

            // Cooldown overlay sweep
            if (cdRatio > 0) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
                ctx.fillRect(curX, slotY + slotSize * (1 - cdRatio), slotSize, slotSize * cdRatio);
            }

            // Key Badge in Top-Left
            ctx.fillStyle = 'rgba(10, 8, 12, 0.92)';
            ctx.fillRect(curX + 2, slotY + 2, 15, 13);
            ctx.font = 'bold 9px "Cinzel", serif';
            ctx.fillStyle = '#c5a059';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(slot.key, curX + 9, slotY + 8);

            // Subtext in Bottom-Right
            if (subtext) {
                ctx.font = 'bold 9px "Cinzel", serif';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'bottom';
                ctx.fillStyle = isReady ? '#dfcaa2' : '#887d70';
                ctx.fillText(subtext, curX + slotSize - 3, slotY + slotSize - 2);
            }

            // Outer Slot Border
            ctx.strokeStyle = isReady ? '#8c6f36' : '#3d3430';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(curX, slotY, slotSize, slotSize);

            curX += slotSize + slotGap;
        }

        ctx.restore();

        // 5. Roguelike Minimap Radar HUD (Top Right)
        this._drawMinimap(ctx, w, h);
    }

    /**
     * Combat & Entity Debug Visualization in World Space (F1)
     */
    _drawCombatDebugWorld(ctx) {
        ctx.save();

        // 1. Player Hurtbox, Foot Pivot, and Direction Vector
        const p = this.player;
        const char = this.state.character;

        // Player Hurtbox (Cyan)
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y - (p.h || 28) * 0.4, p.radius || 14, 0, Math.PI * 2);
        ctx.stroke();

        // Foot Anchor Pivot (0.85h) Crosshair
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x - 8, p.y); ctx.lineTo(p.x + 8, p.y);
        ctx.moveTo(p.x, p.y - 8); ctx.lineTo(p.x, p.y + 8);
        ctx.stroke();

        // Facing Vector Arrow
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + (p.facing?.x || 1) * 36, p.y + (p.facing?.y || 0) * 36);
        ctx.stroke();

        // Velocity Arrow
        if (p.vx || p.vy) {
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + p.vx * 0.25, p.y + p.vy * 0.25);
            ctx.stroke();
        }

        // Player State Tag
        ctx.font = '10px monospace';
        ctx.fillStyle = '#67e8f9';
        ctx.textAlign = 'center';
        const pState = p.isDashing ? 'DODGE' : (p.attackCooldown > 0 ? 'ATTACK' : ((p.vx || p.vy) ? 'WALK' : 'IDLE'));
        ctx.fillText(`[${pState} | HP:${Math.ceil(char ? char.hp : p.hp)}/${char ? char.maxHp : p.maxHp} | iF:${(p.iFrames || 0).toFixed(2)}]`, p.x, p.y - 54);
        ctx.fillStyle = '#ffffff';
        ctx.font = '9px monospace';
        ctx.fillText(`pivot (${Math.round(p.x)}, ${Math.round(p.y)})`, p.x, p.y + 16);

        // 2. Active Hitboxes (Gold / Red)
        if (this.combat && this.combat.hitboxes) {
            for (const hb of this.combat.hitboxes) {
                ctx.strokeStyle = hb.color || '#ef4444';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(hb.x, hb.y, hb.radius, 0, Math.PI * 2);
                ctx.stroke();

                ctx.font = 'bold 9px monospace';
                ctx.fillStyle = '#fca5a5';
                ctx.textAlign = 'center';
                ctx.fillText(`HITBOX dmg:${hb.damage} life:${hb.lifetime.toFixed(2)}s`, hb.x, hb.y - hb.radius - 4);
            }
        }

        // 3. Enemies Hurtboxes, Pivots, States, and Assets
        for (const e of this.enemies) {
            // Hurtbox (Green for regular, Red for boss)
            ctx.strokeStyle = e.isBoss ? '#ef4444' : '#22c55e';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(e.x, e.y - (e.height || 58) * 0.4, e.radius || 20, 0, Math.PI * 2);
            ctx.stroke();

            // Foot Anchor Pivot
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(e.x - 6, e.y); ctx.lineTo(e.x + 6, e.y);
            ctx.moveTo(e.x, e.y - 6); ctx.lineTo(e.x, e.y + 6);
            ctx.stroke();

            // Heading Vector
            if (e.facing) {
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(e.x, e.y);
                ctx.lineTo(e.x + e.facing.x * 24, e.y + e.facing.y * 24);
                ctx.stroke();
            }

            // State & Target Diagnostics
            ctx.font = '10px monospace';
            ctx.fillStyle = e.isBoss ? '#f87171' : '#86efac';
            ctx.textAlign = 'center';
            const distToP = Math.round(Math.hypot(p.x - e.x, p.y - e.y));
            const eState = e.isDying ? 'DEAD_STAGGER' : (e.isCharging ? 'CHARGING' : e.state);
            ctx.fillText(`[${eState} | dist:${distToP}px | cd:${(e.currentCooldown || 0).toFixed(1)}s]`, e.x, e.y - (e.height || 58) * 0.85 - 14);

            ctx.fillStyle = '#d1d5db';
            ctx.font = '9px monospace';
            ctx.fillText(`asset: ${e.spriteKey} (${e.width}x${e.height})`, e.x, e.y + 14);
        }

        ctx.restore();
    }

    /**
     * Combat & Entity Diagnostics in Screen Space (F1)
     */
    _drawCombatDebugScreen(ctx, w, h) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Screen space reset

        const boxW = 340;
        const boxH = 110;
        ctx.fillStyle = 'rgba(8, 7, 12, 0.90)';
        ctx.fillRect(16, 16, boxW, boxH);
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(16, 16, boxW, boxH);

        ctx.font = 'bold 11px "Cinzel", serif';
        ctx.fillStyle = '#facc15';
        ctx.fillText('⚔ ASHEN COMBAT DEBUG [F1] ⚔', 26, 34);

        ctx.font = '10px monospace';
        ctx.fillStyle = '#e4e4e7';
        ctx.fillText(`FPS: 60 | Zoom: ${this.zoom.toFixed(2)}x (Alvo: ${this.targetZoom.toFixed(2)}x)`, 26, 52);
        ctx.fillText(`Camera: (${Math.round(this.camera.x)}, ${Math.round(this.camera.y)}) | Shake: ${this.screenShakeIntensity.toFixed(1)}`, 26, 68);
        ctx.fillText(`Entidades: ${this.enemies.length + 1} | Hitboxes: ${this.combat.hitboxes.length} | Decalques: ${this.bloodDecals.length}`, 26, 84);
        const bossStatus = this.boss ? (this.boss.isDying ? 'AGONIZANDO' : (this.boss.phase === 2 ? 'FASE 2 (FRENESI)' : 'FASE 1')) : 'NENHUM';
        ctx.fillText(`Chefe: ${bossStatus} | Névoa: ${this.fogGateActive ? 'FECHADA' : 'ABERTA'}`, 26, 100);

        ctx.restore();
    }

    // ═══════════════════════════════════════════
    //  INPUT
    // ═══════════════════════════════════════════

    _bindInput() {
        this._onContextMenu = (e) => { e.preventDefault(); };

        this._onKeyDown = (e) => {
            const k = e.key.toLowerCase();
            this.keys[k] = true;
            this.keys[e.code] = true;

            const sm = window.SettingsManager;
            const keyState = { [e.code]: true, [k]: true };

            // Debug Modes: F1 for Combat/Entity Debug, F3 for Asset Pipeline Debug
            if (e.key === 'F1') {
                e.preventDefault();
                window.ASHEN_COMBAT_DEBUG = !window.ASHEN_COMBAT_DEBUG;
                console.log(`[Combat Debug] ${window.ASHEN_COMBAT_DEBUG ? 'ATIVADO [F1]' : 'DESATIVADO [F1]'}`);
            } else if (e.key === 'F3') {
                e.preventDefault();
                if (typeof window.toggleAssetDebug === 'function') {
                    window.toggleAssetDebug();
                } else {
                    window.ASHEN_ASSET_DEBUG = !window.ASHEN_ASSET_DEBUG;
                }
            }

            // Roguelike Zoom Toggle with [Z]: Switches between Immersive 1.6x and Tactical 1.25x
            if (k === 'z') {
                this.targetZoom = (this.targetZoom > 1.45 ? 1.25 : 1.6);
            }

            // Check Monolith Extraction with [E] or custom interact key
            const wantsInteract = sm ? sm.isActionActive('interact', keyState) : (k === 'e');
            if (wantsInteract && this.extractionMonolith) {
                const pDist = Math.hypot(this.player.x - this.extractionMonolith.x, this.player.y - this.extractionMonolith.y);
                if (pDist < 65) {
                    this.keys['e'] = false;
                    this.triggerExtraction();
                    return;
                }
            }

            // Check Void Obelisks Attunement with [E]
            if (wantsInteract && this.currentMapId === 'DUNGEON_VOID' && this.obelisks) {
                for (const obelisk of this.obelisks) {
                    const dist = Math.hypot(this.player.x - obelisk.x, this.player.y - obelisk.y);
                    if (dist <= obelisk.radius * 1.4 && !obelisk.attuned) {
                        obelisk.attuned = true;
                        this.keys['e'] = false;
                        if (obelisk.id === 'obelisk_west') this.voidObelisks.west = true;
                        if (obelisk.id === 'obelisk_east') this.voidObelisks.east = true;

                        this.triggerScreenShake(8, 0.35);
                        if (this.combat && this.combat.emitFloatingText) {
                            this.combat.emitFloatingText(obelisk.x, obelisk.y - 40, 'OBELISCO SINTONIZADO!', true, '#c084fc');
                        }
                        if (window.AudioManager && window.AudioManager.playClash) {
                            window.AudioManager.playClash(false);
                        }

                        if (this.voidObelisks.west && this.voidObelisks.east) {
                            this.voidBarrierActive = false;
                            this.triggerScreenShake(14, 0.6);
                            if (window.uiManager) {
                                window.uiManager.notify('A Barreira Gravitacional se desfez! O caminho para o Trono do Vazio está aberto!', 'legendary');
                            }
                        } else {
                            if (window.uiManager) {
                                window.uiManager.notify(`${obelisk.name} ressoou! Sintonize o obelisco restante para dissipar a barreira!`, 'warning');
                            }
                        }
                        return;
                    }
                }
            }

            // Potion quickslots
            const wantsPot1 = sm ? sm.isActionActive('potion1', keyState) : (k === '1');
            const wantsPot2 = sm ? sm.isActionActive('potion2', keyState) : (k === '2');
            if (wantsPot1) {
                if (window.alchemyManager && this.state.potionBelt && this.state.potionBelt[0]) {
                    window.alchemyManager.useBeltSlot(0);
                    if (window.AudioManager) window.AudioManager.playPotion();
                }
            } else if (wantsPot2) {
                if (window.alchemyManager && this.state.potionBelt && this.state.potionBelt[1]) {
                    window.alchemyManager.useBeltSlot(1);
                    if (window.AudioManager) window.AudioManager.playPotion();
                }
            }
            // Skill quickslots ([Q] [W] [E] [R] or customized mapping)
            else if (sm ? sm.isActionActive('skill1', keyState) : (k === 'q')) {
                this.combat.useSkillByTier(1, this.mousePos);
            } else if (sm ? sm.isActionActive('skill2', keyState) : (k === 'w')) {
                this.combat.useSkillByTier(2, this.mousePos);
            } else if (sm ? sm.isActionActive('skill3', keyState) : (k === 'e' || k === '3')) {
                this.combat.useSkillByTier(3, this.mousePos);
            } else if (sm ? sm.isActionActive('skill4', keyState) : (k === 'r' || k === '4')) {
                this.combat.useSkillByTier(4, this.mousePos);
            }
            // Primary & Heavy Attack via Keyboard
            else if (sm && sm.isActionActive('attack', keyState)) {
                if (this.player.attackCooldown <= 0) {
                    this._playerAttack();
                    this.player.attackCooldown = 1 / (this.state.character?.attackSpeed || 1.2);
                    if (window.AudioManager) window.AudioManager.playClash(false);
                }
            } else if (sm && sm.isActionActive('heavyAttack', keyState)) {
                this.combat.useSkillByTier(3, this.mousePos);
            }
        };

        this._onKeyUp = (e) => {
            this.keys[e.key.toLowerCase()] = false;
            this.keys[e.code] = false;
        };

        this._onMouseDown = (e) => {
            if (e.button === 0) {
                this.mouseDown = true;

                // Check click on Extraction Monolith
                if (this.extractionMonolith) {
                    const clickDist = Math.hypot(this.mousePos.x - this.extractionMonolith.x, this.mousePos.y - this.extractionMonolith.y);
                    const playerDist = Math.hypot(this.player.x - this.extractionMonolith.x, this.player.y - this.extractionMonolith.y);
                    if (clickDist < 50 && playerDist < 90) {
                        this.triggerExtraction();
                        return;
                    }
                }

                const usedSkill = this.combat.useSkillByTier(1, this.mousePos);
                if (!usedSkill && this.player.attackCooldown <= 0) {
                    this._playerAttack();
                    this.player.attackCooldown = 1 / (this.state.character?.attackSpeed || 1.2);
                }
            } else if (e.button === 2) {
                this.rightMouseDown = true;
                // Right click triggers Tier 3 Core Skill
                this.combat.useSkillByTier(3, this.mousePos);
            }
        };

        this._onMouseUp = (e) => {
            if (e.button === 0) this.mouseDown = false;
            if (e.button === 2) this.rightMouseDown = false;
        };

        this._onMouseMove = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.rawMouseScreen.x = e.clientX - rect.left;
            this.rawMouseScreen.y = e.clientY - rect.top;
            this._updateWorldMouse();
        };

        // Smooth Mouse Wheel Zoom (1.15x - 2.25x)
        this._onWheel = (e) => {
            e.preventDefault();
            const step = 0.15;
            if (e.deltaY < 0) {
                this.targetZoom = Utils.clamp(this.targetZoom + step, this.minZoom, this.maxZoom);
            } else {
                this.targetZoom = Utils.clamp(this.targetZoom - step, this.minZoom, this.maxZoom);
            }
        };

        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        this.canvas.addEventListener('contextmenu', this._onContextMenu);
        this.canvas.addEventListener('mousedown', this._onMouseDown);
        this.canvas.addEventListener('mouseup', this._onMouseUp);
        this.canvas.addEventListener('mousemove', this._onMouseMove);
        this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
    }

    _unbindInput() {
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
        if (this.canvas) {
            this.canvas.removeEventListener('contextmenu', this._onContextMenu);
            this.canvas.removeEventListener('mousedown', this._onMouseDown);
            this.canvas.removeEventListener('mouseup', this._onMouseUp);
            this.canvas.removeEventListener('mousemove', this._onMouseMove);
            this.canvas.removeEventListener('wheel', this._onWheel);
        }
        this.keys = {};
        this.mouseDown = false;
        this.rightMouseDown = false;
    }

    // ═══════════════════════════════════════════
    //  ROGUELIKE CAMERA, LIGHTING & AMBIENCE
    // ═══════════════════════════════════════════

    _updateCamera(dt) {
        if (!this.canvas) return;

        // Smooth zoom interpolation
        this.zoom += (this.targetZoom - this.zoom) * (1 - Math.exp(-9 * dt));

        // Subtle aim look-ahead (drifts camera slightly toward where player is aiming)
        const lookDist = 75;
        const offX = Utils.clamp((this.mousePos.x - this.player.x) * 0.12, -lookDist, lookDist);
        const offY = Utils.clamp((this.mousePos.y - this.player.y) * 0.12, -lookDist, lookDist);
        let targetX = this.player.x + offX;
        let targetY = this.player.y + offY;

        const w = this.canvas.width;
        const h = this.canvas.height;
        const halfW = (w / this.zoom) / 2;
        const halfH = (h / this.zoom) / 2;

        if (this.roomW > w / this.zoom) {
            targetX = Utils.clamp(targetX, halfW, this.roomW - halfW);
        } else {
            targetX = this.roomW / 2;
        }

        if (this.roomH > h / this.zoom) {
            targetY = Utils.clamp(targetY, halfH, this.roomH - halfH);
        } else {
            targetY = this.roomH / 2;
        }

        // Smooth spring-damped camera tracking
        const camLerp = 1 - Math.exp(-10 * dt);
        this.camera.x += (targetX - this.camera.x) * camLerp;
        this.camera.y += (targetY - this.camera.y) * camLerp;

        // Keep world mouse aim vector in sync with camera movement
        this._updateWorldMouse();
    }

    _updateWorldMouse() {
        if (!this.canvas) return;
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.mousePos.x = (this.rawMouseScreen.x - w / 2) / this.zoom + this.camera.x;
        this.mousePos.y = (this.rawMouseScreen.y - h / 2) / this.zoom + this.camera.y;

        const dx = this.mousePos.x - this.player.x;
        const dy = this.mousePos.y - this.player.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 5) {
            this.player.facing.x = dx / dist;
            this.player.facing.y = dy / dist;
        }
    }

    _initAmbientMotes(count = 50) {
        const motes = [];
        for (let i = 0; i < count; i++) {
            motes.push({
                x: Math.random() * 2752,
                y: Math.random() * 1536,
                vx: Utils.randFloat(-8, 8),
                vy: Utils.randFloat(-22, -6),
                size: Utils.randFloat(1.5, 3.2),
                alpha: Utils.randFloat(0.25, 0.75),
                color: Math.random() < 0.65 ? '#f59e0b' : '#ef4444',
                phase: Math.random() * Math.PI * 2,
            });
        }
        return motes;
    }

    _updateAmbientMotes(dt) {
        const time = performance.now() / 1000;
        for (let i = 0; i < this.ambientMotes.length; i++) {
            const m = this.ambientMotes[i];
            m.y += m.vy * dt;
            m.x += (m.vx + Math.sin(time * 2 + m.phase) * 12) * dt;

            // Wrap around room bounds
            if (m.y < 0) {
                m.y = this.roomH;
                m.x = Math.random() * this.roomW;
            }
            if (m.x < 0) m.x = this.roomW;
            if (m.x > this.roomW) m.x = 0;
        }
    }

    _drawBraziers(ctx) {
        const time = performance.now();
        for (const b of this.braziers) {
            // Frustum check: only draw if within visible world area + 60px
            const dx = Math.abs(b.x - this.camera.x);
            const dy = Math.abs(b.y - this.camera.y);
            const maxW = (this.canvas.width / this.zoom) / 2 + 60;
            const maxH = (this.canvas.height / this.zoom) / 2 + 60;
            if (dx > maxW || dy > maxH) continue;

            const isBossArea = b.y < 450;
            const flameColor = isBossArea ? '#ef4444' : '#f97316';
            const innerFlame = isBossArea ? '#fca5a5' : '#fef08a';

            ctx.save();
            ctx.translate(b.x, b.y);

            // Elliptical cast shadow under brazier
            ctx.beginPath();
            ctx.ellipse(0, 8, 14, 6, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
            ctx.fill();

            // Iron tripod base
            ctx.strokeStyle = '#2d2522';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(-9, 8); ctx.lineTo(0, -6);
            ctx.moveTo(9, 8);  ctx.lineTo(0, -6);
            ctx.moveTo(0, 10); ctx.lineTo(0, -6);
            ctx.stroke();

            // Fire bowl
            ctx.beginPath();
            ctx.arc(0, -6, 10, 0, Math.PI);
            ctx.fillStyle = '#1c1719';
            ctx.fill();
            ctx.strokeStyle = '#5a4632';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Animated Living Flame
            const f1 = Math.sin(time / 70 + b.x * 0.1) * 2;
            const f2 = Math.cos(time / 90 + b.y * 0.1) * 3;
            const flameH = 16 + f1 + f2;

            // Outer flame teardrop
            ctx.beginPath();
            ctx.moveTo(-6, -6);
            ctx.quadraticCurveTo(-7, -6 - flameH * 0.6, f1 * 0.5, -6 - flameH);
            ctx.quadraticCurveTo(7, -6 - flameH * 0.6, 6, -6);
            ctx.closePath();
            ctx.fillStyle = flameColor;
            ctx.shadowColor = flameColor;
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0;

            // Inner core flame
            ctx.beginPath();
            ctx.moveTo(-3, -6);
            ctx.quadraticCurveTo(-3, -6 - flameH * 0.5, f1 * 0.3, -6 - flameH * 0.7);
            ctx.quadraticCurveTo(3, -6 - flameH * 0.5, 3, -6);
            ctx.closePath();
            ctx.fillStyle = innerFlame;
            ctx.fill();

            ctx.restore();
        }
    }

    /**
     * Map-Specific Dynamic Features & Hazards:
     * - DUNGEON_FORGES: Molten slag vats with thermal glow, falling portcullis gate at North circular furnace
     * - DUNGEON_VOID: Dual hexagonal obelisks with attunement beams, pulsating purple gravitational barrier across crossroads
     */
    _drawMapSpecificFeatures(ctx) {
        const time = performance.now();

        // ═══════════════════════════════════════════
        //  MASMORRA 2: AS FORJAS MORTAS
        // ═══════════════════════════════════════════
        if (this.currentMapId === 'DUNGEON_FORGES') {
            // 1. Draw Molten Slag Vats with radiant boiling metal
            if (this.slagHazards) {
                for (const vat of this.slagHazards) {
                    ctx.save();
                    // Slag basin border / warning rim
                    ctx.strokeStyle = '#f97316';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(vat.x, vat.y, vat.w, vat.h);

                    // Boiling molten metal interior
                    const pulse = Math.sin(time / 280 + vat.x) * 0.15 + 0.85;
                    const lavaGrad = ctx.createLinearGradient(vat.x, vat.y, vat.x + vat.w, vat.y + vat.h);
                    lavaGrad.addColorStop(0, `rgba(239, 68, 68, ${0.85 * pulse})`);
                    lavaGrad.addColorStop(0.5, `rgba(249, 115, 22, ${0.95 * pulse})`);
                    lavaGrad.addColorStop(1, `rgba(234, 179, 8, ${0.85 * pulse})`);
                    ctx.fillStyle = lavaGrad;
                    ctx.fillRect(vat.x, vat.y, vat.w, vat.h);

                    // Molten bubbles & hot spots
                    ctx.fillStyle = 'rgba(254, 240, 138, 0.75)';
                    for (let b = 0; b < 6; b++) {
                        const bx = vat.x + 15 + ((b * 22 + (time * 0.04) % (vat.w - 30)));
                        const by = vat.y + 10 + (Math.sin(time * 0.005 + b) * (vat.h / 3) + vat.h / 3);
                        const br = 2.5 + Math.sin(time * 0.01 + b) * 1.5;
                        ctx.beginPath();
                        ctx.arc(bx, by, Math.max(1, br), 0, Math.PI * 2);
                        ctx.fill();
                    }

                    // Warning sign / thermal aura
                    ctx.shadowColor = 'rgba(239, 68, 68, 0.8)';
                    ctx.shadowBlur = 18;
                    ctx.strokeStyle = 'rgba(254, 215, 170, 0.4)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(vat.x - 2, vat.y - 2, vat.w + 4, vat.h + 4);
                    ctx.restore();
                }
            }

            // 2. Falling Portcullis Gate at North Entrance (y = 250)
            if (this.fogGateActive) {
                ctx.save();
                // Portcullis iron bars dropping down
                ctx.fillStyle = 'rgba(30, 27, 34, 0.95)';
                ctx.fillRect(630, 246, 115, 12);
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 2.5;
                ctx.strokeRect(630, 246, 115, 12);

                // Vertical spiked iron grating
                ctx.fillStyle = '#dc2626';
                for (let gx = 635; gx <= 740; gx += 12) {
                    ctx.fillRect(gx, 242, 4, 18);
                }

                // Fiery warning runes along the gate
                const runeAlpha = Math.sin(time / 200) * 0.35 + 0.65;
                ctx.fillStyle = `rgba(255, 100, 50, ${runeAlpha})`;
                ctx.font = 'bold 12px "Cinzel", serif';
                ctx.textAlign = 'center';
                ctx.fillText('⚡ COMPORTAS FECHADAS ⚡', 688, 235);
                ctx.restore();
            }
        }

        // ═══════════════════════════════════════════
        //  MASMORRA 3: O TRONO DO VAZIO
        // ═══════════════════════════════════════════
        else if (this.currentMapId === 'DUNGEON_VOID') {
            // 1. Dual Hexagonal Obelisks (West: 780, 1008; East: 2804, 1008)
            if (this.obelisks) {
                for (const ob of this.obelisks) {
                    ctx.save();
                    const isNear = Math.hypot(this.player.x - ob.x, this.player.y - ob.y) <= ob.radius * 1.4;

                    // Rotating Runic Circle on the floor
                    const rot = (time / 1800) * (ob.id === 'obelisk_west' ? 1 : -1);
                    ctx.translate(ob.x, ob.y);

                    // Outer magical ring
                    ctx.save();
                    ctx.rotate(rot);
                    ctx.beginPath();
                    ctx.arc(0, 0, ob.radius * 0.85, 0, Math.PI * 2);
                    ctx.strokeStyle = ob.attuned ? 'rgba(192, 132, 252, 0.85)' : (isNear ? 'rgba(234, 179, 8, 0.75)' : 'rgba(147, 51, 234, 0.45)');
                    ctx.lineWidth = ob.attuned ? 3 : 2;
                    ctx.stroke();

                    // Runic ticks
                    for (let a = 0; a < 6; a++) {
                        const ang = (a * Math.PI) / 3;
                        ctx.beginPath();
                        ctx.moveTo(Math.cos(ang) * (ob.radius * 0.75), Math.sin(ang) * (ob.radius * 0.75));
                        ctx.lineTo(Math.cos(ang) * (ob.radius * 0.95), Math.sin(ang) * (ob.radius * 0.95));
                        ctx.stroke();
                    }
                    ctx.restore();

                    // Central Monolith Pillar
                    const pulse = Math.sin(time / 250) * 0.2 + 0.8;
                    ctx.beginPath();
                    ctx.arc(0, 0, 22, 0, Math.PI * 2);
                    ctx.fillStyle = ob.attuned ? '#581c87' : '#1e1028';
                    ctx.fill();
                    ctx.strokeStyle = ob.attuned ? '#d8b4fe' : '#9333ea';
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    // Ethereal vertical energy beam if attuned
                    if (ob.attuned) {
                        ctx.shadowColor = '#c084fc';
                        ctx.shadowBlur = 24;
                        ctx.fillStyle = `rgba(192, 132, 252, ${0.45 * pulse})`;
                        ctx.fillRect(-12, -180, 24, 180);
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(-4, -180, 8, 180);
                        ctx.shadowBlur = 0;
                    }

                    // Glyph icon
                    ctx.font = 'bold 20px "Cinzel", serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = ob.attuned ? '#f3e8ff' : (isNear ? '#fde047' : '#a855f7');
                    ctx.fillText(ob.attuned ? 'ᛟ' : 'ᚱ', 0, 0);

                    // Near Interaction Prompt
                    if (isNear && !ob.attuned) {
                        ctx.font = 'bold 12px "Cinzel", serif';
                        ctx.fillStyle = '#fde047';
                        ctx.fillText('[E] Sintonizar Obelisco', 0, -38);
                    }
                    ctx.restore();
                }
            }

            // 2. Gravitational Purple Barrier across Crossroads (Blocking North Bridge: x: 1690..1895, y: 1100)
            if (this.voidBarrierActive) {
                ctx.save();
                const pTime = time / 150;
                const bx1 = 1690, bx2 = 1895, by = 1100;

                // Pulsing Singularity wall
                const barGrad = ctx.createLinearGradient(bx1, by - 20, bx2, by + 20);
                barGrad.addColorStop(0, 'rgba(126, 34, 206, 0.9)');
                barGrad.addColorStop(0.5, 'rgba(192, 132, 252, 0.95)');
                barGrad.addColorStop(1, 'rgba(88, 28, 135, 0.9)');
                ctx.fillStyle = barGrad;
                ctx.shadowColor = 'rgba(168, 85, 247, 0.95)';
                ctx.shadowBlur = 20;
                ctx.fillRect(bx1, by - 12, bx2 - bx1, 24);

                // Electric cosmic arcs across the barrier
                ctx.strokeStyle = '#e9d5ff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(bx1, by);
                for (let x = bx1 + 15; x <= bx2; x += 20) {
                    const jitter = Math.sin(pTime + x) * 10;
                    ctx.lineTo(x, by + jitter);
                }
                ctx.stroke();

                // Warning runic text over barrier
                ctx.font = 'bold 13px "Cinzel", serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#f3e8ff';
                ctx.fillText('⛊ BARREIRA GRAVITACIONAL SELADA ⛊', 1792, by - 22);

                const westStatus = this.voidObelisks?.west ? '✓' : '✗';
                const eastStatus = this.voidObelisks?.east ? '✓' : '✗';
                ctx.font = '10px monospace';
                ctx.fillStyle = '#d8b4fe';
                ctx.fillText(`Obelisco Oeste: [${westStatus}]  |  Obelisco Leste: [${eastStatus}]`, 1792, by + 28);
                ctx.restore();
            }

            // 3. Cosmic Horizon Gate when Boss arena is entered (y = 450)
            if (this.fogGateActive) {
                ctx.save();
                const gx1 = 1690, gx2 = 1895, gy = 445;
                ctx.fillStyle = 'rgba(15, 5, 25, 0.95)';
                ctx.fillRect(gx1, gy - 8, gx2 - gx1, 16);
                ctx.strokeStyle = '#a855f7';
                ctx.lineWidth = 2.5;
                ctx.strokeRect(gx1, gy - 8, gx2 - gx1, 16);
                ctx.font = 'bold 12px "Cinzel", serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#f3e8ff';
                ctx.fillText('🌌 HORIZONTE DE EVENTOS SELADO 🌌', 1792, gy - 16);
                ctx.restore();
            }
        }
    }

    _drawAmbientMotes(ctx) {
        const time = performance.now();
        const maxW = (this.canvas.width / this.zoom) / 2 + 50;
        const maxH = (this.canvas.height / this.zoom) / 2 + 50;

        for (let i = 0; i < this.ambientMotes.length; i++) {
            const m = this.ambientMotes[i];
            const dx = Math.abs(m.x - this.camera.x);
            const dy = Math.abs(m.y - this.camera.y);
            if (dx > maxW || dy > maxH) continue;

            // Pulse alpha slightly
            const pulse = Math.sin(time / 300 + m.phase) * 0.2 + 0.8;
            ctx.save();
            ctx.globalAlpha = Utils.clamp(m.alpha * pulse, 0, 1);
            ctx.beginPath();
            ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
            ctx.fillStyle = m.color;
            ctx.shadowColor = m.color;
            ctx.shadowBlur = 6;
            ctx.fill();
            ctx.restore();
        }
    }

    _drawLighting(ctx, w, h, shakeX = 0, shakeY = 0) {
        if (!this.lightCanvas) return;
        if (this.lightCanvas.width !== w || this.lightCanvas.height !== h) {
            this.lightCanvas.width = w;
            this.lightCanvas.height = h;
        }

        const lCtx = this.lightCtx;
        const time = performance.now();

        // 1. Fill light canvas with atmospheric dark shroud
        lCtx.globalCompositeOperation = 'source-over';
        lCtx.fillStyle = 'rgba(7, 5, 10, 0.86)'; // Moody dark fantasy ambient
        lCtx.fillRect(0, 0, w, h);

        // 2. Carve out light pools with 'destination-out'
        lCtx.globalCompositeOperation = 'destination-out';

        const toScreen = (wx, wy) => ({
            x: (wx - this.camera.x) * this.zoom + w / 2 + shakeX,
            y: (wy - this.camera.y) * this.zoom + h / 2 + shakeY
        });

        // A. Dynamic Player Torch / Lantern with Organic Flicker
        const pScreen = toScreen(this.player.x, this.player.y);
        const torchFlicker = Math.sin(time / 95) * 5 + Math.cos(time / 140) * 3.5;
        const torchR = Math.max(140, (230 + torchFlicker) * this.zoom);
        const torchInnerR = Math.max(30, (65 + torchFlicker * 0.3) * this.zoom);

        const playerGrad = lCtx.createRadialGradient(pScreen.x, pScreen.y, torchInnerR, pScreen.x, pScreen.y, torchR);
        playerGrad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
        playerGrad.addColorStop(0.45, 'rgba(0, 0, 0, 0.92)');
        playerGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0.42)');
        playerGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        lCtx.fillStyle = playerGrad;
        lCtx.beginPath();
        lCtx.arc(pScreen.x, pScreen.y, torchR, 0, Math.PI * 2);
        lCtx.fill();

        // B. Braziers / Wall Torches
        for (const b of this.braziers) {
            const bScr = toScreen(b.x, b.y);
            const bR = (145 + Math.sin(time / 110 + b.x) * 4) * this.zoom;
            if (bScr.x < -bR || bScr.x > w + bR || bScr.y < -bR || bScr.y > h + bR) continue;

            const bGrad = lCtx.createRadialGradient(bScr.x, bScr.y, 18 * this.zoom, bScr.x, bScr.y, bR);
            bGrad.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
            bGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.65)');
            bGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

            lCtx.fillStyle = bGrad;
            lCtx.beginPath();
            lCtx.arc(bScr.x, bScr.y, bR, 0, Math.PI * 2);
            lCtx.fill();
        }

        // C. Relic Chests (Golden beacon)
        for (const chest of this.chests) {
            const cScr = toScreen(chest.x, chest.y);
            const cR = (chest.opened ? 60 : 105) * this.zoom;
            if (cScr.x < -cR || cScr.x > w + cR || cScr.y < -cR || cScr.y > h + cR) continue;

            const cGrad = lCtx.createRadialGradient(cScr.x, cScr.y, 15 * this.zoom, cScr.x, cScr.y, cR);
            cGrad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
            cGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

            lCtx.fillStyle = cGrad;
            lCtx.beginPath();
            lCtx.arc(cScr.x, cScr.y, cR, 0, Math.PI * 2);
            lCtx.fill();
        }

        // D. Impassable Crimson Fog Gate
        if (this.fogGateActive) {
            const g1 = toScreen(1240, 430);
            const g2 = toScreen(1512, 430);
            const fogGateR = 75 * this.zoom;
            for (let gx = g1.x; gx <= g2.x; gx += 45 * this.zoom) {
                const fgGrad = lCtx.createRadialGradient(gx, g1.y, 10, gx, g1.y, fogGateR);
                fgGrad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
                fgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                lCtx.fillStyle = fgGrad;
                lCtx.beginPath();
                lCtx.arc(gx, g1.y, fogGateR, 0, Math.PI * 2);
                lCtx.fill();
            }
        }

        // E. Boss Arena Crimson Radiance
        if (this.boss && this.boss.hp > 0) {
            const bScr = toScreen(this.boss.x, this.boss.y);
            const bossR = (this.boss.isBoss ? 260 : 130) * this.zoom;
            if (bScr.x >= -bossR && bScr.x <= w + bossR && bScr.y >= -bossR && bScr.y <= h + bossR) {
                const bGrad = lCtx.createRadialGradient(bScr.x, bScr.y, 30 * this.zoom, bScr.x, bScr.y, bossR);
                bGrad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
                bGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.45)');
                bGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                lCtx.fillStyle = bGrad;
                lCtx.beginPath();
                lCtx.arc(bScr.x, bScr.y, bossR, 0, Math.PI * 2);
                lCtx.fill();
            }
        }

        // F. Extraction Monolith (Divine celestial pillar of gold)
        if (this.extractionMonolith) {
            const mScr = toScreen(this.extractionMonolith.x, this.extractionMonolith.y);
            const mR = 300 * this.zoom;
            const mGrad = lCtx.createRadialGradient(mScr.x, mScr.y, 40 * this.zoom, mScr.x, mScr.y, mR);
            mGrad.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
            mGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.65)');
            mGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            lCtx.fillStyle = mGrad;
            lCtx.beginPath();
            lCtx.arc(mScr.x, mScr.y, mR, 0, Math.PI * 2);
            lCtx.fill();
        }

        // G. Ground Effects & Combat Projectiles
        for (const eff of this.combat.groundEffects) {
            const eScr = toScreen(eff.x, eff.y);
            const eR = eff.radius * 1.25 * this.zoom;
            const eGrad = lCtx.createRadialGradient(eScr.x, eScr.y, 10, eScr.x, eScr.y, eR);
            eGrad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
            eGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            lCtx.fillStyle = eGrad;
            lCtx.beginPath();
            lCtx.arc(eScr.x, eScr.y, eR, 0, Math.PI * 2);
            lCtx.fill();
        }

        for (const proj of this.projectiles) {
            const prScr = toScreen(proj.x, proj.y);
            const prR = 65 * this.zoom;
            const prGrad = lCtx.createRadialGradient(prScr.x, prScr.y, 5, prScr.x, prScr.y, prR);
            prGrad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
            prGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            lCtx.fillStyle = prGrad;
            lCtx.beginPath();
            lCtx.arc(prScr.x, prScr.y, prR, 0, Math.PI * 2);
            lCtx.fill();
        }

        // 3. Draw Darkness Canvas over main scene
        ctx.drawImage(this.lightCanvas, 0, 0);

        // 4. Additive Warmth / Tinting Pass (gives that cozy torchlight / crimson danger warmth)
        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        // Torch amber core
        const warmGrad = ctx.createRadialGradient(pScreen.x, pScreen.y, 0, pScreen.x, pScreen.y, 170 * this.zoom);
        warmGrad.addColorStop(0, 'rgba(245, 158, 11, 0.22)');
        warmGrad.addColorStop(0.5, 'rgba(217, 119, 6, 0.08)');
        warmGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = warmGrad;
        ctx.beginPath();
        ctx.arc(pScreen.x, pScreen.y, 170 * this.zoom, 0, Math.PI * 2);
        ctx.fill();

        // Monolith divine gold core
        if (this.extractionMonolith) {
            const mScr = toScreen(this.extractionMonolith.x, this.extractionMonolith.y);
            const goldGrad = ctx.createRadialGradient(mScr.x, mScr.y, 0, mScr.x, mScr.y, 220 * this.zoom);
            goldGrad.addColorStop(0, 'rgba(234, 179, 8, 0.35)');
            goldGrad.addColorStop(0.6, 'rgba(202, 138, 4, 0.12)');
            goldGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = goldGrad;
            ctx.beginPath();
            ctx.arc(mScr.x, mScr.y, 220 * this.zoom, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    _drawMinimap(ctx, w, h) {
        const mw = 154;
        const mh = 90;
        const mx = w - mw - 20;
        const my = 50;

        ctx.save();

        // 1. Drop shadow & Dark stone backing
        ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
        ctx.fillRect(mx - 3, my - 3, mw + 6, mh + 6);

        ctx.fillStyle = '#0a080d';
        ctx.fillRect(mx, my, mw, mh);

        // Clip to minimap viewport interior
        ctx.save();
        ctx.beginPath();
        ctx.rect(mx, my, mw, mh);
        ctx.clip();

        // 2. Simplified architectural floor layout (corridor, side rooms, boss arena)
        const toMx = (wx) => mx + (wx / this.roomW) * mw;
        const toMy = (wy) => my + (wy / this.roomH) * mh;

        if (this.currentMapId === 'DUNGEON_FORGES') {
            // As Forjas Mortas: Industrial track corridor, workshops, slag vats, circular furnace
            ctx.fillStyle = '#1c1822';
            // Central rail corridor
            ctx.fillRect(toMx(600), toMy(250), toMx(776) - toMx(600), toMy(740) - toMy(250));
            // West workshops & vat room
            ctx.fillRect(toMx(150), toMy(300), toMx(600) - toMx(150), toMy(700) - toMy(300));
            // East workshops & vat room
            ctx.fillRect(toMx(776), toMy(300), toMx(1226) - toMx(776), toMy(700) - toMy(300));

            // Molten Slag Vats (hazard markers in orange-red)
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(toMx(220), toMy(380), toMx(360) - toMx(220), toMy(445) - toMy(380));
            ctx.fillRect(toMx(990), toMy(380), toMx(1130) - toMx(990), toMy(445) - toMy(380));

            // North Circular Furnace Arena
            ctx.beginPath();
            ctx.arc(toMx(688), toMy(150), 18, 0, Math.PI * 2);
            ctx.fillStyle = '#3f1810';
            ctx.fill();

            // Portcullis gate marker
            if (this.fogGateActive) {
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(toMx(630), toMy(250));
                ctx.lineTo(toMx(745), toMy(250));
                ctx.stroke();
            }
        } else if (this.currentMapId === 'DUNGEON_VOID') {
            // O Trono do Vazio: Cosmic cross over the infinite abyss
            ctx.fillStyle = '#140c1f';
            // South bridge
            ctx.fillRect(toMx(1690), toMy(1100), toMx(1895) - toMx(1690), toMy(1950) - toMy(1100));
            // North bridge
            ctx.fillRect(toMx(1690), toMy(450), toMx(1895) - toMx(1690), toMy(1100) - toMy(450));
            // West wing walkway
            ctx.fillRect(toMx(780), toMy(950), toMx(1690) - toMx(780), toMy(1066) - toMy(950));
            // East wing walkway
            ctx.fillRect(toMx(1895), toMy(950), toMx(2804) - toMx(1895), toMy(1066) - toMy(950));

            // Hexagonal platform nodes (West and East)
            ctx.fillStyle = '#241038';
            ctx.beginPath();
            ctx.arc(toMx(780), toMy(1008), 10, 0, Math.PI * 2);
            ctx.arc(toMx(2804), toMy(1008), 10, 0, Math.PI * 2);
            ctx.fill();

            // North Throne Semicircle
            ctx.beginPath();
            ctx.arc(toMx(1792), toMy(240), 20, 0, Math.PI * 2);
            ctx.fillStyle = '#301344';
            ctx.fill();

            // Obelisk Markers
            if (this.obelisks) {
                for (const ob of this.obelisks) {
                    ctx.fillStyle = ob.attuned ? '#c084fc' : '#9333ea';
                    ctx.beginPath();
                    ctx.arc(toMx(ob.x), toMy(ob.y), ob.attuned ? 3.5 : 2.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Gravitational Barrier Marker
            if (this.voidBarrierActive) {
                ctx.strokeStyle = '#c084fc';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(toMx(1690), toMy(1100));
                ctx.lineTo(toMx(1895), toMy(1100));
                ctx.stroke();
            }

            // Event horizon gate
            if (this.fogGateActive) {
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(toMx(1690), toMy(450));
                ctx.lineTo(toMx(1895), toMy(450));
                ctx.stroke();
            }
        } else {
            // Default Rift layout
            ctx.fillStyle = '#1c1822';
            // South corridor
            ctx.fillRect(toMx(1220), toMy(450), toMx(1532) - toMx(1220), toMy(1500) - toMy(450));
            // West chamber
            ctx.fillRect(toMx(480), toMy(280), toMx(1100) - toMx(480), toMy(1350) - toMy(280));
            // East chamber
            ctx.fillRect(toMx(1650), toMy(400), toMx(2250) - toMx(1650), toMy(1250) - toMy(400));
            // Boss Arena (North circular)
            ctx.beginPath();
            ctx.arc(toMx(1376), toMy(220), 22, 0, Math.PI * 2);
            ctx.fillStyle = '#261219';
            ctx.fill();

            // Impassable Fog Gate Marker
            if (this.fogGateActive) {
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(toMx(1240), toMy(430));
                ctx.lineTo(toMx(1512), toMy(430));
                ctx.stroke();
            }
        }

        // Interactive Chests
        for (const chest of this.chests) {
            const cx = toMx(chest.x);
            const cy = toMy(chest.y);
            ctx.fillStyle = chest.opened ? '#5c5245' : '#eab308';
            ctx.beginPath();
            ctx.arc(cx, cy, chest.opened ? 2 : 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Extraction Monolith
        if (this.extractionMonolith) {
            const ex = toMx(this.extractionMonolith.x);
            const ey = toMy(this.extractionMonolith.y);
            const pulse = (Math.sin(performance.now() / 250) * 0.5 + 0.5);
            ctx.fillStyle = `rgba(234, 179, 8, ${0.4 + pulse * 0.5})`;
            ctx.beginPath();
            ctx.arc(ex, ey, 5 + pulse * 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fde047';
            ctx.beginPath();
            ctx.arc(ex, ey, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Enemies
        for (const enemy of this.enemies) {
            const ex = toMx(enemy.x);
            const ey = toMy(enemy.y);
            if (enemy.isBoss) {
                const pulse = Math.sin(performance.now() / 200) * 0.4 + 0.6;
                ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`;
                ctx.beginPath();
                ctx.arc(ex, ey, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(ex, ey, 2, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = enemy.isElite ? '#f97316' : '#ef4444';
                ctx.beginPath();
                ctx.arc(ex, ey, enemy.isElite ? 2.5 : 1.8, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Camera Viewport Rectangle (Yellow box showing current zoom view)
        const viewW = w / this.zoom;
        const viewH = h / this.zoom;
        const vx1 = toMx(this.camera.x - viewW / 2);
        const vy1 = toMy(this.camera.y - viewH / 2);
        const vW = (viewW / this.roomW) * mw;
        const vH = (viewH / this.roomH) * mh;

        ctx.strokeStyle = 'rgba(234, 179, 8, 0.45)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(vx1, vy1, vW, vH);
        ctx.setLineDash([]);

        // Player Arrow Indicator
        const px = toMx(this.player.x);
        const py = toMy(this.player.y);
        const fx = this.player.facing?.x || 0;
        const fy = this.player.facing?.y || -1;
        const pAngle = Math.atan2(fy, fx);

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(pAngle);
        ctx.beginPath();
        ctx.moveTo(5, 0);
        ctx.lineTo(-4, -3.5);
        ctx.lineTo(-2, 0);
        ctx.lineTo(-4, 3.5);
        ctx.closePath();
        ctx.fillStyle = '#fde047';
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 4;
        ctx.fill();
        ctx.restore();

        ctx.restore(); // Exit clip

        // 3. Gothic Brass Outer Frame & Filigree
        ctx.strokeStyle = '#8c6f36';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(mx, my, mw, mh);

        // Corner rivets
        ctx.fillStyle = '#c5a059';
        ctx.fillRect(mx - 2, my - 2, 4, 4);
        ctx.fillRect(mx + mw - 2, my - 2, 4, 4);
        ctx.fillRect(mx - 2, my + mh - 2, 4, 4);
        ctx.fillRect(mx + mw - 2, my + mh - 2, 4, 4);

        // Header Label: Fenda Abissal • A1
        ctx.fillStyle = 'rgba(10, 8, 12, 0.9)';
        ctx.fillRect(mx + 4, my + 3, mw - 8, 14);
        ctx.font = 'bold 9px "Cinzel", serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#c5a059';
        ctx.fillText(`FENDA ABISSAL • A${this.floor}`, mx + 8, my + 10);

        // Cardinal North 'N'
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ef4444';
        ctx.fillText('N', mx + mw - 8, my + 10);

        // Footer Zoom Status Badge: ZOOM 1.6x [Scroll/Z]
        ctx.fillStyle = 'rgba(10, 8, 12, 0.9)';
        ctx.fillRect(mx + 4, my + mh - 14, mw - 8, 12);
        ctx.textAlign = 'center';
        ctx.font = 'bold 8px "Cinzel", serif';
        ctx.fillStyle = '#dfcaa2';
        ctx.fillText(`ZOOM: ${this.zoom.toFixed(1)}x  [Z / Scroll]`, mx + mw / 2, my + mh - 8);

        ctx.restore();
    }

    // ═══════════════════════════════════════════
    //  CANVAS RESIZE
    // ═══════════════════════════════════════════

    _resizeCanvas() {
        if (!this.canvas) return;
        this.canvas.width  = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (this.lightCanvas) {
            this.lightCanvas.width  = this.canvas.width;
            this.lightCanvas.height = this.canvas.height;
        }
    }

    _onResize = () => this._resizeCanvas();

    /**
     * Synchronize live game settings from SettingsManager
     * @param {Object} settings
     */
    syncSettings(settings) {
        if (!settings) return;
        if (settings.visual && settings.visual.emberDensity) {
            const d = settings.visual.emberDensity;
            const count = (d === 'low' ? 18 : (d === 'medium' ? 36 : 60));
            this.ambientMotes = this._initAmbientMotes(count);
        }
    }
}

console.log('[DungeonEngine] Class loaded.');
