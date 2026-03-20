import * as PIXI from 'pixi.js';
import * as Matter from 'matter-js';
import { CATEGORY_BULLET, BULLET_MASK } from '../config/GameConfig';

export class Bullet extends PIXI.Container {
    public body!: Matter.Body;
    private glowGraphics: PIXI.Graphics;
    private mainGraphics: PIXI.Graphics;
    private color: number = 0xFFFFFF; // White (GDD 規範)
    private bulletWidth: number = 4;
    private bulletHeight: number = 15;
    private trailPoints: { x: number, y: number, alpha: number }[] = [];
    private maxTrailPoints: number = 5;
    public isPiercing: boolean = false;

    constructor(x: number, y: number, color?: number) {
        super();
        this.x = x;
        this.y = y;
        if (color !== undefined) this.color = color;

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
        
        for (let i = 0; i < this.trailPoints.length; i++) {
            const p = this.trailPoints[i];
            const sizeScale = 1 - (i / this.maxTrailPoints);
            this.glowGraphics
                .rect(-this.bulletWidth * sizeScale / 2, p.y - this.bulletHeight / 2, this.bulletWidth * sizeScale, this.bulletHeight * sizeScale)
                .fill({ color: this.color, alpha: p.alpha * 0.3 });
        }

        this.glowGraphics
            .rect(-this.bulletWidth / 2, -this.bulletHeight / 2, this.bulletWidth, this.bulletHeight)
            .fill({ color: this.color, alpha: 0.6 });

        this.mainGraphics
            .rect(-this.bulletWidth / 2, -this.bulletHeight / 2, this.bulletWidth, this.bulletHeight)
            .fill({ color: this.color, alpha: 0.9 })
            .stroke({ color: 0xFFFFFF, width: 1, alpha: 0.6 });
        
        this.mainGraphics
            .rect(-this.bulletWidth / 4, -this.bulletHeight * 0.4, this.bulletWidth / 2, this.bulletHeight * 0.8)
            .fill({ color: 0xFFFFFF, alpha: 1 });
    }


    public initPhysics(world: Matter.World, velocityY: number) {
        this.body = Matter.Bodies.rectangle(this.x, this.y, this.bulletWidth, this.bulletHeight, {
            isSensor: true,
            label: "Bullet",
            frictionAir: 0,
            collisionFilter: {
                category: CATEGORY_BULLET,
                mask: BULLET_MASK
            },
            plugin: { sprite: this }
        });

        Matter.Body.setVelocity(this.body, { x: 0, y: velocityY });
        Matter.World.add(world, this.body);
    }

    public update() {
        if (this.body) {
            this.x = this.body.position.x;
            this.y = this.body.position.y;
            this.rotation = this.body.angle;

            this.updateTrail();
            this.draw();
        }
    }

    private updateTrail() {
        this.trailPoints.unshift({ x: 0, y: 0, alpha: 0.6 });
        
        for (let i = 0; i < this.trailPoints.length; i++) {
            this.trailPoints[i].y += 3;
            this.trailPoints[i].alpha *= 0.8;
        }

        if (this.trailPoints.length > this.maxTrailPoints) {
            this.trailPoints.pop();
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
