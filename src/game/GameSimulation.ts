// GameSimulation.ts

import { GameState, Player, Enemy, Bullet } from "../rooms/schema/GameState";
import { GameRoom } from "../rooms/GameRoom";
import { EnemyAI_Base } from "./ai/EnemyAI_Base";
import { GruntAI } from "./ai/GruntAI";
import { WeaverAI } from "./ai/WeaverAI";
import * as C from './GameConstants';

// Define the structure for storing non-synced bullet data
interface InternalBulletData {
  velocityX: number;
  velocityY: number;
  life: number; // Time in ms
}

// Define the structure for storing player inputs
interface PlayerInput {
  horizontal: number; // -1, 0, or 1
  vertical: number;   // -1, 0, or 1
  angle: number;      // Player's aiming angle
}

interface WindProfile {
    speed: number;
    direction: number;
}

export class GameSimulation {
    private state: GameState;
    private room: GameRoom;

    // --- Internal (non-synced) state ---

    // Store the last processed input for each player
    private playerInputs = new Map<string, PlayerInput>();
    
    // Store non-synced data for bullets (velocity, life)
    private internalBulletData = new Map<string, InternalBulletData>();

    // Entity ID counter
    private entityIdCounter: number = 0;

    // Game logic timers
    private enemySpawnTimer: number = 0;
    private readonly enemySpawnInterval: number = 1000; // 1 second
    
    // --- Spatial Grid ---
    // Key: "cellX_cellY", Value: Set of entity IDs in that cell
    private spatialGrid = new Map<string, Set<string>>();
    
    // --- Cleanup Sets ---
    // Sets of IDs to be removed at the end of the tick
    private bulletsToRemove = new Set<string>();
    private enemiesToRemove = new Set<string>();

    private playerInvulnerability = new Map<string, number>(); // <sessionId, ms_remaining>
    private playerPostHitInvuln = new Map<string, number>();

    private windProfiles: WindProfile[];
    private currentPhaseIndex = 0;
    private windPhaseTimer = C.WIND_PHASE_DURATION;
    private targetWindX = 0;
    private targetWindY = 0;
    private isInInitialCalm: boolean = true

    private nextColorIndex = 0;

    private difficultyLevel = 1;
    private difficultyTimer = 0;
    private spawnTimer = 0;

    private enemyAIs = new Map<string, EnemyAI_Base>();
    
    constructor(state: GameState, room: GameRoom, windProfiles: WindProfile[]){
        this.state = state;
        this.room = room;
        this.windProfiles = windProfiles;

        this.windPhaseTimer = C.INITIAL_CALM_DURATION;
        this.isInInitialCalm = true;
        
        this.targetWindX = 0;
        this.targetWindY = 0;
        this.state.windForceX = 0;
        this.state.windForceY = 0;

        this.state.difficultyLevel = 1;
        this.difficultyLevel = 1;
        this.difficultyTimer = C.DIFFICULTY_INCREASE_INTERVAL;
        this.spawnTimer = C.BASE_SPAWN_INTERVAL;
    }

    /**
     * This is the main game loop, called by setSimulationInterval.
     * Order of operations is now critical.
     */
    public update(deltaTime: number) {
        const dtSeconds = deltaTime / 1000; // Convert ms to seconds

        this.bulletsToRemove.clear();
        this.enemiesToRemove.clear();

        this.updateTimers(deltaTime);
        this.updateWind(deltaTime, dtSeconds);
        this.processPlayerInputs(dtSeconds);
        this.updateSpatialGrid();
        this.updateDifficulty(deltaTime);
        this.updateSpawning(deltaTime);
        this.updateEnemies(dtSeconds);
        this.updateBullets(dtSeconds); // Moves bullets, flags expired ones for removal
        this.checkCollisions();
        this.cleanupEntities();
    }

    // =================================================================
    // PUBLIC API (Called by GameRoom)
    // =================================================================

    public addPlayer(sessionId: string, name: string) {

    const color = C.PLAYER_COLORS[this.nextColorIndex % C.PLAYER_COLORS.length];
        this.nextColorIndex++;

        const player = new Player().assign({
            id: sessionId,
            name: name || "Player",
            x: (Math.random() * C.ARENA_WIDTH) - C.HALF_WIDTH,
            y: (Math.random() * C.ARENA_HEIGHT) - C.HALF_HEIGHT,
            angle: 0,
            score: 0,
            isAlive: true,
            health: C.PLAYER_MAX_HEALTH,
            color: color
        });

        this.state.players.set(sessionId, player);
        this.playerInputs.set(sessionId, { horizontal: 0, vertical: 0, angle: 0 });

    this.playerInvulnerability.set(sessionId, C.PLAYER_SPAWN_INVULNERABILITY);
        this.playerPostHitInvuln.set(sessionId, 0);
    }

    public removePlayer(sessionId: string) {
        this.state.players.delete(sessionId);
        this.playerInputs.delete(sessionId);
        this.playerInvulnerability.delete(sessionId);
        this.playerPostHitInvuln.delete(sessionId);
    }

    /**
     * Stores and *sanitizes* player input.
     */
    public handleInput(sessionId: string, input: PlayerInput) {
        const player = this.state.players.get(sessionId);
        if (player && player.isAlive) {

            // Sanitize and clamp input values
            let horizontal = Math.max(-1, Math.min(1, input.horizontal || 0));
            let vertical = Math.max(-1, Math.min(1, input.vertical || 0));

            // Normalize diagonal movement
            const magnitude = Math.hypot(horizontal, vertical);
            if (magnitude > 1) {
                horizontal /= magnitude;
                vertical /= magnitude;
            }

            this.playerInputs.set(sessionId, {
                horizontal: horizontal,
                vertical: vertical,
                angle: input.angle || 0
            });
        }
    }

    /**
     * Creates a new *synced* bullet.
     */
    public handleShoot(sessionId: string, shootData: { angle: number }) {
        const player = this.state.players.get(sessionId);
        if (!player || !player.isAlive) return;

        // Use reliable, incrementing ID
        const bulletId = `bullet_${this.entityIdCounter++}`;
        const angle = shootData.angle;

        // 1. Create the synced state object
        const bullet = new Bullet().assign({
            id: bulletId,
            ownerId: sessionId,
            x: player.x,
            y: player.y,
        });

        // 2. Create the internal, non-synced data object
        this.internalBulletData.set(bulletId, {
            velocityX: Math.cos(angle) * C.BULLET_SPEED,
            velocityY: Math.sin(angle) * C.BULLET_SPEED,
            life: C.BULLET_LIFETIME,
        });

        // 3. Add to the state. Colyseus will sync this to all clients.
        this.state.bullets.set(bulletId, bullet);
    }

    public setWindPhase(phaseIndex: number) {
        if (phaseIndex >= this.windProfiles.length) {
            phaseIndex = 0; // Loop back to the start
        }

        const profile = this.windProfiles[phaseIndex];
        this.currentPhaseIndex = phaseIndex;

        // Convert profile to target forces
        const angleRadians = (profile.direction - 90) * (Math.PI / 180);
        const force = profile.speed * C.WIND_SCALING_FACTOR;

        let forceX = Math.cos(angleRadians) * force;
        let forceY = Math.sin(angleRadians) * force;

        // Clamp the final force components to a max value
        this.targetWindX = Math.max(-C.MAX_WIND_FORCE_COMPONENT, Math.min(C.MAX_WIND_FORCE_COMPONENT, forceX));
        this.targetWindY = Math.max(-C.MAX_WIND_FORCE_COMPONENT, Math.min(C.MAX_WIND_FORCE_COMPONENT, forceY));

        console.log(`[Wind] Shifting to Phase ${phaseIndex}. Target: (${this.targetWindX.toFixed(2)}, ${this.targetWindY.toFixed(2)})`);
        
        // Broadcast a warning to clients
        this.room.broadcast("wind_shift_warning", { windX: this.targetWindX, windY: this.targetWindY });
    }


    // =================================================================
    // PRIVATE - SIMULATION LOGIC
    // =================================================================

    /**
     * Increases the difficulty level over time.
     */
    private updateDifficulty(deltaTime: number) {
        this.difficultyTimer -= deltaTime;
        if (this.difficultyTimer <= 0) {
            this.difficultyLevel++;
            this.state.difficultyLevel = this.difficultyLevel; // Sync to client
            this.difficultyTimer = C.DIFFICULTY_INCREASE_INTERVAL;
        }
    }

    /**
     * Calculates the total "threat" currently on the map.
     */
    private calculateCurrentThreat(): number {
        let currentThreat = 0;
        this.state.enemies.forEach((enemy) => {
            currentThreat += C.ENEMY_COSTS[enemy.type] || 1;
        });
        return currentThreat;
    }

    private calculateMaxThreat(): number {
        const baseThreat = this.difficultyLevel * C.BASE_THREAT_PER_LEVEL;
        const playerCount = this.state.players.size;
        const playerMultiplier = 1 + (playerCount - 1) * C.PLAYER_THREAT_MULTIPLIER;

        return baseThreat * playerMultiplier;
    }

    private chooseEnemyType(maxThreat: number): number {
        // If threat is > 50, 10% chance to spawn a Type 1
        if (maxThreat > 50 && Math.random() < 0.1) {
            return 1;
        }
        
        // If threat is > 150, 5% chance to spawn a Type 2
        if (maxThreat > 150 && Math.random() < 0.05) {
            return 2;
        }

        // Default to Type 0
        return 0;
    }

    private updateTimers(deltaTime: number) {
        this.playerInvulnerability.forEach((timeLeft, sessionId) => {
            if (timeLeft > 0) {
                this.playerInvulnerability.set(sessionId, timeLeft - deltaTime);
            }
        });

        this.playerPostHitInvuln.forEach((timeLeft, sessionId) => {
            if (timeLeft > 0) {
                this.playerPostHitInvuln.set(sessionId, timeLeft - deltaTime);
            }
        });
    }

    private processPlayerInputs(dt: number) {

        const windX = this.state.windForceX;
        const windY = this.state.windForceY;

        this.playerInputs.forEach((input, sessionId) => {
            const player = this.state.players.get(sessionId);
            if (!player || !player.isAlive){
                return;
            }

            // Apply movement
            player.x += input.horizontal * C.PLAYER_SPEED * dt;
            player.y += input.vertical * C.PLAYER_SPEED * dt;
            player.angle = input.angle;

            // --- Apply Arena Current ---
            player.x += windX * dt;
            player.y += windY * dt;
            
            // Add boundary checks
            player.x = Math.max(-C.HALF_WIDTH, Math.min(C.HALF_WIDTH, player.x));
            player.y = Math.max(-C.HALF_HEIGHT, Math.min(C.HALF_HEIGHT, player.y));
        });
    }

    private updateWind(deltaTime: number, dtSeconds: number) {
        // 1. Tick down the phase timer
        this.windPhaseTimer -= deltaTime;

        if (this.windPhaseTimer <= 0) {
            // Check if we were in the initial calm period
            if (this.isInInitialCalm) {
                // The calm period is over! Start the first *real* phase
                this.isInInitialCalm = false;
                this.windPhaseTimer = C.WIND_PHASE_DURATION; // Reset timer
                this.setWindPhase(0); // Set to phase 0
            } else {
                // We were in a normal phase, so advance
                this.windPhaseTimer = C.WIND_PHASE_DURATION; // Reset timer
                this.setWindPhase(this.currentPhaseIndex + 1); // Go to next phase
            }
        }

        // 2. Smoothly interpolate the *actual* wind force towards the *target*
        // This is a simple "lerp" (Linear Interpolation)
        const lerpFactor = dtSeconds / (C.WIND_SHIFT_DURATION / 1000);

        this.state.windForceX += (this.targetWindX - this.state.windForceX) * lerpFactor;
        this.state.windForceY += (this.targetWindY - this.state.windForceY) * lerpFactor;
    }

    /**
     * Moves synced bullets based on internal data.
     */
    private updateBullets(dt: number) {
        const windX = this.state.windForceX;
        const windY = this.state.windForceY;

        for (const bullet of this.state.bullets.values()) {
            const internalData = this.internalBulletData.get(bullet.id);
            if (!internalData) continue;

            // Apply movement
            bullet.x += internalData.velocityX * dt;
            bullet.y += internalData.velocityY * dt;

            // --- Apply Arena Current ---
            bullet.x += windX * dt;
            bullet.y += windY * dt;

            internalData.life -= (dt * 1000); // Decrement lifetime in ms

            // Check for removal (lifetime or out of bounds)
            if (internalData.life <= 0 ||
                bullet.x < -C.HALF_WIDTH || bullet.x > C.HALF_WIDTH ||
                bullet.y < -C.HALF_HEIGHT || bullet.y > C.HALF_HEIGHT)
            {
                this.bulletsToRemove.add(bullet.id);
            }
        }
    }

    /**
     * Uses spatial grid to find nearest player.
     */
    private updateEnemies(dt: number) {
        this.enemyAIs.forEach((ai, id) => {
            if (this.state.enemies.has(id)) {
                ai.update(dt);
            }
        });
    }

    /**
     * Uses spatial grid for efficient collision checks.
     */
    private checkCollisions() {
        // --- Check Bullets vs. Enemies ---
        for (const bullet of this.state.bullets.values()) {
            if (this.bulletsToRemove.has(bullet.id)) continue; // Already marked for removal

            const nearbyEntities = this.getNearbyEntities(bullet.x, bullet.y);
            
            for (const entityId of nearbyEntities) {
                const enemy = this.state.enemies.get(entityId);

                // Check if it's an enemy and not already marked for removal
                if (enemy && !this.enemiesToRemove.has(enemy.id)) {
                    const distance = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
                    
                    if (distance < C.BULLET_HIT_RADIUS + C.ENEMY_HIT_RADIUS) {
                        // HIT!
                        this.bulletsToRemove.add(bullet.id);
                        this.enemiesToRemove.add(enemy.id);

                        // Grant score to the player
                        const player = this.state.players.get(bullet.ownerId);
                        if (player) {
                            player.score += 100;
                        }
                        
                        // A bullet can only hit one enemy, so we break
                        break; 
                    }
                }
            }
        }

        // --- Check Player vs. Enemies ---
        for (const player of this.state.players.values()) {
            if (!player.isAlive) continue;

            const invulnerableTime = this.playerInvulnerability.get(player.id);
            if (invulnerableTime && invulnerableTime > 0) {
                continue; // Skip collision check
            }

            if (this.playerPostHitInvuln.get(player.id) > 0) continue;
            
            const nearbyEntities = this.getNearbyEntities(player.x, player.y);

            for (const entityId of nearbyEntities) {
                const enemy = this.state.enemies.get(entityId);

                if (enemy && !this.enemiesToRemove.has(enemy.id)) {
                    const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
                    
                    if (distance < C.PLAYER_HIT_RADIUS + C.ENEMY_HIT_RADIUS) {
                        // Player is hit!
                        player.health -= C.ENEMY_DAMAGE;

                        this.playerPostHitInvuln.set(player.id, C.PLAYER_POST_HIT_INVULNERABILITY);

                        this.room.broadcast("player_hit", { sessionId: player.id });

                        if (player.health <= 0) {
                            player.isAlive = false;
                            this.room.broadcast("player_died", { sessionId: player.id });
                        }

                        this.enemiesToRemove.add(enemy.id);
                    }
                }
            }
        }
    }

    private updateSpawning(deltaTime: number) {
        this.spawnTimer -= deltaTime;
        if (this.spawnTimer > 0) {
            return; // Not time to spawn yet
        }
        
        this.spawnTimer = C.BASE_SPAWN_INTERVAL; // Reset timer

        const currentThreat = this.calculateCurrentThreat();
        const maxThreat = this.calculateMaxThreat();

        // If we are below our "threat budget", spawn an enemy
        if (currentThreat < maxThreat) {
            // This is where you can add logic for *which* enemy to spawn
            const enemyType = this.chooseEnemyType(maxThreat);
            this.spawnEnemy(enemyType);
        }
    }

    private spawnEnemy(enemyType: number) {
        let spawnX = 0;
        let spawnY = 0;
        let isSafe = false;

    // Define the "center" rectangle coordinates
    const CENTER_MIN_X = -C.HALF_WIDTH + C.BORDER_MARGIN;  // e.g., -40 + 20 = -20
    const CENTER_MAX_X = C.HALF_WIDTH - C.BORDER_MARGIN;   // e.g.,  40 - 20 =  20
    const CENTER_MIN_Y = -C.HALF_HEIGHT + C.BORDER_MARGIN; // e.g., -20
    const CENTER_MAX_Y = C.HALF_HEIGHT - C.BORDER_MARGIN;  // e.g.,  20

    // The total width/height of the inner center area
    const CENTER_WIDTH = C.ARENA_WIDTH - (C.BORDER_MARGIN * 2);   // e.g., 40
    const CENTER_HEIGHT = C.ARENA_HEIGHT - (C.BORDER_MARGIN * 2); // e.g., 40

    // Try up to MAX_SPAWN_ATTEMPTS times to find a safe spot
    for (let i = 0; i < C.MAX_SPAWN_ATTEMPTS; i++) {
            
            // --- 1. Generate a weighted spawn point ---
            if (Math.random() < C.BORDER_SPAWN_CHANCE) {
                // --- Try to spawn in the BORDER area ---
                
                // Pick a random point in the *whole* arena
                spawnX = (Math.random() * C.ARENA_WIDTH) - C.HALF_WIDTH;  // -40 to 40
                spawnY = (Math.random() * C.ARENA_HEIGHT) - C.HALF_HEIGHT; // -40 to 40

                // Check if it's in the center
                const inCenter = spawnX > CENTER_MIN_X && spawnX < CENTER_MAX_X &&
                                 spawnY > CENTER_MIN_Y && spawnY < CENTER_MAX_Y;

                if (inCenter) {
                    // It's in the center, but we want a border spawn.
                    // "Push" it to one of the 4 border strips randomly.
                    const side = Math.floor(Math.random() * 4);
                    switch (side) {
                        case 0: // Push to Top border
                            spawnY = (Math.random() * C.BORDER_MARGIN) + CENTER_MAX_Y; // 20 to 40
                            break;
                        case 1: // Push to Bottom border
                            spawnY = -((Math.random() * C.BORDER_MARGIN) + CENTER_MAX_Y); // -20 to -40
                            break;
                        case 2: // Push to Right border
                            spawnX = (Math.random() * C.BORDER_MARGIN) + CENTER_MAX_X; // 20 to 40
                            break;
                        case 3: // Push to Left border
                            spawnX = -((Math.random() * C.BORDER_MARGIN) + CENTER_MAX_X); // -20 to -40
                            break;
                    }
                }
                // If it wasn't in the center, we're good! We'll use the random point.

            } else {
                // --- Try to spawn in the CENTER area ---
                spawnX = (Math.random() * CENTER_WIDTH) + CENTER_MIN_X;   // -20 to 20
                spawnY = (Math.random() * CENTER_HEIGHT) + CENTER_MIN_Y; // -20 to 20
            }

            // --- 2. Check if the spot is safe ---
            isSafe = true;
            for (const player of this.state.players.values()) {
                if (!player.isAlive) continue;

                const distance = Math.hypot(spawnX - player.x, spawnY - player.y);
                if (distance < C.MIN_SPAWN_DISTANCE_FROM_PLAYER) {
                    isSafe = false; // Too close!
                    break; 
                }
            }

            if (isSafe) {
                break;
            }
        }
        
        // --- 3. Create the enemy ---
        const enemyId = `enemy_${this.entityIdCounter++}`;
        const enemy = new Enemy().assign({
            id: enemyId,
            type: enemyType,
            x: spawnX,
            y: spawnY,
        });

        this.state.enemies.set(enemyId, enemy);

        let ai: EnemyAI_Base;
        switch (enemyType) {
            case 1:
                ai = new WeaverAI(enemy, this.state, C);
                break;
            case 0:
            default:
                ai = new GruntAI(enemy, this.state, C);
                break;
        }

        this.enemyAIs.set(enemyId, ai);
    }

    /**
     * Uses incrementing ID and arena bounds.
     */
    private spawnEnemies(deltaTime: number) {
        this.enemySpawnTimer += deltaTime;
        if (this.enemySpawnTimer < this.enemySpawnInterval) {
            return;
        }
        
        this.enemySpawnTimer = 0; // Reset timer

        // Spawn one enemy
        const enemyId = `enemy_${this.entityIdCounter++}`;
        const enemy = new Enemy().assign({
            id: enemyId,
            type: 0, // Grunt
            x: (Math.random() * C.ARENA_WIDTH) - C.HALF_WIDTH,
            y: (Math.random() * C.ARENA_HEIGHT) - C.HALF_HEIGHT,
        });

        this.state.enemies.set(enemyId, enemy);
    }
  
    /**
     * Cleans up entities from the *state* and internal maps.
     */
    private cleanupEntities() {
        // Remove enemies
        this.enemiesToRemove.forEach((id) => {
            this.state.enemies.delete(id);
            this.enemyAIs.delete(id);
        });

        this.enemiesToRemove.clear();
        
        // Remove bullets
        this.bulletsToRemove.forEach((id) => {
            this.state.bullets.delete(id);
            this.internalBulletData.delete(id); // Clean up internal data
        });
    }

    // =================================================================
    // PRIVATE - SPATIAL GRID
    // =================================================================

    /**
     * Calculates the grid cell key for a given position.
     */
    private getCellKey(x: number, y: number): string {
        const cellX = Math.floor(x / C.CELL_SIZE);
        const cellY = Math.floor(y / C.CELL_SIZE);
        return `${cellX}_${cellY}`;
    }

    /**
     * Rebuilds the spatial grid from scratch.
     * Called once per tick *after* all entities have moved.
     */
    private updateSpatialGrid() {
        this.spatialGrid.clear();

        // Helper to add any entity with id, x, y to the grid
        const addToGrid = (entity: { id: string, x: number, y: number }) => {
            const key = this.getCellKey(entity.x, entity.y);
            if (!this.spatialGrid.has(key)) {
                this.spatialGrid.set(key, new Set());
            }
            this.spatialGrid.get(key)!.add(entity.id);
        };

        // Add all entities
        this.state.players.forEach(addToGrid);
        this.state.enemies.forEach(addToGrid);
        this.state.bullets.forEach(addToGrid);
    }

    /**
     * Gets all entity IDs in the 3x3 grid area around a position.
     */
    private getNearbyEntities(x: number, y: number): Set<string> {
        const nearbyEntities = new Set<string>();
        const originCellX = Math.floor(x / C.CELL_SIZE);
        const originCellY = Math.floor(y / C.CELL_SIZE);

        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const key = `${originCellX + i}_${originCellY + j}`;
                
                if (this.spatialGrid.has(key)) {
                    // Add all entity IDs from this cell
                    this.spatialGrid.get(key)!.forEach(id => nearbyEntities.add(id));
                }
            }
        }
        return nearbyEntities;
    }
}