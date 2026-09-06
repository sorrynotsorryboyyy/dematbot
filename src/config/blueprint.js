// Etat cible du serveur DematGames.
// /setup lit ce fichier et fait converger le serveur vers cette structure.
// Modifier ici puis relancer /setup : rien n'est duplique, seul le manquant est cree.

import { ChannelType } from 'discord.js';

// --- ROLES ------------------------------------------------------------------
// key    : identifiant interne stable (utilise en base et dans le code)
// name   : nom affiche sur Discord
// hoist  : affiche separement dans la liste des membres
// group  : rattache le role a un panneau de selection

export const ROLES = [
  { key: 'staff', name: '👑 Staff DematGames', color: 0xe8b923, hoist: true, mentionable: true },
  { key: 'moderator', name: '🛡️ Modérateur', color: 0x5865f2, hoist: true, mentionable: true },
  { key: 'devPartner', name: '🎮 Développeur partenaire', color: 0x57f287, hoist: true, mentionable: true },
  { key: 'verified', name: '⭐ Membre vérifié', color: 0xeb459e, hoist: false, mentionable: false },
  { key: 'bots', name: '🤖 Bots', color: 0x99aab5, hoist: false, mentionable: false },

  // Plateformes (panneau de roles)
  { key: 'plat_pc', name: 'PC', color: 0x4f545c, group: 'platform', emoji: '🖥️' },
  { key: 'plat_playstation', name: 'PlayStation', color: 0x4f545c, group: 'platform', emoji: '🎮' },
  { key: 'plat_xbox', name: 'Xbox', color: 0x4f545c, group: 'platform', emoji: '🟩' },
  { key: 'plat_switch', name: 'Switch', color: 0x4f545c, group: 'platform', emoji: '🔴' },
  { key: 'plat_retro', name: 'Rétro', color: 0x4f545c, group: 'platform', emoji: '👾' },

  // Notifications (panneau de roles)
  { key: 'notif_annonces', name: '📢 Annonces', color: 0x4f545c, group: 'notif', emoji: '📢' },
  { key: 'notif_sorties', name: '🚀 Sorties', color: 0x4f545c, group: 'notif', emoji: '🚀' },
  { key: 'notif_concours', name: '🎁 Concours', color: 0x4f545c, group: 'notif', emoji: '🎁' },
  { key: 'notif_clips', name: '🎥 Clips', color: 0x4f545c, group: 'notif', emoji: '🎥' },
];

export const ROLE_GROUPS = {
  platform: { label: 'Plateformes', placeholder: 'Sur quoi joues-tu ?' },
  notif: { label: 'Notifications', placeholder: 'De quoi veux-tu être notifié ?' },
};

// --- CATEGORIES ET SALONS ---------------------------------------------------
// key      : identifiant interne stable
// name     : nom affiche
// type     : text | voice | forum
// preset   : nom du preset dans lib/permissions.js
// aliases  : anciens noms a reutiliser au lieu de creer un doublon
// topic    : sujet du salon
// slowmode : en secondes

export const CATEGORIES = [
  {
    key: 'accueil',
    name: '📌 ACCUEIL',
    preset: 'PUBLIC_READONLY',
    channels: [
      { key: 'reglement', name: 'règlement', type: 'text', preset: 'PUBLIC_READONLY', aliases: ['rules', 'reglement'], topic: 'Le règlement du serveur. Accepte-le pour accéder à la communauté.' },
      { key: 'annonces', name: 'annonces', type: 'text', preset: 'PUBLIC_READONLY', topic: 'Annonces officielles DematGames.' },
      { key: 'bienvenue', name: 'bienvenue', type: 'text', preset: 'PUBLIC_READONLY', topic: 'Les nouveaux arrivants sont accueillis ici.' },
      { key: 'choisir-roles', name: 'choisir-ses-rôles', type: 'text', preset: 'PUBLIC_READONLY', topic: 'Choisis tes plateformes et tes notifications.' },
    ],
  },
  {
    key: 'communaute',
    name: '💬 COMMUNAUTÉ',
    preset: 'MEMBER_CHAT',
    channels: [
      { key: 'general', name: 'général', type: 'text', preset: 'MEMBER_CHAT', topic: 'Discussion générale, de tout et de rien.' },
      { key: 'hors-sujet', name: 'hors-sujet', type: 'text', preset: 'MEMBER_CHAT', topic: 'Tout ce qui n a rien à voir avec le jeu vidéo.' },
      { key: 'jeux-video', name: 'jeux-vidéo', type: 'text', preset: 'MEMBER_CHAT', topic: 'On parle jeux : ce qu on joue, ce qu on attend.' },
      { key: 'actus-gaming', name: 'actus-gaming', type: 'text', preset: 'MEMBER_CHAT', topic: 'L actualité du jeu vidéo.' },
      { key: 'clips', name: 'clips-et-screenshots', type: 'text', preset: 'MEMBER_CHAT', topic: 'Tes meilleurs moments en image et en vidéo.', slowmode: 30 },
      { key: 'lfg', name: 'recherche-de-joueurs', type: 'text', preset: 'MEMBER_CHAT', topic: 'Trouve des joueurs pour ta prochaine partie.' },
      { key: 'creations', name: 'créations', type: 'text', preset: 'MEMBER_CHAT', topic: 'Fan art, mods, projets perso : montre ce que tu fais.' },
      { key: 'vocal-general', name: '🔊 Vocal général', type: 'voice', preset: 'VOICE_MEMBER' },
      { key: 'vocal-jeu', name: '🔊 Vocal jeu', type: 'voice', preset: 'VOICE_MEMBER' },
      { key: 'vocal-afk', name: '🔊 AFK', type: 'voice', preset: 'VOICE_MEMBER' },
    ],
  },
  {
    key: 'jeux',
    name: '🕹️ JEUX DEMATGAMES',
    preset: 'PUBLIC_READONLY',
    channels: [
      { key: 'catalogue', name: 'catalogue', type: 'text', preset: 'PUBLIC_READONLY', topic: 'Les éditions physiques DematGames.' },
      { key: 'sorties', name: 'sorties-et-précommandes', type: 'text', preset: 'PUBLIC_READONLY', topic: 'Sorties, précommandes et disponibilités.' },
      { key: 'forum-jeux', name: 'forum-jeux', type: 'forum', preset: 'MEMBER_CHAT', topic: 'Un espace de discussion par jeu.', tags: ['Narratif', 'Famille', 'Rétro', 'Aventure', 'Action', 'Puzzle'] },
      { key: 'retours', name: 'retours-et-idées', type: 'text', preset: 'MEMBER_CHAT', topic: 'Tes retours et tes idées sur nos éditions.' },
    ],
  },
  {
    key: 'studio',
    name: '🏭 STUDIO & COULISSES',
    preset: 'PUBLIC_READONLY',
    channels: [
      { key: 'coulisses', name: 'coulisses', type: 'text', preset: 'PUBLIC_READONLY', topic: 'On grave, on imprime, on expédie : les coulisses de l atelier.' },
      { key: 'support', name: 'support', type: 'text', preset: 'PUBLIC_READONLY', topic: 'Une question sur une commande, un colis, un SAV ? Ouvre un ticket.' },
    ],
  },
  {
    key: 'devs',
    name: '🛠️ ESPACE DÉVELOPPEURS',
    preset: 'PUBLIC_READONLY',
    channels: [
      { key: 'editer-mon-jeu', name: 'éditer-mon-jeu', type: 'text', preset: 'PUBLIC_READONLY', topic: 'Tu développes un jeu ? Passe-le en édition physique avec DematGames.' },
      { key: 'faq-devs', name: 'faq-devs', type: 'text', preset: 'PUBLIC_READONLY', topic: 'Tirages, éditions, délais, critères : les réponses aux questions fréquentes.' },
      { key: 'vitrine-devs', name: 'vitrine-devs', type: 'text', preset: 'MEMBER_CHAT', topic: 'Les devs partagent leurs projets en cours : WIP, trailers, devlogs.' },
      { key: 'entraide-dev', name: 'entraide-dev', type: 'text', preset: 'MEMBER_CHAT', topic: 'Entraide entre développeurs : outils, moteurs, édition, distribution.' },
      { key: 'projets-en-cours', name: 'projets-en-cours', type: 'text', preset: 'DEV_PARTNER', topic: 'Suivi de production des jeux signés : maquettes, BAT, pressage, expédition.' },
      { key: 'vocal-devs', name: '🔊 Vocal devs', type: 'voice', preset: 'VOICE_DEV' },
    ],
  },
  {
    key: 'tickets',
    name: '🎫 TICKETS',
    preset: 'TICKET_CATEGORY',
    channels: [],
  },
  {
    key: 'staff',
    name: '🔒 STAFF',
    preset: 'STAFF_ONLY',
    channels: [
      { key: 'panel-admin', name: 'panel-admin', type: 'text', preset: 'STAFF_ONLY', topic: 'Le panneau de gestion du serveur.' },
      { key: 'moderator-only', name: 'moderator-only', type: 'text', preset: 'STAFF_ONLY', aliases: ['moderator-only'], topic: 'Coordination de la modération.' },
      { key: 'logs-bot', name: 'logs-bot', type: 'text', preset: 'STAFF_ONLY', topic: 'Journal des actions du bot.' },
      { key: 'vocal-staff', name: '🔊 Vocal staff', type: 'voice', preset: 'VOICE_STAFF' },
    ],
  },
];

export const CHANNEL_TYPES = {
  text: ChannelType.GuildText,
  voice: ChannelType.GuildVoice,
  forum: ChannelType.GuildForum,
};

// Acces rapide a la definition d'un salon par sa cle.
export function findChannelDef(key) {
  for (const cat of CATEGORIES) {
    const ch = cat.channels.find((c) => c.key === key);
    if (ch) return { category: cat, channel: ch };
  }
  return null;
}

export function allChannelDefs() {
  return CATEGORIES.flatMap((cat) => cat.channels.map((ch) => ({ category: cat, channel: ch })));
}
