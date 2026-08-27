import axios from 'axios';
import { logger } from '../utils/logger.js';

const BUDGET_COMMAND_RE = /^!(expense|income)\b/i;

function getConfig() {
  return {
    webhookUrl: process.env.N8N_BUDGET_WEBHOOK_URL?.trim() || '',
    allowedUserIds: (process.env.BUDGET_ALLOWED_USER_IDS || process.env.BUDGET_ALLOWED_USER_ID || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
    expenseChannelId: process.env.BUDGET_CHANNEL_ID?.trim() || '',
    allowDMs: String(process.env.BUDGET_ALLOW_DMS ?? 'true').toLowerCase() !== 'false',
  };
}

/**
 * Forwards only !expense / !income messages to n8n.
 * Returns true when the message belongs to the budget feature so the normal
 * command/leveling pipeline can stop. Returns false for all unrelated messages.
 */
export async function handleN8nBudgetTrigger(message) {
  const content = message.content?.trim() || '';

  // Leave every unrelated command/message completely untouched.
  if (!BUDGET_COMMAND_RE.test(content)) {
    return false;
  }

  const config = getConfig();
  const isDM = !message.guildId;

  // Optional user restriction. Leave BUDGET_ALLOWED_USER_IDS unset/blank to allow everyone.
  if (config.allowedUserIds.length > 0 && !config.allowedUserIds.includes(message.author.id)) {
    logger.warn(`Blocked budget command from unauthorized user ${message.author.id}`);
    await message.reply('⚠️ You are not allowed to use the budget workflow.').catch(() => {});
    return true;
  }

  // DMs can be enabled/disabled independently.
  if (isDM && !config.allowDMs) {
    return true;
  }

  // If BUDGET_CHANNEL_ID is configured, restrict server use to that channel.
  // If it is blank, allow budget commands from any server channel.
  if (!isDM && config.expenseChannelId && message.channelId !== config.expenseChannelId) {
    logger.debug(`Budget command ignored outside configured channel: ${message.channelId}`);
    return false;
  }

  if (!config.webhookUrl) {
    logger.error('N8N_BUDGET_WEBHOOK_URL is not configured');
    await message.reply('⚠️ The budget workflow is not configured yet.').catch(() => {});
    return true;
  }

  const payload = {
    event_type: 'message_create',
    content: {
      text: content,
    },
    author: {
      id: message.author.id,
      username: message.author.username,
    },
    channel: {
      id: message.channelId,
      name: message.channel?.name ?? null,
    },
    guild: message.guild
      ? {
          id: message.guild.id,
          name: message.guild.name,
        }
      : null,
    message_id: message.id,
    timestamp: message.createdAt.toISOString(),
    is_dm: isDM,
  };

  try {
    const response = await axios.post(config.webhookUrl, payload, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    logger.info(
      `Budget command forwarded to n8n: ${message.author.id} / ${isDM ? 'DM' : message.channelId} / HTTP ${response.status}`,
    );

    // Immediate visual acknowledgement that SpooderMan reached n8n.
    await message.react('✅').catch(() => {});
  } catch (error) {
    const status = error?.response?.status;
    const detail = error?.response?.data ?? error?.message ?? 'Unknown error';
    logger.error(`Failed to forward budget command to n8n${status ? ` (${status})` : ''}:`, detail);

    await message.reply('⚠️ I could not reach the budget workflow. Please try again shortly.').catch(() => {});
  }

  return true;
}
