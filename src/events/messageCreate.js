// Automod leger : anti-flood, anti-invitation Discord, anti-mass-mention.
// Le staff en est exempte.

import { Events } from 'discord.js';
import { resolveRoles, isStaff } from '../lib/guild.js';
import * as logger from '../lib/logger.js';
import * as embeds from '../lib/embeds.js';
import { COLORS } from '../config/brand.js';

export const name = Events.MessageCreate;

const RULES = {
  flood: { messages: 5, windowMs: 5000, timeoutMs: 60_000 },
  mentions: { max: 5 },
};

const INVITE = /(discord\.(gg|io|me|li)|discordapp\.com\/invite)\/\w+/i;

// Historique des envois recents, par membre.
const recent = new Map();

export async function execute(message) {
  if (message.author.bot || !message.guild) return;

  const roles = await resolveRoles(message.guild);
  if (message.member && isStaff(message.member, roles)) return;

  if (await checkInvite(message)) return;
  if (await checkMentions(message)) return;
  await checkFlood(message);
}

async function checkInvite(message) {
  if (!INVITE.test(message.content)) return false;

  await message.delete().catch(() => {});
  await warnUser(message, 'Les invitations vers d autres serveurs ne sont pas autorisées ici.');
  await logAuto(message, 'Invitation supprimée', message.content.slice(0, 300));
  return true;
}

async function checkMentions(message) {
  const count = message.mentions.users.size + message.mentions.roles.size;
  if (count <= RULES.mentions.max) return false;

  await message.delete().catch(() => {});
  await warnUser(message, `Trop de mentions d un coup (${count}). Évite le mass-mention.`);
  await logAuto(message, 'Mass-mention supprimé', `${count} mentions`);
  return true;
}

async function checkFlood(message) {
  const key = `${message.guildId}:${message.author.id}`;
  const now = Date.now();
  const history = (recent.get(key) || []).filter((t) => now - t < RULES.flood.windowMs);
  history.push(now);
  recent.set(key, history);

  if (history.length < RULES.flood.messages) return;

  recent.delete(key);
  await message.member?.timeout(RULES.flood.timeoutMs, 'Flood détecté').catch(() => {});
  await warnUser(message, 'Tu envoies trop de messages d affilée. Pause d une minute.');
  await logAuto(message, 'Flood détecté', `${history.length} messages en ${RULES.flood.windowMs / 1000}s`);
}

async function warnUser(message, text) {
  const sent = await message.channel
    .send({ content: `${message.author}`, embeds: [embeds.error(text)] })
    .catch(() => null);
  // Le rappel s'efface tout seul pour ne pas polluer le salon.
  if (sent) setTimeout(() => sent.delete().catch(() => {}), 8000);
}

function logAuto(message, title, detail) {
  return logger.toChannel(message.guild, {
    title: `🤖 Automod — ${title}`,
    color: COLORS.danger,
    fields: [
      { name: 'Membre', value: `${message.author}`, inline: true },
      { name: 'Salon', value: `${message.channel}`, inline: true },
      { name: 'Détail', value: detail || '—' },
    ],
  });
}

// Purge periodique de l'historique de flood pour eviter la fuite memoire.
setInterval(() => {
  const now = Date.now();
  for (const [key, times] of recent) {
    if (!times.some((t) => now - t < RULES.flood.windowMs)) recent.delete(key);
  }
}, 60_000).unref();
