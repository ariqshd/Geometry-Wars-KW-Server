import axios from "axios";

interface WindProfile {
    speed: number;
    direction: number;
}

export class WeatherService {

    private static windData: WindProfile[] = [];
    private static  isInitialized = false;

    public static async initialize() {
        console.log("[WeatherService] Initializing and fetching weather data...");
        if (this.isInitialized) return;

        const API_URL = "https://archive-api.open-meteo.com/v1/archive?latitude=19.25&longitude=121.6667&start_date=2025-09-01&end_date=2025-09-30&hourly=wind_speed_10m,wind_direction_10m&timezone=Asia%2FSingapore";
    
        try {
            const response = await axios.get(API_URL);
            const data: any = response.data;

            if(!data.hourly){
                throw new Error("Weather data format is invalid. 'hourly' key is missing.");
            }

            const times = data.hourly.time;
            const speeds = data.hourly.wind_speed_10m;
            const directions = data.hourly.wind_direction_10m;

            if (!times || !speeds || !directions) {
                throw new Error("Weather data is missing required arrays (time, speed, or direction).");
            }

            for (let i = 0; i < times.length; i++) {
                if (speeds[i] !== null && directions[i] !== null) {
                    this.windData.push({
                        speed: speeds[i],
                        direction: directions[i]
                    });
                }
            }

            console.log(`[WeatherService] Cached ${this.windData.length} wind profiles from Typhoon Ragasa.`);
            this.isInitialized = true;
        } catch (e) {
            console.error("[WeatherService] Failed to fetch weather data:", e);
            this.windData.push({ speed: 0, direction: 0 });
        }
    }

    public static getRandomWindProfile(): WindProfile {
        if (!this.isInitialized || this.windData.length === 0) {
            return { speed: 0, direction: 0 }; // Return a calm day
        }
        
        const index = Math.floor(Math.random() * this.windData.length);
        return this.windData[index];
    }

    /**
     * Gets a set of consecutive wind profiles for a dynamic match.
     * @param count The number of phases (e.g., 3).
     */
    public static getWindPhases(count: number = 3): WindProfile[] {
        if (!this.isInitialized || this.windData.length < count) {
            // Not enough data, just return one calm profile
            console.warn("[WeatherService] Not enough wind data for requested phases. Returning calm profiles.");
            return [{ speed: 0, direction: 0 }];
        }

        // Pick a starting index that allows for 'count' consecutive hours
        const startIndex = Math.floor(Math.random() * (this.windData.length - count));
        
        return this.windData.slice(startIndex, startIndex + count);
    }
}