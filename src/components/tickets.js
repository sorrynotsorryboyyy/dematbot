// Tickets : support client, question dev, et soumission de jeu.
// Le parcours de soumission reprend les 5 etapes du formulaire du site.
//
// Les modals Discord n'acceptent que des champs texte (5 max), les choix fermes
// passent donc par des select menus successifs avant le modal final.

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { submissions, tickets as ticketsDb } from '../db/index.js';
import { isStaff, resolveCategory, resolveChannel, resolveRoles } from '../lib/guild.js';
import { ticketOverwrites } from '../lib/permissions.js';
import * as embeds from '../lib/embeds.js';
import * as logger from '../lib/logger.js';
import { COLORS, EMOJI, SELLING_POINTS } from '../config/brand.js';

// Reponses en cours de saisie du parcours dev, par utilisateur.
const wizard = new Map();

// --- panneaux publics --------------------------------------------------------

export function buildSupportPanel() {
  return {
    embeds: [
      embeds.log({
        title: `${EMOJI.ticket} Besoin d aide ?`,
        color: COLORS.info,
        description: [
          'Une question sur une commande, un colis en route, un souci avec une édition ?',
          'Ouvre un ticket : un salon privé est créé entre toi et l équipe DematGames.',
        ].join('\n'),
      }),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket:open:support')
          .setLabel('Ouvrir un ticket')
          .setStyle(ButtonStyle.Primary)
          .setEmoji(EMOJI.ticket),
      ),
    ],
  };
}

export function buildDevPanel() {
  return {
    embeds: [embeds.devPitch()],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket:submit:start')
          .setLabel('Soumettre mon jeu')
          .setStyle(ButtonStyle.Success)
          .setEmoji(EMOJI.submit),
        new ButtonBuilder()
          .setCustomId('ticket:open:question')
          .setLabel('Poser une question')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(EMOJI.question),
      ),
    ],
  };
}

// --- etapes du parcours dev --------------------------------------------------

const STEPS = [
  {
    key: 'stage',
    label: 'Où en est ton jeu ?',
    options: [
      ['En développement', 'dev'],
      ['Accès anticipé', 'early'],
      ['Sortie imminente', 'soon'],
      ['Déjà sorti', 'released'],
    ],
  },
  {
    key: 'copies',
    label: 'Combien d exemplaires envisages-tu ?',
    options: [
      ['50 à 100', '50-100'],
      ['100 à 250', '100-250'],
      ['250 à 500', '250-500'],
      ['Plus de 500', '500+'],
    ],
  },
  {
    key: 'edition',
    label: 'Quel type d édition ?',
    options: [
      ['Standard', 'standard'],
      ['Deluxe', 'deluxe'],
      ['Collector', 'collector'],
      ['À définir ensemble', 'tbd'],
    ],
  },
  {
    key: 'teamSize',
    label: 'Quelle est la taille de ton équipe ?',
    options: [
      ['Solo', 'solo'],
      ['2 à 5', '2-5'],
      ['6 à 15', '6-15'],
      ['Plus de 15', '15+'],
    ],
  },
];

const labelOf = (stepKey, value) => {
  const step = STEPS.find((s) => s.key === stepKey);
  return step?.options.find(([, v]) => v === value)?.[0] || value;
};

// ephemeral n'est valide qu'a la premiere reponse : un update() herite deja
// du caractere ephemere du message qu'il remplace.
function stepMessage(index, { ephemeral = false } = {}) {
  const step = STEPS[index];
  const payload = {
    embeds: [
      embeds.log({
        title: `${EMOJI.submit} Soumettre mon jeu — étape ${index + 1}/${STEPS.length + 1}`,
        color: COLORS.primary,
        description: step.label,
      }),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`ticket:step:${index}`)
          .setPlaceholder('Choisis une réponse')
          .addOptions(step.options.map(([label, value]) => ({ label, value }))),
      ),
    ],
  };
  if (ephemeral) payload.flags = MessageFlags.Ephemeral;
  return payload;
}

function finalModal() {
  return new ModalBuilder()
    .setCustomId('ticket:submitform')
    .setTitle('Ton jeu — dernière étape')
    .addComponents(
      row(new TextInputBuilder().setCustomId('gameName').setLabel('Nom du jeu').setStyle(TextInputStyle.Short).setRequired(true)),
      row(
        new TextInputBuilder()
          .setCustomId('notes')
          .setLabel('Décris ton jeu en quelques lignes')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1500),
      ),
      row(
        new TextInputBuilder()
          .setCustomId('url')
          .setLabel('Lien (site, Steam, itch.io…)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false),
      ),
      row(
        new TextInputBuilder()
          .setCustomId('contact')
          .setLabel('Contact (e-mail, studio)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false),
      ),
    );
}

const row = (c) => new ActionRowBuilder().addComponents(c);

// --- routage -----------------------------------------------------------------

export async function handle(interaction, action, args) {
  switch (action) {
    case 'open':
      return openSimpleTicket(interaction, args[0]);
    case 'submit':
      wizard.set(interaction.user.id, {});
      return interaction.reply(stepMessage(0, { ephemeral: true }));
    case 'step':
      return onStep(interaction, Number(args[0]));
    case 'submitform':
      return onSubmitForm(interaction);
    case 'close':
      return onClose(interaction);
    case 'claim':
      return onClaim(interaction);
    case 'accept':
      return onAccept(interaction);
    case 'hold':
      return onHold(interaction);
  }
}

async function onStep(interaction, index) {
  const state = wizard.get(interaction.user.id) || {};
  state[STEPS[index].key] = interaction.values[0];
  wizard.set(interaction.user.id, state);

  const next = index + 1;
  if (next < STEPS.length) {
    await interaction.update(stepMessage(next));
    return;
  }

  // Toutes les etapes a choix sont faites : on passe au formulaire texte.
  // showModal() ne consomme pas le message d'etape, on le neutralise apres coup
  // pour que l'utilisateur ne puisse pas rejouer la derniere etape.
  await interaction.showModal(finalModal());
  await interaction
    .editReply({
      embeds: [embeds.info(`${EMOJI.submit} Dernière étape ouverte — remplis le formulaire.`)],
      components: [],
    })
    .catch(() => {});
}

// --- creation des tickets ----------------------------------------------------

async function openSimpleTicket(interaction, type) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const existing = ticketsDb.openForUser(interaction.user.id, type);
  if (existing.length) {
    await interaction.editReply({
      embeds: [embeds.info(`Tu as déjà un ticket ouvert : <#${existing[0].channel_id}>`)],
    });
    return;
  }

  const ticketId = ticketsDb.create({ userId: interaction.user.id, type });
  const channel = await createTicketChannel(interaction, ticketId, type, interaction.user.username);

  if (!channel) {
    await interaction.editReply({
      embeds: [embeds.error('Impossible de créer le salon. La catégorie TICKETS existe-t-elle ? Lance `/setup`.')],
    });
    return;
  }

  await channel.send({
    content: `${interaction.user}`,
    embeds: [embeds.ticketOpened({ type, user: interaction.user })],
    components: [staffButtons(ticketId, false)],
  });

  await interaction.editReply({ embeds: [embeds.success(`Ton ticket est ouvert : ${channel}`)] });
  await logTicket(interaction.guild, type, interaction.user, channel);
}

async function onSubmitForm(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const state = wizard.get(interaction.user.id) || {};
  const get = (id) => {
    try {
      return interaction.fields.getTextInputValue(id)?.trim() || null;
    } catch {
      return null;
    }
  };

  const data = {
    userId: interaction.user.id,
    gameName: get('gameName'),
    notes: get('notes'),
    url: get('url'),
    contact: get('contact'),
    stage: labelOf('stage', state.stage),
    copies: labelOf('copies', state.copies),
    edition: labelOf('edition', state.edition),
    teamSize: labelOf('teamSize', state.teamSize),
  };

  const ticketId = ticketsDb.create({ userId: interaction.user.id, type: 'submission', subject: data.gameName });
  data.ticketId = ticketId;
  submissions.create(data);
  wizard.delete(interaction.user.id);

  const slug = (data.gameName || interaction.user.username)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 20);

  const channel = await createTicketChannel(interaction, ticketId, 'submission', slug);

  if (!channel) {
    await interaction.editReply({
      embeds: [embeds.error('Impossible de créer le salon. La catégorie TICKETS existe-t-elle ? Lance `/setup`.')],
    });
    return;
  }

  const recap = embeds.ticketOpened({
    type: 'submission',
    user: interaction.user,
    fields: [
      { name: 'Jeu', value: data.gameName || '—', inline: false },
      { name: 'État', value: data.stage || '—', inline: true },
      { name: 'Exemplaires', value: data.copies || '—', inline: true },
      { name: 'Édition', value: data.edition || '—', inline: true },
      { name: 'Équipe', value: data.teamSize || '—', inline: true },
      { name: 'Lien', value: data.url || '—', inline: true },
      { name: 'Contact', value: data.contact || '—', inline: true },
      { name: 'Description', value: (data.notes || '—').slice(0, 1000) },
    ],
  });

  const roles = await resolveRoles(interaction.guild);
  const staffPing = roles.staff ? `<@&${roles.staff.id}>` : '';

  const msg = await channel.send({
    content: `${interaction.user} ${staffPing}`.trim(),
    embeds: [recap],
    components: [staffButtons(ticketId, true)],
  });
  await msg.pin().catch(() => {});

  await interaction.editReply({
    embeds: [
      embeds.success(
        `Ta soumission est enregistrée : ${channel}\nL équipe DematGames revient vers toi sous quelques jours.`,
      ),
    ],
  });

  await logTicket(interaction.guild, 'submission', interaction.user, channel, data.gameName);
}

async function createTicketChannel(interaction, ticketId, type, slug) {
  const guild = interaction.guild;
  const category = await resolveCategory(guild, 'tickets');
  const roles = await resolveRoles(guild);

  const prefix = type === 'submission' ? 'dev' : 'ticket';
  const name = `${prefix}-${String(ticketId).padStart(4, '0')}-${slug}`.slice(0, 100);

  const channel = await guild.channels
    .create({
      name,
      type: ChannelType.GuildText,
      parent: category?.id ?? null,
      permissionOverwrites: ticketOverwrites(roles, interaction.user.id),
      topic: `Ticket #${ticketId} — ${type} — ouvert par ${interaction.user.tag}`,
      reason: `Ticket ${type} ouvert par ${interaction.user.tag}`,
    })
    .catch(() => null);

  if (channel) ticketsDb.attachChannel(ticketId, channel.id);
  return channel;
}

function staffButtons(ticketId, isSubmission) {
  const buttons = [
    new ButtonBuilder().setCustomId(`ticket:claim:${ticketId}`).setLabel('Prendre en charge').setStyle(ButtonStyle.Primary).setEmoji(EMOJI.claim),
  ];
  if (isSubmission) {
    buttons.push(
      new ButtonBuilder().setCustomId(`ticket:accept:${ticketId}`).setLabel('Accepter le projet').setStyle(ButtonStyle.Success).setEmoji(EMOJI.accept),
      new ButtonBuilder().setCustomId(`ticket:hold:${ticketId}`).setLabel('Mettre en attente').setStyle(ButtonStyle.Secondary).setEmoji(EMOJI.hold),
    );
  }
  buttons.push(
    new ButtonBuilder().setCustomId(`ticket:close:${ticketId}`).setLabel('Fermer').setStyle(ButtonStyle.Danger).setEmoji(EMOJI.lock),
  );
  return new ActionRowBuilder().addComponents(buttons);
}

// --- actions staff -----------------------------------------------------------

async function requireStaff(interaction) {
  const roles = await resolveRoles(interaction.guild);
  if (isStaff(interaction.member, roles)) return roles;
  await interaction.reply({
    embeds: [embeds.error('Cette action est réservée au staff.')],
    flags: MessageFlags.Ephemeral,
  });
  return null;
}

async function onClaim(interaction) {
  if (!(await requireStaff(interaction))) return;
  const ticket = ticketsDb.byChannel(interaction.channelId);
  if (!ticket) return;

  ticketsDb.setStatus(ticket.id, 'claimed', interaction.user.id);
  await interaction.reply({
    embeds: [embeds.info(`${interaction.user} prend ce ticket en charge.`)],
  });
}

async function onAccept(interaction) {
  const roles = await requireStaff(interaction);
  if (!roles) return;

  await interaction.deferReply();
  const ticket = ticketsDb.byChannel(interaction.channelId);
  if (!ticket) return;

  const member = await interaction.guild.members.fetch(ticket.user_id).catch(() => null);

  if (member && roles.devPartner) {
    await member.roles.add(roles.devPartner, 'Projet accepté par DematGames').catch(() => {});
  }

  ticketsDb.setStatus(ticket.id, 'accepted', interaction.user.id);

  const projets = await resolveChannel(interaction.guild, 'projets-en-cours');

  await interaction.editReply({
    embeds: [
      embeds.log({
        title: `${EMOJI.accept} Projet accepté`,
        color: COLORS.success,
        description: [
          `${member || 'Le développeur'} rejoint les **développeurs partenaires**.`,
          projets ? `Le suivi de production se poursuit dans ${projets}.` : null,
        ].filter(Boolean).join('\n'),
      }),
    ],
  });

  await logger.toChannel(interaction.guild, {
    title: `${EMOJI.accept} Soumission acceptée`,
    description: `**${ticket.subject || 'Projet'}** — accepté par ${interaction.user}`,
    color: COLORS.success,
  });
}

async function onHold(interaction) {
  if (!(await requireStaff(interaction))) return;
  const ticket = ticketsDb.byChannel(interaction.channelId);
  if (!ticket) return;

  ticketsDb.setStatus(ticket.id, 'hold', interaction.user.id);
  await interaction.reply({
    embeds: [embeds.info(`${EMOJI.hold} Projet mis en attente par ${interaction.user}. On y revient plus tard.`)],
  });
}

async function onClose(interaction) {
  const ticket = ticketsDb.byChannel(interaction.channelId);
  if (!ticket) return;

  const roles = await resolveRoles(interaction.guild);
  // L'auteur du ticket peut fermer le sien, le staff peut fermer n'importe lequel.
  if (!isStaff(interaction.member, roles) && interaction.user.id !== ticket.user_id) {
    await interaction.reply({
      embeds: [embeds.error('Seuls le staff et l auteur du ticket peuvent le fermer.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.reply({ embeds: [embeds.info('🔒 Fermeture du ticket, transcript en cours…')] });

  const transcript = await buildTranscript(interaction.channel);
  ticketsDb.close(ticket.id);

  await logger.toChannel(interaction.guild, {
    title: `${EMOJI.lock} Ticket #${ticket.id} fermé`,
    description: `Type : **${ticket.type}** • Fermé par ${interaction.user}`,
    color: COLORS.neutral,
    fields: [{ name: 'Transcript', value: transcript.slice(0, 1000) || 'Aucun message.' }],
  });

  setTimeout(() => interaction.channel.delete('Ticket fermé').catch(() => {}), 5000);
}

async function buildTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  if (!messages) return '';
  return [...messages.values()]
    .reverse()
    .filter((m) => m.content)
    .map((m) => `${m.author.tag} : ${m.content}`)
    .join('\n');
}

function logTicket(guild, type, user, channel, subject) {
  return logger.toChannel(guild, {
    title: `${EMOJI.ticket} Nouveau ticket`,
    description: `Type : **${type}**${subject ? ` • ${subject}` : ''}\nPar ${user} dans ${channel}`,
    color: COLORS.info,
  });
}
