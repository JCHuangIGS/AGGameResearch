export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 720;

// Player Tuning
export const PLAYER_SPEED = 4.0; // Corrected: 4px per frame after fixing double physics update
export const PLAYER_FIRE_INTERVAL = 150; // ms, GDD 規範 0.15s
export const PLAYER_BULLET_SPEED = -10;

// Matter.js Collision Categories (Must be powers of 2)
export const CATEGORY_PLAYER = 0x0001;
export const CATEGORY_ENEMY = 0x0002;
export const CATEGORY_BULLET = 0x0004;
export const CATEGORY_FRAGMENT = 0x0008;
export const CATEGORY_ENEMY_BULLET = 0x0010;

// Masks (Define what can collide with what)
export const PLAYER_MASK = CATEGORY_ENEMY | CATEGORY_FRAGMENT | CATEGORY_ENEMY_BULLET; 
export const ENEMY_MASK = CATEGORY_PLAYER | CATEGORY_BULLET;
export const BULLET_MASK = CATEGORY_ENEMY;
export const ENEMY_BULLET_MASK = CATEGORY_PLAYER;
export const FRAGMENT_MASK = CATEGORY_PLAYER;
