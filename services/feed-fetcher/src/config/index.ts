import dotenv from 'dotenv';
import path from 'path';

const envFiles: Record<string, string> = {
  development: '.env.development',
  production: '.env.production',
  local: '.env.local',
};

const envFilePath = path.join(
  __dirname,
  '..',
  '..',
  envFiles[process.env.NODE_ENV as string] || envFiles.local,
);

dotenv.config({
  path: envFilePath,
});

export default () =>
  ({
    POSTGRES_URI: process.env.POSTGRES_URI as string,
    SYNC_DB: process.env.SYNC_DB === 'true',
  } as const);
