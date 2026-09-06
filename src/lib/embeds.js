// Fabriques d'embeds a la charte DematGames.
// Tout ce que le bot publie passe par ici : un seul endroit pour changer le style.

import { EmbedBuilder } from 'discord.js';
import { COLORS, FOOTER, SITE_URL, SELLING_POINTS, EMOJI } from '../config/brand.js';

function base(color = COLORS.primary) {
  return new EmbedBuilder().setColor(color).setFooter(FOOTER).setTimestamp();
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

// Embed d'attente affiche dans #catalogue tant qu'aucun jeu n'est enregistre.
export function emptyCatalogue() {
  return base(COLORS.neutral)
    .setTitle('Catalogue bientôt disponible')
    .setDescription(
      [
        'Les premières éditions physiques DematGames arrivent.',
        '',
        'Chaque édition, c est un disque pressé, un boîtier, une jaquette et un livret imprimés,',
        'fabriqués à la demande en Europe et expédiés en suivi dans toute l UE.',
        '',
        `Le catalogue complet est sur ${SITE_URL}`,
      ].join('\n'),
    );
}

// Embed permanent de #éditer-mon-jeu : la porte d'entree des developpeurs.
export function devPitch() {
  return base(COLORS.primary)
    .setTitle(`${EMOJI.dev} Passe ton jeu en édition physique`)
    .setDescription(
      [
        'Tu développes un jeu et tu aimerais qu il existe autrement qu en téléchargement ?',
        'DematGames fabrique des éditions physiques de jeux indés, de A à Z.',
        '',
        SELLING_POINTS.map((p) => `• ${p}`).join('\n'),
        '',
        'Clique sur **Soumettre mon jeu** pour nous présenter ton projet en 5 étapes,',
        'ou sur **Poser une question** si tu veux d abord en discuter.',
      ].join('\n'),
    );
}

export function devFaq() {
  return base(COLORS.info)
    .setTitle('❓ FAQ développeurs')
    .addFields(
      { name: 'Quels tirages ?', value: 'De 50 à plus de 500 exemplaires. On adapte au projet et à ton audience.' },
      { name: 'Quelles éditions ?', value: 'Standard, deluxe, collector — ou une formule définie ensemble.' },
      { name: 'Combien ça coûte ?', value: 'La soumission est gratuite et sans engagement. Le devis dépend du tirage et de l édition.' },
      { name: 'Quels critères ?', value: 'On privilégie la qualité : des jeux qu on a envie de tenir en main. La taille de ta communauté n est pas déterminante.' },
      { name: 'Sous quel délai ?', value: 'Une réponse sous quelques jours. Chaque message reçoit une réponse.' },
      { name: 'Et le joueur ?', value: 'Nos éditions tournent hors ligne, sans compte ni plateforme externe.' },
    );
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
