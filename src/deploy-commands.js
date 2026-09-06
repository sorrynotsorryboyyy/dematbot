// Enregistre les slash commands sur le serveur (portee guild : mise a jour immediate).
// A relancer apres tout ajout ou modification d'une commande.

import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { loadCommands } from './lib/loader.js';
import { assertEnv } from './lib/env.js';

// requireIds : le deploiement a besoin du CLIENT_ID et du GUILD_ID,
// contrairement au simple demarrage du bot.
const { token: DISCORD_TOKEN, clientId: CLIENT_ID, guildId: GUILD_ID } = assertEnv({ requireIds: true });

const commands = await loadCommands();
const body = [...commands.values()].map((c) => c.data.toJSON());

const rest = new REST().setToken(DISCORD_TOKEN);
const data = await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body });

console.log(`${data.length} commandes déployées :`);
for (const c of data) console.log(`  /${c.name}`);
// Pas de process.exit() : le REST client se ferme seul, et forcer la sortie
// declenche une assertion libuv sur Windows.
