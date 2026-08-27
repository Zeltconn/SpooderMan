import axios from 'axios';
import { logger } from '../utils/logger.js';

const BUDGET_COMMAND_RE = /^!(expense|income)\b/i;

function getConfig() {
  return {
    webhookUrl: process.env.N8N_BUDGET_WEBHOOK_URL?.trim() || '',
    allowedUserId: process.env.BUDGET_ALLOWED_USER_ID?.trim() || '',
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

  // Optional owner restriction. Recommended for a personal finance workflow.
  if (config.allowedUserId && message.author.id !== config.allowedUserId) {
    logger.warn(`Blocked budget command from unauthorized user ${message.author.id}`);
    return true;
  }

  // DMs can be enabled/disabled independently.
  if (isDM && !config.allowDMs) {
    return true;
  }

  // In servers, only the configured budget channel can trigger the workflow.
  // If BUDGET_CHANNEL_ID is blank, server-based budget commands are disabled.
  if (!isDM && (!config.expenseChannelId || message.channelId !== config.expenseChannelId)) {
    return true;
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
    await axios.post(config.webhookUrl, payload, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    logger.info(
      `Budget command forwarded to n8n: ${message.author.id} / ${isDM ? 'DM' : message.channelId}`,
    );
  } catch (error) {
    const status = error?.response?.status;
    const detail = error?.response?.data ?? error?.message ?? 'Unknown error';
    logger.error(`Failed to forward budget command to n8n${status ? ` (${status})` : ''}:`, detail);

    await message.reply('⚠️ I could not reach the budget workflow. Please try again shortly.').catch(() => {});
  }

  return true;
}
