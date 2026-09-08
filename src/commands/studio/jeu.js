// /jeu : consulter et retirer les fiches jeux publiees dans #sorties-et-precommandes.
// L'ajout et la mise a jour passent par le panneau admin (formulaire guide).

import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { games } from '../../db/index.js';
import { resolveChannel } from '../../lib/guild.js';
import * as embeds from '../../lib/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('jeu')
  .setDescription('Consulter le catalogue DematGames')
  .setDMPermission(false)
  .addSubcommand((s) => s.setName('liste').setDescription('Lister les jeux du catalogue'))
  .addSubcommand((s) =>
    s.setName('voir').setDescription('Afficher la fiche d un jeu')
      .addStringOption((o) => o.setName('nom').setDescription('Nom du jeu').setRequired(true).setAutocomplete(true)),
  )
  .addSubcommand((s) =>
    s.setName('retirer').setDescription('Retirer un jeu du catalogue (staff)')
      .addStringOption((o) => o.setName('nom').setDescription('Nom du jeu').setRequired(true).setAutocomplete(true)),
  );

export async function autocomplete(interaction) {
  const focused = interaction.options.getFocused().toLowerCase();
  const choices = games
    .list()
    .filter((g) => g.name.toLowerCase().includes(focused))
    .slice(0, 25)
    .map((g) => ({ name: g.name, value: g.name }));
  await interaction.respond(choices);
}

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'liste') {
    await interaction.deferReply();
    const list = games.list();

    if (!list.length) {
      const sorties = await resolveChannel(interaction.guild, 'sorties');
      await interaction.editReply({
        embeds: [
          embeds.info(
            `Aucune édition publiée pour l instant — les premières arrivent.${sorties ? `\nSuis ${sorties} pour ne rien rater.` : ''}`,
          ),
        ],
      });
      return;
    }

    await interaction.editReply({
      embeds: [
        embeds.log({
          title: `🎮 Catalogue DematGames (${list.length})`,
          description: list
            .map((g) => `• **${g.name}**${g.genre ? ` — ${g.genre}` : ''}${g.price ? ` — ${g.price}` : ''}`)
            .join('\n'),
        }),
      ],
    });
    return;
  }

  const name = interaction.options.getString('nom');
  const game = games.byName(name);

  if (!game) {
    await interaction.reply({
      embeds: [embeds.error(`Aucun jeu nommé **${name}** dans le catalogue.`)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === 'voir') {
    await interaction.reply({ embeds: [embeds.gameCard(game)] });
    return;
  }

  // retirer : reserve au staff.
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      embeds: [embeds.error('Seul le staff peut retirer un jeu du catalogue.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Retire aussi le message publie dans #sorties, s'il existe encore.
  if (game.message_id) {
    const sorties = await resolveChannel(interaction.guild, 'sorties');
    const msg = await sorties?.messages.fetch(game.message_id).catch(() => null);
    await msg?.delete().catch(() => {});
  }

  games.remove(name);
  await interaction.editReply({ embeds: [embeds.success(`**${name}** retiré du catalogue.`)] });
}
