/**
 * ============================================
 *  CAMP SERVICES UI (Núcleo de Serviços do Acampamento)
 *  Manages:
 *  - A Bigorna Ancestral (Forja, Aprimoramento +1 a +10, Desmanche de Sucata)
 *  - O Caldeirão Alquímico (Destilação de Elixires, Atribuição do Cinto de Tônicos)
 *  - A Feira das Cinzas (Permuta de Recursos, Mercador de Provisões)
 *  - O Quadro de Editais (3 slots de missões secundárias, resgate e renovação)
 *  - Cinto de Tônicos na Masmorra (Teclas 1 e 2, exibição de buffs ativos)
 * ============================================
 */

class CampServicesUI {
    /**
     * @param {StateManager} state
     * @param {BlacksmithManager} blacksmith
     * @param {AlchemyManager} alchemy
     * @param {MarketManager} market
     * @param {BountyManager} bounties
     * @param {UIManager} uiManager
     */
    constructor(state, blacksmith, alchemy, market, bounties, uiManager) {
        this.state = state;
        this.blacksmith = blacksmith;
        this.alchemy = alchemy;
        this.market = market;
        this.bounties = bounties;
        this.uiManager = uiManager;

        this.selectedForgeItem = null;

        this._initListeners();
        console.log('[CampServicesUI] Initialized.');
    }

    _initListeners() {
        // Pub/Sub listeners to refresh UI dynamically
        this.state.on('resources:changed', () => this.renderMarketAndForgeCosts());
        this.state.on('character:changed', () => {
            this.renderForge();
            this.renderAlchemy();
        });
        this.state.on('item_upgraded', (data) => {
            this.renderForge();
            if (data.success) {
                this.uiManager?.notify?.(`Têmpera bem-sucedida! ${data.item.displayName}`, 'success');
            } else {
                this.uiManager?.notify?.(`A têmpera falhou! O item permaneceu intacto.`, 'warning');
            }
        });
        this.state.on('item_salvaged', (data) => {
            this.renderForge();
            const count = data.count || 1;
            this.uiManager?.notify?.(`${count} equipamento(s) desmanchado(s) em matérias-primas.`, 'info');
        });
        this.state.on('potions:changed', () => {
            this.renderAlchemy();
            this.renderDungeonPotionBelt();
        });
        this.state.on('buff_applied', (data) => {
            this.uiManager?.notify?.(`Tônico consumido: ${data.name}`, 'success');
            this.renderDungeonPotionBelt();
        });
        this.state.on('buff_expired', () => {
            this.renderDungeonPotionBelt();
        });
        this.state.on('resource_traded', (data) => {
            this.uiManager?.notify?.(`Permuta realizada na Feira das Cinzas.`, 'info');
        });
        this.state.on('provision_purchased', (data) => {
            this.uiManager?.notify?.(`Aquisição de provisões concluída.`, 'success');
            this.renderMarket();
        });
        this.state.on('bounties:changed', () => {
            this.renderBounties();
        });
        this.state.on('bounty_ready', (data) => {
            this.uiManager?.notify?.(`Edital cumprido: ${data.bounty.title}!`, 'success');
        });
        this.state.on('bounty_completed', (data) => {
            this.uiManager?.notify?.(`Recompensa resgatada: +${data.reward.gold} 🜚 Ouro, +${data.reward.xp} XP`, 'success');
        });

        // Ticking loop for timers (bounties cooldown, alchemy buffs)
        setInterval(() => {
            this.updateTimers();
        }, 1000);
    }

    render() {
        this.renderForge();
        this.renderAlchemy();
        this.renderMarket();
        this.renderBounties();
        this.renderDungeonPotionBelt();
    }

    switchSubTab(subTab) {
        if (subTab === 'forge') {
            this.renderForge();
            const el = document.querySelector('.forge-block');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (subTab === 'alchemy') {
            this.renderAlchemy();
            const el = document.querySelector('.alchemy-block');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (subTab === 'market') {
            this.renderMarket();
            const el = document.querySelector('.market-block');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (subTab === 'bounties') {
            this.renderBounties();
            const el = document.querySelector('.bounties-block');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    updateTimers() {
        // Tick subsystem cooldowns
        if (this.bounties) this.bounties.update(1.0);
        if (this.alchemy) this.alchemy.update(1.0);

        // Update bounty cooldown badges
        const bounties = this.state.bounties || [];
        for (let i = 0; i < bounties.length; i++) {
            const b = bounties[i];
            const cdEl = document.getElementById(`bounty-cd-${i}`);
            if (cdEl && b && b.claimed && b.cooldownRemaining > 0) {
                cdEl.textContent = `Novo edital em: ${Math.ceil(b.cooldownRemaining)}s`;
            }
        }

        // Update active potion buffs on dungeon HUD
        this.renderDungeonBuffs();
    }

    // ═══════════════════════════════════════════
    //  A BIGORNA ANCESTRAL (FORGE & UPGRADES)
    // ═══════════════════════════════════════════

    renderForge() {
        const char = this.state.character;
        const selector = document.getElementById('forge-item-select');
        const previewContainer = document.getElementById('forge-item-preview');
        const salvageList = document.getElementById('forge-salvage-list');

        if (!selector || !previewContainer) return;

        // Collect all upgradable equipment (equipped + inventory)
        const upgradableItems = [];
        if (char) {
            for (const [slot, item] of Object.entries(char.equipment || {})) {
                if (item) upgradableItems.push({ item, slotName: `Equipado (${slot})`, isEquipped: true });
            }
            (char.inventory || []).forEach((item, idx) => {
                if (item) upgradableItems.push({ item, slotName: `Algibeira [${idx + 1}]`, isEquipped: false });
            });
        }

        // Retain selection or pick first
        if (this.selectedForgeItem && !upgradableItems.some(i => i.item.id === this.selectedForgeItem.id)) {
            this.selectedForgeItem = null;
        }
        if (!this.selectedForgeItem && upgradableItems.length > 0) {
            this.selectedForgeItem = upgradableItems[0].item;
        }

        // Render Dropdown / Selector
        selector.innerHTML = '';
        if (upgradableItems.length === 0) {
            selector.innerHTML = '<option value="">Nenhum equipamento disponível</option>';
            previewContainer.innerHTML = `
                <div class="forge-empty-state">
                    <span class="rune-icon" style="font-size: 2rem;">🜛</span>
                    <p>Nenhuma peça de combate encontrada na algibeira ou equipada.</p>
                </div>
            `;
        } else {
            upgradableItems.forEach(entry => {
                const opt = document.createElement('option');
                opt.value = entry.item.id;
                opt.textContent = `${entry.slotName} • ${entry.item.displayName} (${entry.item.rarity.toUpperCase()})`;
                if (this.selectedForgeItem && this.selectedForgeItem.id === entry.item.id) {
                    opt.selected = true;
                }
                selector.appendChild(opt);
            });

            selector.onchange = (e) => {
                const found = upgradableItems.find(i => i.item.id === e.target.value);
                this.selectedForgeItem = found ? found.item : null;
                this.renderForgePreview();
            };

            this.renderForgePreview();
        }

        // Render Salvage Section
        if (salvageList) {
            salvageList.innerHTML = '';
            const unequippedItems = (char?.inventory || []).filter(Boolean);

            if (unequippedItems.length === 0) {
                salvageList.innerHTML = '<p class="text-muted" style="text-align:center; padding: 12px;">Nenhum item descartável na algibeira.</p>';
            } else {
                unequippedItems.forEach(item => {
                    const row = document.createElement('div');
                    row.className = `salvage-row rarity-${item.rarity}`;
                    const ret = this.blacksmith.calculateSalvageReturns(item);
                    const retStrs = [];
                    if (ret[ResourceType.WOOD]) retStrs.push(`${ret[ResourceType.WOOD]} ᚱ`);
                    if (ret[ResourceType.ORE]) retStrs.push(`${ret[ResourceType.ORE]} 🜛`);
                    if (ret[ResourceType.GOLD]) retStrs.push(`${ret[ResourceType.GOLD]} 🜚`);
                    if (ret[ResourceType.ESSENCE]) retStrs.push(`${ret[ResourceType.ESSENCE]} ᛟ`);
                    if (ret[ResourceType.ASHES]) retStrs.push(`${ret[ResourceType.ASHES]} 🜂`);

                    row.innerHTML = `
                        <div class="salvage-info">
                            <span class="salvage-name font-cinzel">${item.displayName}</span>
                            <span class="salvage-returns">Retorno: ${retStrs.join(' ')}</span>
                        </div>
                        <button class="btn-gothic btn-gothic-danger btn-sm" data-salvage-id="${item.id}">
                            <span class="rune-icon">🜂</span> Desmanchar
                        </button>
                    `;

                    row.querySelector('button').addEventListener('click', () => {
                        this.blacksmith.salvageItem(item.id);
                    });

                    salvageList.appendChild(row);
                });
            }

            const btnBulkSalvage = document.getElementById('btn-bulk-salvage');
            if (btnBulkSalvage) {
                btnBulkSalvage.onclick = () => {
                    const res = this.blacksmith.salvageCommonAndMagic();
                    if (!res.success) {
                        this.uiManager?.notify?.(res.reason, 'warning');
                    }
                };
            }
        }
    }

    renderForgePreview() {
        const previewContainer = document.getElementById('forge-item-preview');
        const item = this.selectedForgeItem;
        if (!previewContainer || !item) return;

        const curLvl = item.upgradeLevel || 0;
        const isMax = curLvl >= 10;
        const cost = this.blacksmith.getUpgradeCost(item);
        const chance = this.blacksmith.getSuccessChance(curLvl);
        const chancePct = Math.round(chance * 100);

        const curOre = this.state.resources[ResourceType.ORE] || 0;
        const curGold = this.state.resources[ResourceType.GOLD] || 0;
        const canAfford = cost && curOre >= cost.ore && curGold >= cost.gold;

        let statDisplay = '';
        if (item.baseDamage) {
            const nextDmg = Math.round(item.baseDamage * (1 + (curLvl + 1) * 0.10));
            statDisplay = `
                <div class="forge-stat-row">
                    <span>Dano da Lâmina:</span>
                    <strong>${item.effectiveDamage} ${!isMax ? `<span class="stat-next">→ ${nextDmg} (+10%)</span>` : '<span class="stat-max">(Máx)</span>'}</strong>
                </div>
            `;
        } else if (item.armor) {
            const nextArm = Math.round(item.armor * (1 + (curLvl + 1) * 0.10));
            statDisplay = `
                <div class="forge-stat-row">
                    <span>Proteção de Armadura:</span>
                    <strong>${item.effectiveArmor} ${!isMax ? `<span class="stat-next">→ ${nextArm} (+10%)</span>` : '<span class="stat-max">(Máx)</span>'}</strong>
                </div>
            `;
        }

        previewContainer.innerHTML = `
            <div class="forge-card rarity-${item.rarity}">
                <div class="forge-card-header">
                    <span class="forge-item-name font-cinzel">${item.displayName}</span>
                    <span class="forge-item-level-tag">Têmpera: +${curLvl} / +10</span>
                </div>
                <div class="forge-card-body">
                    ${statDisplay}
                    <div class="forge-stat-row">
                        <span>Raridade:</span>
                        <span class="rarity-badge rarity-${item.rarity}">${item.rarity.toUpperCase()}</span>
                    </div>
                </div>

                ${!isMax ? `
                    <div class="forge-upgrade-meta">
                        <div class="forge-cost-block">
                            <span class="meta-label">Custo da Têmpera:</span>
                            <div class="cost-badges">
                                <span class="cost-badge ${curOre >= cost.ore ? 'cost-met' : 'cost-unmet'}">
                                    <span class="rune-icon">🜛</span> ${cost.ore} Minério (${curOre})
                                </span>
                                <span class="cost-badge ${curGold >= cost.gold ? 'cost-met' : 'cost-unmet'}">
                                    <span class="rune-icon">🜚</span> ${cost.gold} Ouro (${curGold})
                                </span>
                            </div>
                        </div>
                        <div class="forge-chance-block">
                            <span class="meta-label">Taxa de Sucesso:</span>
                            <span class="chance-tag ${chancePct >= 70 ? 'chance-high' : chancePct >= 40 ? 'chance-mid' : 'chance-low'}">
                                ${chancePct}% ${curLvl < 3 ? '(Garantido)' : ''}
                            </span>
                        </div>
                        <p class="forge-safety-note text-muted">
                            <span class="rune-icon">ᛏ</span> Em caso de falha, apenas as matérias são consumidas. O item nunca se rompe.
                        </p>
                    </div>
                    <button class="btn-gothic btn-gothic-primary btn-lg btn-forge-upgrade" id="btn-forge-upgrade-action" ${!canAfford ? 'disabled' : ''}>
                        <span class="rune-icon">🜛</span> Forjar Têmpera (+${curLvl + 1})
                    </button>
                ` : `
                    <div class="forge-max-box">
                        <span class="rune-icon">ᛟ</span> Esta relíquia alcançou a têmpera máxima (+10).
                    </div>
                `}
            </div>
        `;

        const btnUpgrade = document.getElementById('btn-forge-upgrade-action');
        if (btnUpgrade) {
            btnUpgrade.onclick = () => {
                this.blacksmith.upgradeItem(item.id);
            };
        }
    }

    renderMarketAndForgeCosts() {
        if (this.selectedForgeItem) {
            this.renderForgePreview();
        }
        this.renderMarket();
    }

    // ═══════════════════════════════════════════
    //  O CALDEIRÃO ALQUÍMICO (ALCHEMY)
    // ═══════════════════════════════════════════

    renderAlchemy() {
        const container = document.getElementById('alchemy-recipes-list');
        const beltSlot1 = document.getElementById('belt-slot-1-select');
        const beltSlot2 = document.getElementById('belt-slot-2-select');
        if (!container) return;

        container.innerHTML = '';
        const recipes = Object.values(ELIXIR_DEFINITIONS || {});

        recipes.forEach(rec => {
            const count = (this.state.potions && this.state.potions[rec.id]) || 0;
            const card = document.createElement('div');
            card.className = 'alchemy-recipe-card';

            const canAfford = this.alchemy.canCraft(rec.id, 1);
            const costBadges = Object.entries(rec.cost).map(([resType, amt]) => {
                const cur = this.state.resources[resType] || 0;
                const meta = RESOURCE_META[resType] || { label: resType, icon: '🜛' };
                const met = cur >= amt;
                return `<span class="cost-badge ${met ? 'cost-met' : 'cost-unmet'}">
                    <span class="rune-icon">${meta.icon}</span> ${amt} ${meta.label} (${cur})
                </span>`;
            }).join(' ');

            card.innerHTML = `
                <div class="recipe-header">
                    <span class="recipe-icon rune-icon">${rec.icon}</span>
                    <div class="recipe-title-group">
                        <h4 class="recipe-name font-cinzel">${rec.name}</h4>
                        <span class="recipe-effect">${rec.desc}</span>
                    </div>
                    <div class="recipe-stock-badge">
                        Algibeira: <strong>${count}</strong>
                    </div>
                </div>
                <div class="recipe-footer">
                    <div class="recipe-cost">
                        ${costBadges}
                    </div>
                    <div class="recipe-actions">
                        <button class="btn-gothic btn-gothic-primary btn-sm btn-brew" data-potion="${rec.id}" ${!canAfford ? 'disabled' : ''}>
                            <span class="rune-icon">🜛</span> Destilar (1x)
                        </button>
                    </div>
                </div>
            `;

            card.querySelector('.btn-brew').addEventListener('click', () => {
                const res = this.alchemy.craftPotion(rec.id, 1);
                if (res.success) {
                    this.uiManager?.notify?.(`Destilado: ${rec.name}`, 'success');
                } else {
                    this.uiManager?.notify?.(res.reason, 'warning');
                }
            });

            container.appendChild(card);
        });

        // Belt Slot Selectors
        if (beltSlot1 && beltSlot2) {
            [beltSlot1, beltSlot2].forEach((sel, slotIdx) => {
                sel.innerHTML = '<option value="">(Nenhum tônico equipado)</option>';
                recipes.forEach(rec => {
                    const opt = document.createElement('option');
                    opt.value = rec.id;
                    const stock = (this.state.potions && this.state.potions[rec.id]) || 0;
                    opt.textContent = `${rec.name} (${stock} un.)`;
                    if (this.state.potionBelt && this.state.potionBelt[slotIdx] === rec.id) {
                        opt.selected = true;
                    }
                    sel.appendChild(opt);
                });

                sel.onchange = (e) => {
                    this.alchemy.assignBeltSlot(slotIdx, e.target.value);
                    this.renderDungeonPotionBelt();
                };
            });
        }
    }

    // ═══════════════════════════════════════════
    //  A FEIRA DAS CINZAS (MARKET & BARTER)
    // ═══════════════════════════════════════════

    renderMarket() {
        const barterContainer = document.getElementById('market-barter-list');
        const merchantContainer = document.getElementById('market-provisions-list');
        if (!barterContainer || !merchantContainer) return;

        // Render Barter Rates
        barterContainer.innerHTML = '';
        const rates = Object.values(BARTER_RATES || {});
        rates.forEach(rate => {
            const card = document.createElement('div');
            card.className = 'barter-card';

            const fromMeta = RESOURCE_META[rate.from];
            const toMeta = RESOURCE_META[rate.to];
            const curFrom = this.state.resources[rate.from] || 0;

            const can1x = curFrom >= rate.fromAmount;
            const can10x = curFrom >= rate.fromAmount * 10;

            card.innerHTML = `
                <div class="barter-flow">
                    <span class="barter-unit">
                        <span class="rune-icon">${fromMeta ? fromMeta.icon : ''}</span> ${rate.fromAmount} ${fromMeta ? fromMeta.label : rate.from}
                    </span>
                    <span class="barter-arrow">→</span>
                    <span class="barter-unit">
                        <span class="rune-icon">${toMeta ? toMeta.icon : ''}</span> ${rate.toAmount} ${toMeta ? toMeta.label : rate.to}
                    </span>
                </div>
                <div class="barter-actions">
                    <button class="btn-gothic btn-gothic-secondary btn-sm" data-barter-id="${rate.id}" data-times="1" ${!can1x ? 'disabled' : ''}>
                        Permutar 1x
                    </button>
                    <button class="btn-gothic btn-gothic-primary btn-sm" data-barter-id="${rate.id}" data-times="10" ${!can10x ? 'disabled' : ''}>
                        Permutar 10x
                    </button>
                </div>
            `;

            card.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', () => {
                    const times = parseInt(btn.dataset.times, 10);
                    const res = this.market.barter(rate.id, times);
                    if (res.success) {
                        this.renderMarket();
                    } else {
                        this.uiManager?.notify?.(res.reason, 'warning');
                    }
                });
            });

            barterContainer.appendChild(card);
        });

        // Render Merchant Provisions
        merchantContainer.innerHTML = '';
        const provs = Object.values(MARKET_PROVISIONS || {});
        const curGold = this.state.resources[ResourceType.GOLD] || 0;

        provs.forEach(prov => {
            const card = document.createElement('div');
            card.className = 'merchant-card';

            let stockText = '';
            let canBuy = curGold >= prov.goldCost;

            if (prov.id === 'key' || prov.id === 'rift_key') {
                stockText = `Chaves atuais: <strong>${this.state.dungeonKeys}</strong> (Ilimitado)`;
            } else {
                const stock = (this.state.marketStock && this.state.marketStock[prov.id]) ?? prov.maxStock;
                stockText = `Estoque disponível: <strong>${stock} / ${prov.maxStock}</strong>`;
                if (stock <= 0) canBuy = false;
            }

            card.innerHTML = `
                <div class="merchant-header">
                    <span class="merchant-icon rune-icon">${prov.icon}</span>
                    <div class="merchant-title-group">
                        <h4 class="merchant-name font-cinzel">${prov.name}</h4>
                        <span class="merchant-desc">${prov.desc}</span>
                    </div>
                </div>
                <div class="merchant-footer">
                    <div class="merchant-stock-info">${stockText}</div>
                    <button class="btn-gothic btn-gothic-primary btn-sm btn-buy-prov" ${!canBuy ? 'disabled' : ''}>
                        <span class="rune-icon">🜚</span> ${prov.goldCost} Ouro
                    </button>
                </div>
            `;

            card.querySelector('.btn-buy-prov').addEventListener('click', () => {
                if (prov.id === 'key' || prov.id === 'rift_key') {
                    const res = this.market.buyRiftKey(1);
                    if (!res.success) this.uiManager?.notify?.(res.reason, 'warning');
                } else {
                    const res = this.market.buyReagent(prov.id, 1);
                    if (!res.success) this.uiManager?.notify?.(res.reason, 'warning');
                }
            });

            merchantContainer.appendChild(card);
        });

        const btnRestock = document.getElementById('btn-restock-market');
        if (btnRestock) {
            btnRestock.onclick = () => {
                const res = this.market.restock(50);
                if (res.success) {
                    this.uiManager?.notify?.('Estoque das provisões renovado pelas caravanas.', 'success');
                } else {
                    this.uiManager?.notify?.(res.reason, 'warning');
                }
            };
        }
    }

    // ═══════════════════════════════════════════
    //  O QUADRO DE EDITAIS (BOUNTIES)
    // ═══════════════════════════════════════════

    renderBounties() {
        const container = document.getElementById('bounties-list');
        if (!container) return;

        container.innerHTML = '';
        const bounties = this.state.bounties || [];

        bounties.forEach((bounty, idx) => {
            if (!bounty) return;

            const card = document.createElement('div');
            card.className = `bounty-card bounty-type-${bounty.type} ${bounty.completed ? 'bounty-completed' : ''} ${bounty.claimed ? 'bounty-claimed' : ''}`;

            const pct = Math.min(100, Math.round((bounty.currentCount / bounty.targetCount) * 100));

            // Reward strings
            const rewList = [];
            if (bounty.reward.gold) rewList.push(`<span class="cost-badge"><span class="rune-icon">🜚</span> ${bounty.reward.gold} Ouro</span>`);
            if (bounty.reward.xp) rewList.push(`<span class="cost-badge"><span class="rune-icon">ᛉ</span> ${bounty.reward.xp} XP</span>`);
            if (bounty.reward.keys) rewList.push(`<span class="cost-badge"><span class="rune-icon">⚿</span> ${bounty.reward.keys} Chave</span>`);
            if (bounty.reward.ashes) rewList.push(`<span class="cost-badge"><span class="rune-icon">🜂</span> ${bounty.reward.ashes} Cinzas</span>`);

            let actionHtml = '';
            if (bounty.claimed) {
                actionHtml = `
                    <div class="bounty-cooldown-box">
                        <span class="cooldown-badge" id="bounty-cd-${idx}">Novo edital em: ${Math.ceil(bounty.cooldownRemaining || 0)}s</span>
                        <button class="btn-gothic btn-gothic-secondary btn-sm btn-fast-refresh" data-slot="${idx}">
                            <span class="rune-icon">🜚</span> Apressar (20 Ouro)
                        </button>
                    </div>
                `;
            } else if (bounty.completed) {
                actionHtml = `
                    <button class="btn-gothic btn-gothic-primary btn-claim-bounty" data-slot="${idx}">
                        <span class="rune-icon">ᛏ</span> Resgatar Recompensas
                    </button>
                `;
            } else {
                actionHtml = `
                    <button class="btn-gothic btn-gothic-secondary btn-sm btn-reroll-bounty" data-slot="${idx}">
                        <span class="rune-icon">🜚</span> Revogar (25 Ouro)
                    </button>
                `;
            }

            card.innerHTML = `
                <div class="bounty-header">
                    <span class="bounty-icon rune-icon">${bounty.icon}</span>
                    <div class="bounty-title-group">
                        <div class="bounty-type-tag">${bounty.type.toUpperCase()}</div>
                        <h4 class="bounty-title font-cinzel">${bounty.title}</h4>
                    </div>
                </div>
                <p class="bounty-desc">${bounty.desc}</p>

                <div class="bounty-progress-block">
                    <div class="bounty-bar-wrapper">
                        <div class="bounty-bar-fill" style="width: ${pct}%"></div>
                    </div>
                    <span class="bounty-count">${bounty.currentCount} / ${bounty.targetCount}</span>
                </div>

                <div class="bounty-rewards">
                    <span class="rewards-label">Tributo:</span>
                    <div class="rewards-items">${rewList.join(' ')}</div>
                </div>

                <div class="bounty-actions">
                    ${actionHtml}
                </div>
            `;

            // Event bindings
            const btnClaim = card.querySelector('.btn-claim-bounty');
            if (btnClaim) {
                btnClaim.addEventListener('click', () => {
                    this.bounties.claimBounty(idx);
                });
            }

            const btnReroll = card.querySelector('.btn-reroll-bounty');
            if (btnReroll) {
                btnReroll.addEventListener('click', () => {
                    const res = this.bounties.rerollBounty(idx);
                    if (!res.success) this.uiManager?.notify?.(res.reason, 'warning');
                });
            }

            const btnFastRefresh = card.querySelector('.btn-fast-refresh');
            if (btnFastRefresh) {
                btnFastRefresh.addEventListener('click', () => {
                    const res = this.bounties.fastRefreshSlot(idx);
                    if (!res.success) this.uiManager?.notify?.(res.reason, 'warning');
                });
            }

            container.appendChild(card);
        });
    }

    // ═══════════════════════════════════════════
    //  CINTO DE TÔNICOS NA MASMORRA (KEYS 1 & 2)
    // ═══════════════════════════════════════════

    renderDungeonPotionBelt() {
        const beltContainer = document.getElementById('dungeon-potion-belt');
        if (!beltContainer) return;

        beltContainer.innerHTML = '';
        const belt = this.state.potionBelt || [];

        [0, 1].forEach(slotIdx => {
            const potId = belt[slotIdx];
            const def = ELIXIR_DEFINITIONS[potId];
            const count = (this.state.potions && potId && this.state.potions[potId]) || 0;
            const cd = (this.alchemy.cooldowns && potId && this.alchemy.cooldowns[potId]) || 0;

            const slotEl = document.createElement('div');
            slotEl.className = `belt-slot ${!def ? 'belt-empty' : ''} ${cd > 0 ? 'belt-on-cooldown' : ''}`;
            slotEl.title = def ? `${def.name} (Tecla ${slotIdx + 1})` : `Slot Vazio (Tecla ${slotIdx + 1})`;

            slotEl.innerHTML = `
                <div class="belt-key-tag font-cinzel">[${slotIdx + 1}]</div>
                <span class="belt-icon rune-icon">${def ? def.icon : '†'}</span>
                <span class="belt-count ${count === 0 ? 'zero-stock' : ''}">${def ? count : '—'}</span>
                ${cd > 0 ? `<div class="belt-cd-overlay">${Math.ceil(cd)}s</div>` : ''}
            `;

            slotEl.addEventListener('click', () => {
                this.alchemy.useBeltSlot(slotIdx);
            });

            beltContainer.appendChild(slotEl);
        });

        this.renderDungeonBuffs();
    }

    renderDungeonBuffs() {
        const buffContainer = document.getElementById('dungeon-active-buffs');
        if (!buffContainer) return;

        const buffs = this.state.activeBuffs || {};
        const activeKeys = Object.keys(buffs);

        if (activeKeys.length === 0) {
            buffContainer.innerHTML = '';
            return;
        }

        buffContainer.innerHTML = '';
        activeKeys.forEach(k => {
            const b = buffs[k];
            const def = ELIXIR_DEFINITIONS[k];
            if (!b || b.duration <= 0) return;

            const badge = document.createElement('div');
            badge.className = 'active-buff-badge';
            badge.title = `${def ? def.name : k}: ${Math.ceil(b.duration)}s restantes`;

            badge.innerHTML = `
                <span class="rune-icon">${def ? def.icon : '🜛'}</span>
                <span class="buff-timer">${Math.ceil(b.duration)}s</span>
            `;

            buffContainer.appendChild(badge);
        });
    }
}

// Export for browser
window.CampServicesUI = CampServicesUI;
