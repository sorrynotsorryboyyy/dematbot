// /panneaux : publie (ou met a jour) tous les messages permanents du serveur.
//
// Idempotent : avant de publier, on cherche dans les derniers messages du salon
// un message du bot portant le meme titre d'embed. S'il existe, on l'edite au
// lieu d'en empiler un nouveau — la commande est donc relancable a volonte.

import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { resolveChannel } from '../../lib/guild.js';
import * as rules from '../../components/rules.js';
import * as rolePanel from '../../components/rolePanel.js';
import * as tickets from '../../components/tickets.js';
import * as embeds from '../../lib/embeds.js';
import { games } from '../../db/index.js';
import { COLORS } from '../../config/brand.js';

export const data = new SlashCommandBuilder()
  .setName('panneaux')
  .setDescription('Publier ou mettre à jour tous les messages permanents du serveur')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

// Chaque entree decrit un message permanent : ou le publier et quoi publier.
// `payload` rend un objet { embeds, components } directement envoyable.
const PANELS = [
  { channel: 'reglement', label: 'Règlement', payload: () => rules.buildMessage(), pin: true },
  { channel: 'choisir-roles', label: 'Choix des rôles', special: 'roles' },
  { channel: 'support', label: 'Support', payload: () => tickets.buildSupportPanel(), pin: true },
  { channel: 'editer-mon-jeu', label: 'Espace développeurs', payload: () => tickets.buildDevPanel(), pin: true },
  { channel: 'faq-devs', label: 'FAQ développeurs', payload: () => ({ embeds: [embeds.devFaq()] }) },

  // En-tetes des salons vitrine et staff. Aucun salon de discussion ici :
  // #général, #hors-sujet, #jeux-vidéo, #actus-gaming, #clips, #lfg,
  // #créations et #entraide-dev restent volontairement vierges.
  { channel: 'sorties', label: 'En-tête sorties', payload: () => ({ embeds: [embeds.sortiesHeader()] }) },
  { channel: 'coulisses', label: 'En-tête coulisses', payload: () => ({ embeds: [embeds.coulissesHeader()] }) },
  { channel: 'vitrine-devs', label: 'En-tête vitrine devs', payload: () => ({ embeds: [embeds.vitrineDevsHeader()] }) },
  { channel: 'retours', label: 'En-tête retours', payload: () => ({ embeds: [embeds.retoursHeader()] }) },
  { channel: 'projets-en-cours', label: 'En-tête projets en cours', payload: () => ({ embeds: [embeds.projetsEnCoursHeader()] }) },
  { channel: 'moderator-only', label: 'En-tête modération', payload: () => ({ embeds: [embeds.moderatorHeader()] }) },
  { channel: 'logs-bot', label: 'En-tête logs', payload: () => ({ embeds: [embeds.logsHeader()] }) },

  { channel: 'forum-jeux', label: 'Consignes du forum', special: 'forum' },
  { channel: 'catalogue', label: 'Catalogue', payload: () => ({ embeds: [embeds.emptyCatalogue()] }), onlyIfEmptyCatalogue: true },
];

export async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = interaction.guild;
  const created = [];
  const updated = [];
  const skipped = [];
  const missing = [];

  for (const panel of PANELS) {
    if (panel.onlyIfEmptyCatalogue && games.count() > 0) {
      skipped.push(`${panel.label} — le catalogue contient déjà des jeux`);
      continue;
    }

    const channel = await resolveChannel(guild, panel.channel);
    if (!channel) {
      missing.push(panel.label);
      continue;
    }

    try {
      const outcome = await publishPanel(guild, channel, panel);
      (outcome === 'updated' ? updated : created).push(`${panel.label} → ${channel}`);
    } catch (err) {
      skipped.push(`${panel.label} — ${err.message}`);
    }
  }

  await interaction.editReply({
    embeds: [
      embeds.log({
        title: '📋 Panneaux du serveur',
        color: missing.length || skipped.length ? COLORS.primary : COLORS.success,
        description: [
          created.length ? `**Publiés**\n${created.map((d) => `✅ ${d}`).join('\n')}` : '',
          updated.length ? `**Mis à jour**\n${updated.map((d) => `♻️ ${d}`).join('\n')}` : '',
          skipped.length ? `**Ignorés**\n${skipped.map((d) => `⏭️ ${d}`).join('\n')}` : '',
          missing.length ? `**Salons introuvables**\n${missing.map((d) => `⚠️ ${d}`).join('\n')}\nLance \`/setup\` pour les créer.` : '',
        ].filter(Boolean).join('\n\n').slice(0, 4000),
      }),
    ],
  });
}

// Publie un panneau, ou met a jour celui deja present. Rend 'created' ou 'updated'.
async function publishPanel(guild, channel, panel) {
  if (panel.special === 'roles') return publishRolePanel(guild, channel);
  if (panel.special === 'forum') return publishForumGuidelines(channel);

  const payload = panel.payload();
  const title = payload.embeds[0].data.title;

  const existing = await findBotMessage(channel, title);
  if (existing) {
    await existing.edit(payload);
    return 'updated';
  }

  const message = await channel.send(payload);
  if (panel.pin) await message.pin().catch(() => {});
  return 'created';
}

// Le panneau de roles a sa propre logique de persistance (ids en base) :
// on remplace l'ancien message plutot que de l'editer.
async function publishRolePanel(guild, channel) {
  const { embed } = await rolePanel.build(guild);
  const existing = await findBotMessage(channel, embed.data.title);

  if (existing) await existing.delete().catch(() => {});
  await rolePanel.publish(guild, channel);
  return existing ? 'updated' : 'created';
}

// Dans un forum, les consignes vont dans un post epingle plutot qu'un message.
async function publishForumGuidelines(forum) {
  if (forum.type !== 15) throw new Error('ce salon n est pas un forum');

  const embed = embeds.forumGuidelines();
  const threads = await forum.threads.fetchActive().catch(() => null);
  const existing = threads?.threads.find((t) => t.name === 'À lire avant de poster');

  if (existing) {
    const starter = await existing.fetchStarterMessage().catch(() => null);
    if (starter) {
      await starter.edit({ embeds: [embed] });
      return 'updated';
    }
  }

  const thread = await forum.threads.create({
    name: 'À lire avant de poster',
    message: { embeds: [embed] },
    reason: 'Consignes du forum',
  });
  await thread.pin().catch(() => {});
  await thread.setLocked(true).catch(() => {});
  return 'created';
}

// Retrouve un message deja publie par le bot, identifie par le titre de son embed.
async function findBotMessage(channel, title) {
  if (!title) return null;
  const recent = await channel.messages.fetch({ limit: 30 }).catch(() => null);
  if (!recent) return null;
  return recent.find((m) => m.author.id === channel.client.user.id && m.embeds[0]?.title === title) || null;
}
