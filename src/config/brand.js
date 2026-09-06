// Charte visuelle et textes de marque DematGames.
// Un seul endroit a modifier pour changer l'identite du bot partout.

export const SITE_URL = 'https://www.dematgames.com/fr';

export const COLORS = {
  primary: 0xe8b923,   // or DematGames - annonces, panneaux
  success: 0x57f287,   // validations, sorties
  danger: 0xed4245,    // sanctions, erreurs
  info: 0x5865f2,      // informations, logs
  neutral: 0x2b2d31,   // fond discret
};

export const EMOJI = {
  announce: '📢',
  release: '🚀',
  preorder: '🛒',
  game: '🎮',
  roles: '🏷️',
  channels: '⚙️',
  sync: '🔄',
  dev: '🛠️',
  ticket: '🎫',
  lock: '🔒',
  claim: '👤',
  accept: '✅',
  hold: '📥',
  question: '❓',
  submit: '📨',
};

export const FOOTER = {
  text: 'DematGames — éditions physiques de jeux indés',
  iconURL: null,
};

// Arguments de vente repris du site, reutilises dans les embeds devs.
export const SELLING_POINTS = [
  'Pressage de disques, boîtiers, jaquettes et livrets imprimés',
  'Fabrication à la demande en Europe',
  'Expédition suivie vers toute l’UE',
  'Des jeux qui tournent hors ligne, sans compte ni plateforme',
  'Gratuit et sans engagement — réponse sous quelques jours',
];
