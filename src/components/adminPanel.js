// Hub admin persistant : un message a boutons dans #panel-admin.
// Chaque bouton ouvre un formulaire, montre un apercu, puis publie.
//
// Flux : panel:<action> (bouton) -> modal panel:submit:<action>
//        -> apercu ephemere -> panel:publish:<action> / panel:cancel

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { games, roleId } from '../db/index.js';
import { resolveChannel, resolveRoles } from '../lib/guild.js';
import * as embeds from '../lib/embeds.js';
import * as logger from '../lib/logger.js';
import { COLORS, EMOJI } from '../config/brand.js';
import { block, bullets, stack } from '../lib/layout.js';
import * as rolePanel from './rolePanel.js';
import * as rules from './rules.js';
import * as tickets from './tickets.js';

// Brouillons en attente de publication, par utilisateur.
// Volontairement en memoire : un brouillon perdu au redemarrage se refait en 30 s.
const drafts = new Map();

// --- le message du hub -------------------------------------------------------

export function buildPanel() {
  const embed = embeds.log({
    title: '🎛️  Panneau DematGames',
    color: COLORS.primary,
    description: stack(
      'Gère le serveur sans retenir la moindre commande.\nChaque bouton ouvre un formulaire, affiche un aperçu, puis publie.',
      block('📤', 'Publier', bullets([
        [`${EMOJI.announce} Annonce`, 'une annonce dans le salon de ton choix'],
        [`${EMOJI.release} Sortie`, 'la sortie d une édition physique'],
        [`${EMOJI.preorder} Précommande`, 'ouvrir les précommandes d un jeu'],
        [`${EMOJI.game} Fiche jeu`, 'publier ou mettre à jour la fiche d une édition'],
      ])),
      block('⚙️', 'Configurer', bullets([
        [`${EMOJI.roles} Panneaux`, 'republier règlement, rôles, services, support…'],
        [`${EMOJI.dev} Partenaire`, 'promouvoir un membre en développeur partenaire'],
      ])),
    ),
  });

  const rows = [
    new ActionRowBuilder().addComponents(
      button('panel:announce', 'Annonce', ButtonStyle.Primary, EMOJI.announce),
      button('panel:release', 'Sortie', ButtonStyle.Success, EMOJI.release),
      button('panel:preorder', 'Précommande', ButtonStyle.Success, EMOJI.preorder),
    ),
    new ActionRowBuilder().addComponents(
      button('panel:game', 'Fiche jeu', ButtonStyle.Secondary, EMOJI.game),
      button('panel:panels', 'Panneaux', ButtonStyle.Secondary, EMOJI.roles),
      button('panel:partner', 'Partenaire', ButtonStyle.Secondary, EMOJI.dev),
    ),
  ];

  return { embeds: [embed], components: rows };
}

const button = (id, label, style, emoji) =>
  new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style).setEmoji(emoji);

// --- definition des formulaires ---------------------------------------------

const FORMS = {
  announce: {
    title: 'Nouvelle annonce',
    fields: [
      { id: 'title', label: 'Titre', style: 'short', required: true, max: 200 },
      { id: 'body', label: 'Contenu', style: 'paragraph', required: true, max: 3000 },
      { id: 'image', label: 'URL d une image (optionnel)', style: 'short', required: false },
      { id: 'ping', label: 'Mentionner le rôle Annonces ? (oui/non)', style: 'short', required: false, placeholder: 'non' },
    ],
    channelKey: 'annonces',
    pingRole: 'notif_annonces',
  },
  release: {
    title: 'Annonce de sortie',
    fields: [
      { id: 'game', label: 'Nom du jeu', style: 'short', required: true },
      { id: 'body', label: 'Description', style: 'paragraph', required: false, max: 2000 },
      { id: 'meta', label: 'Date | Prix | Édition', style: 'short', required: false, placeholder: '12/12/2026 | 16,99 € | Standard' },
      { id: 'url', label: 'Lien boutique', style: 'short', required: false },
      { id: 'image', label: 'URL d une image', style: 'short', required: false },
    ],
    channelKey: 'sorties',
    pingRole: 'notif_sorties',
  },
  preorder: {
    title: 'Ouverture des précommandes',
    fields: [
      { id: 'game', label: 'Nom du jeu', style: 'short', required: true },
      { id: 'body', label: 'Description', style: 'paragraph', required: false, max: 2000 },
      { id: 'meta', label: 'Prix | Édition | Exemplaires', style: 'short', required: false, placeholder: '16,99 € | Collector | 250' },
      { id: 'deadline', label: 'Date limite', style: 'short', required: false, placeholder: '31/12/2026' },
      { id: 'url', label: 'Lien de précommande', style: 'short', required: false },
    ],
    channelKey: 'sorties',
    pingRole: 'notif_sorties',
  },
  game: {
    title: 'Fiche jeu',
    fields: [
      { id: 'name', label: 'Nom du jeu', style: 'short', required: true },
      { id: 'description', label: 'Description', style: 'paragraph', required: true, max: 2000 },
      { id: 'meta', label: 'Genre | Âge | Prix', style: 'short', required: false, placeholder: 'Narratif | 12+ | 16,99 €' },
      { id: 'url', label: 'Lien boutique', style: 'short', required: false },
      { id: 'image', label: 'URL de la jaquette', style: 'short', required: false },
    ],
    channelKey: 'sorties',
  },
};

function buildModal(action) {
  const form = FORMS[action];
  const modal = new ModalBuilder().setCustomId(`panel:submit:${action}`).setTitle(form.title);

  for (const f of form.fields) {
    const input = new TextInputBuilder()
      .setCustomId(f.id)
      .setLabel(f.label)
      .setStyle(f.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(f.required ?? false);
    if (f.max) input.setMaxLength(f.max);
    if (f.placeholder) input.setPlaceholder(f.placeholder);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }
  return modal;
}

// "a | b | c" -> ['a','b','c'], entrees vides ignorees.
const splitMeta = (raw) => (raw || '').split('|').map((s) => s.trim());

// --- routage -----------------------------------------------------------------

export async function handle(interaction, action, args, client) {
  switch (action) {
    case 'announce':
    case 'release':
    case 'preorder':
    case 'game':
      await interaction.showModal(buildModal(action));
      return;

    case 'submit':
      await onSubmit(interaction, args[0]);
      return;

    case 'publish':
      await onPublish(interaction, args[0]);
      return;

    case 'cancel':
      drafts.delete(interaction.user.id);
      await interaction.update({ embeds: [embeds.info('Annulé.')], components: [] });
      return;

    case 'panels':
      await onPanels(interaction);
      return;

    case 'republish':
      await onRepublish(interaction, args[0], client);
      return;

    case 'partner':
      await onPartnerPrompt(interaction);
      return;

    case 'partnerpick':
      await onPartnerPick(interaction);
      return;
  }
}

// --- apercu ------------------------------------------------------------------

async function onSubmit(interaction, action) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const get = (id) => {
    try {
      return interaction.fields.getTextInputValue(id)?.trim() || null;
    } catch {
      return null;
    }
  };

  let embed;
  let payload;

  if (action === 'announce') {
    payload = { title: get('title'), body: get('body'), image: get('image'), ping: /^o/i.test(get('ping') || '') };
    embed = embeds.announcement(payload);
  } else if (action === 'release') {
    const [date, price, edition] = splitMeta(get('meta'));
    payload = { game: get('game'), body: get('body'), date, price, edition, url: get('url'), image: get('image'), ping: true };
    embed = embeds.release(payload);
  } else if (action === 'preorder') {
    const [price, edition, copies] = splitMeta(get('meta'));
    payload = { game: get('game'), body: get('body'), price, edition, copies, deadline: get('deadline'), url: get('url'), ping: true };
    embed = embeds.preorder(payload);
  } else if (action === 'game') {
    const [genre, age, price] = splitMeta(get('meta'));
    payload = {
      name: get('name'), description: get('description'), genre, age, price,
      url: get('url'), image: get('image'),
    };
    embed = embeds.gameCard(payload);
  }

  drafts.set(interaction.user.id, { action, payload });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`panel:publish:${action}`).setLabel('Publier').setStyle(ButtonStyle.Success).setEmoji('📤'),
    new ButtonBuilder().setCustomId('panel:cancel').setLabel('Annuler').setStyle(ButtonStyle.Secondary),
  );

  await interaction.editReply({
    content: '**Aperçu** — voici ce qui sera publié :',
    embeds: [embed],
    components: [row],
  });
}

// --- publication -------------------------------------------------------------

async function onPublish(interaction, action) {
  const draft = drafts.get(interaction.user.id);
  if (!draft || draft.action !== action) {
    await interaction.update({
      embeds: [embeds.error('Brouillon introuvable (le bot a peut-être redémarré). Recommence depuis le panneau.')],
      components: [],
    });
    return;
  }

  await interaction.deferUpdate();
  const guild = interaction.guild;
  const form = FORMS[action];
  const channel = await resolveChannel(guild, form.channelKey);

  if (!channel) {
    await interaction.editReply({
      embeds: [embeds.error(`Salon **${form.channelKey}** introuvable. Lance \`/setup\` d abord.`)],
      components: [],
    });
    return;
  }

  const { payload } = draft;
  let content = null;

  if (form.pingRole && payload.ping) {
    const id = roleId(form.pingRole);
    if (id) content = `<@&${id}>`;
  }

  let embed;
  let sent;

  if (action === 'game') {
    // Une fiche jeu est persistee : republication en place si elle existe deja.
    const saved = games.upsert(payload);
    embed = embeds.gameCard(saved);

    if (saved.message_id) {
      const old = await channel.messages.fetch(saved.message_id).catch(() => null);
      if (old) {
        await old.edit({ embeds: [embed] });
        sent = old;
      }
    }
    if (!sent) {
      sent = await channel.send({ embeds: [embed] });
      games.setMessage(saved.name, sent.id);
    }


  } else {
    embed = action === 'announce' ? embeds.announcement(payload)
      : action === 'release' ? embeds.release(payload)
      : embeds.preorder(payload);
    sent = await channel.send({ content, embeds: [embed] });
  }

  drafts.delete(interaction.user.id);

  await interaction.editReply({
    embeds: [embeds.success(`Publié dans ${channel}. [Voir le message](${sent.url})`)],
    components: [],
  });

  await logger.toChannel(guild, {
    title: `${EMOJI.announce} Publication`,
    description: `**${FORMS[action].title}** dans ${channel} par ${interaction.user}`,
    color: COLORS.success,
  });
}

// --- republication des panneaux ---------------------------------------------

const PANELS = {
  rules: { label: 'Règlement', channel: 'reglement' },
  roles: { label: 'Choix des rôles', channel: 'choisir-roles' },
  support: { label: 'Support', channel: 'ouvrir-un-ticket' },
  devs: { label: 'Espace développeurs', channel: 'editer-mon-jeu' },
  faq: { label: 'Questions fréquentes', channel: 'faq' },
  services: { label: 'Nos services', channel: 'nos-services' },
};

async function onPanels(interaction) {
  const row1 = new ActionRowBuilder().addComponents(
    ...Object.entries(PANELS).slice(0, 3).map(([key, p]) =>
      new ButtonBuilder().setCustomId(`panel:republish:${key}`).setLabel(p.label).setStyle(ButtonStyle.Secondary),
    ),
  );
  const row2 = new ActionRowBuilder().addComponents(
    ...Object.entries(PANELS).slice(3).map(([key, p]) =>
      new ButtonBuilder().setCustomId(`panel:republish:${key}`).setLabel(p.label).setStyle(ButtonStyle.Secondary),
    ),
  );

  await interaction.reply({
    embeds: [
      embeds.info(
        'Quel panneau veux-tu (re)publier ?\nLe message est envoyé dans son salon dédié. Supprime l ancien si besoin.',
      ),
    ],
    components: [row1, row2],
    flags: MessageFlags.Ephemeral,
  });
}

async function onRepublish(interaction, key) {
  await interaction.deferUpdate();
  const guild = interaction.guild;
  const def = PANELS[key];
  const channel = await resolveChannel(guild, def.channel);

  if (!channel) {
    await interaction.editReply({
      embeds: [embeds.error(`Salon **${def.channel}** introuvable. Lance \`/setup\` d abord.`)],
      components: [],
    });
    return;
  }

  let message;
  if (key === 'rules') message = await channel.send(rules.buildMessage());
  else if (key === 'roles') message = await rolePanel.publish(guild, channel);
  else if (key === 'support') message = await channel.send(tickets.buildSupportPanel());
  else if (key === 'devs') message = await channel.send(tickets.buildDevPanel());
  else if (key === 'faq') message = await channel.send({ embeds: [embeds.devFaq()] });
  else if (key === 'services') message = await channel.send({ embeds: [embeds.servicesHeader()] });

  await interaction.editReply({
    embeds: [embeds.success(`**${def.label}** publié dans ${channel}. [Voir](${message.url})`)],
    components: [],
  });
}

// --- promotion en developpeur partenaire ------------------------------------

async function onPartnerPrompt(interaction) {
  const { UserSelectMenuBuilder } = await import('discord.js');
  await interaction.reply({
    embeds: [
      embeds.info(
        'Choisis le membre à promouvoir **développeur partenaire**.\nIl obtiendra l accès à **#projets-en-cours** pour le suivi de production.',
      ),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder().setCustomId('panel:partnerpick').setPlaceholder('Sélectionne un membre').setMaxValues(1),
      ),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

async function onPartnerPick(interaction) {
  await interaction.deferUpdate();
  const roles = await resolveRoles(interaction.guild);

  if (!roles.devPartner) {
    await interaction.editReply({
      embeds: [embeds.error('Le rôle développeur partenaire n existe pas. Lance `/setup`.')],
      components: [],
    });
    return;
  }

  const userId = interaction.values[0];
  const member = await interaction.guild.members.fetch(userId).catch(() => null);

  if (!member) {
    await interaction.editReply({ embeds: [embeds.error('Membre introuvable.')], components: [] });
    return;
  }

  await member.roles.add(roles.devPartner, `Promu par ${interaction.user.tag}`);
  await interaction.editReply({
    embeds: [embeds.success(`${member} est désormais **développeur partenaire**.`)],
    components: [],
  });

  await logger.toChannel(interaction.guild, {
    title: `${EMOJI.dev} Nouveau développeur partenaire`,
    description: `${member} promu par ${interaction.user}`,
    color: COLORS.success,
  });
}
