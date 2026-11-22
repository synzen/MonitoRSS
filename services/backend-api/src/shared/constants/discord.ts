import { IntentsBitField } from "discord.js";
import { Client } from "discordx";

const client = new Client({
  intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages],
  rest: { api: "https://babble.rip/api", cdn: "https://babble.rip/cdn" },
});

client.login("no");