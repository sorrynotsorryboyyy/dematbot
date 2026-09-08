// /reset : efface la structure creee par le bot pour repartir sur du propre.
//
// C'est la commande la plus destructive du bot. Les garde-fous sont cumulatifs :
//   1. permission Administrateur exigee par Discord
//   2. reservee au proprietaire du serveur
//   3. le nom exact du serveur doit etre tape en confirmation
//   4. recapitulatif + bouton a cliquer
//   5. option simulation pour tout voir sans rien toucher
//
// Ne touche jamais a ce qui n'est pas decrit par le blueprint : les salons et
// roles crees a la main sont preserves.

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { CATEGORIES, ROLES } from '../../config/blueprint.js';
import { findCategory, findChannel, findRole } from '../../lib/blueprintLookup.js';
import { db } from '../../db/index.js';
import * as embeds from '../../lib/embeds.js';
import { COLORS } from '../../config/brand.js';
import { console_ } from '../../lib/logger.js';

const TABLES = ['settings', 'games', 'tickets', 'submissions', 'warns', 'rolepanels'];

export const data = new SlashCommandBuilder()
  .setName('reset')
  .setDescription('⚠️ Supprime la structure créée par le bot (salons, rôles, données)')
  .addStringOption((o) =>
    o
      .setName('cible')
      .setDescription('Ce qui doit être supprimé')
      .setRequired(true)
      .addChoices(
        { name: 'Tout (salons + rôles + données)', value: 'tout' },
        { name: 'Salons et catégories', value: 'salons' },
        { name: 'Rôles', value: 'roles' },
        { name: 'Données du bot uniquement', value: 'donnees' },
      ),
  )
  .addStringOption((o) =>
    o.setName('confirmation').setDescription('Tape le nom exact du serveur pour confirmer'),
  )
  .addBooleanOption((o) =>
    o.setName('simulation').setDescription('Affiche ce qui serait supprimé, sans rien toucher'),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false);

export async function execute(interaction) {
  const target = interaction.options.getString('cible');
  const confirmation = interaction.options.getString('confirmation');
  const dryRun = interaction.options.getBoolean('simulation') ?? false;
  const guild = interaction.guild;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Garde-fou 2 : le proprietaire du serveur, et lui seul.
  if (interaction.user.id !== guild.ownerId) {
    await interaction.editReply({
      embeds: [
        embeds.error(
          'Seul le **propriétaire du serveur** peut lancer `/reset`.\nLa permission Administrateur ne suffit pas pour cette commande.',
        ),
      ],
    });
    return;
  }

  await guild.roles.fetch();
  await guild.channels.fetch();

  const scope = {
    channels: target === 'tout' || target === 'salons',
    roles: target === 'tout' || target === 'roles',
    data: target === 'tout' || target === 'donnees',
  };

  const plan = buildResetPlan(guild, scope);

  if (!plan.channels.length && !plan.categories.length && !plan.roles.length && !scope.data) {
    await interaction.editReply({
      embeds: [embeds.info('Rien à supprimer : aucun élément du blueprint n est présent sur ce serveur.')],
    });
    return;
  }

  const summary = renderResetPlan(guild, plan, scope, dryRun);

  if (dryRun) {
    await interaction.editReply({ embeds: [summary] });
    return;
  }

  // Garde-fou 3 : le nom exact du serveur.
  if (confirmation !== guild.name) {
    await interaction.editReply({
      embeds: [
        summary,
        embeds.error(
          confirmation
            ? `Confirmation incorrecte.\nRelance la commande avec \`confirmation:${guild.name}\``
            : `Cette action est irréversible.\nPour confirmer, relance avec \`confirmation:${guild.name}\`\n\nOu commence par \`simulation:true\` pour voir sans rien toucher.`,
        ),
      ],
    });
    return;
  }

  // Garde-fou 4 : un dernier clic.
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('reset:confirm').setLabel('Supprimer définitivement').setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
    new ButtonBuilder().setCustomId('reset:cancel').setLabel('Annuler').setStyle(ButtonStyle.Secondary),
  );

  const msg = await interaction.editReply({ embeds: [summary], components: [row] });

  const press = await msg
    .awaitMessageComponent({ filter: (i) => i.user.id === interaction.user.id, time: 60_000 })
    .catch(() => null);

  if (!press || press.customId === 'reset:cancel') {
    await interaction.editReply({
      embeds: [embeds.info(press ? 'Reset annulé, rien n a été supprimé.' : 'Reset expiré, rien n a été supprimé.')],
      components: [],
    });
    return;
  }

  await press.update({ embeds: [embeds.info('⏳ Suppression en cours…')], components: [] });

  const result = await applyReset(guild, plan, scope);

  await interaction.editReply({
    embeds: [
      embeds.log({
        title: '🗑️ Reset terminé',
        color: COLORS.danger,
        description: [
          scope.channels ? `**${result.channelsDeleted}** salons et **${result.categoriesDeleted}** catégories supprimés` : '',
          scope.roles ? `**${result.rolesDeleted}** rôles supprimés` : '',
          scope.data ? `Base de données vidée (${TABLES.length} tables)` : '',
          '',
          'Relance `/setup` pour reconstruire le serveur.',
          result.errors.length
            ? `\n⚠️ ${result.errors.length} élément(s) non supprimé(s) :\n${result.errors.slice(0, 8).map((e) => `• ${e}`).join('\n')}`
            : '',
        ].filter(Boolean).join('\n'),
      }),
    ],
  });

  console_.warn(`/reset (${target}) exécuté sur ${guild.name} par ${interaction.user.tag}`);
}

// --- plan --------------------------------------------------------------------

function buildResetPlan(guild, scope) {
  const plan = { channels: [], categories: [], roles: [], protectedRoles: [] };
  const me = guild.members.me;

  if (scope.channels) {
    for (const cat of CATEGORIES) {
      for (const ch of cat.channels) {
        const found = findChannel(guild, ch);
        if (found) plan.channels.push(found);
      }
      const foundCat = findCategory(guild, cat);
      if (foundCat) plan.categories.push(foundCat);
    }

    // Les salons de tickets sont crees a la volee : ils ne figurent pas dans le
    // blueprint mais vivent sous sa categorie, donc ils partent avec elle.
    for (const category of plan.categories) {
      for (const child of guild.channels.cache.values()) {
        if (child.parentId === category.id && !plan.channels.some((c) => c.id === child.id)) {
          plan.channels.push(child);
        }
      }
    }
  }

  if (scope.roles) {
    for (const def of ROLES) {
      const role = findRole(guild, def);
      if (!role) continue;

      // Un role gere par une integration ou situe au-dessus du bot ne peut pas
      // etre supprime : on le signale plutot que d'echouer silencieusement.
      if (role.managed) {
        plan.protectedRoles.push(`${role.name} (géré par une intégration)`);
      } else if (me && role.position >= me.roles.highest.position) {
        plan.protectedRoles.push(`${role.name} (au-dessus du bot dans la hiérarchie)`);
      } else {
        plan.roles.push(role);
      }
    }
  }

  return plan;
}

function renderResetPlan(guild, plan, scope, dryRun) {
  const section = (title, items, fmt) =>
    items.length ? { name: `${title} (${items.length})`, value: items.map(fmt).join('\n').slice(0, 1000) } : null;

  const fields = [
    section('Salons supprimés', plan.channels, (c) => `• ${c.name}`),
    section('Catégories supprimées', plan.categories, (c) => `• ${c.name}`),
    section('Rôles supprimés', plan.roles, (r) => `• ${r.name}`),
    section('Rôles conservés (impossible à supprimer)', plan.protectedRoles, (r) => `• ${r}`),
    scope.data ? { name: 'Données du bot', value: `Les ${TABLES.length} tables seront vidées : configuration, catalogue, tickets, soumissions, avertissements.` } : null,
  ].filter(Boolean);

  return embeds.log({
    title: dryRun ? '🔍 Simulation du reset' : '⚠️ Suppression demandée',
    color: dryRun ? COLORS.primary : COLORS.danger,
    description: dryRun
      ? 'Voici ce qui serait supprimé. **Rien n a été touché.**'
      : `**Cette action est irréversible.** Les messages des salons seront perdus.\n\nLes salons et rôles créés à la main hors du blueprint sont conservés.`,
    fields,
  });
}

// --- application -------------------------------------------------------------

async function applyReset(guild, plan, scope) {
  const result = { channelsDeleted: 0, categoriesDeleted: 0, rolesDeleted: 0, errors: [] };

  // Salons d'abord, categories ensuite : Discord refuse de supprimer une
  // categorie qui contient encore des salons.
  for (const channel of plan.channels) {
    try {
      await channel.delete('DematBot /reset');
      result.channelsDeleted += 1;
    } catch (err) {
      result.errors.push(`salon ${channel.name} : ${err.message}`);
    }
  }

  for (const category of plan.categories) {
    try {
      await category.delete('DematBot /reset');
      result.categoriesDeleted += 1;
    } catch (err) {
      result.errors.push(`catégorie ${category.name} : ${err.message}`);
    }
  }

  for (const role of plan.roles) {
    try {
      await role.delete('DematBot /reset');
      result.rolesDeleted += 1;
    } catch (err) {
      result.errors.push(`rôle ${role.name} : ${err.message}`);
    }
  }

  // La base est videe en dernier : si la suppression des salons echoue, les ids
  // memorises restent exploitables pour reessayer.
  if (scope.data) {
    for (const table of TABLES) {
      try {
        db.exec(`DELETE FROM ${table}`);
      } catch (err) {
        result.errors.push(`table ${table} : ${err.message}`);
      }
    }
  } else if (scope.channels || scope.roles) {
    // Sans reset des donnees, on purge quand meme les ids devenus obsoletes,
    // sinon /setup chercherait des salons qui n'existent plus.
    try {
      if (scope.channels) db.exec("DELETE FROM settings WHERE key LIKE 'channel:%'");
      if (scope.roles) db.exec("DELETE FROM settings WHERE key LIKE 'role:%'");
    } catch (err) {
      result.errors.push(`nettoyage des références : ${err.message}`);
    }
  }

  return result;
}
