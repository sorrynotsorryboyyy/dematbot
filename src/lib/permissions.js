import { PermissionFlagsBits as P } from 'discord.js';
import { STAFF_ROLE_KEYS } from '../config/blueprint.js';

// Applique les memes droits a tous les grades du staff, en ignorant ceux qui
// n'existent pas encore sur le serveur.
const forEachStaff = (r, allow) =>
  STAFF_ROLE_KEYS.map((key) => r[key]).filter(Boolean).map((role) => ({ id: role.id, allow }));

// Presets de permissions. Chaque preset est une fonction qui recoit les roles
// resolus du serveur et rend un tableau de permissionOverwrites pret a l'emploi.
//
// roles : { everyone, staff, founder, admin, helper, devPartner, verified, bots }

export const PRESETS = {
  // Tout le monde lit, personne n'ecrit (sauf staff).
  PUBLIC_READONLY: (r) => [
    { id: r.everyone.id, deny: [P.SendMessages, P.CreatePublicThreads, P.CreatePrivateThreads], allow: [P.ViewChannel, P.ReadMessageHistory] },
    { id: r.staff.id, allow: [P.SendMessages, P.ManageMessages] },
  ],

  // Visible par tous, ecriture pour les membres verifies.
  MEMBER_CHAT: (r) => [
    { id: r.everyone.id, deny: [P.ViewChannel] },
    { id: r.verified.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks, P.AddReactions, P.CreatePublicThreads] },
    { id: r.staff.id, allow: [P.ViewChannel, P.SendMessages, P.ManageMessages] },
  ],

  // Ouvert a tous, y compris non verifies (accueil).
  OPEN_CHAT: (r) => [
    { id: r.everyone.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AddReactions] },
  ],

  // Staff et moderateurs uniquement.
  STAFF_ONLY: (r) => [
    { id: r.everyone.id, deny: [P.ViewChannel] },
    ...forEachStaff(r, [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.ManageMessages]),
  ],

  // Suivi de production : staff + developpeurs partenaires.
  DEV_PARTNER: (r) => [
    { id: r.everyone.id, deny: [P.ViewChannel] },
    { id: r.devPartner.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks] },
    { id: r.staff.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.ManageMessages] },
  ],

  // Vocal ouvert aux membres verifies.
  VOICE_MEMBER: (r) => [
    { id: r.everyone.id, deny: [P.ViewChannel] },
    { id: r.verified.id, allow: [P.ViewChannel, P.Connect, P.Speak, P.Stream] },
    { id: r.staff.id, allow: [P.ViewChannel, P.Connect, P.Speak, P.MuteMembers, P.MoveMembers] },
  ],

  // Vocal staff.
  VOICE_STAFF: (r) => [
    { id: r.everyone.id, deny: [P.ViewChannel] },
    ...forEachStaff(r, [P.ViewChannel, P.Connect, P.Speak]),
  ],

  // Vocal devs : partenaires + staff.
  VOICE_DEV: (r) => [
    { id: r.everyone.id, deny: [P.ViewChannel] },
    { id: r.devPartner.id, allow: [P.ViewChannel, P.Connect, P.Speak, P.Stream] },
    { id: r.staff.id, allow: [P.ViewChannel, P.Connect, P.Speak] },
  ],

  // Categorie tickets : invisible, les salons enfants ouvrent au cas par cas.
  TICKET_CATEGORY: (r) => [
    { id: r.everyone.id, deny: [P.ViewChannel] },
    { id: r.staff.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.ManageMessages] },
  ],
};

// Overwrites d'un salon de ticket individuel : l'auteur + le staff.
export function ticketOverwrites(roles, userId) {
  return [
    { id: roles.everyone.id, deny: [P.ViewChannel] },
    { id: userId, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks] },
    ...forEachStaff(roles, [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.ManageMessages]),
  ];
}

export function resolvePreset(name, roles) {
  const preset = PRESETS[name];
  if (!preset) throw new Error(`Preset de permissions inconnu : ${name}`);
  return preset(roles);
}
