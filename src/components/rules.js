// Reglement du serveur + bouton d'acceptation qui debloque la communaute.

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { resolveRoles } from '../lib/guild.js';
import * as embeds from '../lib/embeds.js';
import { COLORS, SITE_URL } from '../config/brand.js';

const ARTICLES = [
  ['1. Respect', 'On est là pour parler de jeux. Pas d insultes, pas de harcèlement, pas de discrimination.'],
  ['2. Contenu', 'Rien de NSFW, de choquant ou d illégal. Les clips et images restent tout public.'],
  ['3. Pas de spam', 'Ni flood, ni pub, ni invitations vers d autres serveurs sans accord du staff.'],
  ['4. Le bon salon', 'Chaque salon a son sujet. Les descriptions sont là pour t aider.'],
  ['5. Piratage', 'Aucun partage de jeux crackés ou de ROMs. On édite des jeux, on respecte ceux qui les font.'],
  ['6. Le staff', 'Les décisions du staff s appliquent. Un désaccord ? Ouvre un ticket, on en discute au calme.'],
];

export function buildMessage() {
  const embed = embeds.log({
    title: '📌 Règlement de DematGames',
    color: COLORS.primary,
    description: [
      `Bienvenue sur le serveur de **DematGames**, l édition physique de jeux indés.`,
      `Ici on parle jeux, on partage des clips, et on suit les coulisses de l atelier.`,
      '',
      'Accepte le règlement pour débloquer les salons de la communauté.',
    ].join('\n'),
    fields: ARTICLES.map(([name, value]) => ({ name, value })),
  }).setFooter({ text: `DematGames — ${SITE_URL}` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('rules:accept')
      .setLabel('J accepte le règlement')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅'),
  );

  return { embeds: [embed], components: [row] };
}

export async function handle(interaction, action) {
  if (action !== 'accept') return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const roles = await resolveRoles(interaction.guild);

  if (!roles.verified) {
    await interaction.editReply({
      embeds: [embeds.error('Le rôle de membre vérifié n existe pas encore. Un admin doit lancer `/setup`.')],
    });
    return;
  }

  if (interaction.member.roles.cache.has(roles.verified.id)) {
    await interaction.editReply({ embeds: [embeds.info('Tu as déjà accepté le règlement. Bon jeu !')] });
    return;
  }

  await interaction.member.roles.add(roles.verified, 'Règlement accepté');
  await interaction.editReply({
    embeds: [
      embeds.success('Règlement accepté, la communauté est débloquée. Passe par **#choisir-ses-rôles** pour la suite.'),
    ],
  });
}
