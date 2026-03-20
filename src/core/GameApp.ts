import * as PIXI from 'pixi.js';
import * as Matter from 'matter-js';
import { PLAYER_SPEED, GAME_WIDTH, GAME_HEIGHT } from '../config/GameConfig';
import { Fighter } from '../entities/Fighter';
import { Bullet } from '../entities/Bullet';
import { EnemyManager } from './EnemyManager';
import { VFXManager } from './VFXManager';
import { UIManager } from './UIManager';
import { Enemy } from '../entities/Enemy';
import { GameState } from '../types/GameTypes';
import { EnemyBullet } from '../entities/EnemyBullet';


export class GameApp {
  private pixiApp!: PIXI.Application;
  private engine!: Matter.Engine;
  private container: HTMLElement;

  // PixiJS Layers
  public bgLayer!: PIXI.Container;
  public shapesLayer!: PIXI.Container;
  public particlesLayer!: PIXI.Container;

  // Player
  private player!: Fighter;
  private replacementPlayer: Fighter | null = null;
  private bullets: Bullet[] = [];
  private enemyBullets: EnemyBullet[] = [];
  private enemyManager!: EnemyManager;
  private vfxManager!: VFXManager;
  private keys: Record<string, boolean> = {};
  private uiManager!: UIManager;

  // Game State
  private score: number = 0;
  private highScore: number = 0;
  private lives: number = 3;
  private heat: number = 0;
  private isFeverMode: boolean = false;
  private feverTimer: number = 0;
  private state: GameState = GameState.INTRO;
  private currentLevel: number = 1;
  private rank: number = 0; // GDD: 0-255
  private challengeHits: number = 0;
  private stateTimer: number = 0;
  private heatDecayTimer: number = 0;
  private readonly FEVER_DURATION = 10000; // 10s
  private readonly HEAT_DECAY_DELAY = 2000; // 2s before decay starts
  private readonly HEAT_DECAY_RATE = 0.05; // per ms
  private shotsTotal: number = 0;
  private shotsHit: number = 0;

  // Screen Shake
  private shakeIntensity: number = 0;
  private shakeDecay: number = 0.9;

  // Background Stars
  private stars: PIXI.Graphics[] = [];
  private gridGraphics!: PIXI.Graphics;
  private gridScrollOffset: number = 0;


  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async init() {
    // 1. Initialize PixiJS
    this.pixiApp = new PIXI.Application();
    await this.pixiApp.init({
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      backgroundColor: 0x111122, // GDD 規範: Deep Blue/Black Base
      antialias: true,
      resolution: window.devicePixelRatio || 1,
    });
    this.container.appendChild(this.pixiApp.canvas);

    // Load High Score
    const savedHighScore = localStorage.getItem('antigravity_highscore');
    if (savedHighScore) this.highScore = parseInt(savedHighScore);

    // 2. Setup PixiJS Layers
    this.bgLayer = new PIXI.Container();
    this.shapesLayer = new PIXI.Container();
    this.particlesLayer = new PIXI.Container();

    this.pixiApp.stage.addChild(this.bgLayer);
    this.pixiApp.stage.addChild(this.shapesLayer);
    this.pixiApp.stage.addChild(this.particlesLayer);

    // 2.1 Initialize Cyber Grid Background (GDD 規範)
    this.initCyberGrid();

    // 2.2 Initialize Stars (多層次遠景流星效果)
    for (let i = 0; i < 100; i++) {
        const star = new PIXI.Graphics();
        const x = Math.random() * GAME_WIDTH;
        const y = Math.random() * GAME_HEIGHT;
        const size = 1 + Math.random() * 2;
        star.circle(0, 0, size).fill({ color: 0xFFFFFF, alpha: 0.5 + Math.random() * 0.5 });
        star.x = x;
        star.y = y;
        (star as any).speed = 0.5 + Math.random() * 1.5;
        this.bgLayer.addChild(star);
        this.stars.push(star);
    }

    // 3. Initialize Matter.js
    this.engine = Matter.Engine.create();

    // Disable gravity for space shooter
    this.engine.gravity.y = 0;

    // 4. Setup Input
    window.addEventListener('keydown', (e) => {
        this.keys[e.code] = true;
        
        // DEV KEYS
        if (e.code === 'KeyT') {
            this.player.isDouble = !this.player.isDouble;
            console.log("Double Fighter:", this.player.isDouble);
        }
        if (e.code === 'KeyB') {
            this.vfxManager.createTractorBeam(400, 0, 400);
        }
    });
    window.addEventListener('keyup', (e) => this.keys[e.code] = false);

    // DEV CHEAT: Expose setLevel to window
    (window as any).setLevel = (level: number) => {
        this.currentLevel = level;
        this.enemyManager.enemies.forEach(e => {
            this.shapesLayer.removeChild(e);
            Matter.Composite.remove(this.engine.world, e.body);
        });
        this.enemyManager.enemies = [];
        this.enemyBullets.forEach(b => {
             this.shapesLayer.removeChild(b);
             Matter.Composite.remove(this.engine.world, b.body);
        });
        this.enemyBullets = [];
        
        this.uiManager.updateLevel(level);
        this.spawnLevel(level);
        console.log(`Dev: Jumped to Level ${level}`);
    };

    // 5. Initialize UI
    this.uiManager = new UIManager(this.pixiApp.stage);
    this.uiManager.updateScore(this.score, this.highScore);
    this.uiManager.updateLives(this.lives);
    this.uiManager.updateLevel(this.currentLevel);

    // 5. Initialize Player
    this.player = new Fighter();
    this.shapesLayer.addChild(this.player);
    this.player.initPhysics(GAME_WIDTH / 2, GAME_HEIGHT - 80, this.engine.world);

    // 6. Initialize VFX Manager
    this.vfxManager = new VFXManager(this.particlesLayer);

    // 7. Initialize Enemy Manager
    this.enemyManager = new EnemyManager(this.engine.world, this.shapesLayer);
    this.enemyManager.playerRef = this.player; // Set player reference here
    this.enemyManager.onEnemyDestroyed = (enemy: Enemy) => {
        if (!enemy.isEscaped) {
            // GDD: 衝刺中擊殺得分更高
            const score = (enemy.state === 'DIVING' || enemy.state === 'CAPTURING') 
                ? enemy.divePoints 
                : enemy.points;
            this.addScore(score);
            this.updateHeat(5); // 5% per kill
            // GDD: 擊殺敵人 Rank +1
            this.rank = Math.min(255, this.rank + 1);
            if (this.enemyManager.isChallengeStage) {
                this.challengeHits++;
            }
        }
    };
    
    // Spawn initial wave
    this.spawnLevel(this.currentLevel);

      this.enemyManager.onFighterReleased = (boss: Enemy, isHostile: boolean) => {
          if (!boss.capturedFighter) return;
          const fighter = boss.capturedFighter;
          boss.capturedFighter = null;

          if (isHostile) {
              console.log("RESCUE FAILED: Captured fighter turns HOSTILE!");
              // Create a red enemy at the fighter's position
              const hostileFighter = new Enemy(3);
              hostileFighter.color = 0xFF0000;
              hostileFighter.points = 500;
              (hostileFighter as any).isHostile = true; // Flag for special behavior if needed
              
              hostileFighter.initPhysics(fighter.x, fighter.y, this.engine.world);
              this.shapesLayer.addChild(hostileFighter);
              this.enemyManager.enemies.push(hostileFighter);
              
              // Start diving immediately
              hostileFighter.state = 'DIVING';
              
              // Remove the original fighter entity
              fighter.state = 'DEAD';
              this.shapesLayer.removeChild(fighter);
          } else {
              // Rescue possible - handled by falling logic already in updateCaptureLogic
              console.log("Boss killed while diving! Rescued fighter is falling...");
          }
      };

      // 8. Start Game Loop
    this.pixiApp.ticker.add((ticker) => {
      this.update(ticker.deltaMS);
    });

    // 9. Collision Handling (Matter.js)
    Matter.Events.on(this.engine, 'collisionStart', (event) => {
        event.pairs.forEach(pair => {
            const bodyA = pair.bodyA;
            const bodyB = pair.bodyB;
            
            // Bullet vs Enemy
            if ((bodyA.label === 'Bullet' && bodyB.label === 'Enemy') ||
                (bodyB.label === 'Bullet' && bodyA.label === 'Enemy')) {
                const bulletBody = bodyA.label === 'Bullet' ? bodyA : bodyB;
                const enemyBody = bodyA.label === 'Enemy' ? bodyA : bodyB;
                
                const bullet = bulletBody.plugin.sprite as Bullet;
                const enemy = enemyBody.plugin.sprite as any; // Enemy type

                // Check if already destroyed to avoid double-processing crash
                if (bullet && enemy && !bullet.destroyed && (!enemy.destroyed)) {
                    // Only destroy bullet if not piercing
                    if (!bullet.isPiercing) {
                        bullet.destroyBullet(this.engine.world);
                    }
                    enemy.takeDamage(1, this.vfxManager);
                    this.shotsHit++;
                }
            }

            // Bullet vs Captured Player (Rescue Failure)
            if ((bodyA.label === 'Bullet' && bodyB.label === 'Player' && (bodyB.plugin.sprite as Fighter).state !== 'ALIVE') ||
                (bodyB.label === 'Bullet' && bodyA.label === 'Player' && (bodyA.plugin.sprite as Fighter).state !== 'ALIVE')) {
                const bulletBody = bodyA.label === 'Bullet' ? bodyA : bodyB;
                const playerBody = bodyA.label === 'Player' ? bodyA : bodyB;
                const bullet = bulletBody.plugin.sprite as Bullet;
                const fighter = playerBody.plugin.sprite as Fighter;

                if (bullet && fighter && !bullet.destroyed) {
                    bullet.destroyBullet(this.engine.world);
                    // GDD: Red explosion for rescue failure
                    this.vfxManager.createExplosion(fighter.x, fighter.y, 0xFF0000, 3);
                    fighter.state = 'DEAD';
                    this.shapesLayer.removeChild(fighter);
                    console.log("RESCUE FAILED: Captured fighter destroyed!");
                }
            }

            // EnemyBullet vs Player
            if ((bodyA.label === 'EnemyBullet' && bodyB.label === 'Player') ||
                (bodyB.label === 'EnemyBullet' && bodyA.label === 'Player')) {
                const bulletBody = bodyA.label === 'EnemyBullet' ? bodyA : bodyB;
                const bullet = bulletBody.plugin.sprite as EnemyBullet;
                if (bullet && !bullet.destroyed) {
                    bullet.destroyBullet(this.engine.world);
                    this.handlePlayerHit();
                }
            }

            if ((bodyA.label === 'Player' && bodyB.label === 'Enemy') ||
                (bodyB.label === 'Player' && bodyA.label === 'Enemy')) {
                const enemyBody = bodyA.label === 'Enemy' ? bodyA : bodyB;
                const fighterBody = bodyA.label === 'Player' ? bodyA : bodyB;

                const player = fighterBody.plugin.sprite as Fighter;
                const enemy = enemyBody.plugin.sprite as any;

                if (player && enemy && !player.destroyed && !enemy.destroyed && !player.isInvulnerable) {
                    // 敵人受傷或爆炸
                    enemy.takeDamage(10, this.vfxManager);
                    
                    // 觸發玩家受擊處理 (爆炸、扣命、復活)
                    this.handlePlayerHit();
                }
            }
        });
    });

    // Using manual update in pixi ticker instead of Matter.Runner to avoid double updates
    console.log("GameApp Initialized");
  }

  private update(delta: number) {
    const feverMult = this.isFeverMode ? 1.5 : 1.0;
    const scaledDelta = delta * feverMult;
    const deltaFactor = scaledDelta / 16.6;

    // 0. Update Cyber Grid scroll
    this.gridScrollOffset += 0.5 * deltaFactor;
    if (this.gridScrollOffset >= 50) this.gridScrollOffset -= 50;
    this.drawCyberGrid();

    // 0.1 Update Stars (Pause during BONUS state as per GDD)
    if (this.state !== GameState.BONUS) {
        this.stars.forEach(star => {
            star.y += (star as any).speed * deltaFactor;
            if (star.y > GAME_HEIGHT) {
                star.y = -10;
                star.x = Math.random() * GAME_WIDTH;
            }
        });
    }

    // 1. Handle Input (Uses scaledDelta via handleInput internal logic)
    this.handleInput(scaledDelta);

    // 2. Update Matter.js engine (Speeds up physics by feverMult)
    Matter.Engine.update(this.engine, scaledDelta);

    // 3. Update Enemy Manager (Speeds up AI by feverMult)
    this.enemyManager.update(
        scaledDelta, 
        this.vfxManager, 
        this.state, 
        this.shapesLayer,
        this.rank,
        (bullet) => this.enemyBullets.push(bullet)
    );
    this.updateCaptureLogic(scaledDelta);

    // 4. Update VFX
    this.vfxManager.update(scaledDelta);

    // 5. Update Screen Shake
    if (this.shakeIntensity > 0.1) {
        this.pixiApp.stage.x = (Math.random() - 0.5) * this.shakeIntensity;
        this.pixiApp.stage.y = (Math.random() - 0.5) * this.shakeIntensity;
        this.shakeIntensity *= this.shakeDecay;
    } else {
        this.pixiApp.stage.x = 0;
        this.pixiApp.stage.y = 0;
        this.shakeIntensity = 0;
    }

    // 6. Fever Mode Logic
    if (this.isFeverMode) {
        this.feverTimer -= delta;
        if (this.feverTimer <= 0) {
            this.endFeverMode();
        }
    } else {
        // Heat Decay
        this.heatDecayTimer += delta;
        if (this.heatDecayTimer > this.HEAT_DECAY_DELAY && this.heat > 0) {
            this.heat = Math.max(0, this.heat - this.HEAT_DECAY_RATE * delta);
            this.uiManager.updateHeatBar(this.heat, false);
        }
        
        if (this.heat >= 100) {
            this.startFeverMode();
        }
    }

    // 7. Level progression
    if (this.state === GameState.ATTACK && 
        this.enemyManager.enemies.length === 0 && 
        this.vfxManager.getParticleCount() === 0) {
        
        this.state = GameState.CLEAR;
        this.stateTimer = 0;
        console.log("Stage Cleared! Waiting for delay...");
    }

    // 8. Game State Logic
    this.updateGameState(delta);

    // 8. Synchronize PixiJS objects with Matter.js bodies
    const bodies = Matter.Composite.allBodies(this.engine.world);
    for (const body of bodies) {
      if (body.plugin && body.plugin.sprite) {
        const sprite = body.plugin.sprite as (PIXI.Container | Fighter);
        
        // Skip if destroyed
        if ((sprite as any).destroyed) continue;

        // Sync position and rotation directly
        sprite.x = body.position.x;
        sprite.y = body.position.y;
        sprite.rotation = body.angle;

        // Custom update for animations/visuals (Fighter only for now, Enemy handled separately)
        if (body.label === 'Player' && 'update' in sprite) {
           (sprite as any).update();
        }

        // Clamp player position
        if (body.label === 'Player') {
            const buffer = 20;
            if (body.position.x < buffer) {
                Matter.Body.setPosition(body, { x: buffer, y: body.position.y });
                Matter.Body.setVelocity(body, { x: 0, y: 0 });
            } else if (body.position.x > GAME_WIDTH - buffer) {
                Matter.Body.setPosition(body, { x: GAME_WIDTH - buffer, y: body.position.y });
                Matter.Body.setVelocity(body, { x: 0, y: 0 });
            }
        }
      }
    }

    // 4. Bullet Cleanup
    for (let i = this.bullets.length - 1; i >= 0; i--) {
        const bullet = this.bullets[i];
        if (bullet.destroyed || bullet.y < -50) {
            if (!bullet.destroyed) {
                bullet.destroyBullet(this.engine.world);
            }
            this.bullets.splice(i, 1);
        }
    }

    // 5. 敵人子彈清理 (一碰到螢幕底部 580px 即清除)
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
        const bullet = this.enemyBullets[i];
        bullet.update();
        if (bullet.destroyed || bullet.y > 580) {
            if (!bullet.destroyed) {
                bullet.destroyBullet(this.engine.world);
            }
            this.enemyBullets.splice(i, 1);
        }
    }
  }

  private handlePlayerHit() {
      if (this.player.isInvulnerable) return;

      this.lives--;
      this.uiManager.updateLives(this.lives);
      
      // 原地爆炸
      this.vfxManager.createExplosion(this.player.x, this.player.y, 0x00FFFF, 3);
      this.shakeIntensity = 20;

      // 隱藏戰機並停止物理
      this.player.visible = false;
      this.player.state = 'DEAD';
      Matter.Body.setPosition(this.player.body, { x: -1000, y: -1000 });
      Matter.Body.setVelocity(this.player.body, { x: 0, y: 0 });

      // 罰分：重置熱度
      this.heat = Math.max(0, this.heat - 30);
      this.uiManager.updateHeatBar(this.heat, false);

      // GDD: 玩家被擊落 (-15 Rank)
      this.rank = Math.max(0, this.rank - 15);

      if (this.lives < 0) {
          this.gameOver();
      } else {
          // 延遲復活
          setTimeout(() => {
              this.player.visible = true;
              this.player.state = 'ALIVE';
              this.player.health = 100;
              this.player.invulnerableTimer = 2000; // 2秒無敵
              Matter.Body.setPosition(this.player.body, { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 80 });
              console.log("戰機於地板復活，進入短暫無敵狀態。");
          }, 1000);
      }
  }

  private gameOver() {
      this.state = GameState.GAMEOVER;
      const accuracy = this.shotsTotal > 0 ? (this.shotsHit / this.shotsTotal) * 100 : 0;
      this.uiManager.showGameOverPanel(this.score, accuracy, this.rank, () => this.restartGame());
      console.log(`Game Over! Accuracy: ${accuracy.toFixed(1)}%, Score: ${this.score}, Rank: ${this.rank}`);
  }

  private restartGame() {
      // Hide Game Over UI
      this.uiManager.hideGameOverPanel();

      // Clear all enemies (Enemy extends PIXI.Container, so it IS the sprite)
      this.enemyManager.enemies.forEach(e => {
          this.shapesLayer.removeChild(e);
          if (e.body) Matter.World.remove(this.engine.world, e.body);
      });
      this.enemyManager.enemies = [];

      // Clear all enemy bullets (EnemyBullet extends PIXI.Container)
      this.enemyBullets.forEach(b => {
          this.shapesLayer.removeChild(b);
          if (b.body) Matter.World.remove(this.engine.world, b.body);
      });
      this.enemyBullets = [];

      // Clear all player bullets
      this.bullets.forEach(b => b.destroyBullet(this.engine.world));
      this.bullets = [];

      // Reset player
      if (this.player.body) {
          Matter.Body.setPosition(this.player.body, { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 80 });
      }
      this.player.setDouble(false);
      this.player.state = 'ALIVE';
      this.player.visible = true;
      this.player.alpha = 1;

      // Reset game state
      this.score = 0;
      this.lives = 3;
      this.heat = 0;
      this.isFeverMode = false;
      this.feverTimer = 0;
      this.rank = 0;
      this.currentLevel = 1;
      this.challengeHits = 0;
      this.stateTimer = 0;
      this.shotsTotal = 0;
      this.shotsHit = 0;

      // Update UI
      this.uiManager.updateScore(0, this.highScore);
      this.uiManager.updateLives(3);
      this.uiManager.updateLevel(1);
      this.uiManager.updateHeatBar(0, false);

      // Restart from Level 1
      this.state = GameState.INTRO;
      this.enemyManager.spawnLevelSequence(1);
      console.log('Game Restarted!');
  }

  private updateGameState(delta: number) {
      this.stateTimer += delta;

      switch (this.state) {
          case GameState.INTRO:
              if (this.stateTimer > 2000) {
                  this.state = GameState.ENTRY;
                  this.stateTimer = 0;
                  this.spawnLevel(this.currentLevel);
                  console.log("State: ENTRY");
              }
              break;
          case GameState.ENTRY:
              // Check if all enemies are in FORMATION mode
              const allInFormation = this.enemyManager.enemies.every(e => e.state === 'FORMATION');
              if (allInFormation && this.enemyManager.enemies.length > 0) {
                  this.state = GameState.FORMATION;
                  this.stateTimer = 0;
                  console.log("State: FORMATION");
              }
              break;
          case GameState.FORMATION:
              // Wait for a few seconds before starting attacks
              const waitTime = this.enemyManager.isChallengeStage ? 1000 : 3000;
              if (this.stateTimer > waitTime) {
                  this.state = GameState.ATTACK;
                  this.stateTimer = 0;
                  console.log("State: ATTACK");
              }
              break;
          case GameState.ATTACK:
              // In this state, EnemyManager will trigger diving logic
              break;
              
          case GameState.CLEAR:
              // GDD: Enemies Zero Check + Delay 60 frames (approx 1s)
              if (this.stateTimer > 1000) {
                  const isChallenging = [3, 7, 11, 19, 27].includes(this.currentLevel);
                  if (isChallenging) {
                      this.state = GameState.BONUS;
                      this.stateTimer = 0;
                      
                      // Calculate Bonus
                      let bonus = 0;
                      if (this.challengeHits >= 40) {
                          bonus = 10000;
                      } else if (this.challengeHits >= 30) {
                          bonus = 3000;
                      } else if (this.challengeHits >= 20) {
                          bonus = 2000;
                      } else if (this.challengeHits >= 10) {
                          bonus = 1000;
                      }
                      
                      this.addScore(bonus);
                      this.uiManager.showStageBonus(this.challengeHits, bonus, true);
                  } else {
                      this.nextLevel();
                  }
              }
              break;
              
          case GameState.BONUS:
              // Wait for user or timer to proceed
              if (this.stateTimer > 5000) { // Auto-proceed after 5s
                  this.uiManager.hideStageBonus();
                  this.nextLevel();
              }
              break;
      }
  }

  private updateCaptureLogic(delta: number) {
      if (!this.player) return;
      const deltaFactor = delta / 16.6;

      const boss = this.enemyManager.enemies.find(e => e.sides === 6 && e.state === 'CAPTURING');
      if (boss) {
          // Create beam if not exists
          if (!boss.tractorBeam) {
              boss.tractorBeam = this.vfxManager.createTractorBeam(boss.x, boss.y + 40, 400);
          }

          // Check if player is in beam (Triangle area detection)
          const beamX = boss.x;
          const beamY = boss.y + 10; // offset for boss center
          const topWidth = 16;
          const bottomWidth = 48;
          const beamHeight = 400;

          if (this.player.state === 'ALIVE') {
              const relativeY = this.player.y - beamY;
              if (relativeY > 0 && relativeY < beamHeight) {
                  const currentWidth = topWidth + (bottomWidth - topWidth) * (relativeY / beamHeight);
                  const distToCenter = Math.abs(this.player.x - beamX);
                  
                  if (distToCenter < currentWidth / 2) {
                      console.log("Player caught in Tractor Beam!");
                      this.player.state = 'SPINNING_CAPTURE';
                      boss.capturedFighter = this.player;

                      // Disable collision so captured fighter doesn't collide
                      Matter.Body.set(this.player.body, 'collisionFilter', { mask: 0, category: 0 });
                      
                      if (this.lives >= 0) {
                          this.lives--;
                          this.uiManager.updateLives(this.lives);
                          // Delay replacement spawn to give capture feel
                          setTimeout(() => this.spawnReplacementPlayer(), 1500);
                      }
                  }
              }
          }
      }

      // Handle SPINNING_CAPTURE player movement (Pulled up to Boss side)
      if (this.player.state === 'SPINNING_CAPTURE' && boss) {
          // Pull toward Boss
          const targetX = boss.x;
          const targetY = boss.y;
          const dx = targetX - this.player.x;
          const dy = targetY - this.player.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const pullSpeed = 5 * deltaFactor;
          if (dist > 8) {
              Matter.Body.setPosition(this.player.body, {
                  x: this.player.x + (dx / dist) * Math.min(dist, pullSpeed),
                  y: this.player.y + (dy / dist) * Math.min(dist, pullSpeed)
              });
          } else {
              // Snapped to Boss — switch to CAPTURED, park to Boss's left side
              this.player.state = 'CAPTURED';
              this.player.setTint(0xFF4444);  // Turn red (hostile captive)
              Matter.Body.setPosition(this.player.body, { x: boss.x - 40, y: boss.y });
          }
      }

      // Handle CAPTURED state: follow Boss into formation
      if (this.player.state === 'CAPTURED' && boss) {
          // Ride beside Boss (left side, no physics pull needed)
          Matter.Body.setPosition(this.player.body, { x: boss.x - 40, y: boss.y });
          Matter.Body.setVelocity(this.player.body, { x: 0, y: 0 });
      }

      // Handle Falling Rescued/Destroyed Fighter (Boss killed while capturing)
      if ((this.player.state === 'CAPTURED' || this.player.state === 'SPINNING_CAPTURE') && !boss && this.player.y < GAME_HEIGHT) {
          // Boss was killed! Spiraling down per GDD
          const fallSpeed = 3 * deltaFactor;
          const spiralFreq = 0.1;
          
          let nextX = this.player.x + Math.sin(this.player.y * spiralFreq) * 2;
          let nextY = this.player.y + fallSpeed;

          // Check for magnetize (Logic: alignment then snap)
          if (this.replacementPlayer && this.replacementPlayer.state === 'ALIVE') {
              const dx = this.player.x - this.replacementPlayer.x;
              const dy = this.player.y - this.replacementPlayer.y;
              const dist = Math.sqrt(dx*dx + dy*dy);

              // GDD: Align X-coordinates when close to player height
              if (this.player.y > GAME_HEIGHT * 0.65) {
                  const alignSpeed = 0.15 * deltaFactor;
                  nextX = this.player.x - dx * alignSpeed;
              }

              if (dist < 30) {
                  this.completeRescue();
              }
          }

          Matter.Body.setPosition(this.player.body, { x: nextX, y: nextY });

          // Fell off screen without rescue — remove captured fighter & promote replacement
          if (this.player.y > GAME_HEIGHT + 20) {
              // Clean up captured player
              if (this.player.body) Matter.World.remove(this.engine.world, this.player.body);
              this.shapesLayer.removeChild(this.player);

              // Promote replacement as main player (it was already spawned in spawnReplacementPlayer)
              if (this.replacementPlayer) {
                  this.player = this.replacementPlayer;
                  this.replacementPlayer = null;
                  this.player.setTint(0x00FFFF); // reset to neon cyan
                  this.enemyManager.playerRef = this.player; // UPDATE REFERENCE
              } else {
                  // No replacement yet — respawn fresh
                  this.player = new Fighter();
                  this.shapesLayer.addChild(this.player);
                  this.player.initPhysics(GAME_WIDTH / 2, GAME_HEIGHT - 80, this.engine.world);
                  this.player.state = 'ALIVE';
                  this.player.invulnerableTimer = 2000;
                  this.enemyManager.playerRef = this.player; // UPDATE REFERENCE
              }
          }
      }
  }

  private spawnReplacementPlayer() {
      if (this.replacementPlayer) return; // already exists
      this.replacementPlayer = new Fighter();
      this.replacementPlayer.initPhysics(GAME_WIDTH / 2, GAME_HEIGHT - 80, this.engine.world);
      this.replacementPlayer.state = 'ALIVE';
      this.replacementPlayer.invulnerableTimer = 2000; // 2s invulnerable
      this.shapesLayer.addChild(this.replacementPlayer);
      console.log("Replacement Fighter spawned!");
  }

  private completeRescue() {
      if (!this.replacementPlayer) return;
      this.replacementPlayer.setDouble(true);
      
      // Visual Flash on merger
      this.vfxManager.createFeverParticles(this.replacementPlayer.x, this.replacementPlayer.y);
      console.log("CLICK! Magnetized 合體.");
      
      // Cleanup the rescued fighter
      if (this.player.body) Matter.World.remove(this.engine.world, this.player.body);
      this.shapesLayer.removeChild(this.player);
      
      // The replacement is now our primary player
      this.player = this.replacementPlayer;
      this.replacementPlayer = null;
      this.enemyManager.playerRef = this.player; // UPDATE REFERENCE
      
      console.log("RESCUE COMPLETE: DUAL FIGHTER ENABLED!");
      
      // GDD: 雙機合體 (+10 Rank)
      this.rank = Math.min(255, this.rank + 10);
  }

  private handleInput(delta: number) {
      const activeFighter = this.replacementPlayer || this.player;
      if (!activeFighter || !activeFighter.body || activeFighter.state !== 'ALIVE') return;

      const deltaFactor = delta / 16.66;
      const moveSpeed = PLAYER_SPEED * deltaFactor;
      let vx = 0;

      if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
          vx = -moveSpeed;
      } else if (this.keys['ArrowRight'] || this.keys['KeyD']) {
          vx = moveSpeed;
      }

      Matter.Body.setVelocity(activeFighter.body, { x: vx, y: 0 });

      // Handle Shooting
      if (this.keys['Space']) {
          // GDD: Max 2 bullets on screen
          if (this.bullets.length < 2) {
              const newBullets = activeFighter.fire(this.engine.world, this.shapesLayer);
              if (newBullets) {
                  this.bullets.push(...newBullets);
                  this.shotsTotal += newBullets.length;
              }
          }
      }
  }

  private addScore(points: number) {
      let finalPoints = points;
      // GDD: Fever Mode Score Multiplier x2.0
      if (this.isFeverMode) {
          finalPoints = Math.floor(points * 2.0);
      }
      this.score += finalPoints;
      if (this.score > this.highScore) {
          this.highScore = this.score;
          localStorage.setItem('antigravity_highscore', this.highScore.toString());
      }
      this.uiManager.updateScore(this.score, this.highScore);
  }

  private updateHeat(amount: number) {
      if (this.isFeverMode) return;
      
      this.heat = Math.min(100, this.heat + amount);
      this.heatDecayTimer = 0; // Reset decay timer on gain
      this.uiManager.updateHeatBar(this.heat, false);
  }

  private startFeverMode() {
      this.isFeverMode = true;
      this.feverTimer = this.FEVER_DURATION;
      this.player.isPiercing = true;
      this.player.fireRateMultiplier = 2;
      this.vfxManager.createFeverParticles(400, 300); // Burst from center center
      this.uiManager.showFeverFlash();
      this.uiManager.setFeverTone(true);
      this.uiManager.updateHeatBar(100, true);
      console.log("FEVER MODE START");
  }

  private endFeverMode() {
      this.isFeverMode = false;
      this.heat = 0;
      this.player.isPiercing = false;
      this.player.fireRateMultiplier = 1;
      this.uiManager.setFeverTone(false);
      this.uiManager.updateHeatBar(0, false);
      console.log("FEVER MODE END");
  }

  private nextLevel() {
      this.currentLevel++;
      
      // GDD: 5關為一個「五角星別針」，1關為一個「藍紅條紋」
      this.uiManager.updateLevel(this.currentLevel);
      
      // GDD: 關卡完成 (+5 Rank)
      this.rank = Math.min(255, this.rank + 5);
      
      this.state = GameState.INTRO;
      this.stateTimer = 0;
  }

  private spawnLevel(level: number) {
      this.state = GameState.ENTRY;
      this.stateTimer = 0;
      this.challengeHits = 0;
      
      this.enemyManager.spawnLevelSequence(level);
      console.log(`Level ${level} Sequence Started | Rank: ${this.rank} | Challenge: ${this.enemyManager.isChallengeStage}`);
  }

  /**
   * Helper to create a basic synced object for testing
   */
  public createBox(x: number, y: number, width: number, height: number, color: number) {
    const graphics = new PIXI.Graphics();
    graphics.rect(-width / 2, -height / 2, width, height).fill(color);
    this.shapesLayer.addChild(graphics);

    const body = Matter.Bodies.rectangle(x, y, width, height, {
      plugin: { sprite: graphics }
    });
    Matter.World.add(this.engine.world, body);
    
    return body;
  }

  /**
   * Initialize Cyber Grid background (GDD: 可動態滾動的格線)
   */
  private initCyberGrid() {
    this.gridGraphics = new PIXI.Graphics();
    this.bgLayer.addChildAt(this.gridGraphics, 0);
    this.drawCyberGrid();
  }

  private drawCyberGrid() {
    this.gridGraphics.clear();
    const gridColor = 0x333333; // GDD 規範: Dim Gray
    const gridSpacing = 50;

    // Vertical lines
    for (let x = 0; x <= GAME_WIDTH; x += gridSpacing) {
      this.gridGraphics
        .moveTo(x, 0)
        .lineTo(x, GAME_HEIGHT)
        .stroke({ color: gridColor, width: 1, alpha: 0.3 });
    }

    // Horizontal lines (scrolling)
    for (let y = -gridSpacing + this.gridScrollOffset; y <= GAME_HEIGHT + gridSpacing; y += gridSpacing) {
      this.gridGraphics
        .moveTo(0, y)
        .lineTo(GAME_WIDTH, y)
        .stroke({ color: gridColor, width: 1, alpha: 0.3 });
    }
  }
}
