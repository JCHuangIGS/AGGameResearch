export enum GameState {
    ATTRACT = 'ATTRACT',
    INTRO = 'INTRO',
    ENTRY = 'ENTRY',
    FORMATION = 'FORMATION',
    ATTACK = 'ATTACK',
    CLEAR = 'CLEAR',
    BONUS = 'BONUS',
    GAMEOVER = 'GAMEOVER'
}

export interface Position {
    x: number;
    y: number;
}
