// Enregistre les slash commands sur le serveur (portee guild : mise a jour immediate).
// A relancer apres tout ajout ou modification d'une commande.

import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { loadCommands } from './lib/loader.js';

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

for (const [key, value] of Object.entries({ DISCORD_TOKEN, CLIENT_ID, GUILD_ID })) {
  if (!value) {
    console.error(`${key} manquant dans .env`);
    process.exit(1);
  }
}

const commands = await loadCommands();
const body = [...commands.values()].map((c) => c.data.toJSON());

const rest = new REST().setToken(DISCORD_TOKEN);
const data = await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body });

console.log(`${data.length} commandes déployées :`);
for (const c of data) console.log(`  /${c.name}`);
process.exit(0);
