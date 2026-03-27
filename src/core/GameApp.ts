import * as PIXI from 'pixi.js';
import { AdvancedBloomFilter } from 'pixi-filters';
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
import { SoundManager } from './SoundManager';


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

  // Touch / Pointer
  private isPointerDown: boolean = false;
  private lastPointerX: number = 0;

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

  // GDD 5.2: Extra Lives (Extend) System
  private nextExtendAt: number = 20000; // First extend at 20,000

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
    
    // Initialize Audio
    document.addEventListener('click', () => SoundManager.getInstance().init(), { once: true });
    document.addEventListener('keydown', () => SoundManager.getInstance().init(), { once: true });

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

    // Apply Neon Bloom Filter (Phase 2)
    const bloomFilter = new AdvancedBloomFilter({
        threshold: 0.25,
        bloomScale: 1.3,
        brightness: 1.0,
        blur: 5
    });
    this.shapesLayer.filters = [bloomFilter];
    this.particlesLayer.filters = [bloomFilter];

    // 2.1 Initialize Cyber Grid Background (GDD 規範)
    this.initCyberGrid();

    // 2.2 Initialize Stars (三層星空動態視差滾動)
    for (let i = 0; i < 120; i++) {
        const star = new PIXI.Graphics();
        const x = Math.random() * GAME_WIDTH;
        const y = Math.random() * GAME_HEIGHT;
        
        let pLayer = Math.random();
        let size, speed, alpha, color;
        
        // Parallax Layers
        if (pLayer < 0.6) { 
            // Back layer: slow, small, dark blue
            size = 0.8 + Math.random(); speed = 0.5 + Math.random()*0.5; alpha = 0.3; color = 0x8888AA;
        } else if (pLayer < 0.9) { 
            // Mid layer: medium
            size = 1.5 + Math.random(); speed = 1.5 + Math.random(); alpha = 0.6; color = 0xBBBBFF;
        } else { 
            // Front layer: fast, big, bright white
            size = 2.5 + Math.random(); speed = 3.5 + Math.random()*2; alpha = 0.9; color = 0xFFFFFF;
        }
        
        star.circle(0, 0, size).fill({ color: color, alpha: alpha });
        star.x = x;
        star.y = y;
        (star as any).speed = speed;
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

    // Setup Pointer/Touch Input
    this.pixiApp.canvas.style.touchAction = 'none'; // Prevent scrolling
    this.pixiApp.canvas.addEventListener('pointerdown', (e) => {
        this.isPointerDown = true;
        this.lastPointerX = e.clientX;
    });
    this.pixiApp.canvas.addEventListener('pointermove', (e) => {
        if (!this.isPointerDown) return;
        const activeFighter = this.replacementPlayer || this.player;
        if (!activeFighter || !activeFighter.body || activeFighter.state !== 'ALIVE') return;
        
        const dx = e.clientX - this.lastPointerX;
        this.lastPointerX = e.clientX;
        
        // Relative Touch Sensitivity
        const newX = activeFighter.x + dx * 1.5;
        Matter.Body.setPosition(activeFighter.body, { x: newX, y: activeFighter.body.position.y });
    });
    const resetPointer = () => this.isPointerDown = false;
    this.pixiApp.canvas.addEventListener('pointerup', resetPointer);
    this.pixiApp.canvas.addEventListener('pointercancel', resetPointer);
    this.pixiApp.canvas.addEventListener('pointerout', resetPointer);

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
              (hostileFighter as any).isHostile = true;
              
              hostileFighter.initPhysics(fighter.x, fighter.y, this.engine.world);
              this.shapesLayer.addChild(hostileFighter);
              this.enemyManager.enemies.push(hostileFighter);
              
              // Start diving immediately
              hostileFighter.state = 'DIVING';
              
              // BUG FIX: 完整清除被俘虜戰機（含 Matter.js body），避免殘留幽靈物件
              fighter.state = 'DEAD';
              (fighter as any)._isFalling = false;
              if (fighter.body) {
                  Matter.World.remove(this.engine.world, fighter.body);
              }
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
                    (fighter as any)._isFalling = false;
                    // BUG FIX: 從 Matter 世界移除 body，避免殘留
                    if (fighter.body) {
                        Matter.World.remove(this.engine.world, fighter.body);
                    }
                    this.shapesLayer.removeChild(fighter);
                    console.log("RESCUE FAILED: Captured fighter destroyed!");
                }
            }

            // EnemyBullet vs Player
            if ((bodyA.label === 'EnemyBullet' && bodyB.label === 'Player') ||
                (bodyB.label === 'EnemyBullet' && bodyA.label === 'Player')) {
                const bulletBody = bodyA.label === 'EnemyBullet' ? bodyA : bodyB;
                const playerBody = bodyA.label === 'Player' ? bodyA : bodyB;
                const bullet = bulletBody.plugin.sprite as EnemyBullet;
                const hitFighter = playerBody.plugin?.sprite as Fighter;
                // BUG FIX: 只有 ALIVE 狀態的戰機才會被敵方子彈擊中
                if (bullet && !bullet.destroyed && hitFighter && hitFighter.state === 'ALIVE') {
                    bullet.destroyBullet(this.engine.world);
                    this.handlePlayerHit();
                }
            }

            if ((bodyA.label === 'Player' && bodyB.label === 'Enemy') ||
                (bodyB.label === 'Player' && bodyA.label === 'Enemy')) {
                const enemyBody = bodyA.label === 'Enemy' ? bodyA : bodyB;
                const fighterBody = bodyA.label === 'Player' ? bodyA : bodyB;

                const player = fighterBody.plugin?.sprite as Fighter;
                const enemy = enemyBody.plugin?.sprite as any;

                // BUG FIX: 只有 ALIVE 狀態才處理碰撞，避免 CAPTURED/DEAD 狀態觸發
                if (player && enemy && player.state === 'ALIVE' && !player.destroyed && !enemy.destroyed && !player.isInvulnerable) {
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
    const normalDeltaFactor = delta / 16.6;

    // Fever only affects player — compute a scaled delta for player input only
    const feverMult = this.isFeverMode ? 1.5 : 1.0;
    const playerDelta = delta * feverMult;

    // 0. Update Cyber Grid scroll
    this.gridScrollOffset += 0.5 * normalDeltaFactor;
    if (this.gridScrollOffset >= 50) this.gridScrollOffset -= 50;
    this.drawCyberGrid();

    // 0.1 Update Stars (Pause during BONUS state as per GDD)
    if (this.state !== GameState.BONUS) {
        this.stars.forEach(star => {
            star.y += (star as any).speed * normalDeltaFactor;
            if (star.y > GAME_HEIGHT) {
                star.y = -10;
                star.x = Math.random() * GAME_WIDTH;
            }
        });
    }

    // 1. Handle Input — player moves & fires faster during fever
    this.handleInput(playerDelta);

    // 2. Update Matter.js engine — normal speed (enemies use normal delta)
    Matter.Engine.update(this.engine, delta);

    // 3. Update Enemy Manager — normal speed (enemies NOT affected by fever)
    this.enemyManager.update(
        delta, 
        this.vfxManager, 
        this.state, 
        this.shapesLayer,
        this.rank,
        (bullet) => this.enemyBullets.push(bullet)
    );
    this.updateCaptureLogic(delta);

    // 4. Update VFX — normal speed
    this.vfxManager.update(delta);

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
    if ((this.state === GameState.ATTACK || this.state === GameState.ENTRY) && 
        !this.enemyManager.isSpawning &&
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

    // 5. 敵人子彈清理 (一路落到畫面之外)
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
        const bullet = this.enemyBullets[i];
        bullet.update();
        if (bullet.destroyed || bullet.y > GAME_HEIGHT + 20) {
            if (!bullet.destroyed) {
                bullet.destroyBullet(this.engine.world);
            }
            this.enemyBullets.splice(i, 1);
        }
    }
  }

  private handlePlayerHit() {
      // BUG FIX: 操作的一定是「當前活動戰機」，而非固定的 this.player
      const activeFighter = this.replacementPlayer || this.player;
      if (!activeFighter || activeFighter.isInvulnerable) return;

      // GDD Phase 4: 合體機中彈 → 僅退回單機模式，不扣命
      if (activeFighter.isDouble) {
          activeFighter.setDouble(false);
          activeFighter.invulnerableTimer = 1500; // 短暫無敵
          this.vfxManager.createExplosion(activeFighter.x + 14, activeFighter.y, 0x00FFFF, 3);
          this.shakeIntensity = 10;
          SoundManager.getInstance().playExplosionSound();
          console.log("Dual Fighter hit — reverted to single mode!");
          return;
      }

      this.lives--;
      this.uiManager.updateLives(this.lives);
      
      // 原地爆炸
      this.vfxManager.createExplosion(activeFighter.x, activeFighter.y, 0x00FFFF, 3);
      this.shakeIntensity = 20;

      // 隱藏戰機並停止物理
      activeFighter.visible = false;
      activeFighter.state = 'DEAD';
      Matter.Body.setPosition(activeFighter.body, { x: -1000, y: -1000 });
      Matter.Body.setVelocity(activeFighter.body, { x: 0, y: 0 });

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
              activeFighter.visible = true;
              activeFighter.state = 'ALIVE';
              activeFighter.health = 100;
              activeFighter.invulnerableTimer = 2000; // 2秒無敵
              Matter.Body.setPosition(activeFighter.body, { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 80 });
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

      // --- 1. Clean up all enemies (including tractor beam VFX) ---
      this.enemyManager.enemies.forEach(e => {
          // Cleanup tractor beam VFX if active
          if (e.tractorBeam && e.tractorBeam.cleanup) {
              e.tractorBeam.cleanup();
              e.tractorBeam = null;
          }
          // Release capturedFighter reference
          e.capturedFighter = null;
          this.shapesLayer.removeChild(e);
          if (e.body) Matter.World.remove(this.engine.world, e.body);
      });
      this.enemyManager.enemies = [];

      // Reset EnemyManager internal timers
      this.enemyManager.resetTimers();

      // --- 2. Clean up all bullets ---
      this.enemyBullets.forEach(b => {
          this.shapesLayer.removeChild(b);
          if (b.body) Matter.World.remove(this.engine.world, b.body);
      });
      this.enemyBullets = [];

      this.bullets.forEach(b => b.destroyBullet(this.engine.world));
      this.bullets = [];

      // --- 3. Clean up replacement player (if exists from capture mechanic) ---
      if (this.replacementPlayer) {
          if (this.replacementPlayer.body) {
              Matter.World.remove(this.engine.world, this.replacementPlayer.body);
          }
          this.shapesLayer.removeChild(this.replacementPlayer);
          this.replacementPlayer = null;
      }

      // --- 4. Fully reset primary player ---
      // Remove the old player body first, then recreate cleanly
      if (this.player.body) {
          Matter.World.remove(this.engine.world, this.player.body);
      }
      this.shapesLayer.removeChild(this.player);

      // Create a fresh player instance
      this.player = new Fighter();
      this.shapesLayer.addChild(this.player);
      this.player.initPhysics(GAME_WIDTH / 2, GAME_HEIGHT - 80, this.engine.world);
      this.player.state = 'ALIVE';
      this.player.setDouble(false);
      this.player.setTint(0x00FFFF); // Restore default Cyan
      this.player.isPiercing = false;
      this.player.fireRateMultiplier = 1;
      this.player.invulnerableTimer = 0;
      this.player.visible = true;
      this.player.alpha = 1;
      (this.player as any)._isFalling = false;

      // Update EnemyManager's player reference
      this.enemyManager.playerRef = this.player;

      // --- 5. Clear lingering VFX particles ---
      this.vfxManager.clearAll();

      // --- 6. Reset game state ---
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
      this.nextExtendAt = 20000;
      this.shakeIntensity = 0;

      // --- 7. Update UI ---
      this.uiManager.updateScore(0, this.highScore);
      this.uiManager.updateLives(3);
      this.uiManager.updateLevel(1);
      this.uiManager.updateHeatBar(0, false);
      this.uiManager.setFeverTone(false);

      // --- 8. Restart from Level 1 ---
      this.state = GameState.INTRO;
      this.stateTimer = 0;
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
              if (this.enemyManager.isChallengeStage) {
                  this.state = GameState.ATTACK;
                  this.stateTimer = 0;
                  console.log("State: ATTACK (Challenge)");
              } else {
                  // Check if all enemies are in FORMATION mode
                  const allInFormation = this.enemyManager.enemies.every(e => e.state === 'FORMATION');
                  if (allInFormation && this.enemyManager.enemies.length > 0) {
                      this.state = GameState.FORMATION;
                      this.stateTimer = 0;
                      console.log("State: FORMATION");
                  }
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
                  const isChallenging = this.enemyManager.isChallengeStage;
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
                      SoundManager.getInstance().playStageClearSound(this.challengeHits >= 40);
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

      // --- 1. Find any boss currently in CAPTURING state ---
      const boss = this.enemyManager.enemies.find(e => e.sides === 6 && e.state === 'CAPTURING');
      
      if (boss) {
          // Create beam if not exists, update position to track boss
          if (!boss.tractorBeam) {
              boss.tractorBeam = this.vfxManager.createTractorBeam(boss.x, boss.y + 20, 450);
          } else {
              // GDD Phase 4: 光束跟隨 Boss 位置 (即使 Boss 有微小晃動)
              const beamVisual = boss.tractorBeam as PIXI.Container;
              if (beamVisual && !beamVisual.destroyed) {
                  beamVisual.x = boss.x;
                  beamVisual.y = boss.y + 20;
              }
          }

          // Check if player is in beam (Trapezoid area detection)
          if (this.player.state === 'ALIVE') {
              const beamX = boss.x;
              const beamY = boss.y + 20;
              const topWidth = 20;
              const bottomWidth = 60;
              const beamHeight = 450;

              const relativeY = this.player.y - beamY;
              if (relativeY > 0 && relativeY < beamHeight) {
                  const currentWidth = topWidth + (bottomWidth - topWidth) * (relativeY / beamHeight);
                  const distToCenter = Math.abs(this.player.x - beamX);
                  
                  if (distToCenter < currentWidth / 2) {
                      console.log("Player caught in Tractor Beam!");
                      this.player.state = 'SPINNING_CAPTURE';
                      boss.capturedFighter = this.player;
                      SoundManager.getInstance().playTractorBeamSound(); // GDD 10.2: 牽引光束警報音

                      // Disable collision so captured fighter doesn't interact
                      Matter.Body.set(this.player.body, 'collisionFilter', { mask: 0, category: 0 });
                      
                      // GDD: 扣除一條生命
                      if (this.lives >= 0) {
                          this.lives--;
                          this.uiManager.updateLives(this.lives);
                          
                          if (this.lives < 0) {
                              // Game Over — no more lives to continue
                              setTimeout(() => this.gameOver(), 2000);
                          }
                          // 注意: 替補機不在這裡生成! 要等 Boss 把人質帶回陣位後才生成
                      }
                  }
              }
          }
      }

      // --- 2. Handle SPINNING_CAPTURE: Player spins and gets pulled toward Boss ---
      if (this.player.state === 'SPINNING_CAPTURE') {
          const captureBoss = this.enemyManager.enemies.find(e => e.sides === 6 && e.capturedFighter === this.player);
          
          if (captureBoss) {
              // Pull toward Boss with spiral motion
              const targetX = captureBoss.x + 20; // Park slightly to the right
              const targetY = captureBoss.y;
              const dx = targetX - this.player.x;
              const dy = targetY - this.player.y;
              const dist = Math.sqrt(dx * dx + dy * dy);

              const pullSpeed = 3.5 * deltaFactor;
              
              if (dist > 10) {
                  // Spiral pull: add sine wave to X during ascent
                  const spiralX = Math.sin(Date.now() * 0.008) * 15 * (dist / 300);
                  Matter.Body.setPosition(this.player.body, {
                      x: this.player.x + (dx / dist) * Math.min(dist, pullSpeed) + spiralX * deltaFactor,
                      y: this.player.y + (dy / dist) * Math.min(dist, pullSpeed)
                  });
              } else {
                  // Snapped to Boss — switch to CAPTURED state
                  this.player.state = 'CAPTURED';
                  this.player.setTint(0xFF4444); // Turn red (hostile captive)
                  Matter.Body.setPosition(this.player.body, { x: captureBoss.x + 40, y: captureBoss.y });
                  Matter.Body.setAngle(this.player.body, 0);
                  this.player.scale.set(1); // Reset any pulsing
                  console.log("Fighter captured! Now hostage beside Boss.");
                  
                  // Cleanup beam after capture completes
                  if (captureBoss.tractorBeam && captureBoss.tractorBeam.cleanup) {
                      captureBoss.tractorBeam.cleanup();
                      captureBoss.tractorBeam = null;
                  }
                  // Boss returns to formation (帶著人質飛回)
                  captureBoss.state = 'ENTERING';
                  
                  // Bug 2 Fix: 人質完全黏上 Boss 後，才生成替補機
                  if (this.lives >= 0 && !this.replacementPlayer) {
                      this.spawnReplacementPlayer();
                  }
              }
          } else {
              // Boss was killed during capture pull — fighter falls
              this.startFighterFall();
          }
      }

      // --- 3. Handle CAPTURED state: Follow Boss in formation ---
      if (this.player.state === 'CAPTURED') {
          const hostBoss = this.enemyManager.enemies.find(e => e.sides === 6 && e.capturedFighter === this.player);
          if (hostBoss) {
              // Ride beside Boss (right side)
              Matter.Body.setPosition(this.player.body, { x: hostBoss.x + 40, y: hostBoss.y });
              Matter.Body.setVelocity(this.player.body, { x: 0, y: 0 });
              Matter.Body.setAngle(this.player.body, 0);
          } else {
              // Boss is gone — start falling for potential rescue
              this.startFighterFall();
          }
      }

      // --- 4. Handle FALLING rescued fighter ---
      if (this.player.state === 'DEAD' && (this.player as any)._isFalling) {
          const fallSpeed = 2.8 * deltaFactor;
          const spiralFreq = 0.08;
          
          let nextX = this.player.x + Math.sin(this.player.y * spiralFreq) * 2 * deltaFactor;
          let nextY = this.player.y + fallSpeed;

          // Check for alignment and snap (rescue merge)
          if (this.replacementPlayer && this.replacementPlayer.state === 'ALIVE') {
              const dx = this.player.x - this.replacementPlayer.x;
              const dy = this.player.y - this.replacementPlayer.y;
              const dist = Math.sqrt(dx * dx + dy * dy);

              // GDD: Gradually align X-coordinates when approaching player height
              if (this.player.y > GAME_HEIGHT * 0.6) {
                  const alignSpeed = 0.12 * deltaFactor;
                  nextX = this.player.x - dx * alignSpeed;
              }

              if (dist < 35) {
                  this.completeRescue();
                  return;
              }
          }

          Matter.Body.setPosition(this.player.body, { x: nextX, y: nextY });

          // Fell off screen without rescue — permanently lost
          if (this.player.y > GAME_HEIGHT + 30) {
              this.promoteFighterOrRespawn();
          }
      }
  }

  /** GDD Phase 4: 開始人質戰機自由落體 (可被營救) */
  private startFighterFall() {
      this.player.state = 'DEAD';
      (this.player as any)._isFalling = true;
      this.player.setTint(0xFF8800); // Orange tint while falling
      // Re-enable collision for potential rescue bullet hit
      Matter.Body.set(this.player.body, 'collisionFilter', { 
          mask: 0, category: 0 // Keep collision off: rescue is by proximity, not bullet
      });
      console.log("Captured fighter is falling — rescue window open!");
  }

  /** GDD Phase 4: 推進替換玩家或重新生成 */
  private promoteFighterOrRespawn() {
      // Clean up the falling captured player
      if (this.player.body) Matter.World.remove(this.engine.world, this.player.body);
      this.shapesLayer.removeChild(this.player);

      if (this.replacementPlayer) {
          this.player = this.replacementPlayer;
          this.replacementPlayer = null;
      } else {
          this.player = new Fighter();
          this.shapesLayer.addChild(this.player);
          this.player.initPhysics(GAME_WIDTH / 2, GAME_HEIGHT - 80, this.engine.world);
          this.player.state = 'ALIVE';
          this.player.invulnerableTimer = 2000;
      }
      
      this.enemyManager.playerRef = this.player;
      
      // Apply correct visual and stats depending on current Fever state
      if (this.isFeverMode) {
          this.player.setTint(0x0000FF);
          this.player.isPiercing = true;
          this.player.fireRateMultiplier = 2;
      } else {
          this.player.setTint(0x00FFFF);
          this.player.isPiercing = false;
          this.player.fireRateMultiplier = 1;
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
      
      // Enable double fighter mode
      this.replacementPlayer.setDouble(true);
      
      // GDD Phase 4: 合體特效 — 大量火花 + 螢幕震動
      this.vfxManager.createFeverParticles(this.replacementPlayer.x, this.replacementPlayer.y);
      this.shakeIntensity = 12;
      SoundManager.getInstance().playMergeSound();
      console.log("CLICK! Magnetized 合體.");
      
      // Cleanup the rescued fighter
      (this.player as any)._isFalling = false;
      if (this.player.body) Matter.World.remove(this.engine.world, this.player.body);
      this.shapesLayer.removeChild(this.player);
      
      // The replacement is now our primary player
      this.player = this.replacementPlayer;
      this.replacementPlayer = null;
      this.enemyManager.playerRef = this.player;
      
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

      if (!this.isPointerDown) {
          if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
              vx = -moveSpeed;
          } else if (this.keys['ArrowRight'] || this.keys['KeyD']) {
              vx = moveSpeed;
          }
          Matter.Body.setVelocity(activeFighter.body, { x: vx, y: 0 });
      } else {
          // Zero velocity for physics when dragging to avoid drift
          Matter.Body.setVelocity(activeFighter.body, { x: 0, y: 0 });
      }

      // Handle Shooting (Auto-Fire when pointer is down or Space is pressed)
      if (this.keys['Space'] || this.isPointerDown) {
          // GDD: 單機最多 2 發，雙機最多 4 發 (Fever 期間數量加倍)
          let maxBullets = activeFighter.isDouble ? 4 : 2;
          if (this.isFeverMode) maxBullets *= 2;
          
          if (this.bullets.length < maxBullets) {
              const newBullets = activeFighter.fire(this.engine.world, this.shapesLayer, this.isFeverMode);
              if (newBullets) {
                  this.bullets.push(...newBullets);
                  this.shotsTotal += newBullets.length;
              }
          }
      }
  }

  private addScore(points: number) {
      let finalPoints = points;
      // GDD: Dual Fighter Score Bonus x1.5
      if (this.player && this.player.isDouble) {
          finalPoints = Math.floor(finalPoints * 1.5);
      }
      // GDD: Fever Mode Score Multiplier x2.0
      if (this.isFeverMode) {
          finalPoints = Math.floor(points * 2.0);
      }
      const prevScore = this.score;
      this.score += finalPoints;
      if (this.score > this.highScore) {
          this.highScore = this.score;
          localStorage.setItem('antigravity_highscore', this.highScore.toString());
      }
      this.uiManager.updateScore(this.score, this.highScore);

      // GDD 5.2: Extra Lives — 20k, 70k, then every 70k
      if (prevScore < this.nextExtendAt && this.score >= this.nextExtendAt) {
          this.lives++;
          this.uiManager.updateLives(this.lives);
          SoundManager.getInstance().playExtendSound();
          console.log(`1UP! Extra life at ${this.nextExtendAt}. Lives: ${this.lives}`);
          // Next extend threshold
          this.nextExtendAt = this.nextExtendAt === 20000 ? 70000 : this.nextExtendAt + 70000;
      }
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
      
      const activeFighter = this.replacementPlayer || this.player;
      activeFighter.setTint(0x0000FF);
      
      this.vfxManager.createFeverParticles(400, 300); // Burst from center center
      this.uiManager.showFeverFlash();
      this.uiManager.setFeverTone(true);
      this.uiManager.updateHeatBar(100, true);
      console.log("FEVER MODE START (Deep Blue)");
  }

  private endFeverMode() {
      this.isFeverMode = false;
      this.heat = 0;
      this.player.isPiercing = false;
      this.player.fireRateMultiplier = 1;
      
      const activeFighter = this.replacementPlayer || this.player;
      activeFighter.setTint(0x00FFFF);
      
      this.uiManager.setFeverTone(false);
      this.uiManager.updateHeatBar(0, false);
      console.log("FEVER MODE END (Restored Cyan)");
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
      
      // GDD 5.1: Difficulty Scaling — pass level to enemy manager for bullet speed scaling
      this.enemyManager.currentStage = level;
      this.enemyManager.spawnLevelSequence(level);

      // Show "STAGE X" or "CHALLENGING STAGE" label
      if (this.enemyManager.isChallengeStage) {
          console.log(`=== CHALLENGING STAGE ${level} === | Rank: ${this.rank}`);
      } else {
          console.log(`Level ${level} Sequence Started | Rank: ${this.rank}`);
      }
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
