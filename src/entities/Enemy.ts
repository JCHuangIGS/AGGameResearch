import * as PIXI from 'pixi.js';
import * as Matter from 'matter-js';
import { SHAPES } from '../config/Shapes';
import { CATEGORY_ENEMY, ENEMY_MASK, GAME_HEIGHT } from '../config/GameConfig';
import { VFXManager } from '../core/VFXManager';
import { EnemyBullet } from './EnemyBullet';
import { Fighter } from './Fighter';

export type EnemyState = 'ENTERING' | 'FORMATION' | 'DIVING' | 'CAPTURING' | 'DEAD';

export class Enemy extends PIXI.Container {
    public body!: Matter.Body;
    private glowGraphics: PIXI.Graphics;
    private mainGraphics: PIXI.Graphics;
    
    public sides: number;
    public color: number;
    public sideLength: number;
    public health: number;
    public points: number;
    public divePoints: number;
    
    public state: EnemyState = 'ENTERING';
    public isChallenge: boolean = false;
    public targetPos: { x: number, y: number } | null = null;
    public path: { x: number, y: number }[] = [];
    public pathIndex: number = 0;
    
    public isEscaped: boolean = false;
    public isTransforming: boolean = false;
    
    private time: number = 0;
    private oscillationOffset: number = Math.random() * Math.PI * 2;
    public tractorBeam: any = null;
    private diveTime: number = 0;
    private startDivePos: { x: number, y: number } = { x: 0, y: 0 };
    public capturedFighter: Fighter | null = null;
    private captureTimer: number = 0;
    private readonly CAPTURE_DURATION: number = 2100; // 2.1s per GDD
    
    public playerRef: Fighter | null = null;
    private hasJerked: boolean = false;
    public onFighterReleased?: (isHostile: boolean) => void;

    constructor(sides: number) {
        super();
        const config = SHAPES[sides] || SHAPES[3];
        this.sides = config.sides;
        this.color = config.color;
        this.sideLength = config.sideLength;
        this.health = config.health;
        this.points = config.points;
        this.divePoints = config.divePoints;

        this.glowGraphics = new PIXI.Graphics();
        this.mainGraphics = new PIXI.Graphics();
        this.addChild(this.glowGraphics);
        this.addChild(this.mainGraphics);
        
        this.draw();
        this.applyGlow();
        
        this.time = Math.random() * 100;
        this.oscillationOffset = Math.random() * Math.PI * 2;
    }

    private draw() {
        this.mainGraphics.clear();
        this.glowGraphics.clear();
        
        const points: number[] = [];
        const radius = this.sideLength / 2;
        
        for (let i = 0; i < this.sides; i++) {
            const angle = (i / this.sides) * Math.PI * 2 - Math.PI / 2;
            points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
        }

        this.glowGraphics
            .poly(points, true)
            .stroke({ color: this.color, width: 8, alpha: 0.6 });

        this.mainGraphics
            .poly(points, true)
            .stroke({ color: this.color, width: 3, alpha: 1 });

        const innerScale = 0.55;
        const innerPoints = points.map(p => p * innerScale);
        this.mainGraphics
            .poly(innerPoints, true)
            .stroke({ color: 0xFFFFFF, width: 1.5, alpha: 0.9 });
    }

    private applyGlow() {
        const blurFilter = new PIXI.BlurFilter();
        blurFilter.blur = 6;
        this.glowGraphics.filters = [blurFilter];
    }

    public initPhysics(x: number, y: number, world: Matter.World) {
        this.body = Matter.Bodies.polygon(x, y, this.sides, this.sideLength / 2, {
            inertia: Infinity,
            frictionAir: 0.1,
            label: "Enemy",
            isSensor: true,
            collisionFilter: {
                category: CATEGORY_ENEMY,
                mask: ENEMY_MASK
            },
            plugin: { sprite: this }
        });

        Matter.World.add(world, this.body);
    }

    public takeDamage(amount: number, vfx?: VFXManager): boolean {
        this.health -= amount;
        
        if (vfx) {
            vfx.createSparks(this.x, this.y, this.color);
        }

        if (this.health <= 0) {
            const prevState = this.state;
            this.state = 'DEAD';
            
            // Cleanup tractor beam if active
            if (this.tractorBeam && this.tractorBeam.cleanup) {
                this.tractorBeam.cleanup();
                this.tractorBeam = null;
            }

            if (this.capturedFighter) {
                // If killed in formation, fighter turns hostile. 
                // If killed while diving (or capturing), rescue is possible.
                const isHostile = prevState === 'FORMATION' || prevState === 'ENTERING';
                // Trigger release logic which will be handled in GameApp or via a callback
                this.onFighterReleased?.(isHostile);
            }
            return true;
        }

        // Boss Galaga specific: change color to purple on 1st hit
        if (this.sides === 6 && this.health === 1) {
            this.color = 0xBC13FE; // Neon Purple
            this.draw();
        }
        
        if (this.mainGraphics) {
            this.mainGraphics.tint = 0xFFFFFF;
            setTimeout(() => {
                if (this.mainGraphics && !this.mainGraphics.destroyed) {
                    this.mainGraphics.tint = 0xFFFFFF;
                }
            }, 50);
        }
        return false;
    }

    public update(delta: number = 16.6) {
        if (!this.body) return;

        const deltaFactor = delta / 16.6;

        if (this.state === 'ENTERING') {
            const currentTarget = (this.path && this.pathIndex < this.path.length) 
                ? this.path[this.pathIndex] 
                : this.targetPos;

            if (!currentTarget) return;

            const dx = currentTarget.x - this.body.position.x;
            const dy = currentTarget.y - this.body.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 10) {
                if (this.path && this.pathIndex < this.path.length) {
                    this.pathIndex++;
                } else {
                    if (this.isChallenge) {
                        // Challenge Stage: Retreat after path ends
                        this.isEscaped = true;
                        this.state = 'DEAD'; 
                    } else if (this.targetPos && currentTarget === this.targetPos) {
                        this.state = 'FORMATION';
                        Matter.Body.set(this.body, 'isSensor', false);
                        Matter.Body.setVelocity(this.body, { x: 0, y: 0 });
                        return;
                    }
                }
            }
            
            const speed = 6 * deltaFactor; 
            if (dist > 0) {
                Matter.Body.setVelocity(this.body, {
                    x: (dx / dist) * speed,
                    y: (dy / dist) * speed
                });
            }
        } else if (this.state === 'FORMATION') {
            this.time += 0.05 * deltaFactor;
            const offsetX = Math.sin(this.time + this.oscillationOffset) * 10;
            const offsetY = Math.cos(this.time * 0.5 + this.oscillationOffset) * 5;
            
            if (this.targetPos) {
                Matter.Body.setPosition(this.body, {
                    x: this.targetPos.x + offsetX,
                    y: this.targetPos.y + offsetY
                });
            }
        } else if (this.state === 'DIVING') {
            this.diveTime += 0.02 * deltaFactor;
            
            // GDD: Dive speed increases at Stage 12+ (Expert)
            // Normal 1.5-2.0, Expert 2.5
            const baseDiveSpeed = (this.y < 300) ? 3 : 4.5;
            const diveSpeed = baseDiveSpeed * deltaFactor;
            
            // X-axis tracking (Stage 8+)
            let targetX = this.startDivePos.x + Math.sin(this.diveTime * 2.5) * 80;
            if (this.playerRef && this.y < 400) {
                // Smoothly pull towards player X
                const pullStrength = 0.02 * deltaFactor;
                targetX = targetX + (this.playerRef.x - targetX) * pullStrength;
            }

            // Jerk behavior (Stage 20+) - sudden sharp turn
            if (this.y > 200 && this.y < 400 && !this.hasJerked && Math.random() < 0.015) {
                const jerkDirection = Math.random() > 0.5 ? 1 : -1;
                Matter.Body.setVelocity(this.body, { 
                    x: (this.body.velocity.x + jerkDirection * 8) * deltaFactor, 
                    y: this.body.velocity.y 
                });
                this.hasJerked = true;
                this.diveTime += 1.0; // Also shift oscillation phase
                console.log("Enemy JERKED!");
            }
            
            const dx_dive = targetX - this.body.position.x;
            const horizontalSpeed = dx_dive * 0.1 * deltaFactor;
            
            Matter.Body.setPosition(this.body, { 
                x: this.body.position.x + horizontalSpeed, 
                y: this.body.position.y + diveSpeed 
            });

            // Guard Transformation (Stage 4-6) - Morph sides randomly
            if (this.isTransforming && Math.random() < 0.005) {
                this.sides = this.sides === 3 ? 4 : 3;
                this.draw();
                console.log("Enemy Transformed!");
            }

            // Loop back to top if off-screen
            if (this.body.position.y > GAME_HEIGHT + 30) {
                Matter.Body.setPosition(this.body, { x: this.body.position.x, y: -50 });
                this.state = 'ENTERING';
                this.pathIndex = 0; // Reset path if looping (though usually they fly to targetPos)
            }

            // Boss Galaga Tractor Beam Trigger
            // GDD 02: Dive below 1/2 height and uninjured (health == 2 for boss)
            if (this.sides === 6 && this.health === 2 && this.y > GAME_HEIGHT / 2 && Math.random() < 0.1) {
                this.state = 'CAPTURING';
                this.captureTimer = this.CAPTURE_DURATION;
                Matter.Body.setVelocity(this.body, { x: 0, y: 0 });
                console.log("Boss Galaga starting Tractor Beam!");
            }
        } else if (this.state === 'CAPTURING') {
            this.captureTimer -= delta;
            if (this.captureTimer <= 0) {
                // GDD: 作用結束後飛回原位
                this.state = 'ENTERING'; // 使用 ENTERING 會讓它自動往 targetPos 飛
                if (this.tractorBeam && this.tractorBeam.cleanup) {
                    this.tractorBeam.cleanup();
                    this.tractorBeam = null;
                }
                console.log("Boss Galaga 牽引光束時間結束，正在飛回原位。");
            }
        }

        this.x = this.body.position.x;
        this.y = this.body.position.y;
        this.rotation = this.body.angle;
    }

    public startDive() {
        if (this.state !== 'FORMATION') return;
        this.state = 'DIVING';
        this.diveTime = 0;
        this.startDivePos = { x: this.body.position.x, y: this.body.position.y };
        console.log("Enemy started diving!");
    }

    public fire(world: Matter.World, layer: PIXI.Container, rank: number): EnemyBullet | null {
        if (this.state !== 'DIVING') return null;
        
        // Only fire if high enough on screen
        if (this.y < 50 || this.y > GAME_HEIGHT - 240) return null;

        const bullet = new EnemyBullet(this.x, this.y);
        
        // Calculate bullet speed based on rank (GDD-adjusted for "quick fall": 3.0 - 4.5 px/ms)
        const baseSpeedPxPerFrame = 3.0 + (rank / 255) * 1.5;
        // Convert to px/ms for Matter.js (assuming 60fps)
        const bulletSpeed = baseSpeedPxPerFrame; 

        let vx = 0;
        let vy = bulletSpeed;

        // GDD 02: 高難度階段 (Rank > 10) 下，敵機將具有預測玩家位置並提前發彈的偏向
        if (this.playerRef && rank > 10) {
            // Predator targeting: P_target = P_player + V_player * (dist / bulletSpeed)
            const dx = this.playerRef.x - this.x;
            const dy = this.playerRef.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Get player velocity (from Matter.js body)
            const pvx = this.playerRef.body.velocity.x;
            const pvy = this.playerRef.body.velocity.y;
            
            const timeToHit = dist / bulletSpeed;
            const predictedX = this.playerRef.x + pvx * timeToHit;
            const predictedY = this.playerRef.y + pvy * timeToHit;
            
            const aimDX = predictedX - this.x;
            const aimDY = predictedY - this.y;
            const aimDist = Math.sqrt(aimDX * aimDX + aimDY * aimDY);
            
            vx = (aimDX / aimDist) * bulletSpeed;
            vy = (aimDY / aimDist) * bulletSpeed;
        } else if (this.playerRef) {
            // Basic aiming: always aim at player when below Rank 10
            const dx = this.playerRef.x - this.x;
            const dy = this.playerRef.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            vx = (dx / dist) * bulletSpeed;
            vy = (dy / dist) * bulletSpeed;
        }

        bullet.initPhysics(world, { x: vx, y: vy });
        layer.addChild(bullet);
        return bullet;
    }

    public destroyEnemy(world: Matter.World, vfx?: VFXManager) {
        if (this.tractorBeam && this.tractorBeam.cleanup) {
            this.tractorBeam.cleanup();
            this.tractorBeam = null;
        }
        
        if (this.body) {
            if (vfx && this.state === 'DEAD' && !this.isEscaped) {
                vfx.createExplosion(this.body.position.x, this.body.position.y, this.color, this.sides);
            }
            if (this.body.plugin) {
                this.body.plugin.sprite = null;
            }
            Matter.World.remove(world, this.body);
            (this as any).body = null;
        }
        this.destroy({ children: true });
    }
}
