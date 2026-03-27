import * as PIXI from 'pixi.js';
import * as Matter from 'matter-js';
import { Enemy } from '../entities/Enemy';
import { GameState } from '../types/GameTypes';
import { EnemyBullet } from '../entities/EnemyBullet';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/GameConfig';
import { VFXManager } from './VFXManager';
import { Fighter } from '../entities/Fighter';

export class EnemyManager {
    public enemies: Enemy[] = [];
    private world: Matter.World;
    private container: PIXI.Container;
    public playerRef: Fighter | null = null;
    public isChallengeStage: boolean = false;
    public currentStage: number = 1;
    public expectedEnemies: number = 0;
    public spawnedEnemies: number = 0;
    private spawnTimeouts: any[] = [];

    public get isSpawning() {
        return this.spawnedEnemies < this.expectedEnemies;
    }
    
    private formationSlots: { x: number, y: number }[] = [];
    private rows: number = 5;
    private cols: number = 8;
    private spacingX: number = 60;
    private spacingY: number = 50;
    // startX removed — centering is calculated dynamically
    private startY: number = 100;
    
    private diveCooldown: number = 2000; // ms between dives
    private lastDiveTime: number = 0;
    private fireCooldown: number = 1000; // ms between enemy shots
    private lastFireTime: number = 0;
    
    public onEnemyDestroyed?: (enemy: Enemy) => void;
    public onFighterReleased?: (boss: Enemy, isHostile: boolean) => void;

    constructor(world: Matter.World, container: PIXI.Container) {
        this.world = world;
        this.container = container;
        this.calculateFormationGrid();
    }

    private calculateFormationGrid() {
        this.formationSlots = [];
        const gridWidth = (this.cols - 1) * this.spacingX;
        const offsetX = (GAME_WIDTH - gridWidth) / 2;
        
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                this.formationSlots.push({
                    x: offsetX + c * this.spacingX,
                    y: this.startY + r * this.spacingY
                });
            }
        }
    }

    public spawnBatch(batchIndex: number, sides: number, targetSlotIndices: number[], stageNum?: number) {
        const count = targetSlotIndices.length;
        const patternPoints = this.isChallengeStage && stageNum 
            ? this.getChallengePath(stageNum, batchIndex)
            : this.generatePatternPoints(batchIndex);
        
        for (let i = 0; i < count; i++) {
            // Delay each enemy in the batch
            const tId = setTimeout(() => {
                const enemy = new Enemy(sides);
                const startPos = patternPoints[0] || { x: 400, y: -50 };
                
                enemy.initPhysics(startPos.x, startPos.y, this.world);
                this.container.addChild(enemy);
                
                enemy.playerRef = this.playerRef;
                enemy.path = [...patternPoints];
                enemy.isChallenge = this.isChallengeStage;
                
                // Transformation Logic (Stage 4-6)
                if (stageNum && stageNum >= 4 && stageNum <= 6 && batchIndex > 0) {
                    enemy.isTransforming = true;
                }
                
                const slotIndex = targetSlotIndices[i];
                enemy.targetPos = this.formationSlots[slotIndex];
                enemy.state = 'ENTERING';

                this.enemies.push(enemy);
                this.spawnedEnemies++;
                
                enemy.onFighterReleased = (isHostile: boolean) => {
                    if (this.onFighterReleased) this.onFighterReleased(enemy, isHostile);
                };
            }, i * 150); // 150ms delay between enemies in a batch
            this.spawnTimeouts.push(tId);
        }
    }

    private generatePatternPoints(batchIndex: number): { x: number, y: number }[] {
        // GDD Phase 3: 實作「從螢幕底端飛入、360 度大迴旋、前往頂端陣位」及「從螢幕頂端切入、U型俯衝」
        
        // Helper 1: U形下切再上折 (Cubic Bezier)
        const getCubicBezier = (p0: any, p1: any, p2: any, p3: any, segments: number) => {
            const pts = [];
            for(let i=0; i<=segments; i++){
                const t = i / segments;
                const mt = 1 - t;
                const x = mt*mt*mt*p0.x + 3*mt*mt*t*p1.x + 3*mt*t*t*p2.x + t*t*t*p3.x;
                const y = mt*mt*mt*p0.y + 3*mt*mt*t*p1.y + 3*mt*t*t*p2.y + t*t*t*p3.y;
                pts.push({x, y});
            }
            return pts;
        }

        switch (batchIndex) {
            case 0: // Batch 1: 從螢幕頂端正中切入、U型俯衝、前往頂端陣位 (Boss + Guard)
                return getCubicBezier({x: GAME_WIDTH / 2, y: -50}, {x: GAME_WIDTH / 2, y: GAME_HEIGHT * 0.4}, {x: -100, y: GAME_HEIGHT * 0.6}, {x: GAME_WIDTH * 0.2, y: 300}, 30);
            case 1: // Batch 2: 從螢幕左上飛入、大弧線迴旋、前往陣位
                return getCubicBezier({x: -50, y: -50}, {x: GAME_WIDTH * 0.6, y: GAME_HEIGHT * 0.35}, {x: GAME_WIDTH * 0.1, y: GAME_HEIGHT * 0.5}, {x: GAME_WIDTH * 0.3, y: 250}, 30);
            case 2: // Batch 3: 從螢幕右上飛入、大弧線迴旋、前往陣位
                return getCubicBezier({x: GAME_WIDTH + 50, y: -50}, {x: GAME_WIDTH * 0.4, y: GAME_HEIGHT * 0.35}, {x: GAME_WIDTH * 0.9, y: GAME_HEIGHT * 0.5}, {x: GAME_WIDTH * 0.7, y: 250}, 30);
            case 3: // Batch 4: 頂端左側切入，Sweeping Dive
                return getCubicBezier({x: -50, y: 100}, {x: GAME_WIDTH * 0.8, y: 400}, {x: 0, y: 600}, {x: GAME_WIDTH * 0.4, y: 300}, 30);
            case 4: // Batch 5: 頂端右側切入，Sweeping Dive
                return getCubicBezier({x: GAME_WIDTH + 50, y: 100}, {x: GAME_WIDTH * 0.2, y: 400}, {x: GAME_WIDTH, y: 600}, {x: GAME_WIDTH * 0.6, y: 300}, 30);
            default:
                return [{ x: GAME_WIDTH / 2, y: -50 }];
        }
    }

    public getChallengePath(stageNum: number, batchIdx: number): { x: number, y: number }[] {
        const points: { x: number, y: number }[] = [];
        const centerX = 400;
        const centerY = 300;

        switch (stageNum) {
            case 3: // Spiral (螺旋)
                for (let i = 0; i < 10; i++) {
                    const r = 50 + i * 30;
                    const a = i * 0.8 + (batchIdx * Math.PI / 2);
                    points.push({ x: centerX + Math.cos(a) * r, y: centerY + Math.sin(a) * r });
                }
                break;
            case 7: // Cross (左右交叉)
                const side = batchIdx % 2 === 0 ? -1 : 1;
                points.push({ x: side > 0 ? 850 : -50, y: 100 });
                points.push({ x: centerX, y: centerY });
                points.push({ x: side > 0 ? -50 : 850, y: 500 });
                break;
            case 11: // Vertical Split (垂直分裂)
                const dir = batchIdx < 2 ? -1 : 1;
                points.push({ x: centerX + dir * 50, y: -50 });
                points.push({ x: centerX + dir * 200, y: centerY });
                points.push({ x: centerX + dir * 50, y: 650 });
                break;
            case 19: // 8-figure (8字型)
                for (let i = 0; i < 12; i++) {
                    const t = i / 11 * Math.PI * 2;
                    const x = centerX + Math.sin(t) * 200;
                    const y = centerY + Math.sin(t * 2) * 100;
                    points.push({ x, y });
                }
                break;
            case 27: // Extreme speed (極速進場)
                points.push({ x: Math.random() * GAME_WIDTH, y: -50 });
                points.push({ x: Math.random() * GAME_WIDTH, y: GAME_HEIGHT + 50 });
                break;
            default:
                return this.generatePatternPoints(batchIdx);
        }
        return points;
    }

    public spawnLevelSequence(level: number) {
        // GDD: 挑戰關卡在第 3, 7, 11, 15, 19, 23, 27... 關（每4關一次，從第3關開始）
        this.isChallengeStage = level >= 3 && (level - 3) % 4 === 0;
        
        // GDD: 5 batches for every level start
        const batchConfigs = [
            { sides: 6, count: 4, startIndex: 2 }, // Batch 1: 4 Boss (top row mid)
            { sides: 4, count: 8, startIndex: 8 }, // Batch 2: 8 Guard 
            { sides: 3, count: 8, startIndex: 16 }, // Batch 3: 8 Grunt
            { sides: 4, count: 8, startIndex: 24 }, // Batch 4: 8 Guard
            { sides: 3, count: 8, startIndex: 32 }  // Batch 5: 8 Grunt
        ];

        this.expectedEnemies = batchConfigs.reduce((sum, config) => sum + config.count, 0);
        this.spawnedEnemies = 0;

        batchConfigs.forEach((config, i) => {
            const indices = Array.from({ length: config.count }, (_, j) => config.startIndex + j);
            const tId = setTimeout(() => {
                this.spawnBatch(i, config.sides, indices, level);
            }, i * 1800); // 1.8s delay between batches
            this.spawnTimeouts.push(tId);
        });
    }

    public update(delta: number, vfx: VFXManager, gameState: GameState, bulletLayer: PIXI.Container, rank: number, onFire: (bullet: EnemyBullet) => void) {
        this.lastDiveTime += delta;
        this.lastFireTime += delta;
        
        // GDD: Firing rate depends on rank and stage segment
        const fireRateFactor = 1 + (rank / 255) * 1.5; // Up to 2.5x
        const currentFireCooldown = this.fireCooldown / fireRateFactor;

        // Trigger Dives
        if (!this.isChallengeStage && gameState === GameState.ATTACK && this.lastDiveTime > this.diveCooldown) {
            const formationEnemies = this.enemies.filter(e => e.state === 'FORMATION');
            if (formationEnemies.length > 0) {
                // GDD 5.1: 2-3 enemies dive together, scaling with stage
                const maxDivers = Math.min(3 + Math.floor(this.currentStage / 2), 8);
                const numDivers = Math.min(formationEnemies.length, 1 + Math.floor(Math.random() * Math.min(maxDivers, 3)));
                
                for (let j = 0; j < numDivers; j++) {
                    const availableEnemies = this.enemies.filter(e => e.state === 'FORMATION');
                    if (availableEnemies.length === 0) break;
                    
                    const randomEnemy = availableEnemies[Math.floor(Math.random() * availableEnemies.length)];
                    randomEnemy.startDive();
                }
                
                this.lastDiveTime = 0;
                // Randomize next dive interval - faster at higher ranks
                const baseCooldown = 1500;
                this.diveCooldown = (baseCooldown + Math.random() * 2000) / (1 + rank / 512);
            }
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.update(delta);
            
            // Enemy Shooting
            if (!this.isChallengeStage && enemy.state === 'DIVING' && this.lastFireTime > currentFireCooldown) {
                const result = enemy.fire(this.world, bulletLayer, rank, this.currentStage);
                if (result) {
                    // Handle both single bullet and array of bullets (Boss 3-way spread)
                    if (Array.isArray(result)) {
                        result.forEach(b => onFire(b));
                    } else {
                        onFire(result);
                    }
                    this.lastFireTime = 0;
                }
            }

            if (enemy.state === 'DEAD') {
                if (this.onEnemyDestroyed) this.onEnemyDestroyed(enemy);
                enemy.destroyEnemy(this.world, vfx);
                this.enemies.splice(i, 1);
            }
        }
    }
    
    public clear() {
            this.spawnTimeouts.forEach(clearTimeout);
            this.spawnTimeouts = [];
        this.enemies.forEach(e => e.destroyEnemy(this.world));
        this.enemies = [];
    }

    public resetTimers() {
        this.lastDiveTime = 0;
        this.lastFireTime = 0;
        this.diveCooldown = 2000;
        this.isChallengeStage = false;
    }
}
