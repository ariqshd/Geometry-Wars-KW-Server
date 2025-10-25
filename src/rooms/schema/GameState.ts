import { Schema, MapSchema, type } from "@colyseus/schema";

export class Player extends Schema {
  // The '!' tells TypeScript that this property will be initialized by Colyseus, not in a constructor.
  @type("string") id!: string;
  @type("string") name!: string;
  @type("float32") x!: number;
  @type("float32") y!: number;
  @type("float32") angle!: number;
  @type("uint32") score!: number;
  @type("boolean") isAlive!: boolean;
  @type("uint8") health!: number;
  @type("string") color!: string;
}

export class Enemy extends Schema {
  @type("string") id!: string;
  @type("uint8") type!: number;
  @type("float32") x!: number;
  @type("float32") y!: number;
}

export class Bullet extends Schema {
  @type("string") id!: string;
  @type("string") ownerId!: string; // So clients know who shot it
  @type("float32") x!: number;
  @type("float32") y!: number;
  
  // We don't need to sync velocity. The server will move it,
  // and clients will just receive the new x/y.
  // We also don't need to sync 'life'; the server will just delete it
  // from the state map, and Colyseus will notify clients.
}

export class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Enemy }) enemies = new MapSchema<Enemy>();
  @type({ map: Bullet }) bullets = new MapSchema<Bullet>();
  @type("float32") windForceX: number = 0;
  @type("float32") windForceY: number = 0;
  @type("uint8") gamePhase!: number;
}
