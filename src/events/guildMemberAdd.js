// Accueil des nouveaux arrivants.

import { Events } from 'discord.js';
import { resolveChannel, resolveRoles } from '../lib/guild.js';
import { COLORS } from '../config/brand.js';
import * as embeds from '../lib/embeds.js';
import { console_ } from '../lib/logger.js';

export const name = Events.GuildMemberAdd;

export async function execute(member) {
  try {
    const roles = await resolveRoles(member.guild);

    // Les bots recoivent leur role dedie et rien d'autre.
    if (member.user.bot) {
      if (roles.bots) await member.roles.add(roles.bots).catch(() => {});
      return;
    }

    const welcome = await resolveChannel(member.guild, 'bienvenue');
    if (!welcome) return;

    const reglement = await resolveChannel(member.guild, 'reglement');
    const devs = await resolveChannel(member.guild, 'editer-mon-jeu');

    const lines = [
      `Bienvenue ${member} sur **DematGames** !`,
      '',
      reglement ? `📌 Passe par ${reglement} et accepte le règlement pour débloquer la communauté.` : null,
      devs ? `🛠️ Tu développes un jeu ? Va voir ${devs}, on édite des jeux indés en physique.` : null,
    ].filter(Boolean);

    await welcome.send({
      content: `${member}`,
      embeds: [
        embeds.log({
          title: '👋 Un nouveau membre nous rejoint',
          description: lines.join('\n'),
          color: COLORS.success,
        }),
      ],
    });
  } catch (err) {
    console_.error('Accueil du nouveau membre :', err.message);
  }
}
