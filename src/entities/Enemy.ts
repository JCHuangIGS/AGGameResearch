import * as PIXI from 'pixi.js';
import * as Matter from 'matter-js';
import { SHAPES } from '../config/Shapes';
import { CATEGORY_ENEMY, ENEMY_MASK, GAME_HEIGHT, ENEMY_BASE_BULLET_SPEED } from '../config/GameConfig';
import { VFXManager } from '../core/VFXManager';
import { EnemyBullet } from './EnemyBullet';
import { Fighter } from './Fighter';
import { SoundManager } from '../core/SoundManager';

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
                        // GDD Phase 4: 進入陣位後角度歸零 (面朝下方)
                        Matter.Body.setAngle(this.body, 0);
                        Matter.Body.set(this.body, 'isSensor', false);
                        Matter.Body.setVelocity(this.body, { x: 0, y: 0 });
                        return;
                    }
                }
            }
            
            const speed = 6 * deltaFactor; 
            if (dist > 0) {
                const vx = (dx / dist) * speed;
                const vy = (dy / dist) * speed;
                Matter.Body.setVelocity(this.body, { x: vx, y: vy });
                
                // GDD 規範: 實作飛行轉向 (Rotate to face velocity)
                // Shapes naturally point UP (-90 degrees), so add PI/2
                Matter.Body.setAngle(this.body, Math.atan2(vy, vx) + Math.PI / 2);
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
            
            // GDD 規範: 俯衝時戰機要朝向速度方向
            Matter.Body.setAngle(this.body, Math.atan2(diveSpeed, horizontalSpeed) + Math.PI / 2);

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
            // GDD Phase 4: Boss 健康的 (HP=2) 俯衝至畫面 55% 高度時, 觸發光束 (不再隨機)
            // BUG FIX: 雙機合體狀態下，魔王不使用牽引光線
            const playerIsDual = this.playerRef && this.playerRef.isDouble;
            if (this.sides === 6 && this.health === 2 && !this.capturedFighter && !playerIsDual && this.y > GAME_HEIGHT * 0.55 && this.y < GAME_HEIGHT * 0.65) {
                this.state = 'CAPTURING';
                this.captureTimer = this.CAPTURE_DURATION;
                Matter.Body.setVelocity(this.body, { x: 0, y: 0 });
                // GDD Phase 4: Boss 停住不動, 面朝下方
                Matter.Body.setAngle(this.body, 0);
                console.log("Boss Galaga starting Tractor Beam!");
            }
        } else if (this.state === 'CAPTURING') {
            // Bug 2 Fix: 如果已經捕獲戰機並且戰機還在被吸引中，不要倒數計時
            // Boss 必須等待戰機完全黏上才能飛回
            if (this.capturedFighter) {
                // 有捕獲目標 → 無限等待，由 GameApp 的 updateCaptureLogic 處理狀態切換
                // Boss 保持停住不動
                Matter.Body.setVelocity(this.body, { x: 0, y: 0 });
            } else {
                // 沒有捕獲到任何戰機 → 正常倒數，時間到就飛回
                this.captureTimer -= delta;
                if (this.captureTimer <= 0) {
                    this.state = 'ENTERING';
                    if (this.tractorBeam && this.tractorBeam.cleanup) {
                        this.tractorBeam.cleanup();
                        this.tractorBeam = null;
                    }
                    console.log("Boss Galaga 牽引光束時間結束(未捕獲)，正在飛回原位。");
                }
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

    public fire(world: Matter.World, layer: PIXI.Container, rank: number, stage: number = 1): EnemyBullet | EnemyBullet[] | null {
        if (this.state !== 'DIVING') return null;
        
        // Only fire if high enough on screen
        if (this.y < 50 || this.y > GAME_HEIGHT - 240) return null;

        // GDD 5.1: Bullet speed scales with both rank and stage
        // Base: 450 + (Stage * 15) px/s, then multiplied by rank factor
        const effectiveRank = rank / 25.5; // Scale 0-255 to 0-10
        const stageBonus = stage * 15; // +15 px/s per stage
        const bulletSpeedUnitsPerSec = (ENEMY_BASE_BULLET_SPEED + stageBonus) * (1 + effectiveRank * 0.15);
        
        // Convert to px/frame for Matter.js
        const bulletSpeed = bulletSpeedUnitsPerSec * (16.666 / 1000); 

        // Calculate base aim direction
        let baseVx = 0;
        let baseVy = bulletSpeed;

        // GDD 02: 高難度階段 (Rank > 10) 下，敵機將具有預測玩家位置並提前發彈的偏向
        if (this.playerRef && rank > 10) {
            const dx = this.playerRef.x - this.x;
            const dy = this.playerRef.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const pvx = this.playerRef.body.velocity.x;
            const pvy = this.playerRef.body.velocity.y;
            const timeToHit = dist / bulletSpeed;
            const predictedX = this.playerRef.x + pvx * timeToHit;
            const predictedY = this.playerRef.y + pvy * timeToHit;
            const aimDX = predictedX - this.x;
            const aimDY = predictedY - this.y;
            const aimDist = Math.sqrt(aimDX * aimDX + aimDY * aimDY);
            baseVx = (aimDX / aimDist) * bulletSpeed;
            baseVy = (aimDY / aimDist) * bulletSpeed;
        } else if (this.playerRef) {
            const dx = this.playerRef.x - this.x;
            const dy = this.playerRef.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            baseVx = (dx / dist) * bulletSpeed;
            baseVy = (dy / dist) * bulletSpeed;
        }

        // BUG FIX: 雙機合體狀態下，Boss 魔王落彈增加為三顆 (扇形散射)
        const playerIsDual = this.playerRef && this.playerRef.isDouble;
        if (this.sides === 6 && playerIsDual) {
            const bullets: EnemyBullet[] = [];
            const spreadAngle = 0.25; // ~14 degrees spread per side
            const baseAngle = Math.atan2(baseVy, baseVx);

            for (let i = -1; i <= 1; i++) {
                const angle = baseAngle + i * spreadAngle;
                const vx = Math.cos(angle) * bulletSpeed;
                const vy = Math.sin(angle) * bulletSpeed;
                const bullet = new EnemyBullet(this.x, this.y);
                bullet.initPhysics(world, { x: vx, y: vy });
                layer.addChild(bullet);
                bullets.push(bullet);
            }
            console.log("Boss fires 3 bullets (Dual Fighter active)!");
            return bullets;
        }

        const bullet = new EnemyBullet(this.x, this.y);
        bullet.initPhysics(world, { x: baseVx, y: baseVy });
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
                // GDD 10.2: 依據敵人階級播放 3 種不同深度的爆炸音
                const pitch = this.sides === 6 ? 60 : this.sides === 4 ? 100 : 150;
                SoundManager.getInstance().playExplosionSound(pitch);
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
