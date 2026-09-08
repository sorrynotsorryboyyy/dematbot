// Fabriques d'embeds a la charte DematGames.
// Tout ce que le bot publie passe par ici : un seul endroit pour changer le style.

import { EmbedBuilder } from 'discord.js';
import { COLORS, FOOTER, SITE_URL, SELLING_POINTS, EMOJI } from '../config/brand.js';
import { block, bullets, divider, section, stack, steps } from './layout.js';

function base(color = COLORS.primary) {
  return new EmbedBuilder().setColor(color).setFooter(FOOTER).setTimestamp();
}

// En-tete de salon : embed permanent expliquant a quoi sert l'endroit.
// Reserve aux salons vitrine et staff — jamais dans un salon de discussion.
function header({ emoji, title, intro, blocks = [], color = COLORS.info }) {
  return base(color)
    .setTitle(`${emoji}  ${title}`)
    .setDescription(stack(intro, ...blocks));
}

export function announcement({ title, body, image }) {
  const e = base(COLORS.primary).setTitle(`${EMOJI.announce} ${title}`).setDescription(body);
  if (image) e.setImage(image);
  return e;
}

export function release({ game, date, price, edition, url, image, body }) {
  const e = base(COLORS.success)
    .setTitle(`${EMOJI.release} ${game}`)
    .setDescription(body || 'Une nouvelle édition physique arrive chez DematGames.');
  const fields = [];
  if (date) fields.push({ name: 'Date', value: date, inline: true });
  if (price) fields.push({ name: 'Prix', value: price, inline: true });
  if (edition) fields.push({ name: 'Édition', value: edition, inline: true });
  if (fields.length) e.addFields(fields);
  if (url) e.setURL(url);
  if (image) e.setImage(image);
  return e;
}

export function preorder({ game, deadline, copies, price, edition, url, image, body }) {
  const e = base(COLORS.primary)
    .setTitle(`${EMOJI.preorder} Précommande — ${game}`)
    .setDescription(body || 'Les précommandes sont ouvertes. Fabrication à la demande en Europe.');
  const fields = [];
  if (price) fields.push({ name: 'Prix', value: price, inline: true });
  if (edition) fields.push({ name: 'Édition', value: edition, inline: true });
  if (copies) fields.push({ name: 'Exemplaires', value: copies, inline: true });
  if (deadline) fields.push({ name: 'Jusqu au', value: deadline, inline: false });
  if (fields.length) e.addFields(fields);
  if (url) e.setURL(url);
  if (image) e.setImage(image);
  return e;
}

export function gameCard(game) {
  const e = base(COLORS.info).setTitle(`${EMOJI.game} ${game.name}`);
  if (game.description) e.setDescription(game.description);
  const fields = [];
  if (game.genre) fields.push({ name: 'Genre', value: game.genre, inline: true });
  if (game.age) fields.push({ name: 'Âge', value: game.age, inline: true });
  if (game.price) fields.push({ name: 'Prix', value: game.price, inline: true });
  if (fields.length) e.addFields(fields);
  if (game.url) e.setURL(game.url);
  if (game.image) e.setImage(game.image);
  return e;
}

// Embed permanent de #éditer-mon-jeu : la porte d'entree des developpeurs.
export function devPitch() {
  return base(COLORS.primary)
    .setTitle(`${EMOJI.dev}  Passe ton jeu en édition physique`)
    .setDescription(
      stack(
        'Tu développes un jeu et tu aimerais qu il existe autrement qu en téléchargement ?\nDematGames fabrique des éditions physiques de jeux indés, de A à Z.',
        block('✨', 'Ce qu on t apporte', bullets(SELLING_POINTS)),
        block('👇', 'Comment démarrer', bullets([
          ['Soumettre mon jeu', 'présente ton projet en 5 étapes, c est gratuit et sans engagement'],
          ['Poser une question', 'si tu préfères d abord en discuter avec nous'],
        ])),
      ),
    );
}

export function devFaq() {
  return base(COLORS.info)
    .setTitle('❓  Questions fréquentes')
    .setDescription(
      'Les questions qu on nous pose le plus souvent sur nos éditions physiques. ' +
        'Il en manque une ? Passe par **📨・éditer-mon-jeu** ou ouvre un ticket.',
    )
    .addFields(
      { name: '📦  Quels tirages ?', value: 'De 50 à plus de 500 exemplaires. On adapte au projet et à ton audience.' },
      { name: '💎  Quelles éditions ?', value: 'Standard, deluxe, collector — ou une formule définie ensemble.' },
      { name: '💰  Combien ça coûte ?', value: 'La soumission est gratuite et sans engagement. Le devis dépend du tirage et de l édition.' },
      { name: '🎯  Quels critères ?', value: 'On privilégie la qualité : des jeux qu on a envie de tenir en main. La taille de ta communauté n est pas déterminante.' },
      { name: '⏱️  Sous quel délai ?', value: 'Une réponse sous quelques jours. Chaque message reçoit une réponse.' },
      { name: '🎮  Et le joueur ?', value: 'Nos éditions tournent hors ligne, sans compte ni plateforme externe.' },
    );
}

// Vitrine de l'offre DematGames, en tete de la categorie STUDIO.
export function servicesHeader() {
  return header({
    emoji: '💼',
    title: 'Nos services',
    color: COLORS.primary,
    intro: 'DematGames édite des jeux indés en physique. On s occupe de tout, du disque au colis.',
    blocks: [
      block('💿', 'Ce qu on fabrique', bullets([
        ['Le disque', 'pressé et sérigraphié'],
        ['Le boîtier', 'avec sa jaquette imprimée'],
        ['Le livret', 'glissé dans la boîte'],
        ['L édition', 'standard, deluxe ou collector'],
      ])),
      block('🇪🇺', 'Comment on travaille', bullets(SELLING_POINTS)),
      divider(),
      `Tu développes un jeu ? Rendez-vous dans **📨・éditer-mon-jeu**. ` +
        `La boutique et le catalogue sont sur ${SITE_URL}`,
    ],
  });
}

// --- en-tetes de salons ------------------------------------------------------
// Publies par /panneaux dans les salons vitrine et les salons staff.

export function retoursHeader() {
  return header({
    emoji: '💡',
    title: 'Tes retours et tes idées',
    color: COLORS.info,
    intro: 'Tu as reçu une de nos éditions, ou tu as une idée pour la suite ? On lit tout.',
    blocks: [
      block('✍️', 'Un retour utile, c est', bullets([
        'De quelle édition tu parles',
        'Ce qui t a plu, ce qui t a déçu',
        'Une photo si c est un défaut visible',
      ])),
      divider(),
      'Un problème sur une commande ou un colis abîmé ? Le support s en occupe plus vite qu ici.',
    ],
  });
}

export function sortiesHeader() {
  return header({
    emoji: '🚀',
    title: 'Sorties et précommandes',
    color: COLORS.success,
    intro: 'Chaque nouvelle édition physique est annoncée ici : date, prix, tirage et lien de commande.',
    blocks: [
      block('🔔', 'Ne rien rater', bullets([
        'Prends le rôle **🚀 Sorties** dans le salon des rôles pour être notifié',
        'Suis ce salon pour recevoir les annonces sur ton serveur',
      ])),
      divider(),
      `Salon en lecture seule. La boutique complète est sur ${SITE_URL}`,
    ],
  });
}

export function moderatorHeader() {
  return header({
    emoji: '🛡️',
    title: 'Coordination de la modération',
    color: COLORS.danger,
    intro: 'Salon de travail de l équipe. Les actions du bot sont journalisées dans le salon des logs.',
    blocks: [
      block('⚙️', 'Commandes disponibles', bullets([
        ['/mod warn', 'avertir un membre — au-delà de 3, le bot le signale'],
        ['/mod mute', 'réduire au silence (timeout Discord)'],
        ['/mod kick · ban · unban', 'expulser ou bannir'],
        ['/mod warns · unwarn', 'consulter ou effacer les avertissements'],
        ['/mod clear', 'purger les derniers messages d un salon'],
      ])),
      block('🤖', 'Automod actif', bullets([
        'Invitations vers d autres serveurs supprimées',
        'Mass-mention bloqué au-delà de 5 mentions',
        'Flood : 5 messages en 5 s déclenche 1 min de timeout',
        'Le staff en est exempté',
      ])),
    ],
  });
}

export function logsHeader() {
  return header({
    emoji: '📋',
    title: 'Journal du bot',
    color: COLORS.neutral,
    intro: 'Tout ce que fait le bot est consigné ici, automatiquement.',
    blocks: [
      block('📗', 'Ce qui est journalisé', bullets([
        'Actions de modération et déclenchements de l automod',
        'Ouverture, prise en charge et fermeture des tickets',
        'Publications faites depuis le panneau admin',
        'Modifications de salons et exécutions de /setup',
        'Transcripts des tickets fermés',
      ])),
      divider(),
      'Salon en lecture seule : n y poste rien, les messages se perdraient dans le flux.',
    ],
  });
}

export function ticketOpened({ type, user, fields = [] }) {
  const titles = {
    support: `${EMOJI.ticket} Ticket support`,
    question: `${EMOJI.question} Question développeur`,
    submission: `${EMOJI.submit} Soumission de jeu`,
  };
  const e = base(COLORS.info)
    .setTitle(titles[type] || `${EMOJI.ticket} Ticket`)
    .setDescription(`Ouvert par ${user}. L équipe DematGames te répond au plus vite.`);
  if (fields.length) e.addFields(fields);
  return e;
}

export function log({ title, description, color = COLORS.info, fields = [] }) {
  const e = base(color).setTitle(title);
  if (description) e.setDescription(description);
  if (fields.length) e.addFields(fields);
  return e;
}

export function success(message) {
  return base(COLORS.success).setDescription(`✅ ${message}`);
}

export function error(message) {
  return base(COLORS.danger).setDescription(`❌ ${message}`);
}

export function info(message) {
  return base(COLORS.info).setDescription(message);
}
