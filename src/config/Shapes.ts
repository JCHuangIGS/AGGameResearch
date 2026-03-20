export interface ShapeConfig {
    sides: number;
    color: number;
    health: number;
    points: number;        // 隊形內擊殺得分
    divePoints: number;    // 衝刺時擊殺得分
    sideLength: number;
}

export const SHAPES: Record<number, ShapeConfig> = {
    3: {  // 黃蜂 (Bee) - 三角形
        sides: 3,
        color: 0xFFFF00, // Yellow (GDD 規範)
        health: 1,
        points: 50,
        divePoints: 100,
        sideLength: 30
    },
    4: {  // 蝴蝶 (Butterfly) - 方塊
        sides: 4,
        color: 0xFF00FF, // Magenta (GDD 規範)
        health: 1,
        points: 80,
        divePoints: 160,
        sideLength: 30
    },
    5: {  // 小隊長 (Scout) - 圓形
        sides: 5,
        color: 0xFF6B6B, // Coral
        health: 1,
        points: 100,
        divePoints: 200,
        sideLength: 35
    },
    6: {  // 魔王 (Boss Galaga) - 六角形
        sides: 6,
        color: 0x00FF00, // Green (GDD 規範)
        health: 2,
        points: 150,
        divePoints: 400,
        sideLength: 40
    }
};
