// Etat cible du serveur DematGames.
// /setup lit ce fichier et fait converger le serveur vers cette structure.
// Modifier ici puis relancer /setup : rien n'est duplique, seul le manquant est cree.

import { ChannelType } from 'discord.js';

// --- ROLES ------------------------------------------------------------------
// key    : identifiant interne stable (utilise en base et dans le code)
// name   : nom affiche sur Discord
// hoist  : affiche separement dans la liste des membres
// group  : rattache le role a un panneau de selection
//
// L'ordre compte : /setup les cree de haut en bas, du plus eleve au plus bas.

export const ROLES = [
  // Equipe, du plus haut au plus bas.
  { key: 'staff', name: '👑 Staff DematGames', color: 0xe8b923, hoist: true, mentionable: true },
  { key: 'founder', name: '🏛️ Fondateur', color: 0xc0392b, hoist: true, mentionable: true },
  { key: 'admin', name: '⚙️ Admin', color: 0x9b59b6, hoist: true, mentionable: true },
  { key: 'helper', name: '🛠️ Helpeur', color: 0x3498db, hoist: true, mentionable: true },

  { key: 'devPartner', name: '🎮 Développeur partenaire', color: 0x57f287, hoist: true, mentionable: true },
  { key: 'verified', name: '⭐ Membre vérifié', color: 0xeb459e, hoist: false, mentionable: false },
  { key: 'bots', name: '🤖 Bots', color: 0x99aab5, hoist: false, mentionable: false },

  // Plateformes (panneau de roles)
  { key: 'plat_pc', name: 'PC', color: 0x4f545c, group: 'platform', emoji: '🖥️' },
  { key: 'plat_playstation', name: 'PlayStation', color: 0x4f545c, group: 'platform', emoji: '🎮' },
  { key: 'plat_xbox', name: 'Xbox', color: 0x4f545c, group: 'platform', emoji: '🟩' },
  { key: 'plat_switch', name: 'Switch', color: 0x4f545c, group: 'platform', emoji: '🔴' },
  { key: 'plat_retro', name: 'Rétro', color: 0x4f545c, group: 'platform', emoji: '👾' },

  // Notifications (panneau de roles) : un role par salon qui peut notifier.
  { key: 'notif_annonces', name: '📢 Annonces', color: 0x4f545c, group: 'notif', emoji: '📢' },
  { key: 'notif_sorties', name: '🚀 Sorties', color: 0x4f545c, group: 'notif', emoji: '🚀' },
];

export const ROLE_GROUPS = {
  platform: { label: 'Plateformes', placeholder: 'Sur quoi joues-tu ?' },
  notif: { label: 'Notifications', placeholder: 'De quoi veux-tu être notifié ?' },
};

// Grades qui donnent acces aux salons et actions du staff.
export const STAFF_ROLE_KEYS = ['staff', 'founder', 'admin', 'helper'];

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
      { key: 'reglement', name: '📜・règlement', type: 'text', preset: 'PUBLIC_READONLY', aliases: ['rules', 'reglement', 'règlement'], topic: 'Le règlement du serveur. Accepte-le pour accéder à la communauté.' },
      { key: 'bienvenue', name: '👋・bienvenue', type: 'text', preset: 'PUBLIC_READONLY', aliases: ['bienvenue'], topic: 'Les nouveaux arrivants sont accueillis ici.' },
      { key: 'choisir-roles', name: '🏷️・choisir-ses-rôles', type: 'text', preset: 'PUBLIC_READONLY', aliases: ['choisir-ses-rôles'], topic: 'Choisis tes plateformes et tes notifications.' },
    ],
  },
  {
    key: 'dematgames',
    name: '🎮 DEMATGAMES',
    preset: 'PUBLIC_READONLY',
    channels: [
      { key: 'annonces', name: '📢・annonces', type: 'text', preset: 'PUBLIC_READONLY', aliases: ['annonces'], topic: 'Annonces officielles DematGames.' },
      { key: 'sorties', name: '🚀・sorties-et-précommandes', type: 'text', preset: 'PUBLIC_READONLY', aliases: ['sorties-et-précommandes'], topic: 'Sorties, précommandes et nouvelles éditions physiques.' },
      { key: 'retours', name: '💡・retours-et-avis', type: 'text', preset: 'MEMBER_CHAT', aliases: ['retours-et-idées', 'retours-et-avis'], topic: 'Tes retours et tes avis sur nos éditions.' },
    ],
  },
  {
    key: 'communaute',
    name: '💬 COMMUNAUTÉ',
    preset: 'MEMBER_CHAT',
    channels: [
      { key: 'general', name: '💬・général', type: 'text', preset: 'MEMBER_CHAT', aliases: ['général'], topic: 'Discussion générale, de tout et de rien.' },
      { key: 'jeux-video', name: '🎮・jeux-vidéo', type: 'text', preset: 'MEMBER_CHAT', aliases: ['jeux-vidéo'], topic: 'On parle jeux : ce qu on joue, ce qu on attend.' },
      { key: 'clips', name: '🎬・clips-et-screenshots', type: 'text', preset: 'MEMBER_CHAT', aliases: ['clips-et-screenshots'], topic: 'Tes meilleurs moments en image et en vidéo.', slowmode: 30 },
      { key: 'vocal-general', name: '🔊 Vocal général', type: 'voice', preset: 'VOICE_MEMBER' },
    ],
  },
  {
    key: 'studio',
    name: '🏭 STUDIO DEMATGAMES',
    preset: 'PUBLIC_READONLY',
    channels: [
      { key: 'nos-services', name: '💼・nos-services', type: 'text', preset: 'PUBLIC_READONLY', topic: 'Éditions physiques de jeux indés : pressage, jaquettes, livrets, expédition.' },
      { key: 'faq', name: '❓・faq', type: 'text', preset: 'PUBLIC_READONLY', aliases: ['faq-devs'], topic: 'Tirages, éditions, délais, tarifs : les réponses aux questions fréquentes.' },
      { key: 'editer-mon-jeu', name: '📨・éditer-mon-jeu', type: 'text', preset: 'PUBLIC_READONLY', aliases: ['éditer-mon-jeu'], topic: 'Tu développes un jeu ? Passe-le en édition physique avec DematGames.' },
    ],
  },
  {
    key: 'support',
    name: '🎫 SUPPORT',
    preset: 'PUBLIC_READONLY',
    channels: [
      { key: 'ouvrir-un-ticket', name: '🎫・ouvrir-un-ticket', type: 'text', preset: 'PUBLIC_READONLY', aliases: ['support'], topic: 'Une question sur une commande, un colis, un SAV ? Ouvre un ticket.' },
    ],
  },
  {
    key: 'staff',
    name: '🔒 STAFF',
    preset: 'STAFF_ONLY',
    channels: [
      { key: 'panel-admin', name: '🎛️・panel-admin', type: 'text', preset: 'STAFF_ONLY', aliases: ['panel-admin'], topic: 'Le panneau de gestion du serveur.' },
      { key: 'moderator-only', name: '🛡️・moderator-only', type: 'text', preset: 'STAFF_ONLY', aliases: ['moderator-only'], topic: 'Coordination de la modération.' },
      { key: 'logs-bot', name: '📋・logs-bot', type: 'text', preset: 'STAFF_ONLY', aliases: ['logs-bot'], topic: 'Journal des actions du bot.' },
      { key: 'vocal-staff', name: '🔊 Vocal staff', type: 'voice', preset: 'VOICE_STAFF' },
    ],
  },
];

// Les salons de tickets sont crees a la volee sous cette categorie.
export const TICKET_CATEGORY_KEY = 'support';

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
