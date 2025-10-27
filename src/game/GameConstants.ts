// GameConstants.ts

// Player color palette
export const PLAYER_COLORS = [
    "#00FF00", // Green
    "#0000FF", // Blue
    "#FFFF00", // Yellow
    "#FF00FF", // Magenta
    "#00FFFF", // Cyan
    "#FFFFFF", // White
    "#FFA500", // Orange
];

// --- Player Constants ---
export const PLAYER_FIRE_RATE = 100;
export const PLAYER_SPEED = 25; // Pixels per second
export const PLAYER_POST_HIT_INVULNERABILITY = 500; // 0.5 sec
export const PLAYER_SPAWN_INVULNERABILITY = 3000; // 3000ms = 3 seconds
export const PLAYER_MAX_HEALTH = 3;

export const BULLET_SPEED = 40;
export const BULLET_LIFETIME = 1000; // 1 second

export const ENEMY_SPEED = 15;
export const ENEMY_DAMAGE = 1;
export const AI_STOPPING_DISTANCE = 20; // Stop AI 20 units from player (fixes AI loop)

// --- Arena & Grid Constants ---
export const ARENA_WIDTH = 80;
export const ARENA_HEIGHT = 80;
export const HALF_WIDTH = ARENA_WIDTH / 2;
export const HALF_HEIGHT = ARENA_HEIGHT / 2;
export const CELL_SIZE = 10; // For the spatial grid. 10x10 grid.

// --- Collision Constants ---
export const PLAYER_HIT_RADIUS = 0.5;
export const ENEMY_HIT_RADIUS = 0.8;
export const BULLET_HIT_RADIUS = 0.3; // Bullets are small

// --- Spawning Constants ---
export const MIN_SPAWN_DISTANCE_FROM_PLAYER = 20; // Don't spawn within 20 units of a player
export const MAX_SPAWN_ATTEMPTS = 10; // Try 10 times to find a safe spot
export const BORDER_SPAWN_CHANCE = 0.75; // 75% chance to spawn at the edge
export const BORDER_MARGIN = 20;

// --- Wind Constants ---
export const WIND_PHASE_DURATION = 60000; // 60,000ms = 1 minute per phase
export const INITIAL_CALM_DURATION = 60000; // 1 minute of no wind at the start
export const WIND_SHIFT_DURATION = 5000; // 5,000ms = 5 sec transition time
export const WIND_SCALING_FACTOR = 0.27; // Scale wind speed to game units
export const MAX_WIND_FORCE_COMPONENT = 15; // Max X or Y component of wind force

// --- ADD NEW DYNAMIC DIFFICULTY CONSTANTS ---
export const DIFFICULTY_INCREASE_INTERVAL = 10000; // Increase difficulty every 10 seconds
export const BASE_THREAT_PER_LEVEL = 10;       // How much "threat" to add per level
export const PLAYER_THREAT_MULTIPLIER = 0.5;   // Add 50% threat for each *additional* player

export const BASE_SPAWN_INTERVAL = 500; // Try to spawn an enemy every 0.5 seconds

// Define the "cost" of each enemy.
export const ENEMY_COSTS: { [key: number]: number } = {
    0: 1,  // Grunt (Type 0) costs 1 threat point
    1: 5,  // e.g., A "Weaver" (Type 1) costs 5
    2: 10, // e.g., A "Spinner" (Type 2) costs 10
};