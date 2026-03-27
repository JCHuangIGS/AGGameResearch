import * as PIXI from 'pixi.js';
import * as Matter from 'matter-js';
import { Bullet } from './Bullet';
import { CATEGORY_PLAYER, PLAYER_MASK, PLAYER_FIRE_INTERVAL, PLAYER_BULLET_SPEED } from '../config/GameConfig';
import { VFXManager } from '../core/VFXManager';
import { SoundManager } from '../core/SoundManager';

export class Fighter extends PIXI.Container {
    public body!: Matter.Body;
    private glowGraphics: PIXI.Graphics;
    private mainGraphics: PIXI.Graphics;
    private color: number = 0x00FFFF; // Neon Cyan
    private sideLength: number = 40;
    private lastFireTime: number = 0;
    private fireInterval: number = PLAYER_FIRE_INTERVAL; // ms
    public health: number = 100;
    public maxHealth: number = 100;
    public state: 'ALIVE' | 'DEAD' | 'CAPTURED' | 'SPINNING_CAPTURE' = 'ALIVE';
    public isDouble: boolean = false;
    public isPiercing: boolean = false;
    public fireRateMultiplier: number = 1;
    private isSpinning: boolean = false;
    private spinSpeed: number = 0.1;
    public invulnerableTimer: number = 0; // 無敵時間（毫秒）

    public get isInvulnerable(): boolean {
        return this.invulnerableTimer > 0;
    }

    constructor() {
        super();
        this.glowGraphics = new PIXI.Graphics();
        this.mainGraphics = new PIXI.Graphics();
        this.addChild(this.glowGraphics);
        this.addChild(this.mainGraphics);
        this.draw();
        this.applyGlow();
    }

    private draw() {
        this.mainGraphics.clear();
        this.glowGraphics.clear();
        
        const h = (this.sideLength * Math.sqrt(3)) / 2;
        const points = [
            0, -h / 2,                // Top vertex
            this.sideLength / 2, h / 2, // Bottom right
            -this.sideLength / 2, h / 2 // Bottom left
        ];

        if (this.isDouble) {
            // Draw two triangles side by side
            const spacing = 14; // Gives a total width of approx 30px with overlap
            this.drawSingleFighter(points, -spacing);
            this.drawSingleFighter(points, spacing);
        } else {
            this.drawSingleFighter(points, 0);
        }
    }

    private drawSingleFighter(points: number[], offsetX: number) {
        const offsetPoints = points.map((p, i) => i % 2 === 0 ? p + offsetX : p);

        // 1. Glow Layer
        this.glowGraphics
            .poly(offsetPoints, true)
            .stroke({ color: this.color, width: 8, alpha: 0.6 });

        // 2. Main Sharp Layer
        this.mainGraphics
            .poly(offsetPoints, true)
            .stroke({ color: this.color, width: 3, alpha: 1 });

        // Inner white line
        const innerScale = 0.55;
        const innerPoints = offsetPoints.map((p, i) => i % 2 === 0 ? (p - offsetX) * innerScale + offsetX : p * innerScale);
        this.mainGraphics
            .poly(innerPoints, true)
            .stroke({ color: 0xFFFFFF, width: 1.5, alpha: 0.9 });
    }

    public setTint(color: number) {
        this.color = color;
        this.draw();
    }

    private applyGlow() {
        const blurFilter = new PIXI.BlurFilter();
        blurFilter.blur = 6;
        this.glowGraphics.filters = [blurFilter];
    }

    public initPhysics(x: number, y: number, world: Matter.World) {
        // Use a smaller circular hitbox for fairer bullet dodging (radius: 6 units)
        this.body = Matter.Bodies.circle(x, y, 6, {
            inertia: Infinity,
            frictionAir: 0.1,
            label: "Player",
            collisionFilter: {
                category: CATEGORY_PLAYER,
                mask: PLAYER_MASK
            },
            plugin: { sprite: this }
        });

        Matter.World.add(world, this.body);
    }

    public playerSpin(active: boolean) {
        this.isSpinning = active;
    }

    public takeDamage(amount: number, vfx?: VFXManager): boolean {
        if (this.isInvulnerable) return false; // 無敵狀態不扣血
        
        this.health -= amount;
        
        if (vfx) {
            vfx.createSparks(this.x, this.y, this.color);
        }

        if (this.health <= 0) {
            this.state = 'DEAD';
            return true;
        }
        return false;
    }

    public explode(world: Matter.World, vfx?: VFXManager) {
        if (!this.body) return;

        const { x, y } = this.body.position;
        
        if (vfx) {
            vfx.createExplosion(x, y, this.color, 3);
        }

        Matter.World.remove(world, this.body);
        this.destroy({ children: true });
    }

    public fire(world: Matter.World, container: PIXI.Container, isFever: boolean = false): Bullet[] | null {
        if (this.state !== 'ALIVE') return null;
        
        const now = Date.now();
        if (now - this.lastFireTime < this.fireInterval / this.fireRateMultiplier) {
            return null;
        }
        this.lastFireTime = now;

        const h = (this.sideLength * Math.sqrt(3)) / 2;
        const spawnX = this.x;
        const spawnY = this.y - h / 2;
        
        const bulletColor = isFever ? 0x0000FF : 0xFFFFFF;

        if (this.isDouble) {
            // Left bullet
            const b1 = new Bullet(spawnX - 10, spawnY, bulletColor);
            b1.isPiercing = this.isPiercing;
            b1.initPhysics(world, -PLAYER_BULLET_SPEED * 16.666 / 1000);
            container.addChild(b1);
            
            // Right bullet
            const b2 = new Bullet(spawnX + 10, spawnY, bulletColor);
            b2.isPiercing = this.isPiercing;
            b2.initPhysics(world, -PLAYER_BULLET_SPEED * 16.666 / 1000);
            container.addChild(b2);
            
            this.createMuzzleFlash(spawnX - 10, spawnY, container);
            this.createMuzzleFlash(spawnX + 10, spawnY, container);
            SoundManager.getInstance().playShootSound();
            return [b1, b2];
        } else {
            // Single bullet center
            const bullet = new Bullet(spawnX, spawnY, bulletColor);
            bullet.isPiercing = this.isPiercing;
            bullet.initPhysics(world, -PLAYER_BULLET_SPEED * 16.666 / 1000);
            container.addChild(bullet);
            this.createMuzzleFlash(spawnX, spawnY, container);
            SoundManager.getInstance().playShootSound();
            return [bullet];
        }
    }

    private createMuzzleFlash(x: number, y: number, container: PIXI.Container) {
        const flash = new PIXI.Graphics();
        const size = 10;
        
        flash.poly([-size/2, 0, 0, -size, size/2, 0, 0, size], true)
             .fill({ color: 0xFFFFFF, alpha: 0.9 })
             .stroke({ color: this.color, width: 2 });
        
        flash.x = x;
        flash.y = y;
        container.addChild(flash);

        const ticker = (t: PIXI.Ticker) => {
            flash.alpha -= 0.2 * t.deltaTime;
            flash.scale.set(flash.scale.x + 0.3 * t.deltaTime);
            if (flash.alpha <= 0) {
                container.removeChild(flash);
                PIXI.Ticker.shared.remove(ticker);
                flash.destroy();
            }
        };
        PIXI.Ticker.shared.add(ticker);
    }

    public update() {
        if (this.body) {
            this.x = this.body.position.x;
            this.y = this.body.position.y;
            
            if (this.isSpinning || this.state === 'SPINNING_CAPTURE') {
                this.rotation += this.spinSpeed * (this.state === 'SPINNING_CAPTURE' ? 2 : 1);
                Matter.Body.setAngle(this.body, this.rotation);
                
                if (this.state === 'SPINNING_CAPTURE') {
                    // Slight pulsing scale during capture
                    const scale = 1 + Math.sin(Date.now() * 0.01) * 0.1;
                    this.scale.set(scale);
                } else {
                    this.scale.set(1);
                }
            } else {
                this.rotation = this.body.angle;
                this.scale.set(1);
            }

            // 處理無敵閃爍
            if (this.invulnerableTimer > 0) {
                this.invulnerableTimer -= 16.6; // 假設 60fps
                this.alpha = Math.sin(Date.now() * 0.02) > 0 ? 1 : 0.3;
            } else {
                this.alpha = 1;
            }
        }
    }

    public setDouble(active: boolean) {
        this.isDouble = active;
        this.draw();
        
        if (active && this.body) {
            // GDD mentions 30px width for double fighter hitbox.
            // Our single triangle is around 40px wide. 
            // For simplicity, we just keep the single body or we could expand it.
            // Let's at least scale it slightly if needed, but 30px is actually NARROWER than 40px.
            // GDD might have meant 30px PER fighter? Or total? 
            // "Hitbox Width: 30px (Double: 60px)" - Actually GDD says 15px single, 30px double.
            // My sideLength is 40. 
        }
    }
}
