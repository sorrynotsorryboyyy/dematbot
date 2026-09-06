// /mod : warn, mute, kick, ban, unban, warns, clear.
// Regroupe en une seule commande a sous-commandes pour rester lisible.

import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { warns } from '../../db/index.js';
import * as embeds from '../../lib/embeds.js';
import * as logger from '../../lib/logger.js';

// Au-dela de ce nombre d'avertissements, le bot suggere une sanction au staff.
const WARN_THRESHOLD = 3;

export const data = new SlashCommandBuilder()
  .setName('mod')
  .setDescription('Outils de modération')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false)
  .addSubcommand((s) =>
    s.setName('warn').setDescription('Avertir un membre')
      .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true))
      .addStringOption((o) => o.setName('raison').setDescription('Raison').setRequired(true)),
  )
  .addSubcommand((s) =>
    s.setName('warns').setDescription('Voir les avertissements d un membre')
      .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true)),
  )
  .addSubcommand((s) =>
    s.setName('unwarn').setDescription('Effacer les avertissements d un membre')
      .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true)),
  )
  .addSubcommand((s) =>
    s.setName('mute').setDescription('Réduire un membre au silence')
      .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true))
      .addIntegerOption((o) =>
        o.setName('minutes').setDescription('Durée en minutes').setRequired(true).setMinValue(1).setMaxValue(40320),
      )
      .addStringOption((o) => o.setName('raison').setDescription('Raison')),
  )
  .addSubcommand((s) =>
    s.setName('unmute').setDescription('Rendre la parole à un membre')
      .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true)),
  )
  .addSubcommand((s) =>
    s.setName('kick').setDescription('Expulser un membre')
      .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true))
      .addStringOption((o) => o.setName('raison').setDescription('Raison')),
  )
  .addSubcommand((s) =>
    s.setName('ban').setDescription('Bannir un membre')
      .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true))
      .addStringOption((o) => o.setName('raison').setDescription('Raison'))
      .addIntegerOption((o) =>
        o.setName('purge').setDescription('Supprimer ses messages des N derniers jours').setMinValue(0).setMaxValue(7),
      ),
  )
  .addSubcommand((s) =>
    s.setName('unban').setDescription('Révoquer un bannissement')
      .addStringOption((o) => o.setName('identifiant').setDescription('ID du membre banni').setRequired(true)),
  )
  .addSubcommand((s) =>
    s.setName('clear').setDescription('Supprimer les derniers messages du salon')
      .addIntegerOption((o) =>
        o.setName('nombre').setDescription('Entre 1 et 100').setRequired(true).setMinValue(1).setMaxValue(100),
      )
      .addUserOption((o) => o.setName('membre').setDescription('Ne supprimer que ses messages')),
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const guild = interaction.guild;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const user = interaction.options.getUser('membre');
  const reason = interaction.options.getString('raison') || 'Non précisée';
  const member = user ? await guild.members.fetch(user.id).catch(() => null) : null;

  // Garde-fou commun : on ne sanctionne pas plus haut ou egal a soi.
  if (member && ['mute', 'kick', 'ban'].includes(sub)) {
    if (member.id === interaction.user.id) {
      await interaction.editReply({ embeds: [embeds.error('Tu ne peux pas te sanctionner toi-même.')] });
      return;
    }
    if (member.roles.highest.position >= interaction.member.roles.highest.position) {
      await interaction.editReply({
        embeds: [embeds.error('Ce membre a un rôle égal ou supérieur au tien.')],
      });
      return;
    }
  }

  switch (sub) {
    case 'warn': {
      const total = warns.add(user.id, interaction.user.id, reason);
      await notify(member, `Tu as reçu un avertissement sur **${guild.name}**.\nRaison : ${reason}`);
      await interaction.editReply({
        embeds: [
          embeds.success(
            `${user} averti (${total} avertissement${total > 1 ? 's' : ''}).` +
              (total >= WARN_THRESHOLD ? `\n⚠️ Seuil de ${WARN_THRESHOLD} atteint — une sanction est à envisager.` : ''),
          ),
        ],
      });
      await logger.modAction(guild, { action: 'Avertissement', target: user, moderator: interaction.user, reason,
        extra: [{ name: 'Total', value: String(total), inline: true }] });
      break;
    }

    case 'warns': {
      const list = warns.list(user.id);
      if (!list.length) {
        await interaction.editReply({ embeds: [embeds.info(`${user} n a aucun avertissement.`)] });
        return;
      }
      await interaction.editReply({
        embeds: [
          embeds.log({
            title: `⚠️ Avertissements de ${user.tag} (${list.length})`,
            description: list
              .slice(0, 15)
              .map((w) => `• <t:${Math.floor(w.created_at / 1000)}:d> — ${w.reason || 'Non précisée'} *(par <@${w.moderator_id}>)*`)
              .join('\n'),
          }),
        ],
      });
      break;
    }

    case 'unwarn': {
      const n = warns.count(user.id);
      warns.clear(user.id);
      await interaction.editReply({ embeds: [embeds.success(`${n} avertissement(s) effacé(s) pour ${user}.`)] });
      await logger.modAction(guild, { action: 'Avertissements effacés', target: user, moderator: interaction.user, reason: `${n} effacé(s)` });
      break;
    }

    case 'mute': {
      const minutes = interaction.options.getInteger('minutes');
      if (!member) {
        await interaction.editReply({ embeds: [embeds.error('Membre introuvable sur le serveur.')] });
        return;
      }
      await member.timeout(minutes * 60_000, reason);
      await interaction.editReply({ embeds: [embeds.success(`${user} réduit au silence pour ${minutes} minute(s).`)] });
      await logger.modAction(guild, { action: 'Mute', target: user, moderator: interaction.user, reason,
        extra: [{ name: 'Durée', value: `${minutes} min`, inline: true }] });
      break;
    }

    case 'unmute': {
      if (!member) {
        await interaction.editReply({ embeds: [embeds.error('Membre introuvable sur le serveur.')] });
        return;
      }
      await member.timeout(null, `Levé par ${interaction.user.tag}`);
      await interaction.editReply({ embeds: [embeds.success(`${user} peut de nouveau écrire.`)] });
      break;
    }

    case 'kick': {
      if (!member) {
        await interaction.editReply({ embeds: [embeds.error('Membre introuvable sur le serveur.')] });
        return;
      }
      await notify(member, `Tu as été expulsé de **${guild.name}**.\nRaison : ${reason}`);
      await member.kick(reason);
      await interaction.editReply({ embeds: [embeds.success(`${user} expulsé.`)] });
      await logger.modAction(guild, { action: 'Expulsion', target: user, moderator: interaction.user, reason });
      break;
    }

    case 'ban': {
      const days = interaction.options.getInteger('purge') ?? 0;
      await notify(member, `Tu as été banni de **${guild.name}**.\nRaison : ${reason}`);
      await guild.members.ban(user.id, { reason, deleteMessageSeconds: days * 86400 });
      await interaction.editReply({ embeds: [embeds.success(`${user} banni.`)] });
      await logger.modAction(guild, { action: 'Bannissement', target: user, moderator: interaction.user, reason });
      break;
    }

    case 'unban': {
      const id = interaction.options.getString('identifiant');
      await guild.members.unban(id, `Levé par ${interaction.user.tag}`);
      await interaction.editReply({ embeds: [embeds.success(`Bannissement de \`${id}\` levé.`)] });
      break;
    }

    case 'clear': {
      const count = interaction.options.getInteger('nombre');
      const target = interaction.options.getUser('membre');

      const fetched = await interaction.channel.messages.fetch({ limit: 100 });
      const toDelete = [...fetched.values()]
        .filter((m) => (target ? m.author.id === target.id : true))
        // Discord refuse de supprimer en masse les messages de plus de 14 jours.
        .filter((m) => Date.now() - m.createdTimestamp < 14 * 86400_000)
        .slice(0, count);

      const deleted = await interaction.channel.bulkDelete(toDelete, true);
      await interaction.editReply({
        embeds: [embeds.success(`${deleted.size} message(s) supprimé(s)${target ? ` de ${target}` : ''}.`)],
      });
      await logger.toChannel(guild, {
        title: '🧹 Purge de messages',
        description: `${deleted.size} message(s) dans ${interaction.channel} par ${interaction.user}`,
      });
      break;
    }
  }
}

// Prevenir le membre en MP. Un MP ferme ne doit pas faire echouer la sanction.
async function notify(member, text) {
  if (!member) return;
  await member.send({ embeds: [embeds.info(text)] }).catch(() => {});
}
