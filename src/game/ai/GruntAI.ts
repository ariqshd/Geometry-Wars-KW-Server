import { EnemyAI_Base } from "./EnemyAI_Base";

export class GruntAI extends EnemyAI_Base {
    
    public update(dt: number): void {
        const nearestPlayer = this.findNearestPlayer();

        if (nearestPlayer) {
            // Move directly towards the nearest player
            const angle = Math.atan2(nearestPlayer.y - this.enemy.y, nearestPlayer.x - this.enemy.x);
            this.enemy.x += Math.cos(angle) * this.constants.ENEMY_SPEED * dt;
            this.enemy.y += Math.sin(angle) * this.constants.ENEMY_SPEED * dt;
            
            this.applyArenaBounds();
        }
    }
}