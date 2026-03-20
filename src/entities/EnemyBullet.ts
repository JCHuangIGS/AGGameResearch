import * as PIXI from 'pixi.js';
import * as Matter from 'matter-js';
import { CATEGORY_ENEMY_BULLET, ENEMY_BULLET_MASK } from '../config/GameConfig';

export class EnemyBullet extends PIXI.Container {
    public body!: Matter.Body;
    private glowGraphics: PIXI.Graphics;
    private mainGraphics: PIXI.Graphics;
    private color: number = 0xFF4500; // Orange-Red (GDD 規範)
    private bulletWidth: number = 4;
    private bulletHeight: number = 10;
    
    constructor(x: number, y: number) {
        super();
        this.x = x;
        this.y = y;

        this.glowGraphics = new PIXI.Graphics();
        this.mainGraphics = new PIXI.Graphics();
        this.addChild(this.glowGraphics);
        this.addChild(this.mainGraphics);
        
        this.draw();
        
        const blurFilter = new PIXI.BlurFilter();
        blurFilter.blur = 4;
        this.glowGraphics.filters = [blurFilter];
    }

    private draw() {
        this.mainGraphics.clear();
        this.glowGraphics.clear();
        
        this.glowGraphics
            .rect(-this.bulletWidth / 2, -this.bulletHeight / 2, this.bulletWidth, this.bulletHeight)
            .fill({ color: this.color, alpha: 0.6 });

        this.mainGraphics
            .rect(-this.bulletWidth / 2, -this.bulletHeight / 2, this.bulletWidth, this.bulletHeight)
            .fill({ color: this.color, alpha: 0.9 })
            .stroke({ color: 0xFFFFFF, width: 1, alpha: 0.6 });
    }

    public initPhysics(world: Matter.World, velocity: { x: number, y: number }) {
        this.body = Matter.Bodies.rectangle(this.x, this.y, this.bulletWidth, this.bulletHeight, {
            isSensor: true,
            label: "EnemyBullet",
            frictionAir: 0,
            collisionFilter: {
                category: CATEGORY_ENEMY_BULLET,
                mask: ENEMY_BULLET_MASK
            },
            plugin: { sprite: this }
        });

        Matter.Body.setVelocity(this.body, velocity);
        Matter.World.add(world, this.body);
    }

    public update() {
        if (this.body) {
            this.x = this.body.position.x;
            this.y = this.body.position.y;
            this.rotation = this.body.angle;
        }
    }

    public destroyBullet(world: Matter.World) {
        if (this.body) {
            if (this.body.plugin) {
                this.body.plugin.sprite = null;
            }
            Matter.World.remove(world, this.body);
            (this.body as any) = null;
        }
        this.destroy({ children: true });
    }
}
