// /categorie : gestion des categories.

import { ChannelType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import * as embeds from '../../lib/embeds.js';
import * as logger from '../../lib/logger.js';
import { COLORS } from '../../config/brand.js';

export const data = new SlashCommandBuilder()
  .setName('categorie')
  .setDescription('Gérer les catégories du serveur')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .setDMPermission(false)
  .addSubcommand((s) =>
    s.setName('creer').setDescription('Créer une catégorie')
      .addStringOption((o) => o.setName('nom').setDescription('Nom de la catégorie').setRequired(true)),
  )
  .addSubcommand((s) =>
    s.setName('renommer').setDescription('Renommer une catégorie')
      .addChannelOption((o) =>
        o.setName('categorie').setDescription('La catégorie').addChannelTypes(ChannelType.GuildCategory).setRequired(true),
      )
      .addStringOption((o) => o.setName('nom').setDescription('Nouveau nom').setRequired(true)),
  )
  .addSubcommand((s) =>
    s.setName('supprimer').setDescription('Supprimer une catégorie (ses salons sont conservés)')
      .addChannelOption((o) =>
        o.setName('categorie').setDescription('La catégorie').addChannelTypes(ChannelType.GuildCategory).setRequired(true),
      )
      .addStringOption((o) => o.setName('confirmation').setDescription('Tape le nom exact pour confirmer').setRequired(true)),
  )
  .addSubcommand((s) =>
    s.setName('synchroniser').setDescription('Appliquer les permissions de la catégorie à tous ses salons')
      .addChannelOption((o) =>
        o.setName('categorie').setDescription('La catégorie').addChannelTypes(ChannelType.GuildCategory).setRequired(true),
      ),
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const guild = interaction.guild;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  switch (sub) {
    case 'creer': {
      const category = await guild.channels.create({
        name: interaction.options.getString('nom'),
        type: ChannelType.GuildCategory,
        reason: `/categorie creer par ${interaction.user.tag}`,
      });
      await interaction.editReply({ embeds: [embeds.success(`Catégorie **${category.name}** créée.`)] });
      break;
    }

    case 'renommer': {
      const category = interaction.options.getChannel('categorie');
      const old = category.name;
      await category.edit({ name: interaction.options.getString('nom'), reason: `/categorie renommer par ${interaction.user.tag}` });
      await interaction.editReply({ embeds: [embeds.success(`**${old}** renommée en **${category.name}**.`)] });
      break;
    }

    case 'supprimer': {
      const category = interaction.options.getChannel('categorie');
      if (interaction.options.getString('confirmation') !== category.name) {
        await interaction.editReply({
          embeds: [embeds.error(`Confirmation incorrecte. Tape exactement \`${category.name}\`.`)],
        });
        return;
      }
      // Les salons enfants sont detaches, pas supprimes.
      const children = guild.channels.cache.filter((c) => c.parentId === category.id);
      for (const child of children.values()) await child.edit({ parent: null }).catch(() => {});
      const name = category.name;
      await category.delete(`/categorie supprimer par ${interaction.user.tag}`);
      await interaction.editReply({
        embeds: [embeds.success(`Catégorie **${name}** supprimée. ${children.size} salon(s) conservé(s) hors catégorie.`)],
      });
      await logger.toChannel(guild, {
        title: '⚙️ Catégorie supprimée',
        description: `**${name}** par ${interaction.user}`,
        color: COLORS.danger,
      });
      break;
    }

    case 'synchroniser': {
      const category = interaction.options.getChannel('categorie');
      const children = guild.channels.cache.filter((c) => c.parentId === category.id);
      let n = 0;
      for (const child of children.values()) {
        await child.lockPermissions().catch(() => {});
        n += 1;
      }
      await interaction.editReply({
        embeds: [embeds.success(`Permissions de **${category.name}** appliquées à ${n} salon(s).`)],
      });
      break;
    }
  }
}
