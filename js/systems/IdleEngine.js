/**
 * ============================================
 *  IDLE ENGINE
 *  Runs the gathering loop, worker automation,
 *  and ticks all nodes at a fixed interval.
 *  Continues running even while in dungeons.
 * ============================================
 */

class IdleEngine {
    constructor(state) {
        /** @type {StateManager} */
        this.state = state;
        this._idleInterval  = null;
        this._autoInterval  = null;
        this._saveInterval  = null;
        this._lastIdleTick  = performance.now();
        this._autoAccumulator = {};  // per-worker time accumulators

        console.log('[IdleEngine] Initialized.');
    }

    /**
     * Start all idle loops.
     */
    start() {
        this._lastIdleTick = performance.now();

        // ─── Primary Idle Loop (10 Hz — smooth progress bars) ───
        this._idleInterval = setInterval(() => {
            const now = performance.now();
            const dt  = (now - this._lastIdleTick) / 1000;
            this._lastIdleTick = now;
            this._tickNodes(dt);
        }, IDLE_TICK_MS);

        // ─── Automation Loop (1 Hz — worker gathering) ───
        this._autoInterval = setInterval(() => {
            this._tickWorkers();
        }, AUTO_TICK_MS);

        // ─── Auto-save ───
        this._saveInterval = setInterval(() => {
            this.state.save();
        }, SAVE_INTERVAL);

        console.log('[IdleEngine] Loops started.');
    }

    /**
     * Stop all loops.
     */
    stop() {
        clearInterval(this._idleInterval);
        clearInterval(this._autoInterval);
        clearInterval(this._saveInterval);
        console.log('[IdleEngine] Loops stopped.');
    }

    /**
     * Tick all gathering nodes by dt seconds.
     * Nodes that are being manually gathered will progress.
     */
    _tickNodes(dt) {
        for (const node of this.state.nodes) {
            if (!node.isGathering) continue;

            const speedMult = this.state.getGatherSpeedMultiplier(node.resourceType);
            const reward = node.tick(dt, speedMult);

            if (reward) {
                // Deliver resources
                this.state.addResource(reward.resource, reward.amount);

                // Award character Passive XP from gathering
                if (this.state.character) {
                    const leveled = this.state.character.addXP(reward.amount, 'passive');
                    if (leveled) {
                        this.state.emit('character:levelup', {
                            level: this.state.character.level,
                            source: 'passive',
                        });
                    }
                }

                // Rare drops
                for (const drop of reward.rareDrops) {
                    this.state.emit('node:raredrop', {
                        nodeId: node.id,
                        drop,
                    });
                }

                this.state.emit('node:gathered', {
                    nodeId: node.id,
                    resource: reward.resource,
                    amount: reward.amount,
                });

                // Mage class: auto-convert some resources to essence
                if (this.state.character?.idleBonus.type === 'essence_conversion') {
                    if (Math.random() < 0.15) {
                        this.state.addResource(ResourceType.ESSENCE, 1);
                    }
                }

                // Keep node.workers synchronized with worker counts
                let workerCount = 0;
                for (const wDef of WORKER_DEFINITIONS) {
                    if (wDef.nodeId === node.id || wDef.nodeId === 'all') {
                        workerCount += this.state.getWorkerCount(wDef.id);
                    }
                }
                node.workers = workerCount;

                // Automatic gathering loop: ONLY runs if node.workers > 0
                if (node.workers > 0) {
                    node.startGather();
                } else {
                    node.isGathering = false;
                    node.gatherProgress = 0;
                    node.gatherElapsed = 0;
                }
            }

            // Emit progress update (for UI progress bar)
            this.state.emit('node:progress', {
                nodeId: node.id,
                progress: node.gatherProgress,
                isGathering: node.isGathering,
            });
        }
    }

    /**
     * Tick workers — each worker gathers based on its interval.
     */
    _tickWorkers() {
        // Sync node.workers and trigger auto-gather if workers > 0 and idle
        for (const node of this.state.nodes) {
            let workerCount = 0;
            for (const wDef of WORKER_DEFINITIONS) {
                if (wDef.nodeId === node.id || wDef.nodeId === 'all') {
                    workerCount += this.state.getWorkerCount(wDef.id);
                }
            }
            node.workers = workerCount;
            if (node.workers > 0 && !node.isGathering) {
                node.startGather();
            }
        }

        for (const wDef of WORKER_DEFINITIONS) {
            const count = this.state.getWorkerCount(wDef.id);
            if (count <= 0) continue;

            // Initialize accumulator
            if (!this._autoAccumulator[wDef.id]) {
                this._autoAccumulator[wDef.id] = 0;
            }

            this._autoAccumulator[wDef.id] += 1; // +1 second

            if (this._autoAccumulator[wDef.id] >= wDef.gatherInterval) {
                this._autoAccumulator[wDef.id] = 0;

                const totalAmount = wDef.gatherAmount * count;

                if (wDef.nodeId === 'all') {
                    // Automaton: distribute to all node resource types
                    for (const nodeDef of NODE_DEFINITIONS) {
                        this.state.addResource(nodeDef.resourceType, totalAmount);
                    }
                } else {
                    const nodeDef = NODE_DEFINITIONS.find(n => n.id === wDef.nodeId);
                    if (nodeDef) {
                        this.state.addResource(nodeDef.resourceType, totalAmount);
                    }
                }

                this.state.emit('worker:gathered', {
                    workerId: wDef.id,
                    amount: totalAmount,
                });

                // Necromancer bonus: spirits also gather
                if (this.state.character?.idleBonus.type === 'auto_collect') {
                    // Extra 50% bonus for all auto-collect
                    const bonusAmount = Math.floor(totalAmount * 0.5);
                    if (bonusAmount > 0) {
                        if (wDef.nodeId === 'all') {
                            for (const nodeDef of NODE_DEFINITIONS) {
                                this.state.addResource(nodeDef.resourceType, bonusAmount);
                            }
                        } else {
                            const nodeDef = NODE_DEFINITIONS.find(n => n.id === wDef.nodeId);
                            if (nodeDef) {
                                this.state.addResource(nodeDef.resourceType, bonusAmount);
                            }
                        }
                    }
                }
            }
        }

        // ─── Passive XP Generation (Hub Idle rate/minute) ───
        if (this.state.character) {
            let totalWorkers = 0;
            for (const count of Object.values(this.state.workers)) {
                totalWorkers += (count || 0);
            }

            // Rate per minute: 15 base + 6 per active worker
            const xpPerMinute = 15 + (totalWorkers * 6);
            const xpPerSec = xpPerMinute / 60;
            this._passiveXPAccumulator = (this._passiveXPAccumulator || 0) + xpPerSec;

            if (this._passiveXPAccumulator >= 1) {
                const xpGain = Math.floor(this._passiveXPAccumulator);
                this._passiveXPAccumulator -= xpGain;
                const leveled = this.state.character.addXP(xpGain, 'passive');
                if (leveled) {
                    this.state.emit('character:levelup', {
                        level: this.state.character.level,
                        source: 'passive',
                    });
                }
            }
        }
    }

    /**
     * Get the total resources per second from all workers.
     */
    getAutomationRatesPerSecond() {
        const rates = {};
        for (const wDef of WORKER_DEFINITIONS) {
            const count = this.state.getWorkerCount(wDef.id);
            if (count <= 0) continue;
            const rps = (wDef.gatherAmount * count) / wDef.gatherInterval;

            if (wDef.nodeId === 'all') {
                for (const nodeDef of NODE_DEFINITIONS) {
                    rates[nodeDef.resourceType] = (rates[nodeDef.resourceType] || 0) + rps;
                }
            } else {
                const nodeDef = NODE_DEFINITIONS.find(n => n.id === wDef.nodeId);
                if (nodeDef) {
                    rates[nodeDef.resourceType] = (rates[nodeDef.resourceType] || 0) + rps;
                }
            }
        }
        return rates;
    }
}

console.log('[IdleEngine] Class loaded.');
