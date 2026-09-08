// Retrouve sur le serveur les roles, salons et categories decrits par le blueprint.
// Partage par /setup (pour savoir quoi creer) et /reset (pour savoir quoi supprimer).
//
// Strategie : d'abord l'id memorise en base au dernier setup, puis un repli par
// nom (et alias). Le repli permet de retrouver la structure meme si la base a ete
// perdue — un salon renomme a la main reste rattache tant que son id est connu.

import { ChannelType } from 'discord.js';
import { channelId, roleId } from '../db/index.js';

export function findRole(guild, def) {
  const id = roleId(def.key);
  if (id && guild.roles.cache.has(id)) return guild.roles.cache.get(id);
  return guild.roles.cache.find((r) => r.name === def.name) || null;
}

export function findCategory(guild, def) {
  const id = channelId(`cat:${def.key}`);
  if (id && guild.channels.cache.has(id)) return guild.channels.cache.get(id);
  return guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === def.name) || null;
}

export function findChannel(guild, def) {
  const id = channelId(def.key);
  if (id && guild.channels.cache.has(id)) return guild.channels.cache.get(id);
  const names = [def.name, ...(def.aliases || [])];
  return guild.channels.cache.find((c) => c.type !== ChannelType.GuildCategory && names.includes(c.name)) || null;
}
