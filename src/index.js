// Point d'entree du bot DematGames.

import 'dotenv/config';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { loadCommands, loadEvents } from './lib/loader.js';
import { console_ } from './lib/logger.js';
import { assertEnv, verifyTokenOnline } from './lib/env.js';

// Diagnostique la configuration avant toute connexion : un token malforme
// produirait sinon un "TokenInvalid" opaque au moment du login.
const env = assertEnv();

// Puis on demande a Discord si ce token est encore actif, pour distinguer
// un token perime d'un token mal recopie.
const check = await verifyTokenOnline(env.token);
if (check.ok === false) {
  console.error(`\n❌ ${check.reason}\n`);
  process.exit(1);
}
if (check.ok) console_.info(`Token validé auprès de Discord : ${check.tag} (${check.id})`);

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
