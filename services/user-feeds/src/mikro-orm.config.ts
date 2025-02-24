import { defineConfig } from "@mikro-orm/postgresql";
import { config } from "./config";

const configVals = config();

const MikroOrmConfig = defineConfig({
  entities: ["dist/**/*.entity.js"],
  entitiesTs: ["src/**/*.entity.ts"],
  clientUrl: configVals.USER_FEEDS_POSTGRES_URI,
  dbName: configVals.USER_FEEDS_POSTGRES_DATABASE,
  forceUtcTimezone: true,
  timezone: "UTC",
});

export default MikroOrmConfig;
