export class SoundManager {
    private static instance: SoundManager;
    private audioCtx: AudioContext | null = null;
    private enabled: boolean = true;

    private constructor() {
        // Init audio context on user interaction if possible, or just create it
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            this.audioCtx = new AudioContextClass();
        } catch (e) {
            console.warn("Web Audio API not supported", e);
            this.enabled = false;
        }
    }

    public static getInstance(): SoundManager {
        if (!SoundManager.instance) {
            SoundManager.instance = new SoundManager();
        }
        return SoundManager.instance;
    }

    public init() {
        // Call this on first user interaction (e.g. click "Start Game")
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    public playShootSound() {
        if (!this.enabled || !this.audioCtx) return;
        
        const t = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        // 8-bit style short blip
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(300, t + 0.1);

        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(t);
        osc.stop(t + 0.1);
    }

    public playExplosionSound(pitch: number = 100) {
        if (!this.enabled || !this.audioCtx) return;

        const t = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        // GDD: 依據敵人階級播放不同深度的爆炸音
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(pitch, t);
        osc.frequency.exponentialRampToValueAtTime(10, t + 0.3);

        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(t);
        osc.stop(t + 0.3);
    }

    /** GDD 10.2: 牽引光束命中 — 尖銳警報音，心跳節奏 */
    public playTractorBeamSound() {
        if (!this.enabled || !this.audioCtx) return;

        const t = this.audioCtx.currentTime;
        // Two alternating alert pulses
        for (let i = 0; i < 4; i++) {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(i % 2 === 0 ? 1200 : 900, t + i * 0.15);
            gain.gain.setValueAtTime(0.12, t + i * 0.15);
            gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.15 + 0.12);
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start(t + i * 0.15);
            osc.stop(t + i * 0.15 + 0.12);
        }
    }

    /** GDD 10.2: 合體成功 — 激昂兩階段和弦音 (Tada -- Dung!) */
    public playMergeSound() {
        if (!this.enabled || !this.audioCtx) return;

        const t = this.audioCtx.currentTime;
        const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6 major chord arpeggio

        notes.forEach((freq, i) => {
            const osc = this.audioCtx!.createOscillator();
            const gain = this.audioCtx!.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t + i * 0.08);
            gain.gain.setValueAtTime(0.15, t + i * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.08 + 0.3);
            osc.connect(gain);
            gain.connect(this.audioCtx!.destination);
            osc.start(t + i * 0.08);
            osc.stop(t + i * 0.08 + 0.3);
        });
    }

    /** GDD 5.2: 額外生命 — 1UP 上升琶音 */
    public playExtendSound() {
        if (!this.enabled || !this.audioCtx) return;

        const t = this.audioCtx.currentTime;
        const notes = [440, 554, 659, 880]; // A4, C#5, E5, A5

        notes.forEach((freq, i) => {
            const osc = this.audioCtx!.createOscillator();
            const gain = this.audioCtx!.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, t + i * 0.1);
            gain.gain.setValueAtTime(0.1, t + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.1 + 0.2);
            osc.connect(gain);
            gain.connect(this.audioCtx!.destination);
            osc.start(t + i * 0.1);
            osc.stop(t + i * 0.1 + 0.2);
        });
    }

    /** GDD 10.2: 挑戰關卡結束音效 */
    public playStageClearSound(isPerfect: boolean) {
        if (!this.enabled || !this.audioCtx) return;

        const t = this.audioCtx.currentTime;
        const notes = isPerfect 
            ? [523, 659, 784, 1047, 1319] // C5-E5-G5-C6-E6 victory fanfare
            : [523, 659, 784]; // C5-E5-G5 basic clear

        notes.forEach((freq, i) => {
            const osc = this.audioCtx!.createOscillator();
            const gain = this.audioCtx!.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t + i * 0.12);
            gain.gain.setValueAtTime(0.12, t + i * 0.12);
            gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.12 + 0.4);
            osc.connect(gain);
            gain.connect(this.audioCtx!.destination);
            osc.start(t + i * 0.12);
            osc.stop(t + i * 0.12 + 0.4);
        });
    }
}
