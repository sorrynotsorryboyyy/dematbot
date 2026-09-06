// Dispatcher unique : slash commands + composants (boutons, modals, select menus).
// Les customId suivent la convention "domaine:action:arg" et sont routes vers
// le handler du domaine correspondant.

import { Events, MessageFlags } from 'discord.js';
import * as adminPanel from '../components/adminPanel.js';
import * as tickets from '../components/tickets.js';
import * as rolePanel from '../components/rolePanel.js';
import * as rules from '../components/rules.js';
import * as embeds from '../lib/embeds.js';
import { console_ } from '../lib/logger.js';

export const name = Events.InteractionCreate;

const DOMAINS = {
  panel: adminPanel,
  ticket: tickets,
  roles: rolePanel,
  rules,
};

export async function execute(interaction, client) {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction, client);
      return;
    }

    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (command?.autocomplete) await command.autocomplete(interaction, client);
      return;
    }

    // Composants : bouton, modal ou select menu.
    if (interaction.isButton() || interaction.isModalSubmit() || interaction.isAnySelectMenu()) {
      const [domain, action, ...args] = interaction.customId.split(':');
      const handler = DOMAINS[domain];
      if (!handler?.handle) {
        console_.warn(`Aucun handler pour le domaine "${domain}" (${interaction.customId})`);
        return;
      }
      await handler.handle(interaction, action, args, client);
    }
  } catch (err) {
    console_.error(`Interaction ${interaction.customId || interaction.commandName} :`, err);
    await replyError(interaction, err);
  }
}

async function replyError(interaction, err) {
  const payload = {
    embeds: [embeds.error(`Une erreur est survenue.\n\`\`\`${String(err.message).slice(0, 500)}\`\`\``)],
    flags: MessageFlags.Ephemeral,
  };
  try {
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
    else await interaction.reply(payload);
  } catch {
    // L'interaction a expire : plus rien a faire.
  }
}
