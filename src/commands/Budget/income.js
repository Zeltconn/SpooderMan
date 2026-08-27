import { SlashCommandBuilder } from 'discord.js';
import axios from 'axios';
import { createEmbed } from '../../utils/embeds.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

function parseNaturalDate(dateStr) {
  if (!dateStr) return null;
  const lower = dateStr.toLowerCase().trim();
  const now = new Date();

  if (lower === 'today') return now;
  if (lower === 'yesterday') {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d;
  }
  if (lower === 'tomorrow') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d;
  }

  const weekdayMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  const lastWeekdayMatch = lower.match(/last\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/);
  if (lastWeekdayMatch) {
    const targetDay = weekdayMap[lastWeekdayMatch[1]];
    const d = new Date(now);
    const currentDay = d.getDay();
    let diff = currentDay - targetDay;
    if (diff <= 0) diff += 7;
    d.setDate(d.getDate() - diff);
    return d;
  }

  const monthDayMatch = lower.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\w*\s+(\d{1,2})/);
  if (monthDayMatch) {
    const monthMap = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
    const month = monthMap[monthDayMatch[1]];
    const day = parseInt(monthDayMatch[2], 10);
    const d = new Date(now.getFullYear(), month, day);
    if (d > now) d.setFullYear(d.getFullYear() - 1);
    return d;
  }

  const daysAgoMatch = lower.match(/(\d+)\s*days?\s*ago/);
  if (daysAgoMatch) {
    const d = new Date(now);
    d.setDate(d.getDate() - parseInt(daysAgoMatch[1], 10));
    return d;
  }

  return null;
}

function formatEntryDate(date) {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function getWebhookUrl() {
  return process.env.N8N_BUDGET_WEBHOOK_URL?.trim() || '';
}

export default {
  data: new SlashCommandBuilder()
    .setName('income')
    .setDescription('Log income/salary to your budget spreadsheet')
    .addStringOption((option) =>
      option.setName('description').setDescription('Source of income (e.g. Salary, Freelance)').setRequired(true)
    )
    .addNumberOption((option) =>
      option.setName('amount').setDescription('Amount received (e.g. 60000)').setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('date')
        .setDescription('Date (e.g. "yesterday", "Aug 15", "3 days ago"). Leave blank for today.')
        .setRequired(false)
    ),

  execute: withErrorHandling(
    async (interaction, config, client) => {
      const deferred = await InteractionHelper.safeDefer(interaction);
      if (!deferred) return;

      const description = interaction.options.getString('description');
      const amount = interaction.options.getNumber('amount');
      const dateInput = interaction.options.getString('date', null);

      if (amount <= 0) {
        throw createError('Invalid amount', ErrorTypes.VALIDATION, 'Amount must be greater than zero.');
      }

      const parsedDate = dateInput ? parseNaturalDate(dateInput) : new Date();
      if (dateInput && !parsedDate) {
        throw createError(
          'Invalid date format',
          ErrorTypes.VALIDATION,
          `Could not parse "${dateInput}". Try formats like "yesterday", "Aug 15", or "3 days ago".`
        );
      }

      const formattedDate = formatEntryDate(parsedDate);
      const webhookUrl = getWebhookUrl();

      if (!webhookUrl) {
        throw createError(
          'Workflow not configured',
          ErrorTypes.CONFIGURATION,
          'The budget workflow is not configured yet. Please contact the admin.'
        );
      }

      const payload = {
        event_type: 'budget_entry',
        entry_type: 'income',
        description,
        amount,
        date: parsedDate.toISOString(),
        category: '',
        author: {
          id: interaction.user.id,
          username: interaction.user.username,
        },
        channel: {
          id: interaction.channelId,
          name: interaction.channel?.name ?? null,
        },
        guild: interaction.guild
          ? {
              id: interaction.guild.id,
              name: interaction.guild.name,
            }
          : null,
        is_dm: !interaction.guildId,
        message_id: interaction.id,
        timestamp: new Date().toISOString(),
      };

      try {
        await axios.post(webhookUrl, payload, {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' },
        });

        logger.info(
          `Income logged via slash command: ${interaction.user.id} / ${description} / ${amount} / HTTP sent`
        );

        const embed = createEmbed({
          title: '✅ Income Logged',
          description: [`**${description}** — ₱${amount.toLocaleString()}`, `📅 ${formattedDate}`].join('\n'),
          color: 'success',
        }).setFooter({
          text: `Requested by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      } catch (error) {
        const status = error?.response?.status;
        const detail = error?.response?.data ?? error?.message ?? 'Unknown error';
        logger.error(`Failed to send income to workflow${status ? ` (${status})` : ''}:`, detail);

        throw createError(
          'Workflow error',
          ErrorTypes.EXTERNAL,
          'Could not reach the budget workflow. Please try again shortly.'
        );
      }
    },
    { command: 'income' }
  ),
};
