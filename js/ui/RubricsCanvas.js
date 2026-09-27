/**
 * ============================================
 *  RUBRICS ASTRAL CANVAS ENGINE
 *  Path of Exile-inspired Interactive Constellation
 *  Web for Post-Level 40 Progression.
 *  Handles Zoom, Pan, Particle Ambience, Node
 *  Visual States, Tooltips, and Real-Time Allocation.
 * ============================================
 */

class RubricsCanvas {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {Character} character
     * @param {Function} [onNodeAllocated=null] - callback(nodeId)
     */
    constructor(canvas, characterOrState, onNodeAllocated = null) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.character = (characterOrState && characterOrState.character) ? characterOrState.character : characterOrState;
        this.state = (characterOrState && characterOrState.character) ? characterOrState : (typeof gameState !== 'undefined' ? gameState : null);
        this.onNodeAllocated = onNodeAllocated;

        // Viewport Transform
        this.scale = 0.9;
        this.minScale = 0.45;
        this.maxScale = 2.2;
        this.offsetX = 0;
        this.offsetY = 0;

        // Dragging State
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Hovered Node
        this.hoveredNodeId = null;

        // Ambient Nebula Particles
        this.nebulaStars = [];
        this._initStars(90);

        // Visual Pulse & Animation Timer
        this.animTimer = 0;
        this.animId = null;
        this.isRunning = false;

        // Particle Burst Effects (upon node allocation)
        this.burstParticles = [];

        // Tooltip container
        this.tooltipEl = document.getElementById('rubrics-tooltip');

        this._bindEvents();
        this.centerOnClassOrigin();
    }

    _initStars(count) {
        this.nebulaStars = [];
        for (let i = 0; i < count; i++) {
            this.nebulaStars.push({
                x: (Math.random() - 0.2) * 1600,
                y: (Math.random() - 0.2) * 1600,
                radius: 0.8 + Math.random() * 2.2,
                alpha: 0.15 + Math.random() * 0.7,
                twinkleSpeed: 0.015 + Math.random() * 0.03,
                twinklePhase: Math.random() * Math.PI * 2,
                color: Math.random() > 0.4 ? '#f6d396' : (Math.random() > 0.5 ? '#93c5fd' : '#c084fc'),
            });
        }
    }

    _bindEvents() {
        this._onMouseDown = this._handleMouseDown.bind(this);
        this._onMouseMove = this._handleMouseMove.bind(this);
        this._onMouseUp = this._handleMouseUp.bind(this);
        this._onWheel = this._handleWheel.bind(this);
        this._onResize = this.resize.bind(this);

        this.canvas.addEventListener('mousedown', this._onMouseDown);
        window.addEventListener('mousemove', this._onMouseMove);
        window.addEventListener('mouseup', this._onMouseUp);
        this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
        window.addEventListener('resize', this._onResize);

        // Touch support
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                const rect = this.canvas.getBoundingClientRect();
                this._handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY, button: 0 });
            }
        });
        window.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1 && this.isDragging) {
                const touch = e.touches[0];
                this._handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
            }
        });
        window.addEventListener('touchend', () => {
            this._handleMouseUp({ button: 0 });
        });
    }

    destroy() {
        this.stop();
        this.canvas.removeEventListener('mousedown', this._onMouseDown);
        window.removeEventListener('mousemove', this._onMouseMove);
        window.removeEventListener('mouseup', this._onMouseUp);
        this.canvas.removeEventListener('wheel', this._onWheel);
        window.removeEventListener('resize', this._onResize);
        if (this.tooltipEl) {
            this.tooltipEl.style.display = 'none';
        }
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width || 800;
        this.canvas.height = rect.height || 600;
    }

    start() {
        this.resize();
        this.isRunning = true;
        const loop = () => {
            if (!this.isRunning) return;
            this.animTimer += 0.03;
            this.render();
            this.animId = requestAnimationFrame(loop);
        };
        this.animId = requestAnimationFrame(loop);
    }

    stop() {
        this.isRunning = false;
        if (this.animId) {
            cancelAnimationFrame(this.animId);
            this.animId = null;
        }
    }

    centerOnClassOrigin() {
        this.resize();
        const classId = this.character ? this.character.classId : 'barbarian';
        const originId = `origin_${classId === 'barbarian' ? 'barbarian' : classId === 'paladin' ? 'paladin' : classId === 'mage' ? 'mage' : 'necro'}`;
        const node = RUBRICS_CONSTELLATION[originId] || RUBRICS_CONSTELLATION['nexus_eye'];

        if (node) {
            this.offsetX = (this.canvas.width / 2) - (node.x * this.scale);
            this.offsetY = (this.canvas.height / 2) - (node.y * this.scale);
        }
    }

    zoom(delta, pivotX = this.canvas.width / 2, pivotY = this.canvas.height / 2) {
        const prevScale = this.scale;
        const newScale = Utils.clamp(this.scale + delta, this.minScale, this.maxScale);
        if (newScale === prevScale) return;

        // Zoom toward pivot point
        const worldX = (pivotX - this.offsetX) / prevScale;
        const worldY = (pivotY - this.offsetY) / prevScale;

        this.scale = newScale;
        this.offsetX = pivotX - worldX * this.scale;
        this.offsetY = pivotY - worldY * this.scale;
    }

    _handleMouseDown(e) {
        if (e.button !== 0) return;
        this.isDragging = true;
        this.dragStartX = e.clientX - this.offsetX;
        this.dragStartY = e.clientY - this.offsetY;
        this.draggedDistance = 0;
    }

    _handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        if (this.isDragging) {
            const dx = e.clientX - (this.dragStartX + this.offsetX);
            const dy = e.clientY - (this.dragStartY + this.offsetY);
            this.draggedDistance = (this.draggedDistance || 0) + Math.hypot(dx, dy);

            this.offsetX = e.clientX - this.dragStartX;
            this.offsetY = e.clientY - this.dragStartY;
        }

        // Hit test nodes for hover tooltip
        const worldPos = this.screenToWorld(mouseX, mouseY);
        let foundNodeId = null;

        for (const [id, node] of Object.entries(RUBRICS_CONSTELLATION)) {
            const nodeRadius = this._getNodeRadius(node);
            const dist = Math.hypot(worldPos.x - node.x, worldPos.y - node.y);
            if (dist <= nodeRadius + 5) {
                foundNodeId = id;
                break;
            }
        }

        if (foundNodeId !== this.hoveredNodeId) {
            this.hoveredNodeId = foundNodeId;
            this._updateTooltip(foundNodeId, e.clientX, e.clientY);
        } else if (foundNodeId && this.tooltipEl) {
            this._positionTooltip(e.clientX, e.clientY);
        }

        this.canvas.style.cursor = foundNodeId ? 'pointer' : (this.isDragging ? 'grabbing' : 'grab');
    }

    _handleMouseUp(e) {
        if (e.button !== 0) return;
        const wasClick = (this.draggedDistance || 0) < 6;
        this.isDragging = false;

        if (wasClick && this.hoveredNodeId) {
            this._attemptAllocate(this.hoveredNodeId);
        }
    }

    _handleWheel(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomDelta = e.deltaY < 0 ? 0.12 : -0.12;
        this.zoom(zoomDelta, mouseX, mouseY);
        this._updateTooltip(this.hoveredNodeId, e.clientX, e.clientY);
    }

    screenToWorld(sx, sy) {
        return {
            x: (sx - this.offsetX) / this.scale,
            y: (sy - this.offsetY) / this.scale,
        };
    }

    worldToScreen(wx, wy) {
        return {
            x: wx * this.scale + this.offsetX,
            y: wy * this.scale + this.offsetY,
        };
    }

    _attemptAllocate(nodeId) {
        if (!this.character) return;
        const canAlloc = this.character.canAllocateRubric(nodeId);

        if (canAlloc) {
            const res = this.character.allocateRubric(nodeId);
            if (res.success) {
                const node = RUBRICS_CONSTELLATION[nodeId];
                this._createEmberBurst(node.x, node.y);

                // Update toolbar counters
                const ptsEl = document.querySelector('.rubrics-points-value');
                if (ptsEl) ptsEl.textContent = this.character.unspentRubricPoints;
                const allocEl = document.querySelector('.rubrics-allocated-label strong');
                if (allocEl) allocEl.textContent = this.character.rubricsAllocated ? this.character.rubricsAllocated.length : 0;

                if (typeof uiManager !== 'undefined' && uiManager.notify) {
                    uiManager.notify(`✦ Rúbrica [${node.name}] gravada em sua alma!`, 'level');
                    if (uiManager.updateCharacterHUD) {
                        uiManager.updateCharacterHUD(this.character);
                    }
                }

                if (typeof this.onNodeAllocated === 'function') {
                    this.onNodeAllocated(nodeId);
                }
                this._updateTooltip(nodeId);
            }
        } else if (this.character.rubricsAllocated && this.character.rubricsAllocated.includes(nodeId)) {
            // Already allocated
        } else {
            // Reason why cannot allocate
            if (this.character.unspentRubricPoints <= 0) {
                if (typeof uiManager !== 'undefined' && uiManager.notify) {
                    uiManager.notify('Sem Pontos de Rúbrica disponíveis. Penitência adicional necessária.', 'warning');
                }
            } else {
                if (typeof uiManager !== 'undefined' && uiManager.notify) {
                    uiManager.notify('Nó inalcançável. Conecte um nó vizinho adjacente primeiro.', 'warning');
                }
            }
        }
    }

    _createEmberBurst(wx, wy) {
        for (let i = 0; i < 28; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 40 + Math.random() * 120;
            this.burstParticles.push({
                x: wx,
                y: wy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 1.5 + Math.random() * 3.5,
                color: Math.random() > 0.3 ? '#f59e0b' : '#ef4444',
                alpha: 1.0,
                lifetime: 0.6 + Math.random() * 0.5,
                maxLife: 0.6 + Math.random() * 0.5,
            });
        }
    }

    _getNodeRadius(node) {
        switch (node.type) {
            case RubricNodeType.KEYSTONE:    return 30;
            case RubricNodeType.NOTABLE:     return 21;
            case RubricNodeType.ORIGIN:      return 24;
            case RubricNodeType.NEXUS:       return 26;
            case RubricNodeType.HYBRID:      return 18;
            case RubricNodeType.FUNDAMENTAL:
            default:                         return 14;
        }
    }

    _updateTooltip(nodeId, clientX = null, clientY = null) {
        if (!this.tooltipEl) return;
        if (!nodeId) {
            this.tooltipEl.style.display = 'none';
            return;
        }

        const node = RUBRICS_CONSTELLATION[nodeId];
        if (!node) {
            this.tooltipEl.style.display = 'none';
            return;
        }

        const isAllocated = this.character.rubricsAllocated && this.character.rubricsAllocated.includes(nodeId);
        const canAllocate = !isAllocated && this.character.canAllocateRubric(nodeId);

        let categoryLabel = 'Atributo Fundamental';
        let categoryColor = 'var(--text-secondary)';
        if (node.type === RubricNodeType.KEYSTONE) {
            categoryLabel = '✦ PEDRA ANGULAR ✦';
            categoryColor = '#f59e0b';
        } else if (node.type === RubricNodeType.NOTABLE) {
            categoryLabel = '★ ESPECIALIZAÇÃO NOTÁVEL';
            categoryColor = '#d97706';
        } else if (node.type === RubricNodeType.HYBRID) {
            categoryLabel = '☩ TRAVESSIA HÍBRIDA';
            categoryColor = '#a855f7';
        } else if (node.type === RubricNodeType.ORIGIN) {
            categoryLabel = 'ᛟ NASCENTE DE CLASSE';
            categoryColor = '#38bdf8';
        }

        let statusBadge = '';
        if (isAllocated) {
            statusBadge = '<span style="color:#22c55e; font-weight:700;">✓ RÚBRICA ATIVA</span>';
        } else if (canAllocate) {
            statusBadge = '<span style="color:#f59e0b; font-weight:700;">✦ DESBLOQUEÁVEL (1 Ponto)</span>';
        } else {
            statusBadge = '<span style="color:#71717a;">🔒 NÓ INALCANÇÁVEL</span>';
        }

        let html = `
            <div class="rubric-tooltip-header">
                <span class="rune-icon" style="font-size: 1.3rem; color: ${categoryColor};">${node.icon || 'ᛟ'}</span>
                <div>
                    <h4 style="margin: 0; font-family: var(--font-display); font-size: 0.96rem; color: #f3ece1;">${node.name}</h4>
                    <span style="font-size: 0.72rem; letter-spacing: 1px; color: ${categoryColor}; text-transform: uppercase;">${categoryLabel}</span>
                </div>
            </div>
            <p style="margin: 8px 0; font-size: 0.82rem; color: #dfcaa2; line-height: 1.4;">${node.desc}</p>
            <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; font-size: 0.74rem;">
                ${statusBadge}
                <span style="color: var(--text-muted);">Custo: 1 Ponto</span>
            </div>
        `;

        this.tooltipEl.innerHTML = html;
        this.tooltipEl.style.display = 'block';

        if (clientX !== null && clientY !== null) {
            this._positionTooltip(clientX, clientY);
        }
    }

    _positionTooltip(clientX, clientY) {
        if (!this.tooltipEl) return;
        const tw = this.tooltipEl.offsetWidth || 260;
        const th = this.tooltipEl.offsetHeight || 140;

        let left = clientX + 18;
        let top = clientY + 18;

        if (left + tw > window.innerWidth - 16) {
            left = clientX - tw - 18;
        }
        if (top + th > window.innerHeight - 16) {
            top = clientY - th - 18;
        }

        this.tooltipEl.style.left = `${left}px`;
        this.tooltipEl.style.top = `${top}px`;
    }

    // ═══════════════════════════════════════════
    //  RENDER LOOP
    // ═══════════════════════════════════════════
    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.clearRect(0, 0, w, h);

        // 1. Deep Space Cosmic Background
        const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, Math.max(w, h));
        bgGrad.addColorStop(0, '#0c0a0f');
        bgGrad.addColorStop(0.6, '#080709');
        bgGrad.addColorStop(1, '#030204');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        // 2. Nebula Soft Glowing Dust (Cosmic Clouds)
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const nebula1 = ctx.createRadialGradient(
            this.offsetX + 700 * this.scale,
            this.offsetY + 700 * this.scale,
            0,
            this.offsetX + 700 * this.scale,
            this.offsetY + 700 * this.scale,
            550 * this.scale
        );
        nebula1.addColorStop(0, 'rgba(120, 50, 20, 0.22)');
        nebula1.addColorStop(0.5, 'rgba(80, 20, 40, 0.12)');
        nebula1.addColorStop(1, 'transparent');
        ctx.fillStyle = nebula1;
        ctx.fillRect(0, 0, w, h);

        const nebula2 = ctx.createRadialGradient(
            this.offsetX + 850 * this.scale,
            this.offsetY + 550 * this.scale,
            0,
            this.offsetX + 850 * this.scale,
            this.offsetY + 550 * this.scale,
            400 * this.scale
        );
        nebula2.addColorStop(0, 'rgba(30, 60, 140, 0.18)');
        nebula2.addColorStop(0.7, 'transparent');
        ctx.fillStyle = nebula2;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();

        // 3. Stars (Parallaxed softly)
        ctx.save();
        for (const star of this.nebulaStars) {
            const sx = star.x * this.scale + this.offsetX * 0.4;
            const sy = star.y * this.scale + this.offsetY * 0.4;
            const flicker = Math.sin(this.animTimer + star.twinklePhase) * 0.3 + 0.7;

            ctx.fillStyle = star.color;
            ctx.globalAlpha = star.alpha * flicker;
            ctx.beginPath();
            ctx.arc(
                ((sx % (w + 200)) + (w + 200)) % (w + 200) - 100,
                ((sy % (h + 200)) + (h + 200)) % (h + 200) - 100,
                star.radius,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
        ctx.restore();

        // 4. Transform Context for Constellation Space
        ctx.save();
        ctx.translate(this.offsetX, this.offsetY);
        ctx.scale(this.scale, this.scale);

        // 5. Draw Constellation Filaments
        this._drawFilaments(ctx);

        // 6. Draw Nodes
        this._drawNodes(ctx);

        // 7. Draw Burst Particles
        this._drawBurstParticles(ctx);

        ctx.restore();
    }

    _drawFilaments(ctx) {
        const allocated = this.character ? (this.character.rubricsAllocated || []) : [];
        const drawnEdges = new Set();

        for (const [id, node] of Object.entries(RUBRICS_CONSTELLATION)) {
            const isNodeAllocated = allocated.includes(id);

            for (const targetId of (node.connections || [])) {
                const target = RUBRICS_CONSTELLATION[targetId];
                if (!target) continue;

                // Deduplicate bi-directional edges
                const edgeKey = [id, targetId].sort().join('___');
                if (drawnEdges.has(edgeKey)) continue;
                drawnEdges.add(edgeKey);

                const isTargetAllocated = allocated.includes(targetId);
                const isEdgeActive = isNodeAllocated && isTargetAllocated;
                const isEdgeUnlockable = (isNodeAllocated && !isTargetAllocated) || (!isNodeAllocated && isTargetAllocated);

                ctx.beginPath();
                ctx.moveTo(node.x, node.y);
                ctx.lineTo(target.x, target.y);

                if (isEdgeActive) {
                    // Burning ember filament
                    ctx.strokeStyle = '#e8933a';
                    ctx.lineWidth = 3.5;
                    ctx.shadowColor = 'rgba(232, 147, 58, 0.7)';
                    ctx.shadowBlur = 10;
                    ctx.stroke();

                    // Inner bright core
                    ctx.strokeStyle = '#fff1d6';
                    ctx.lineWidth = 1.2;
                    ctx.shadowBlur = 0;
                    ctx.stroke();
                } else if (isEdgeUnlockable) {
                    // Pulsing path to reachable node
                    const pulse = Math.sin(this.animTimer * 2.5) * 0.25 + 0.75;
                    ctx.strokeStyle = `rgba(180, 130, 50, ${0.45 * pulse})`;
                    ctx.lineWidth = 2.0;
                    ctx.shadowColor = 'rgba(180, 130, 50, 0.3)';
                    ctx.shadowBlur = 5;
                    ctx.stroke();
                } else {
                    // Dark metallic filament
                    ctx.strokeStyle = 'rgba(50, 44, 55, 0.7)';
                    ctx.lineWidth = 1.5;
                    ctx.shadowBlur = 0;
                    ctx.stroke();
                }
            }
        }
        ctx.shadowBlur = 0;
    }

    _drawNodes(ctx) {
        const allocated = this.character ? (this.character.rubricsAllocated || []) : [];

        for (const [id, node] of Object.entries(RUBRICS_CONSTELLATION)) {
            const isAllocated = allocated.includes(id);
            const canAllocate = !isAllocated && this.character.canAllocateRubric(nodeIdToKey(id));
            const isHovered = (this.hoveredNodeId === id);
            const radius = this._getNodeRadius(node);

            ctx.save();
            ctx.translate(node.x, node.y);

            // Halo glow for allocated or unlockable
            if (isAllocated) {
                const glowGrad = ctx.createRadialGradient(0, 0, radius * 0.5, 0, 0, radius * 2.4);
                glowGrad.addColorStop(0, 'rgba(232, 147, 58, 0.5)');
                glowGrad.addColorStop(0.6, 'rgba(217, 119, 6, 0.2)');
                glowGrad.addColorStop(1, 'transparent');
                ctx.fillStyle = glowGrad;
                ctx.beginPath();
                ctx.arc(0, 0, radius * 2.4, 0, Math.PI * 2);
                ctx.fill();
            } else if (canAllocate) {
                const pulse = Math.sin(this.animTimer * 3) * 0.3 + 0.7;
                const glowGrad = ctx.createRadialGradient(0, 0, radius * 0.4, 0, 0, radius * 1.8);
                glowGrad.addColorStop(0, `rgba(245, 158, 11, ${0.4 * pulse})`);
                glowGrad.addColorStop(1, 'transparent');
                ctx.fillStyle = glowGrad;
                ctx.beginPath();
                ctx.arc(0, 0, radius * 1.8, 0, Math.PI * 2);
                ctx.fill();
            }

            // Outer Heraldic Border based on Type
            ctx.beginPath();
            if (node.type === RubricNodeType.KEYSTONE) {
                // Octagonal border for keystones
                this._drawPolygon(ctx, 0, 0, radius + 4, 8);
            } else if (node.type === RubricNodeType.NOTABLE) {
                // Diamond/Hexagonal border for notables
                this._drawPolygon(ctx, 0, 0, radius + 3, 6);
            } else {
                ctx.arc(0, 0, radius, 0, Math.PI * 2);
            }

            // Node Body Fill
            if (isAllocated) {
                // Incandescent Ember Core
                const coreGrad = ctx.createRadialGradient(0, -radius * 0.3, 0, 0, 0, radius);
                coreGrad.addColorStop(0, '#fef3c7');
                coreGrad.addColorStop(0.3, '#f59e0b');
                coreGrad.addColorStop(0.7, '#b45309');
                coreGrad.addColorStop(1, '#451a03');
                ctx.fillStyle = coreGrad;
                ctx.fill();

                ctx.lineWidth = 2.5;
                ctx.strokeStyle = '#fef08a';
                ctx.shadowColor = '#e8933a';
                ctx.shadowBlur = 12;
                ctx.stroke();
            } else if (canAllocate) {
                // Reachable: gentle warm gold border & dark core
                const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
                coreGrad.addColorStop(0, '#261a0d');
                coreGrad.addColorStop(1, '#110b06');
                ctx.fillStyle = coreGrad;
                ctx.fill();

                ctx.lineWidth = 2.0;
                ctx.strokeStyle = '#d97706';
                ctx.shadowColor = '#f59e0b';
                ctx.shadowBlur = 8;
                ctx.stroke();
            } else {
                // Inaccessible: dark iron slate
                ctx.fillStyle = '#141217';
                ctx.fill();

                ctx.lineWidth = 1.4;
                ctx.strokeStyle = '#352e3b';
                ctx.shadowBlur = 0;
                ctx.stroke();
            }

            // Draw Inner Icon / Rune
            ctx.shadowBlur = 0;
            ctx.font = `${Math.floor(radius * 0.95)}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (isAllocated) {
                ctx.fillStyle = '#fffbeb';
            } else if (canAllocate) {
                ctx.fillStyle = '#dfcaa2';
            } else {
                ctx.fillStyle = '#554c5e';
            }
            ctx.fillText(node.icon || 'ᛟ', 0, 1);

            // Hover indicator ring
            if (isHovered) {
                ctx.beginPath();
                ctx.arc(0, 0, radius + 6, 0, Math.PI * 2);
                ctx.lineWidth = 2;
                ctx.strokeStyle = isAllocated ? '#fff' : (canAllocate ? '#fbbf24' : '#9ca3af');
                ctx.stroke();
            }

            ctx.restore();
        }
    }

    _drawPolygon(ctx, x, y, radius, sides) {
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
            const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
            const px = x + radius * Math.cos(angle);
            const py = y + radius * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
    }

    _drawBurstParticles(ctx) {
        for (let i = this.burstParticles.length - 1; i >= 0; i--) {
            const p = this.burstParticles[i];
            p.x += p.vx * 0.016;
            p.y += p.vy * 0.016;
            p.lifetime -= 0.016;
            p.alpha = Math.max(0, p.lifetime / p.maxLife);

            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            if (p.lifetime <= 0) {
                this.burstParticles.splice(i, 1);
            }
        }
    }
}

function nodeIdToKey(id) {
    return id;
}

window.RubricsCanvas = RubricsCanvas;
