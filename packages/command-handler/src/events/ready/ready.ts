import { Client } from 'discord.js';
import Logger from '../../utils/logger';

async function ready(
  client: Client,
) {
  new Logger().info(`Client shard ${client.shard?.ids[0]} ready`);
}

export default ready;
