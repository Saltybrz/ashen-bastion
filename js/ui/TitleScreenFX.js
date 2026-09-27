/**
 * ============================================
 *  TITLE SCREEN CINEMATIC ENGINE
 *  Manages the particle system (ascending ashes
 *  & embers), canvas sizing, and fade-to-black
 *  transition for the Dark Souls-inspired
 *  title screen.
 * ============================================
 */

const TitleScreenFX = (() => {
    let canvas = null;
    let ctx = null;
    let particles = [];
    let animFrameId = null;
    let isRunning = false;

    const CONFIG = {
        // Particle pool size
        maxParticles: 120,
        // Spawn rate (particles per frame)
        spawnRate: 0.8,
        // Particle types
        types: {
            ash: {
                probability: 0.65,
                sizeMin: 1.0,
                sizeMax: 2.8,
                speedMin: 0.3,
                speedMax: 0.9,
                colors: [
                    'rgba(120, 110, 100, 0.6)',
                    'rgba(100, 92, 82, 0.5)',
                    'rgba(140, 130, 115, 0.4)',
                    'rgba(80, 75, 68, 0.55)',
                ],
                glowRadius: 0,
                lifetimeMin: 300,
                lifetimeMax: 600,
            },
            ember: {
                probability: 0.35,
                sizeMin: 1.2,
                sizeMax: 3.2,
                speedMin: 0.4,
                speedMax: 1.1,
                colors: [
                    'rgba(232, 147, 58, 0.8)',
                    'rgba(212, 120, 40, 0.75)',
                    'rgba(245, 170, 80, 0.7)',
                    'rgba(200, 100, 30, 0.65)',
                ],
                glowRadius: 8,
                glowColors: [
                    'rgba(232, 147, 58, 0.25)',
                    'rgba(212, 120, 40, 0.2)',
                    'rgba(245, 170, 80, 0.18)',
                ],
                lifetimeMin: 200,
                lifetimeMax: 450,
            }
        },
        // Wind oscillation
        windAmplitude: 0.8,
        windFrequency: 0.008,
    };

    /**
     * Create a single particle
     */
    function createParticle() {
        const isEmber = Math.random() > CONFIG.types.ash.probability;
        const type = isEmber ? CONFIG.types.ember : CONFIG.types.ash;

        const size = type.sizeMin + Math.random() * (type.sizeMax - type.sizeMin);
        const speed = type.speedMin + Math.random() * (type.speedMax - type.speedMin);
        const lifetime = type.lifetimeMin + Math.random() * (type.lifetimeMax - type.lifetimeMin);
        const color = type.colors[Math.floor(Math.random() * type.colors.length)];

        return {
            x: Math.random() * canvas.width,
            y: canvas.height + 10 + Math.random() * 40,
            size,
            baseSpeed: speed,
            speedY: -speed,
            speedX: 0,
            color,
            isEmber,
            glowRadius: type.glowRadius,
            glowColor: isEmber ? type.glowColors[Math.floor(Math.random() * type.glowColors.length)] : null,
            lifetime,
            age: 0,
            opacity: 0,
            maxOpacity: 0.3 + Math.random() * 0.7,
            windPhase: Math.random() * Math.PI * 2,
            wobbleAmplitude: 0.2 + Math.random() * 0.6,
            flickerSpeed: 0.02 + Math.random() * 0.03,
        };
    }

    /**
     * Update particle physics
     */
    function updateParticle(p) {
        p.age++;

        // Fade in during first 15% of life, fade out during last 25%
        const fadeInEnd = p.lifetime * 0.15;
        const fadeOutStart = p.lifetime * 0.75;

        if (p.age < fadeInEnd) {
            p.opacity = (p.age / fadeInEnd) * p.maxOpacity;
        } else if (p.age > fadeOutStart) {
            p.opacity = ((p.lifetime - p.age) / (p.lifetime - fadeOutStart)) * p.maxOpacity;
        } else {
            p.opacity = p.maxOpacity;
        }

        // Wind oscillation
        const wind = Math.sin(p.age * CONFIG.windFrequency + p.windPhase) * CONFIG.windAmplitude;
        p.speedX = wind * p.wobbleAmplitude;

        // Apply movement
        p.x += p.speedX;
        p.y += p.speedY;

        // Ember flicker
        if (p.isEmber) {
            p.size += Math.sin(p.age * p.flickerSpeed) * 0.05;
        }

        // Dead if too old or off-screen
        return p.age < p.lifetime && p.y > -20;
    }

    /**
     * Render a single particle
     */
    function renderParticle(p) {
        if (p.opacity <= 0) return;

        ctx.save();
        ctx.globalAlpha = p.opacity;

        // Ember glow
        if (p.isEmber && p.glowRadius > 0 && p.glowColor) {
            const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.glowRadius * (1 + Math.sin(p.age * 0.04) * 0.2));
            gradient.addColorStop(0, p.glowColor);
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.fillRect(p.x - p.glowRadius, p.y - p.glowRadius, p.glowRadius * 2, p.glowRadius * 2);
        }

        // Core dot
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    /**
     * Main animation loop
     */
    function animate() {
        if (!isRunning || !ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Spawn new particles
        for (let i = 0; i < CONFIG.spawnRate; i++) {
            if (particles.length < CONFIG.maxParticles && Math.random() < CONFIG.spawnRate) {
                particles.push(createParticle());
            }
        }

        // Update and render
        particles = particles.filter(p => {
            const alive = updateParticle(p);
            if (alive) renderParticle(p);
            return alive;
        });

        animFrameId = requestAnimationFrame(animate);
    }

    /**
     * Resize canvas to match viewport
     */
    function resize() {
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    /**
     * Initialize and start the particle system
     */
    function init() {
        canvas = document.getElementById('ts-particles');
        if (!canvas) return;

        ctx = canvas.getContext('2d');
        resize();

        window.addEventListener('resize', resize);

        isRunning = true;
        particles = [];
        animate();

        console.log('[TitleScreenFX] Cinematic particle system initialized.');
    }

    /**
     * Stop and clean up the particle system
     */
    function destroy() {
        isRunning = false;
        if (animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }
        particles = [];
        window.removeEventListener('resize', resize);
        console.log('[TitleScreenFX] Particle system destroyed.');
    }

    /**
     * Perform the fade-to-black transition, then call onComplete
     * @param {Function} onComplete
     */
    function fadeToBlack(onComplete) {
        const overlay = document.getElementById('ts-fade-overlay');
        if (!overlay) {
            if (onComplete) onComplete();
            return;
        }

        overlay.classList.add('active');

        // Wait for the CSS transition to finish (1.6s), then call back
        setTimeout(() => {
            destroy();
            if (onComplete) onComplete();
        }, 1700);
    }

    /**
     * Dynamically update particle density based on settings
     * @param {string} density - 'low', 'medium', 'high'
     */
    function setDensity(density) {
        CONFIG.maxParticles = (density === 'low' ? 40 : (density === 'medium' ? 80 : 130));
        CONFIG.spawnRate = (density === 'low' ? 0.35 : (density === 'medium' ? 0.6 : 0.85));
    }

    return { init, destroy, fadeToBlack, setDensity };
})();

// Expose globally
window.TitleScreenFX = TitleScreenFX;
