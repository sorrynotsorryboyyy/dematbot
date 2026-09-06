// Chargement des modules de commandes et d'evenements depuis l'arborescence src/.
// Isole de index.js pour que deploy-commands.js puisse charger les commandes
// sans demarrer le client.

import { Collection } from 'discord.js';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..');

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.js')) out.push(full);
  }
  return out;
}

export async function loadCommands() {
  const commands = new Collection();
  for (const file of walk(join(SRC, 'commands'))) {
    const mod = await import(pathToFileURL(file).href);
    if (mod.data && mod.execute) commands.set(mod.data.name, mod);
    else console.warn(`Commande ignorée (data/execute manquant) : ${file}`);
  }
  return commands;
}

export async function loadEvents(client) {
  let n = 0;
  for (const file of walk(join(SRC, 'events'))) {
    const mod = await import(pathToFileURL(file).href);
    if (!mod.name || !mod.execute) continue;
    if (mod.once) client.once(mod.name, (...args) => mod.execute(...args, client));
    else client.on(mod.name, (...args) => mod.execute(...args, client));
    n += 1;
  }
  return n;
}
