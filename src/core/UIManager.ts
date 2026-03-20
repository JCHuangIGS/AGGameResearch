import * as PIXI from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/GameConfig';

export class UIManager {
    private stage: PIXI.Container;
    private hudContainer: PIXI.Container;
    
    // UI Elements
    private scoreText!: PIXI.Text;
    private highScoreText!: PIXI.Text;
    private livesText!: PIXI.Text;
    private levelLabel!: PIXI.Text;
    private levelIconsContainer!: PIXI.Container;
    
    // Stage Bonus UI
    private bonusContainer!: PIXI.Container;
    private bonusTitle!: PIXI.Text;
    private bonusHits!: PIXI.Text;
    private bonusPoints!: PIXI.Text;
    
    private heatBarContainer!: PIXI.Container;
    private heatBarBg!: PIXI.Graphics;
    private heatBarFill!: PIXI.Graphics;
    private feverOverlay!: PIXI.Graphics;

    constructor(stage: PIXI.Container) {
        this.stage = stage;
        this.hudContainer = new PIXI.Container();
        this.stage.addChild(this.hudContainer);
        
        this.initHUD();
        this.initFeverOverlay();
    }

    private initHUD() {
        const textStyle = new PIXI.TextStyle({
            fontFamily: 'Arial',
            fontSize: 18,
            fill: '#00FFFF',
            dropShadow: {
                color: '#00FFFF',
                blur: 4,
                distance: 0,
            },
        });

        // Score (Top Left)
        this.scoreText = new PIXI.Text({ text: 'SCORE: 000000', style: textStyle });
        this.scoreText.x = 20;
        this.scoreText.y = 20;
        this.hudContainer.addChild(this.scoreText);

        // High Score (Top Middle)
        this.highScoreText = new PIXI.Text({ text: 'HIGH SCORE: 000000', style: textStyle });
        this.highScoreText.anchor.set(0.5, 0);
        this.highScoreText.x = GAME_WIDTH / 2;
        this.highScoreText.y = 20;
        this.hudContainer.addChild(this.highScoreText);

        // Lives (Bottom Left)
        this.livesText = new PIXI.Text({ text: 'LIVES: 3', style: textStyle });
        this.livesText.x = 20;
        this.livesText.y = 560;
        this.hudContainer.addChild(this.livesText);

        // Level Label (Bottom Right)
        this.levelLabel = new PIXI.Text({ text: 'STAGE', style: textStyle });
        this.levelLabel.anchor.set(1, 1);
        this.levelLabel.x = 780;
        this.levelLabel.y = 540;
        this.hudContainer.addChild(this.levelLabel);

        this.levelIconsContainer = new PIXI.Container();
        this.levelIconsContainer.x = 780;
        this.levelIconsContainer.y = 550;
        this.hudContainer.addChild(this.levelIconsContainer);

        this.initBonusUI(textStyle);
        // Heat Bar (Top, below High Score)
        this.heatBarContainer = new PIXI.Container();
        this.heatBarContainer.x = 300;
        this.heatBarContainer.y = 50;
        this.hudContainer.addChild(this.heatBarContainer);

        this.heatBarBg = new PIXI.Graphics();
        this.heatBarBg.rect(0, 0, 200, 10).fill({ color: 0x333333, alpha: 0.8 }).stroke({ color: 0x555555, width: 1 });
        this.heatBarContainer.addChild(this.heatBarBg);

        this.heatBarFill = new PIXI.Graphics();
        this.heatBarContainer.addChild(this.heatBarFill);
        
        this.updateHeatBar(0, false);
    }

    private initBonusUI(style: PIXI.TextStyle) {
        this.bonusContainer = new PIXI.Container();
        this.bonusContainer.visible = false;
        this.stage.addChild(this.bonusContainer);

        const titleStyle = style.clone();
        titleStyle.fontSize = 32;
        titleStyle.fill = '#FFFF00';

        this.bonusTitle = new PIXI.Text({ text: 'CHALLENGING STAGE', style: titleStyle });
        this.bonusTitle.anchor.set(0.5);
        this.bonusTitle.x = GAME_WIDTH / 2;
        this.bonusTitle.y = 200;
        this.bonusContainer.addChild(this.bonusTitle);

        this.bonusHits = new PIXI.Text({ text: 'Number of Hits: 0', style: style });
        this.bonusHits.anchor.set(0.5);
        this.bonusHits.x = GAME_WIDTH / 2;
        this.bonusHits.y = 260;
        this.bonusContainer.addChild(this.bonusHits);

        this.bonusPoints = new PIXI.Text({ text: 'Bonus Points: 0', style: style });
        this.bonusPoints.anchor.set(0.5);
        this.bonusPoints.x = GAME_WIDTH / 2;
        this.bonusPoints.y = 300;
        this.bonusContainer.addChild(this.bonusPoints);
    }

    private initFeverOverlay() {
        this.feverOverlay = new PIXI.Graphics();
        this.feverOverlay.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: 0xFF00FF, alpha: 0 });
        this.feverOverlay.eventMode = 'none';
        this.stage.addChild(this.feverOverlay);
    }

    public updateScore(score: number, highScore: number) {
        this.scoreText.text = `SCORE: ${score.toString().padStart(6, '0')}`;
        this.highScoreText.text = `HIGH SCORE: ${highScore.toString().padStart(6, '0')}`;
    }

    public updateLives(lives: number) {
        this.livesText.text = `LIVES: ${lives}`;
    }

    public updateLevel(level: number) {
        this.levelIconsContainer.removeChildren();
        
        const stars = Math.floor(level / 5);
        const stripes = level % 5;
        
        let offsetX = 0;
        const spacing = 15;

        // Draw Stars (5 levels each)
        for (let i = 0; i < stars; i++) {
            const star = this.drawStar(0xFFFF00); // Gold star
            star.x = offsetX;
            this.levelIconsContainer.addChild(star);
            offsetX -= spacing * 1.5;
        }

        // Draw Stripes (1 level each)
        for (let i = 0; i < stripes; i++) {
            const stripe = this.drawStripe();
            stripe.x = offsetX;
            this.levelIconsContainer.addChild(stripe);
            offsetX -= spacing;
        }
    }

    private drawStar(color: number): PIXI.Graphics {
        const g = new PIXI.Graphics();
        const points = [];
        const outerRadius = 8;
        const innerRadius = 3;
        for (let i = 0; i < 10; i++) {
            const angle = (i * Math.PI) / 5 - Math.PI / 2;
            const r = i % 2 === 0 ? outerRadius : innerRadius;
            points.push(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        g.poly(points).fill(color).stroke({ color: 0xFFFFFF, width: 1 });
        return g;
    }

    private drawStripe(): PIXI.Graphics {
        const g = new PIXI.Graphics();
        // Blue-Red stripe as per GDD
        g.rect(-4, -8, 4, 16).fill(0x0000FF);
        g.rect(0, -8, 4, 16).fill(0xFF0000);
        g.stroke({ color: 0xFFFFFF, width: 1 });
        return g;
    }

    public showStageBonus(hits: number, bonus: number, isChallenging: boolean = true) {
        this.bonusTitle.text = isChallenging ? 'CHALLENGING STAGE' : 'STAGE CLEAR';
        this.bonusHits.text = `Number of Hits: ${hits}`;
        this.bonusPoints.text = `SPECIAL BONUS: ${bonus}`;
        this.bonusContainer.visible = true;
    }

    public hideStageBonus() {
        this.bonusContainer.visible = false;
    }

    public updateHeatBar(percent: number, isFever: boolean) {
        this.heatBarFill.clear();
        const color = isFever ? 0xFF00FF : 0x00FFFF;
        const width = Math.max(0, Math.min(200, percent * 2));
        
        this.heatBarFill
            .rect(0, 0, width, 10)
            .fill({ color: color })
            .stroke({ color: 0xFFFFFF, width: 1, alpha: 0.5 });
            
        if (isFever) {
            // Pulsing effect for fever mode bar could be added here
        }
    }

    public showFeverFlash() {
        this.feverOverlay.alpha = 0.3;
        const fade = () => {
            this.feverOverlay.alpha -= 0.05;
            if (this.feverOverlay.alpha > 0) {
                requestAnimationFrame(fade);
            } else {
                this.feverOverlay.alpha = 0;
            }
        };
        fade();
    }

    public setFeverTone(active: boolean) {
        // In a real app we might use filters, but here we'll just use a subtle tint overlay
        if (active) {
            this.feverOverlay.alpha = 0.1;
        } else {
            this.feverOverlay.alpha = 0;
        }
    }

    // ========== Game Over 統一面板 (Unified Game Over Panel) ==========
    private gameOverPanel?: PIXI.Container;
    private gameOverOverlay?: PIXI.Graphics;
    private goScoreText?: PIXI.Text;
    private goAccuracyText?: PIXI.Text;
    private goRankText?: PIXI.Text;

    /**
     * Show the unified Game Over panel with blur overlay.
     * Includes: GAME OVER title, RESULTS (Accuracy/Score/Rank), RETRY button.
     */
    public showGameOverPanel(finalScore: number, accuracy: number, rank: number, onRetry?: () => void) {
        const cx = GAME_WIDTH / 2;

        if (!this.gameOverPanel) {
            // 1. Dark overlay (模擬背景模糊)
            this.gameOverOverlay = new PIXI.Graphics();
            this.gameOverOverlay.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: 0x000000, alpha: 0.7 });
            this.gameOverOverlay.eventMode = 'static'; // Block clicks through
            this.stage.addChild(this.gameOverOverlay);

            // 2. Panel container
            this.gameOverPanel = new PIXI.Container();
            this.stage.addChild(this.gameOverPanel);

            // ── GAME OVER Title ──
            const titleStyle = new PIXI.TextStyle({
                fontFamily: 'Arial', fontSize: 56, fill: '#FF0000', fontWeight: 'bold',
                dropShadow: { color: '#FF0000', blur: 10, distance: 0 },
            });
            const title = new PIXI.Text({ text: 'GAME OVER', style: titleStyle });
            title.anchor.set(0.5);
            title.x = cx; title.y = GAME_HEIGHT * 0.22;
            this.gameOverPanel.addChild(title);

            // ── Divider line ──
            const divider1 = new PIXI.Graphics();
            divider1.moveTo(cx - 160, GAME_HEIGHT * 0.30).lineTo(cx + 160, GAME_HEIGHT * 0.30)
                .stroke({ color: 0x444444, width: 1 });
            this.gameOverPanel.addChild(divider1);

            // ── RESULTS Section ──
            const resultsTitleStyle = new PIXI.TextStyle({
                fontFamily: 'Arial', fontSize: 28, fill: '#FFFF00', fontWeight: 'bold',
                dropShadow: { color: '#FFFF00', blur: 4, distance: 0 },
            });
            const resultsTitle = new PIXI.Text({ text: '- RESULTS -', style: resultsTitleStyle });
            resultsTitle.anchor.set(0.5);
            resultsTitle.x = cx; resultsTitle.y = GAME_HEIGHT * 0.34;
            this.gameOverPanel.addChild(resultsTitle);

            const dataStyle = new PIXI.TextStyle({
                fontFamily: 'Arial', fontSize: 22, fill: '#00FFFF',
                dropShadow: { color: '#00FFFF', blur: 3, distance: 0 },
            });

            this.goScoreText = new PIXI.Text({ text: '', style: dataStyle });
            this.goScoreText.anchor.set(0.5);
            this.goScoreText.x = cx; this.goScoreText.y = GAME_HEIGHT * 0.42;
            this.gameOverPanel.addChild(this.goScoreText);

            this.goAccuracyText = new PIXI.Text({ text: '', style: dataStyle });
            this.goAccuracyText.anchor.set(0.5);
            this.goAccuracyText.x = cx; this.goAccuracyText.y = GAME_HEIGHT * 0.48;
            this.gameOverPanel.addChild(this.goAccuracyText);

            this.goRankText = new PIXI.Text({ text: '', style: dataStyle });
            this.goRankText.anchor.set(0.5);
            this.goRankText.x = cx; this.goRankText.y = GAME_HEIGHT * 0.54;
            this.gameOverPanel.addChild(this.goRankText);

            // ── Divider line 2 ──
            const divider2 = new PIXI.Graphics();
            divider2.moveTo(cx - 160, GAME_HEIGHT * 0.60).lineTo(cx + 160, GAME_HEIGHT * 0.60)
                .stroke({ color: 0x444444, width: 1 });
            this.gameOverPanel.addChild(divider2);

            // ── RETRY Button ──
            const retryBg = new PIXI.Graphics();
            retryBg.roundRect(-120, -24, 240, 48, 10)
                .fill({ color: 0x00FFFF, alpha: 0.12 });
            retryBg.roundRect(-120, -24, 240, 48, 10)
                .stroke({ color: 0x00FFFF, width: 2 });
            retryBg.x = cx;
            retryBg.y = GAME_HEIGHT * 0.68;
            retryBg.eventMode = 'static';
            retryBg.cursor = 'pointer';
            this.gameOverPanel.addChild(retryBg);

            const retryStyle = new PIXI.TextStyle({
                fontFamily: 'Arial', fontSize: 24, fill: '#00FFFF', fontWeight: 'bold',
            });
            const retryText = new PIXI.Text({ text: '▶  RETRY', style: retryStyle });
            retryText.anchor.set(0.5);
            retryText.x = cx;
            retryText.y = GAME_HEIGHT * 0.68;
            retryText.eventMode = 'none';
            this.gameOverPanel.addChild(retryText);

            (this.gameOverPanel as any)._retryBg = retryBg;
        }

        // Update dynamic text
        this.goScoreText!.text = `SCORE:  ${finalScore.toString().padStart(6, '0')}`;
        this.goAccuracyText!.text = `ACCURACY:  ${accuracy.toFixed(1)}%`;
        this.goRankText!.text = `RANK:  ${this.getRankLabel(rank)}`;

        // Rebind retry handler
        const retryBg = (this.gameOverPanel as any)._retryBg as PIXI.Graphics;
        retryBg.removeAllListeners();
        if (onRetry) {
            retryBg.on('pointerdown', () => onRetry());
        }

        this.gameOverOverlay!.visible = true;
        this.gameOverPanel.visible = true;
    }

    /** Hide results (legacy compat — now no-op, use hideGameOverPanel) */
    public showResults(_accuracy: number, _score: number, _rank: number) {
        // Now handled by showGameOverPanel
    }

    public hideResults() {
        // Now handled by hideGameOverPanel
    }

    private getRankLabel(rank: number): string {
        if (rank >= 200) return 'S';
        if (rank >= 150) return 'A';
        if (rank >= 100) return 'B';
        if (rank >= 50) return 'C';
        return 'D';
    }

    /** Legacy compat — redirects to showGameOverPanel */
    public showGameOver(_finalScore: number, _onRetry?: () => void) {
        // Will be called together with showResults — actual rendering done in showGameOverPanel
        // This is now a no-op; showGameOverPanel handles everything
    }

    public hideGameOver() {
        this.hideGameOverPanel();
    }

    public hideGameOverPanel() {
        if (this.gameOverPanel) this.gameOverPanel.visible = false;
        if (this.gameOverOverlay) this.gameOverOverlay.visible = false;
    }
}
