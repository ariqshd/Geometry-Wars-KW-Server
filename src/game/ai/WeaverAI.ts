import { Enemy, GameState } from "../../rooms/schema/GameState";
import { EnemyAI_Base } from "./EnemyAI_Base";

export class WeaverAI extends EnemyAI_Base {
    // Store its own velocity
    private velocityX: number;
    private velocityY: number;

    constructor(enemy: Enemy, state: GameState, constants: typeof C) {
        super(enemy, state, constants);
        
        // Start moving in a random diagonal direction
        const speed = this.constants.ENEMY_SPEED * 1.2; // A bit faster
        this.velocityX = Math.random() > 0.5 ? speed : -speed;
        this.velocityY = Math.random() > 0.5 ? speed : -speed;
    }

    public update(dt: number): void {
        this.enemy.x += this.velocityX * dt;
        this.enemy.y += this.velocityY * dt;

        // Bounce off walls
        const { HALF_WIDTH, HALF_HEIGHT } = this.constants;
        if (this.enemy.x >= HALF_WIDTH || this.enemy.x <= -HALF_WIDTH) {
            this.velocityX *= -1; // Reverse X direction
        }
        if (this.enemy.y >= HALF_HEIGHT || this.enemy.y <= -HALF_HEIGHT) {
            this.velocityY *= -1; // Reverse Y direction
        }
        
        this.applyArenaBounds(); // Just in case it gets stuck
    }
}