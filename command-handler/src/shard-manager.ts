import { ShardingManager } from 'discord.js';
import config from './config';
import { join } from 'path';

const manager = new ShardingManager(join(__dirname, 'shard.js'), {
  token: config.botToken,
});

manager.on('shardCreate', shard => console.log(`Launched shard ${shard.id}`));

manager.spawn();
