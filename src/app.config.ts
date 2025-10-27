import config from "@colyseus/tools";
import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";

import { RedisPresence } from "@colyseus/redis-presence";
import { Server } from "colyseus";

import { GameRoom } from "./rooms/GameRoom";
import { WeatherService } from "./services/WeatherService";

export default config({

    initializeGameServer: (gameServer: Server) => {
        // Configure Redis Presence
        // It will automatically connect to "redis://redis:6379"
        // because our Docker service is named 'redis'
        gameServer.attach({
            presence: new RedisPresence(),
        });

        gameServer.define('GameRoom', GameRoom);

    },

    initializeExpress: (app) => {
        /**
         * Bind your custom express routes here:
         * Read more: https://expressjs.com/en/starter/basic-routing.html
         */
        app.get("/hello_world", (req, res) => {
            res.send("It's time to kick ass and chew bubblegum!");
        });

        /**
         * Use @colyseus/playground
         * (It is not recommended to expose this route in a production environment)
         */
        if (process.env.NODE_ENV !== "production") {
            app.use("/", playground());
        }

        /**
         * Use @colyseus/monitor
         * It is recommended to protect this route with a password
         * Read more: https://docs.colyseus.io/tools/monitor/#restrict-access-to-the-panel-using-a-password
         */
        app.use("/monitor", monitor());
    },


    beforeListen: async () => {
        /**
         * Before before gameServer.listen() is called.
         */

        console.log("[Server] Initializing WeatherService...");
        await WeatherService.initialize();
        console.log("[Server] WeatherService is ready.");
    }
});
