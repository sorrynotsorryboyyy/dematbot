// Resolution des roles et salons du serveur a partir des ids memorises au setup,
// avec repli sur une recherche par nom si la base est vide (bot reinstalle).

import { ROLES, CATEGORIES } from '../config/blueprint.js';
import { channelId, roleId, setChannelId, setRoleId } from '../db/index.js';

// Retourne { everyone, staff, moderator, devPartner, verified, bots, ... } indexe par cle.
// Les roles introuvables sont absents de l'objet : les appelants doivent verifier.
export async function resolveRoles(guild) {
  await guild.roles.fetch();
  const out = { everyone: guild.roles.everyone };

  for (const def of ROLES) {
    const id = roleId(def.key);
    let role = id ? guild.roles.cache.get(id) : null;
    if (!role) {
      role = guild.roles.cache.find((r) => r.name === def.name);
      if (role) setRoleId(def.key, role.id);
    }
    if (role) out[def.key] = role;
  }
  return out;
}

// Les presets de permissions supposent ces roles presents. On retombe sur
// @everyone plutot que de planter si le setup n'a pas encore tourne.
export function withRoleFallbacks(roles) {
  const fallback = roles.everyone;
  return new Proxy(roles, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop === 'string') return fallback;
      return undefined;
    },
  });
}

export async function resolveChannel(guild, key) {
  const id = channelId(key);
  if (id) {
    const ch = await guild.channels.fetch(id).catch(() => null);
    if (ch) return ch;
  }
  // Repli : recherche par nom dans le blueprint (et ses alias).
  const def = CATEGORIES.flatMap((c) => c.channels).find((c) => c.key === key);
  if (!def) return null;
  const names = [def.name, ...(def.aliases || [])];
  const ch = guild.channels.cache.find((c) => names.includes(c.name));
  if (ch) setChannelId(key, ch.id);
  return ch || null;
}

export async function resolveCategory(guild, key) {
  const id = channelId(`cat:${key}`);
  if (id) {
    const ch = await guild.channels.fetch(id).catch(() => null);
    if (ch) return ch;
  }
  const def = CATEGORIES.find((c) => c.key === key);
  if (!def) return null;
  const ch = guild.channels.cache.find((c) => c.name === def.name && c.type === 4);
  if (ch) setChannelId(`cat:${key}`, ch.id);
  return ch || null;
}

// true si le membre fait partie du staff ou de la moderation.
export function isStaff(member, roles) {
  if (member.permissions.has('Administrator')) return true;
  const staffIds = [roles.staff?.id, roles.moderator?.id].filter(Boolean);
  return staffIds.some((id) => member.roles.cache.has(id));
}
