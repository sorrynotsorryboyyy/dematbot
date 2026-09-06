// /setup : fait converger le serveur vers le blueprint.
// Idempotent : compare par id memorise puis par nom (et alias), ne cree que le manquant.

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { CATEGORIES, CHANNEL_TYPES, ROLES } from '../../config/blueprint.js';
import { resolvePreset } from '../../lib/permissions.js';
import { withRoleFallbacks } from '../../lib/guild.js';
import { channelId, roleId, setChannelId, setRoleId } from '../../db/index.js';
import * as embeds from '../../lib/embeds.js';
import { COLORS } from '../../config/brand.js';
import * as logger from '../../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Construit ou met à jour la structure du serveur DematGames')
  .addBooleanOption((o) =>
    o.setName('simulation').setDescription('Affiche ce qui serait fait, sans rien modifier'),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false);

export async function execute(interaction) {
  const dryRun = interaction.options.getBoolean('simulation') ?? false;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const plan = await buildPlan(interaction.guild);

  if (!plan.actions.length) {
    await interaction.editReply({
      embeds: [embeds.success('Le serveur est déjà conforme au blueprint. Rien à faire.')],
    });
    return;
  }

  const summary = renderPlan(plan, dryRun);

  if (dryRun) {
    await interaction.editReply({ embeds: [summary] });
    return;
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:confirm').setLabel('Appliquer').setStyle(ButtonStyle.Success).setEmoji('✅'),
    new ButtonBuilder().setCustomId('setup:cancel').setLabel('Annuler').setStyle(ButtonStyle.Secondary),
  );

  const msg = await interaction.editReply({ embeds: [summary], components: [row] });

  // Collector local : la confirmation ne survit volontairement pas au redemarrage,
  // le plan serait recalcule de toute facon.
  const press = await msg
    .awaitMessageComponent({ filter: (i) => i.user.id === interaction.user.id, time: 120_000 })
    .catch(() => null);

  if (!press || press.customId === 'setup:cancel') {
    await interaction.editReply({
      embeds: [embeds.info(press ? 'Setup annulé.' : 'Setup expiré, relance la commande.')],
      components: [],
    });
    return;
  }

  await press.update({ embeds: [embeds.info('⏳ Application en cours…')], components: [] });

  const result = await applyPlan(interaction.guild, plan);

  await interaction.editReply({
    embeds: [
      embeds.log({
        title: '✅ Serveur configuré',
        color: COLORS.success,
        description: [
          `**${result.rolesCreated}** rôles créés, **${result.rolesReused}** réutilisés`,
          `**${result.categoriesCreated}** catégories créées, **${result.categoriesReused}** réutilisées`,
          `**${result.channelsCreated}** salons créés, **${result.channelsReused}** réutilisés`,
          result.errors.length ? `\n⚠️ ${result.errors.length} erreur(s) :\n${result.errors.slice(0, 5).map((e) => `• ${e}`).join('\n')}` : '',
        ].filter(Boolean).join('\n'),
      }),
    ],
  });

  await logger.toChannel(interaction.guild, {
    title: '⚙️ /setup appliqué',
    description: `Par ${interaction.user}`,
    color: COLORS.success,
  });
}

// --- construction du plan ----------------------------------------------------

async function buildPlan(guild) {
  await guild.roles.fetch();
  await guild.channels.fetch();

  const actions = [];
  const existingRoles = new Map();

  for (const def of ROLES) {
    const found = findRole(guild, def);
    if (found) existingRoles.set(def.key, found);
    else actions.push({ kind: 'role', def });
  }

  for (const cat of CATEGORIES) {
    const existingCat = findCategory(guild, cat);
    if (!existingCat) actions.push({ kind: 'category', def: cat });

    for (const ch of cat.channels) {
      if (!findChannel(guild, ch)) actions.push({ kind: 'channel', def: ch, category: cat });
    }
  }

  return { actions, existingRoles };
}

function findRole(guild, def) {
  const id = roleId(def.key);
  if (id && guild.roles.cache.has(id)) return guild.roles.cache.get(id);
  return guild.roles.cache.find((r) => r.name === def.name) || null;
}

function findCategory(guild, def) {
  const id = channelId(`cat:${def.key}`);
  if (id && guild.channels.cache.has(id)) return guild.channels.cache.get(id);
  return guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === def.name) || null;
}

function findChannel(guild, def) {
  const id = channelId(def.key);
  if (id && guild.channels.cache.has(id)) return guild.channels.cache.get(id);
  const names = [def.name, ...(def.aliases || [])];
  return guild.channels.cache.find((c) => c.type !== ChannelType.GuildCategory && names.includes(c.name)) || null;
}

function renderPlan(plan, dryRun) {
  const roles = plan.actions.filter((a) => a.kind === 'role');
  const cats = plan.actions.filter((a) => a.kind === 'category');
  const chans = plan.actions.filter((a) => a.kind === 'channel');

  const section = (title, items, fmt) =>
    items.length ? { name: `${title} (${items.length})`, value: items.map(fmt).join('\n').slice(0, 1000) } : null;

  const fields = [
    section('Rôles à créer', roles, (a) => `• ${a.def.name}`),
    section('Catégories à créer', cats, (a) => `• ${a.def.name}`),
    section('Salons à créer', chans, (a) => `• ${a.def.name} → ${a.category.name}`),
  ].filter(Boolean);

  return embeds.log({
    title: dryRun ? '🔍 Simulation du setup' : '⚙️ Plan de configuration',
    color: COLORS.primary,
    description: dryRun
      ? 'Voici ce qui serait créé. Rien n a été modifié.'
      : 'Vérifie le plan puis clique sur **Appliquer**. Rien n est jamais supprimé.',
    fields,
  });
}

// --- application -------------------------------------------------------------

async function applyPlan(guild, plan) {
  const result = {
    rolesCreated: 0, rolesReused: 0,
    categoriesCreated: 0, categoriesReused: 0,
    channelsCreated: 0, channelsReused: 0,
    errors: [],
  };

  // 1. Roles. Crees dans l'ordre du blueprint, les plus hauts en premier.
  const roles = { everyone: guild.roles.everyone };
  for (const def of ROLES) {
    try {
      let role = findRole(guild, def);
      if (role) {
        result.rolesReused += 1;
      } else {
        role = await guild.roles.create({
          name: def.name,
          color: def.color,
          hoist: def.hoist ?? false,
          mentionable: def.mentionable ?? false,
          reason: 'DematBot /setup',
        });
        result.rolesCreated += 1;
      }
      setRoleId(def.key, role.id);
      roles[def.key] = role;
    } catch (err) {
      result.errors.push(`rôle ${def.name} : ${err.message}`);
    }
  }

  const safeRoles = withRoleFallbacks(roles);

  // 2. Categories, puis salons enfants.
  for (const cat of CATEGORIES) {
    let category;
    try {
      category = findCategory(guild, cat);
      if (category) {
        result.categoriesReused += 1;
        await category.permissionOverwrites.set(resolvePreset(cat.preset, safeRoles)).catch(() => {});
      } else {
        category = await guild.channels.create({
          name: cat.name,
          type: ChannelType.GuildCategory,
          permissionOverwrites: resolvePreset(cat.preset, safeRoles),
          reason: 'DematBot /setup',
        });
        result.categoriesCreated += 1;
      }
      setChannelId(`cat:${cat.key}`, category.id);
    } catch (err) {
      result.errors.push(`catégorie ${cat.name} : ${err.message}`);
      continue;
    }

    for (const ch of cat.channels) {
      try {
        let channel = findChannel(guild, ch);

        if (channel) {
          result.channelsReused += 1;
          // Salon existant (ex. rules) : on le rattache, on le renomme, on aligne les droits.
          const edits = {};
          if (channel.name !== ch.name) edits.name = ch.name;
          if (channel.parentId !== category.id) edits.parent = category.id;
          if (ch.topic && 'topic' in channel && channel.topic !== ch.topic) edits.topic = ch.topic;
          if (Object.keys(edits).length) await channel.edit({ ...edits, reason: 'DematBot /setup' });
          await channel.permissionOverwrites.set(resolvePreset(ch.preset, safeRoles)).catch(() => {});
        } else {
          const options = {
            name: ch.name,
            type: CHANNEL_TYPES[ch.type],
            parent: category.id,
            permissionOverwrites: resolvePreset(ch.preset, safeRoles),
            reason: 'DematBot /setup',
          };
          if (ch.topic && ch.type !== 'voice') options.topic = ch.topic;
          if (ch.slowmode) options.rateLimitPerUser = ch.slowmode;
          if (ch.type === 'forum' && ch.tags) {
            options.availableTags = ch.tags.map((t) => ({ name: t, moderated: false }));
          }
          channel = await guild.channels.create(options);
          result.channelsCreated += 1;
        }

        setChannelId(ch.key, channel.id);
      } catch (err) {
        result.errors.push(`salon ${ch.name} : ${err.message}`);
      }
    }
  }

  return result;
}
