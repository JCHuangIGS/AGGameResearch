import * as PIXI from 'pixi.js';

export interface Particle extends PIXI.Container {
    vx: number;
    vy: number;
    rotationSpeed: number;
    alphaDecay: number;
    life: number;
}

export class VFXManager {
    private container: PIXI.Container;
    private particles: Particle[] = [];

    constructor(container: PIXI.Container) {
        this.container = container;
    }

    public update(delta: number) {
        const deltaFactor = delta / 16.6;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * deltaFactor;
            p.y += p.vy * deltaFactor;
            p.rotation += p.rotationSpeed * deltaFactor;
            p.alpha -= p.alphaDecay * deltaFactor;
            p.life -= deltaFactor;

            if (p.alpha <= 0 || p.life <= 0) {
                this.container.removeChild(p);
                this.particles.splice(i, 1);
                p.destroy({ children: true });
            }
        }
    }

    public getParticleCount(): number {
        return this.particles.length;
    }

    /**
     * Create small sparks at a collision point
     */
    public createSparks(x: number, y: number, color: number, count: number = 5) {
        for (let i = 0; i < count; i++) {
            const spark = new PIXI.Graphics() as any as Particle;
            const size = 2 + Math.random() * 3;
            
            (spark as any as PIXI.Graphics)
                .rect(-size/2, -size/2, size, size)
                .fill({ color: 0xFFFFFF, alpha: 1 })
                .stroke({ color: color, width: 1 });

            spark.x = x;
            spark.y = y;
            spark.vx = (Math.random() - 0.5) * 6;
            spark.vy = (Math.random() - 0.5) * 6;
            spark.rotationSpeed = (Math.random() - 0.5) * 0.2;
            spark.alphaDecay = 0.02 + Math.random() * 0.03;
            spark.life = 30 + Math.random() * 20;

            this.container.addChild(spark);
            this.particles.push(spark);
        }
    }

    /**
     * Create polygonal fragments for enemy explosion
     */
    public createExplosion(x: number, y: number, color: number, _sides: number) {
        const fragments = 5 + Math.random() * 5;
        for (let i = 0; i < fragments; i++) {
            const shardGraphics = new PIXI.Graphics();
            const shard = shardGraphics as any as Particle;
            const size = 8 + Math.random() * 8;
            
            const points: number[] = [];
            const shardSides = 3 + Math.floor(Math.random() * 2); // Mostly triangles and quads
            for (let j = 0; j < shardSides; j++) {
                const angle = (j / shardSides) * Math.PI * 2;
                const r = size * (0.5 + Math.random() * 0.5);
                points.push(Math.cos(angle) * r, Math.sin(angle) * r);
            }

            shardGraphics
                .poly(points, true)
                .fill({ color: color, alpha: 0.4 })
                .stroke({ color: color, width: 2, alpha: 1 })
                .stroke({ color: 0xFFFFFF, width: 1, alpha: 0.8 });

            shard.x = x;
            shard.y = y;
            shard.vx = (Math.random() - 0.5) * 10;
            shard.vy = (Math.random() - 0.5) * 10;
            shard.rotationSpeed = (Math.random() - 0.5) * 0.3;
            shard.alphaDecay = 0.01 + Math.random() * 0.015;
            shard.life = 60 + Math.random() * 40;

            this.container.addChild(shard);
            this.particles.push(shard);
        }

        const ringGraphics = new PIXI.Graphics();
        const ring = ringGraphics as any as Particle;
        ringGraphics.circle(0, 0, 10).stroke({ color: 0xFFFFFF, width: 3, alpha: 1 });
        ring.x = x;
        ring.y = y;
        ring.vx = 0;
        ring.vy = 0;
        ring.rotationSpeed = 0;
        ring.alphaDecay = 0.05;
        ring.life = 20;
        
        this.container.addChild(ring);
        this.particles.push(ring);
    }

    /**
     * Creates a tractor beam visual effect
     */
    public createTractorBeam(x: number, y: number, height: number = 400): PIXI.Container {
        const beamContainer = new PIXI.Container();
        this.container.addChild(beamContainer);
        const beamBase = new PIXI.Graphics();
        const scanlines = new PIXI.Graphics();
        
        beamContainer.addChild(beamBase);
        beamContainer.addChild(scanlines);

        const topWidth = 16;
        const bottomWidth = 48;
        
        const path = [
            -topWidth / 2, 0,
            topWidth / 2, 0,
            bottomWidth / 2, height,
            -bottomWidth / 2, height
        ];

        beamBase.poly(path).fill({ color: 0x00FFFF, alpha: 0.3 });
        beamBase.stroke({ width: 2, color: 0x00FFFF, alpha: 0.8 });

        beamContainer.x = x;
        beamContainer.y = y;
        this.container.addChild(beamContainer);

        let time = 0;
        const beamTicker = (t: PIXI.Ticker) => {
            time += t.deltaTime * 0.05;
            
            // Pulsing / Breathing alpha effect
            beamBase.alpha = 0.3 + Math.sin(time * 3) * 0.15;
            
            // Breathing edge effect (stroke width pulsing)
            const strokeAlpha = 0.6 + Math.sin(time * 5) * 0.3;
            beamBase.stroke({ width: 2 + Math.sin(time * 2) * 1, color: 0x00FFFF, alpha: strokeAlpha });
            
            // Draw scanlines with downward scrolling
            scanlines.clear();
            const dashCount = 12;
            for (let i = 0; i < dashCount; i++) {
                // Moving offset for scanlines
                const lineY = ((i / dashCount * height) + (time * 150)) % height;
                const ratio = lineY / height;
                
                // Interpolate width based on triangle shape
                const currentWidth = topWidth + (bottomWidth - topWidth) * ratio;
                
                // Scanlines have varying alpha for a "flicker" feel
                const lineAlpha = 0.2 + (Math.sin(time * 10 + i) * 0.1);
                
                scanlines
                    .moveTo(-currentWidth / 2, lineY)
                    .lineTo(currentWidth / 2, lineY)
                    .stroke({ width: 1.5, color: 0x00FFFF, alpha: lineAlpha });
            }

            if (beamBase.destroyed) {
                PIXI.Ticker.shared.remove(beamTicker);
            }
        };

        PIXI.Ticker.shared.add(beamTicker);
        
        // Store for cleanup
        (beamContainer as any).cleanup = () => {
            PIXI.Ticker.shared.remove(beamTicker);
            this.container.removeChild(beamContainer);
            beamContainer.destroy({ children: true });
        };

        return beamContainer;
    }

    public createFeverParticles(x: number, y: number) {
        for (let i = 0; i < 40; i++) {
            const color = Math.random() > 0.5 ? 0xFF00FF : 0x00FFFF;
            const spark = new PIXI.Graphics() as any as Particle;
            const size = 3 + Math.random() * 5;
            
            (spark as any as PIXI.Graphics)
                .rect(-size/2, -size/2, size, size)
                .fill({ color: 0xFFFFFF, alpha: 1 })
                .stroke({ color: color, width: 2 });

            spark.x = x;
            spark.y = y;
            const angle = Math.random() * Math.PI * 2;
            const speed = 5 + Math.random() * 10;
            spark.vx = Math.cos(angle) * speed;
            spark.vy = Math.sin(angle) * speed;
            spark.rotationSpeed = (Math.random() - 0.5) * 0.4;
            spark.alphaDecay = 0.01 + Math.random() * 0.02;
            spark.life = 60 + Math.random() * 40;

            this.container.addChild(spark);
            this.particles.push(spark);
        }
    }
}
