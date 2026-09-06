// /panel : publie le hub admin persistant dans #panel-admin.

import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { buildPanel } from '../../components/adminPanel.js';
import { resolveChannel } from '../../lib/guild.js';
import * as embeds from '../../lib/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('panel')
  .setDescription('Publier le panneau de gestion dans #panel-admin')
  .addChannelOption((o) => o.setName('salon').setDescription('Publier ailleurs que dans #panel-admin'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

export async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const channel =
    interaction.options.getChannel('salon') || (await resolveChannel(interaction.guild, 'panel-admin'));

  if (!channel) {
    await interaction.editReply({
      embeds: [embeds.error('Salon **#panel-admin** introuvable. Lance `/setup` ou précise un salon.')],
    });
    return;
  }

  const message = await channel.send(buildPanel());
  await message.pin().catch(() => {});

  await interaction.editReply({
    embeds: [embeds.success(`Panneau publié et épinglé dans ${channel}. [Voir](${message.url})`)],
  });
}
