/**
 * ============================================
 *  SKILL TREE & MODIFIER MODELS
 *  Modular 4-tier tree architecture with mutations
 *  (modifiers) for Tier 3 core skills.
 * ============================================
 */

class SkillModifier {
    /**
     * @param {Object} def
     * @param {string} def.id
     * @param {string} def.name
     * @param {string} def.icon
     * @param {string} def.desc
     * @param {string} def.mutationType
     * @param {Object} [def.properties]
     */
    constructor(def) {
        this.id           = def.id;
        this.name         = def.name;
        this.icon         = def.icon || '✦';
        this.desc         = def.desc;
        this.mutationType = def.mutationType; // e.g. 'vortex_pull', 'wind_slash', 'holy_slow', 'heal_ricochet', 'freeze', 'fire_explosion', 'poison_cloud', 'life_steal'
        this.properties   = def.properties || {};
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            icon: this.icon,
            desc: this.desc,
            mutationType: this.mutationType,
            properties: this.properties,
        };
    }

    static fromJSON(data) {
        return new SkillModifier(data);
    }
}

class Skill {
    /**
     * @param {Object} def
     */
    constructor(def) {
        this.id              = def.id;
        this.name            = def.name;
        this.icon            = def.icon || '†';
        this.tier            = def.tier || 1; // 1, 2, 3, 4
        this.requiredLevel   = def.requiredLevel || (def.tier === 1 ? 1 : def.tier === 2 ? 5 : def.tier === 3 ? 10 : 20);
        this.key             = def.key || `${this.tier}`;
        this.cooldown        = def.cooldown || 0; // seconds
        this.currentCooldown = 0;
        this.cost            = def.cost || 0;
        this.resourceType    = def.resourceType || 'mana';
        this.desc            = def.desc || '';
        this.skillType       = def.skillType || (this.tier === 1 ? 'generator' : this.tier === 2 ? 'utility' : this.tier === 3 ? 'core' : 'ultimate');
        
        // Damage & range properties
        this.damageMultiplier = def.damageMultiplier || 1.0;
        this.range            = def.range || 50;
        this.radius           = def.radius || 30;
        this.duration         = def.duration || 0;
        this.knockbackForce   = def.knockbackForce !== undefined ? def.knockbackForce : 100;
        this.iFramesDuration  = def.iFramesDuration || 0;

        // Tree status
        this.unlocked         = def.unlocked || false;

        // Modifiers (for Tier 3 core skills)
        this.modifiers        = (def.modifiers || []).map(m => m instanceof SkillModifier ? m : new SkillModifier(m));
        this.activeModifierId = def.activeModifierId || (this.modifiers.length > 0 ? this.modifiers[0].id : null);
    }

    get isReady() {
        return this.unlocked && this.currentCooldown <= 0;
    }

    getActiveModifier() {
        if (!this.activeModifierId) return null;
        return this.modifiers.find(m => m.id === this.activeModifierId) || null;
    }

    setActiveModifier(modifierId) {
        const found = this.modifiers.find(m => m.id === modifierId);
        if (found) {
            this.activeModifierId = modifierId;
            return true;
        }
        return false;
    }

    startCooldown() {
        this.currentCooldown = this.cooldown;
    }

    updateCooldown(dt) {
        if (this.currentCooldown > 0) {
            this.currentCooldown = Math.max(0, this.currentCooldown - dt);
        }
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            icon: this.icon,
            tier: this.tier,
            requiredLevel: this.requiredLevel,
            key: this.key,
            cooldown: this.cooldown,
            cost: this.cost,
            resourceType: this.resourceType,
            desc: this.desc,
            skillType: this.skillType,
            damageMultiplier: this.damageMultiplier,
            range: this.range,
            radius: this.radius,
            duration: this.duration,
            knockbackForce: this.knockbackForce,
            iFramesDuration: this.iFramesDuration,
            unlocked: this.unlocked,
            activeModifierId: this.activeModifierId,
            modifiers: this.modifiers.map(m => m.toJSON()),
        };
    }

    static fromJSON(data) {
        const skill = new Skill(data);
        skill.unlocked = data.unlocked || false;
        skill.activeModifierId = data.activeModifierId || null;
        return skill;
    }
}

class SkillNode {
    /**
     * @param {Object} def
     * @param {string} def.id
     * @param {Skill} def.skill
     * @param {number} def.tier
     * @param {number} def.requiredLevel
     * @param {string[]} [def.prerequisites=[]]
     */
    constructor(def) {
        this.id            = def.id;
        this.skill         = def.skill;
        this.tier          = def.tier;
        this.requiredLevel = def.requiredLevel;
        this.prerequisites = def.prerequisites || [];
    }

    get unlocked() {
        return this.skill.unlocked;
    }

    set unlocked(val) {
        this.skill.unlocked = val;
    }

    toJSON() {
        return {
            id: this.id,
            skill: this.skill.toJSON(),
            tier: this.tier,
            requiredLevel: this.requiredLevel,
            prerequisites: this.prerequisites,
        };
    }

    static fromJSON(data) {
        return new SkillNode({
            id: data.id,
            skill: Skill.fromJSON(data.skill),
            tier: data.tier,
            requiredLevel: data.requiredLevel,
            prerequisites: data.prerequisites,
        });
    }
}

class SkillTree {
    /**
     * @param {string} classId
     * @param {SkillNode[]} [nodes=[]]
     */
    constructor(classId, nodes = []) {
        this.classId = classId;
        this.nodes   = nodes; // Array of SkillNode
    }

    /**
     * Look up skill by skill ID.
     * @param {string} skillId
     * @returns {Skill|null}
     */
    getSkill(skillId) {
        const node = this.nodes.find(n => n.skill.id === skillId);
        return node ? node.skill : null;
    }

    /**
     * Look up skill by tier (1 to 4).
     * @param {number} tier
     * @returns {Skill|null}
     */
    getSkillByTier(tier) {
        const node = this.nodes.find(n => n.tier === tier);
        return node ? node.skill : null;
    }

    /**
     * Look up node by ID.
     * @param {string} nodeId
     * @returns {SkillNode|null}
     */
    getNode(nodeId) {
        return this.nodes.find(n => n.id === nodeId || n.skill.id === nodeId) || null;
    }

    /**
     * All skills in tier order.
     * @returns {Skill[]}
     */
    getAllSkills() {
        return this.nodes.map(n => n.skill);
    }

    /**
     * Only unlocked skills.
     * @returns {Skill[]}
     */
    getActiveSkills() {
        return this.nodes.filter(n => n.unlocked).map(n => n.skill);
    }

    /**
     * Number of points currently invested into the tree.
     * (1 point per unlocked skill).
     * @returns {number}
     */
    getInvestedPoints() {
        return this.nodes.filter(n => n.unlocked).length;
    }

    /**
     * Reset the entire skill tree.
     * Refers all spent points back.
     * @returns {number} number of refunded points
     */
    reset() {
        let pointsRefunded = 0;
        for (const node of this.nodes) {
            if (node.unlocked) {
                node.unlocked = false;
                node.skill.currentCooldown = 0;
                pointsRefunded++;
            }
        }
        return pointsRefunded;
    }

    /**
     * Update cooldowns for all skills in the tree.
     * @param {number} dt
     */
    update(dt) {
        for (const node of this.nodes) {
            node.skill.updateCooldown(dt);
        }
    }

    /**
     * Factory: Create full SkillTree instance for a given ClassType.
     * @param {string} classId
     * @returns {SkillTree}
     */
    static createForClass(classId) {
        const treeData = SKILL_TREE_DATA[classId];
        if (!treeData) throw new Error(`Unknown class for skill tree: ${classId}`);

        const nodes = treeData.map(nodeDef => {
            const skill = new Skill({
                ...nodeDef.skill,
                tier: nodeDef.tier,
                requiredLevel: nodeDef.requiredLevel,
                unlocked: nodeDef.tier === 1, // Tier 1 starts unlocked
            });
            return new SkillNode({
                id: `node_${skill.id}`,
                skill,
                tier: nodeDef.tier,
                requiredLevel: nodeDef.requiredLevel,
                prerequisites: nodeDef.prerequisites || [],
            });
        });

        return new SkillTree(classId, nodes);
    }

    toJSON() {
        return {
            classId: this.classId,
            nodes: this.nodes.map(n => n.toJSON()),
        };
    }

    static fromJSON(data) {
        if (!data) return null;
        const nodes = (data.nodes || []).map(SkillNode.fromJSON);
        return new SkillTree(data.classId, nodes);
    }
}

// ─────────────────────────────────────────────
//  SKILL TREE DATA SPECIFICATION (4 CLASSES)
// ─────────────────────────────────────────────
const SKILL_TREE_DATA = {
    // ─── BÁRBARO ───
    barbarian: [
        {
            tier: 1,
            requiredLevel: 1,
            prerequisites: [],
            skill: {
                id: 'barb_heavy_strike',
                name: 'Golpe Pesado',
                icon: 'ᛏ',
                key: '1',
                cooldown: 0.35,
                cost: 0, // Generates fury!
                resourceType: 'fury',
                skillType: 'generator',
                damageMultiplier: 1.1,
                range: 65,
                radius: 40,
                knockbackForce: 130,
                desc: 'Golpe frontal potente que atinge inimigos em arco e gera 15 de Fúria ao acertar.',
                properties: { furyGeneration: 15 },
            },
        },
        {
            tier: 2,
            requiredLevel: 5,
            prerequisites: ['node_barb_heavy_strike'],
            skill: {
                id: 'barb_leap_slam',
                name: 'Investida / Salto Brutal',
                icon: 'ᚦ',
                key: '2',
                cooldown: 5.0,
                cost: 10,
                resourceType: 'fury',
                skillType: 'utility',
                damageMultiplier: 1.4,
                range: 220,
                radius: 70,
                knockbackForce: 180,
                iFramesDuration: 0.45,
                desc: 'Salta ferozmente na direção do alvo com frames de invulnerabilidade, atordoando inimigos por 1.5s ao aterrissar.',
                properties: { stunDuration: 1.5 },
            },
        },
        {
            tier: 3,
            requiredLevel: 10,
            prerequisites: ['node_barb_leap_slam'],
            skill: {
                id: 'barb_whirlwind',
                name: 'Torvelinho',
                icon: 'ᛗ',
                key: '3',
                cooldown: 0.2,
                cost: 12,
                resourceType: 'fury',
                skillType: 'core',
                damageMultiplier: 0.85,
                range: 0,
                radius: 85,
                knockbackForce: 40,
                duration: 1.8,
                desc: 'Gira furiosamente como um turbilhão causando dano contínuo em 360° enquanto consome Fúria.',
                modifiers: [
                    {
                        id: 'mod_vortex_pull',
                        name: 'Vórtice Brutal',
                        icon: 'ᛞ',
                        desc: 'Puxa todos os monstros atingidos violentamente para o centro do torvelinho.',
                        mutationType: 'vortex_pull',
                        properties: { pullStrength: 180 },
                    },
                    {
                        id: 'mod_wind_slashes',
                        name: 'Lâminas de Vento',
                        icon: 'ᛒ',
                        desc: 'Lança rajadas de lâminas de ar perfurantes em todas as direções durante a rotação.',
                        mutationType: 'wind_slash',
                        properties: { projectileCount: 6, projectileSpeed: 320 },
                    },
                ],
            },
        },
        {
            tier: 4,
            requiredLevel: 20,
            prerequisites: ['node_barb_whirlwind'],
            skill: {
                id: 'barb_ancestral_wrath',
                name: 'Fúria Ancestral',
                icon: 'ᚱ',
                key: '4',
                cooldown: 25.0,
                cost: 40,
                resourceType: 'fury',
                skillType: 'ultimate',
                damageMultiplier: 2.8,
                range: 0,
                radius: 200,
                knockbackForce: 260,
                duration: 8.0,
                desc: 'Invoca os espíritos dos ancestrais: causa um estrondo sísmico colossal em grande área e concede +50% de velocidade e dano.',
                properties: { buffSpeed: 0.5, buffDamage: 0.5, buffDuration: 8.0 },
            },
        },
    ],

    // ─── PALADINO ───
    paladin: [
        {
            tier: 1,
            requiredLevel: 1,
            prerequisites: [],
            skill: {
                id: 'pal_hammer_light',
                name: 'Martelo da Luz',
                icon: 'ᛉ',
                key: '1',
                cooldown: 0.4,
                cost: 5,
                resourceType: 'faith',
                skillType: 'generator',
                damageMultiplier: 1.15,
                range: 60,
                radius: 50,
                knockbackForce: 110,
                desc: 'Desfere um golpe sagrado frontal que emite um pulso radiante em arco, regenerando Fé rapidamente.',
                properties: { faithRegenBonus: 5 },
            },
        },
        {
            tier: 2,
            requiredLevel: 5,
            prerequisites: ['node_pal_hammer_light'],
            skill: {
                id: 'pal_shield_charge',
                name: 'Investida com Escudo',
                icon: '⛊',
                key: '2',
                cooldown: 4.5,
                cost: 15,
                resourceType: 'faith',
                skillType: 'utility',
                damageMultiplier: 1.25,
                range: 180,
                radius: 55,
                knockbackForce: 240,
                iFramesDuration: 0.35,
                desc: 'Avança de escudo erguido, repelindo monstros para trás com tremendo empurrão e bloqueando projéteis frontais.',
                properties: { destroysProjectiles: true },
            },
        },
        {
            tier: 3,
            requiredLevel: 10,
            prerequisites: ['node_pal_shield_charge'],
            skill: {
                id: 'pal_blessed_shield',
                name: 'Escudo Abençoado',
                icon: '☩',
                key: '3',
                cooldown: 5.5,
                cost: 25,
                resourceType: 'faith',
                skillType: 'core',
                damageMultiplier: 1.5,
                range: 300,
                radius: 20,
                knockbackForce: 90,
                desc: 'Arremessa um escudo divino flamejante que ricocheteia atingindo até 3 alvos sucessivos.',
                modifiers: [
                    {
                        id: 'mod_holy_slow',
                        name: 'Luz Debilitante',
                        icon: '⚲',
                        desc: 'Aplica lentidão sagrada de 60% e reduz o poder de ataque dos monstros atingidos por 3s.',
                        mutationType: 'holy_slow',
                        properties: { slowAmount: 0.60, slowDuration: 3.0 },
                    },
                    {
                        id: 'mod_healing_grace',
                        name: 'Graça Curativa',
                        icon: '🜛',
                        desc: 'Cada ricochete do escudo cura o paladino em 12% da sua Vida Máxima.',
                        mutationType: 'heal_ricochet',
                        properties: { healPctPerBounce: 0.12 },
                    },
                ],
            },
        },
        {
            tier: 4,
            requiredLevel: 20,
            prerequisites: ['node_pal_blessed_shield'],
            skill: {
                id: 'pal_consecration',
                name: 'Consagração',
                icon: '🜚',
                key: '4',
                cooldown: 22.0,
                cost: 45,
                resourceType: 'faith',
                skillType: 'ultimate',
                damageMultiplier: 0.6,
                range: 0,
                radius: 170,
                duration: 6.0,
                knockbackForce: 10,
                desc: 'Santifica o solo ao redor por 6s. Causa dano sagrado contínuo a cada 0.5s aos hereges e regenera vida do paladino.',
                properties: { healTick: 8, tickRate: 0.5 },
            },
        },
    ],

    // ─── MAGO ───
    mage: [
        {
            tier: 1,
            requiredLevel: 1,
            prerequisites: [],
            skill: {
                id: 'mage_arcane_missile',
                name: 'Projétil Arcano',
                icon: 'ᛋ',
                key: '1',
                cooldown: 0.3,
                cost: 8,
                resourceType: 'mana',
                skillType: 'generator',
                damageMultiplier: 1.0,
                range: 450,
                radius: 14,
                knockbackForce: 60,
                desc: 'Dispara um dardo de pura energia arcana em alta velocidade na direção do cursor do mouse.',
                properties: { projectileSpeed: 480 },
            },
        },
        {
            tier: 2,
            requiredLevel: 5,
            prerequisites: ['node_mage_arcane_missile'],
            skill: {
                id: 'mage_teleport',
                name: 'Teleporte',
                icon: 'ᛤ',
                key: '2',
                cooldown: 4.0,
                cost: 20,
                resourceType: 'mana',
                skillType: 'utility',
                damageMultiplier: 0.5,
                range: 240,
                radius: 45,
                knockbackForce: 80,
                iFramesDuration: 0.3,
                desc: 'Dobra o espaço-tempo, teletransportando-se instantaneamente para o cursor e ignorando colisão de corpos.',
                properties: { instantBlink: true },
            },
        },
        {
            tier: 3,
            requiredLevel: 10,
            prerequisites: ['node_mage_teleport'],
            skill: {
                id: 'mage_elemental_orb',
                name: 'Orbe Elemental',
                icon: '🜄',
                key: '3',
                cooldown: 6.0,
                cost: 35,
                resourceType: 'mana',
                skillType: 'core',
                damageMultiplier: 1.8,
                range: 400,
                radius: 28,
                knockbackForce: 100,
                desc: 'Conjura uma esfera densa de magia lenta que perfura monstros na sua trajetória, causando alto impacto.',
                properties: { projectileSpeed: 160, pierce: true },
                modifiers: [
                    {
                        id: 'mod_glacial_orb',
                        name: 'Orbe Glacial',
                        icon: '🜁',
                        desc: 'Imbui o orbe com gelo eterno: congela monstros no lugar por 2s e causa 80% de lentidão residual.',
                        mutationType: 'freeze',
                        properties: { freezeDuration: 2.0, slowDuration: 4.0 },
                    },
                    {
                        id: 'mod_pyroclastic_orb',
                        name: 'Orbe Piroclástico',
                        icon: '🜂',
                        desc: 'O orbe incinera a área por onde passa e detona em chamas residuais no chão que queimam inimigos.',
                        mutationType: 'fire_explosion',
                        properties: { burnDuration: 3.5, burnDamageTick: 12 },
                    },
                ],
            },
        },
        {
            tier: 4,
            requiredLevel: 20,
            prerequisites: ['node_mage_elemental_orb'],
            skill: {
                id: 'mage_meteor_shower',
                name: 'Chuva de Meteoros',
                icon: '🜃',
                key: '4',
                cooldown: 20.0,
                cost: 60,
                resourceType: 'mana',
                skillType: 'ultimate',
                damageMultiplier: 3.2,
                range: 400,
                radius: 160,
                knockbackForce: 220,
                desc: 'Telegrafa múltiplos círculos rúnicos flamejantes no solo antes de fazer chover meteoros devastadores sobre a área.',
                properties: { telegraphDuration: 0.7, meteorCount: 5 },
            },
        },
    ],

    // ─── NECROMANTE ───
    necromancer: [
        {
            tier: 1,
            requiredLevel: 1,
            prerequisites: [],
            skill: {
                id: 'necro_reaping_scythe',
                name: 'Foice Ceifadora',
                icon: 'ᛡ',
                key: '1',
                cooldown: 0.38,
                cost: 5,
                resourceType: 'mana',
                skillType: 'generator',
                damageMultiplier: 1.1,
                range: 75,
                radius: 65,
                knockbackForce: 85,
                desc: 'Desfere um golpe amplo em cone espectral, ceifando a essência dos monstros e gerando fragmentos de alma.',
                properties: { soulGain: 1 },
            },
        },
        {
            tier: 2,
            requiredLevel: 5,
            prerequisites: ['node_necro_reaping_scythe'],
            skill: {
                id: 'necro_spectral_step',
                name: 'Passo Espectral',
                icon: '🜛',
                key: '2',
                cooldown: 5.0,
                cost: 15,
                resourceType: 'mana',
                skillType: 'utility',
                damageMultiplier: 0.4,
                range: 0,
                radius: 40,
                duration: 1.5,
                knockbackForce: 40,
                iFramesDuration: 1.5,
                desc: 'Dissolve a forma física no plano espectral por 1.5s: invulnerabilidade total, atravessa corpos e ganha +80% de velocidade.',
                properties: { speedBoost: 0.80 },
            },
        },
        {
            tier: 3,
            requiredLevel: 10,
            prerequisites: ['node_necro_spectral_step'],
            skill: {
                id: 'necro_corpse_explosion',
                name: 'Explosão de Cadáveres',
                icon: 'ᚾ',
                key: '3',
                cooldown: 1.5,
                cost: 20,
                resourceType: 'mana',
                skillType: 'core',
                damageMultiplier: 2.2,
                range: 350,
                radius: 110,
                knockbackForce: 170,
                desc: 'Detona carcaças no chão de monstros abatidos próximos ao cursor, provocando explosões maciças de ossos e sangue.',
                modifiers: [
                    {
                        id: 'mod_toxic_plague',
                        name: 'Praga Tóxica',
                        icon: '🝢',
                        desc: 'A detonação libera uma densa nuvem venenosa duradoura que asfixia monstros que passarem sobre ela.',
                        mutationType: 'poison_cloud',
                        properties: { cloudDuration: 4.5, poisonTick: 15 },
                    },
                    {
                        id: 'mod_sanguine_harvest',
                        name: 'Ceifa Sanguínea',
                        icon: '🜏',
                        desc: 'Cada explosão de cadáver drena vitalidade impura, convertendo 25% do dano causado em cura imediata.',
                        mutationType: 'life_steal',
                        properties: { healPctOfDamage: 0.25 },
                    },
                ],
            },
        },
        {
            tier: 4,
            requiredLevel: 20,
            prerequisites: ['node_necro_corpse_explosion'],
            skill: {
                id: 'necro_flesh_titan',
                name: 'Evocação de Titã Cadavérico',
                icon: 'ᛣ',
                key: '4',
                cooldown: 30.0,
                cost: 50,
                resourceType: 'mana',
                skillType: 'ultimate',
                damageMultiplier: 2.0,
                range: 200,
                radius: 80,
                duration: 20.0,
                knockbackForce: 200,
                desc: 'Ergue uma monstruosidade cadavérica colossal permanente/prolongada que provoca inimigos (Taunt) e esmaga o solo.',
                properties: { titanHp: 450, titanDamage: 35, tauntRadius: 220 },
            },
        },
    ],
};

console.log('[Model] SkillTree models loaded.');
