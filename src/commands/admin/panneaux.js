// /panneaux : publie d'un coup tous les messages permanents du serveur
// (reglement, roles, catalogue, support, espace devs, FAQ devs).
// Pratique juste apres /setup pour habiller le serveur en une commande.

import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { resolveChannel } from '../../lib/guild.js';
import * as rules from '../../components/rules.js';
import * as rolePanel from '../../components/rolePanel.js';
import * as tickets from '../../components/tickets.js';
import * as embeds from '../../lib/embeds.js';
import { games } from '../../db/index.js';

export const data = new SlashCommandBuilder()
  .setName('panneaux')
  .setDescription('Publier tous les messages permanents du serveur (règlement, rôles, support, devs…)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

export async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = interaction.guild;
  const done = [];
  const missing = [];

  // send : recoit le salon resolu et se charge lui-meme de l'envoi, ce qui
  // permet au panneau de roles d'utiliser sa propre logique de persistance.
  const publish = async (channelKey, label, send) => {
    const channel = await resolveChannel(guild, channelKey);
    if (!channel) {
      missing.push(label);
      return;
    }
    await send(channel);
    done.push(`${label} → ${channel}`);
  };

  await publish('reglement', 'Règlement', (c) => c.send(rules.buildMessage()));
  await publish('choisir-roles', 'Choix des rôles', (c) => rolePanel.publish(guild, c));
  await publish('support', 'Support', (c) => c.send(tickets.buildSupportPanel()));
  await publish('editer-mon-jeu', 'Espace développeurs', (c) => c.send(tickets.buildDevPanel()));
  await publish('faq-devs', 'FAQ développeurs', (c) => c.send({ embeds: [embeds.devFaq()] }));

  // Le catalogue n'affiche l'embed d'attente que s'il est encore vide.
  if (games.count() === 0) {
    await publish('catalogue', 'Catalogue', (c) => c.send({ embeds: [embeds.emptyCatalogue()] }));
  }

  await interaction.editReply({
    embeds: [
      embeds.log({
        title: '📋 Panneaux publiés',
        description: [
          done.length ? done.map((d) => `✅ ${d}`).join('\n') : 'Aucun panneau publié.',
          missing.length ? `\n⚠️ Salons introuvables : ${missing.join(', ')}\nLance \`/setup\` d abord.` : '',
        ].filter(Boolean).join('\n'),
      }),
    ],
  });
}
