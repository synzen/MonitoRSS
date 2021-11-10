import { IsNotEmpty, IsOptional, IsString, validateSync } from 'class-validator';
import * as dotenv from 'dotenv';

dotenv.config();

class Config {
  @IsString()
  @IsNotEmpty()
  BOT_TOKEN = process.env.BOT_TOKEN as string;

  @IsString()
  @IsNotEmpty()
  BOT_CLIENT_ID = process.env.BOT_CLIENT_ID as string;

  @IsString()
  @IsOptional()
  TESTING_GUILD_ID = process.env.TESTING_GUILD_ID as string;
}

const config = new Config();

validateSync(config);

export default config;
