import { ActivityType, Events } from 'discord.js';
import { console_ } from '../lib/logger.js';
import { SITE_URL } from '../config/brand.js';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client) {
  console_.info(`Connecté en tant que ${client.user.tag}`);
  console_.info(`Site : ${SITE_URL}`);

  client.user.setPresence({
    activities: [{ name: 'graver vos jeux préférés', type: ActivityType.Playing }],
    status: 'online',
  });

  for (const guild of client.guilds.cache.values()) {
    console_.info(`Serveur : ${guild.name} (${guild.memberCount} membres)`);
  }
}
