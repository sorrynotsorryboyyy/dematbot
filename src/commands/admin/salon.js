// /salon : gestion courante des salons.

import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import * as embeds from '../../lib/embeds.js';
import * as logger from '../../lib/logger.js';
import { COLORS } from '../../config/brand.js';

export const data = new SlashCommandBuilder()
  .setName('salon')
  .setDescription('Gérer les salons du serveur')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .setDMPermission(false)
  .addSubcommand((s) =>
    s.setName('creer').setDescription('Créer un salon')
      .addStringOption((o) => o.setName('nom').setDescription('Nom du salon').setRequired(true))
      .addStringOption((o) =>
        o.setName('type').setDescription('Type de salon').addChoices(
          { name: 'Texte', value: 'text' },
          { name: 'Vocal', value: 'voice' },
          { name: 'Forum', value: 'forum' },
        ),
      )
      .addChannelOption((o) =>
        o.setName('categorie').setDescription('Catégorie parente').addChannelTypes(ChannelType.GuildCategory),
      )
      .addStringOption((o) => o.setName('sujet').setDescription('Sujet du salon')),
  )
  .addSubcommand((s) =>
    s.setName('renommer').setDescription('Renommer un salon')
      .addChannelOption((o) => o.setName('salon').setDescription('Le salon').setRequired(true))
      .addStringOption((o) => o.setName('nom').setDescription('Nouveau nom').setRequired(true)),
  )
  .addSubcommand((s) =>
    s.setName('supprimer').setDescription('Supprimer un salon')
      .addChannelOption((o) => o.setName('salon').setDescription('Le salon').setRequired(true))
      .addStringOption((o) => o.setName('confirmation').setDescription('Tape le nom exact du salon pour confirmer').setRequired(true)),
  )
  .addSubcommand((s) =>
    s.setName('deplacer').setDescription('Déplacer un salon vers une autre catégorie')
      .addChannelOption((o) => o.setName('salon').setDescription('Le salon').setRequired(true))
      .addChannelOption((o) =>
        o.setName('categorie').setDescription('Catégorie de destination').addChannelTypes(ChannelType.GuildCategory).setRequired(true),
      ),
  )
  .addSubcommand((s) =>
    s.setName('verrouiller').setDescription('Empêcher @everyone d écrire dans un salon')
      .addChannelOption((o) => o.setName('salon').setDescription('Le salon (par défaut : ici)')),
  )
  .addSubcommand((s) =>
    s.setName('deverrouiller').setDescription('Rendre l écriture au salon')
      .addChannelOption((o) => o.setName('salon').setDescription('Le salon (par défaut : ici)')),
  )
  .addSubcommand((s) =>
    s.setName('slowmode').setDescription('Régler le mode lent')
      .addIntegerOption((o) =>
        o.setName('secondes').setDescription('0 pour désactiver').setRequired(true).setMinValue(0).setMaxValue(21600),
      )
      .addChannelOption((o) => o.setName('salon').setDescription('Le salon (par défaut : ici)')),
  );

const TYPES = { text: ChannelType.GuildText, voice: ChannelType.GuildVoice, forum: ChannelType.GuildForum };

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const guild = interaction.guild;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const target = () => interaction.options.getChannel('salon') || interaction.channel;

  switch (sub) {
    case 'creer': {
      const name = interaction.options.getString('nom');
      const type = interaction.options.getString('type') || 'text';
      const parent = interaction.options.getChannel('categorie');
      const topic = interaction.options.getString('sujet');

      const options = { name, type: TYPES[type], reason: `/salon creer par ${interaction.user.tag}` };
      if (parent) options.parent = parent.id;
      if (topic && type !== 'voice') options.topic = topic;

      const channel = await guild.channels.create(options);
      await interaction.editReply({ embeds: [embeds.success(`Salon ${channel} créé.`)] });
      await log(guild, 'Salon créé', `${channel} par ${interaction.user}`);
      break;
    }

    case 'renommer': {
      const channel = interaction.options.getChannel('salon');
      const old = channel.name;
      await channel.edit({ name: interaction.options.getString('nom'), reason: `/salon renommer par ${interaction.user.tag}` });
      await interaction.editReply({ embeds: [embeds.success(`\`${old}\` renommé en ${channel}.`)] });
      await log(guild, 'Salon renommé', `\`${old}\` → ${channel} par ${interaction.user}`);
      break;
    }

    case 'supprimer': {
      const channel = interaction.options.getChannel('salon');
      const confirm = interaction.options.getString('confirmation');
      // Garde-fou : la suppression est irreversible, on exige le nom exact.
      if (confirm !== channel.name) {
        await interaction.editReply({
          embeds: [embeds.error(`Confirmation incorrecte. Tape exactement \`${channel.name}\` pour supprimer ce salon.`)],
        });
        return;
      }
      const name = channel.name;
      await channel.delete(`/salon supprimer par ${interaction.user.tag}`);
      await interaction.editReply({ embeds: [embeds.success(`Salon \`${name}\` supprimé.`)] });
      await log(guild, 'Salon supprimé', `\`${name}\` par ${interaction.user}`, COLORS.danger);
      break;
    }

    case 'deplacer': {
      const channel = interaction.options.getChannel('salon');
      const parent = interaction.options.getChannel('categorie');
      await channel.edit({ parent: parent.id, reason: `/salon deplacer par ${interaction.user.tag}` });
      await interaction.editReply({ embeds: [embeds.success(`${channel} déplacé vers **${parent.name}**.`)] });
      break;
    }

    case 'verrouiller':
    case 'deverrouiller': {
      const channel = target();
      const locked = sub === 'verrouiller';
      await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: locked ? false : null });
      await interaction.editReply({
        embeds: [embeds.success(`${channel} ${locked ? '🔒 verrouillé' : '🔓 déverrouillé'}.`)],
      });
      await log(guild, locked ? 'Salon verrouillé' : 'Salon déverrouillé', `${channel} par ${interaction.user}`);
      break;
    }

    case 'slowmode': {
      const channel = target();
      const seconds = interaction.options.getInteger('secondes');
      await channel.setRateLimitPerUser(seconds, `/salon slowmode par ${interaction.user.tag}`);
      await interaction.editReply({
        embeds: [embeds.success(seconds ? `Mode lent réglé à ${seconds}s dans ${channel}.` : `Mode lent désactivé dans ${channel}.`)],
      });
      break;
    }
  }
}

function log(guild, title, description, color = COLORS.info) {
  return logger.toChannel(guild, { title: `⚙️ ${title}`, description, color });
}
