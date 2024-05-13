/* eslint-disable no-console */
import { getApplicationContext } from ".";
import { DiscordServersService } from "../features/discord-servers/discord-servers.service";
import { program } from "commander";
import { readFileSync } from "fs";
import { ServerBackup } from "../features/discord-servers/types";

async function main(backup: ServerBackup) {
  try {
    const { app } = await getApplicationContext();
    const serversService = app.get(DiscordServersService);

    console.log("Restoring...");
    await serversService.restoreBackup(backup);
    console.log("Restored!");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

program.option("-f, --file <path>", "Path to the file to restore");

program.parse();

const options = program.opts();
const filePath = options.file;

const backup = JSON.parse(readFileSync(filePath, "utf-8"));

main(backup);
