// Point d'entree du bot DematGames.

import 'dotenv/config';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { loadCommands, loadEvents } from './lib/loader.js';
import { console_ } from './lib/logger.js';

if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN manquant. Copie .env.example vers .env et renseigne-le.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

client.commands = await loadCommands();
const eventCount = await loadEvents(client);

console_.info(`${client.commands.size} commandes et ${eventCount} événements chargés.`);

process.on('unhandledRejection', (err) => console_.error('Rejet non géré :', err));

await client.login(process.env.DISCORD_TOKEN);
