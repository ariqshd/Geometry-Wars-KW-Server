import { Room, Client } from "@colyseus/core";
import { GameState, Player } from "./schema/GameState";
import { GameSimulation } from "../game/GameSimulation";
import { WeatherService } from "../services/WeatherService";

export class GameRoom extends Room<GameState> {
  // maxClients = 10;
  private simulation: GameSimulation;

  onCreate (options: any) {
    
  this.state = new GameState();

  const windPhases = WeatherService.getWindPhases(3);

  this.simulation = new GameSimulation(this.state, this, windPhases);

  this.setSimulationInterval((deltaTime) =>{
    this.simulation.update(deltaTime);
  }, 1000 / 20); // 20 times per second


    this.onMessage("input", (client, message) => {
      this.simulation.handleInput(client.sessionId, message);
    });

    this.onMessage("shoot", (client, message) => {
      this.simulation.handleShoot(client.sessionId, message);
    });

    this.onMessage("respawn", (client) => {
            this.simulation.respawnPlayer(client.sessionId);
        });
  }

  onJoin (client: Client, options: any) {
    this.simulation.addPlayer(client.sessionId, options.name);
    console.log(client.sessionId, "joined!");
  }

  onLeave (client: Client, consented: boolean) {
    this.simulation.removePlayer(client.sessionId);
    console.log(client.sessionId, "left!");
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }

}
