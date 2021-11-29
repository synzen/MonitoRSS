import { Client } from 'discord.js';
import Logger from '../../utils/logger';

export default async function readyEvent(
  client: Client,
) {
  new Logger().info(`Client shard ${client.shard?.ids[0]} ready`);
}
