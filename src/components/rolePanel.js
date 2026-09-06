// Panneau de selection de roles : deux menus deroulants multi-choix
// (Plateformes, Notifications). Les customId sont statiques, le panneau
// survit donc aux redemarrages du bot.

import {
  ActionRowBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { ROLES, ROLE_GROUPS } from '../config/blueprint.js';
import { resolveRoles } from '../lib/guild.js';
import { rolepanels } from '../db/index.js';
import * as embeds from '../lib/embeds.js';
import { COLORS } from '../config/brand.js';

// Construit le message du panneau (embed + menus) pour un serveur donne.
export async function build(guild) {
  const roles = await resolveRoles(guild);
  const components = [];
  const saved = [];

  for (const [kind, meta] of Object.entries(ROLE_GROUPS)) {
    const defs = ROLES.filter((r) => r.group === kind);
    const options = defs
      .filter((d) => roles[d.key])
      .map((d) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(d.name)
          .setValue(d.key)
          .setEmoji(d.emoji || '▫️'),
      );

    if (!options.length) continue;

    components.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`roles:pick:${kind}`)
          .setPlaceholder(meta.placeholder)
          .setMinValues(0)
          .setMaxValues(options.length)
          .addOptions(options),
      ),
    );
    saved.push({ kind, roleIds: defs.filter((d) => roles[d.key]).map((d) => roles[d.key].id) });
  }

  const embed = embeds.log({
    title: '🏷️ Choisis tes rôles',
    color: COLORS.primary,
    description: [
      'Sélectionne ce qui te correspond. Tu peux en choisir plusieurs, et revenir dessus quand tu veux.',
      '',
      '**Plateformes** — sur quoi tu joues, pour trouver des partenaires de jeu.',
      '**Notifications** — ce dont tu veux être prévenu (annonces, sorties, concours, clips).',
      '',
      'Désélectionne une entrée pour retirer le rôle.',
    ].join('\n'),
  });

  return { embed, components, saved };
}

// Publie (ou republie) le panneau dans un salon.
export async function publish(guild, channel) {
  const { embed, components, saved } = await build(guild);
  const message = await channel.send({ embeds: [embed], components });
  for (const { kind, roleIds } of saved) {
    rolepanels.clearKind(kind);
    rolepanels.save(message.id, channel.id, kind, roleIds);
  }
  return message;
}

// --- interactions ------------------------------------------------------------

export async function handle(interaction, action, args) {
  if (action !== 'pick') return;

  const kind = args[0];
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const roles = await resolveRoles(interaction.guild);
  const groupDefs = ROLES.filter((r) => r.group === kind);
  const chosen = new Set(interaction.values);

  const added = [];
  const removed = [];

  for (const def of groupDefs) {
    const role = roles[def.key];
    if (!role) continue;
    const has = interaction.member.roles.cache.has(role.id);

    if (chosen.has(def.key) && !has) {
      await interaction.member.roles.add(role).catch(() => {});
      added.push(def.name);
    } else if (!chosen.has(def.key) && has) {
      await interaction.member.roles.remove(role).catch(() => {});
      removed.push(def.name);
    }
  }

  const lines = [];
  if (added.length) lines.push(`✅ Ajouté : ${added.join(', ')}`);
  if (removed.length) lines.push(`➖ Retiré : ${removed.join(', ')}`);
  if (!lines.length) lines.push('Aucun changement.');

  await interaction.editReply({ embeds: [embeds.info(lines.join('\n'))] });
}
