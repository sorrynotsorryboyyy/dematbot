// Helpers de mise en page des embeds.
// Centralises ici pour que tous les messages du bot partagent le meme rythme
// visuel : memes separateurs, memes puces, memes titres de section.

// Trait de separation entre deux blocs d'un embed.
export const divider = () => '━━━━━━━━━━━━━━━━━━━━━━━';

// Titre de section a l'interieur d'une description.
export const section = (emoji, title) => `${emoji}  **${title}**`;

// Liste a puces. Accepte des chaines ou des paires [label, texte].
export function bullets(items) {
  return items
    .filter(Boolean)
    .map((item) => (Array.isArray(item) ? `> **${item[0]}** — ${item[1]}` : `> ${item}`))
    .join('\n');
}

// Liste numerotee, pour les etapes d'un processus.
export function steps(items) {
  return items.filter(Boolean).map((item, i) => `**${i + 1}.** ${item}`).join('\n');
}

// Ligne cle / valeur.
export const kv = (label, value) => `**${label}** · ${value}`;

// Assemble des blocs en les separant par une ligne vide, en ignorant les vides.
export const stack = (...blocks) => blocks.filter(Boolean).join('\n\n');

// Bloc titre + contenu, precede d'un separateur.
export function block(emoji, title, body) {
  return [divider(), section(emoji, title), '', body].join('\n');
}
