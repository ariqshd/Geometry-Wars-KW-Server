import { GameState, Player, Enemy } from "../../rooms/schema/GameState";
import * as C from "../GameConstants"; // Import constants

export abstract class EnemyAI_Base {
    protected enemy: Enemy;
    protected state: GameState;
    protected constants: typeof C;

    constructor(enemy: Enemy, state: GameState, constants: typeof C) {
        this.enemy = enemy;
        this.state = state;
        this.constants = constants;
    }

    /**
     * This is the main update loop for the AI.
     * Subclasses MUST implement this.
     */
    public abstract update(dt: number): void;

    /**
     * A shared helper function to find the nearest living player.
     */
    protected findNearestPlayer(): Player | null {
        let nearestPlayer: Player = null;
        let minDistance = Infinity;

        this.state.players.forEach((player) => {
            if (!player.isAlive) return;
            const dist = Math.hypot(this.enemy.x - player.x, this.enemy.y - player.y);
            if (dist < minDistance) {
                minDistance = dist;
                nearestPlayer = player;
            }
        });

        return nearestPlayer;
    }

    /**
     * A shared helper to enforce arena boundaries.
     */
    protected applyArenaBounds(): void {
        this.enemy.x = Math.max(-this.constants.HALF_WIDTH, Math.min(this.constants.HALF_WIDTH, this.enemy.x));
        this.enemy.y = Math.max(-this.constants.HALF_HEIGHT, Math.min(this.constants.HALF_HEIGHT, this.enemy.y));
    }
}