// Journalisation : console + salon #logs-bot.

import { channelId } from '../db/index.js';
import * as embeds from './embeds.js';
import { COLORS } from '../config/brand.js';

const stamp = () => new Date().toISOString().slice(11, 19);

export const console_ = {
  info: (...a) => console.log(`[${stamp()}]`, ...a),
  warn: (...a) => console.warn(`[${stamp()}] ⚠`, ...a),
  error: (...a) => console.error(`[${stamp()}] ✖`, ...a),
};

// Publie un embed dans #logs-bot. Ne jette jamais : un log rate ne doit pas
// faire echouer l'action qui l'a declenche.
export async function toChannel(guild, { title, description, color = COLORS.info, fields = [] }) {
  try {
    const id = channelId('logs-bot');
    if (!id) return;
    const ch = await guild.channels.fetch(id).catch(() => null);
    if (!ch) return;
    await ch.send({ embeds: [embeds.log({ title, description, color, fields })] });
  } catch (err) {
    console_.warn('log vers #logs-bot impossible :', err.message);
  }
}

export function modAction(guild, { action, target, moderator, reason, extra = [] }) {
  return toChannel(guild, {
    title: `🛡️ ${action}`,
    color: COLORS.danger,
    fields: [
      { name: 'Membre', value: `${target}`, inline: true },
      { name: 'Modérateur', value: `${moderator}`, inline: true },
      { name: 'Raison', value: reason || 'Non précisée' },
      ...extra,
    ],
  });
}
