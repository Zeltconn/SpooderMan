# SpooderMan n8n Budget Trigger Setup

This patch adds an isolated personal-budget trigger without replacing the bot's existing command system.

## Commands handled

- `!expense <description> <amount> [date]`
- `!income <description> <amount> [date]`

Examples:

- `!expense Coffee 180`
- `!expense Grab 350 yesterday`
- `!income Salary 60000`

All other existing SpooderMan commands continue through the original command pipeline.

## Hosting environment variables

Add these to the same hosting service where the Discord bot is already running:

```env
N8N_BUDGET_WEBHOOK_URL=https://YOUR-N8N-DOMAIN/webhook/discord-budget
BUDGET_ALLOWED_USER_ID=YOUR_DISCORD_USER_ID
BUDGET_CHANNEL_ID=YOUR_EXPENSE_CHANNEL_ID
BUDGET_ALLOW_DMS=true
```

Do not put the Discord bot token in GitHub. Keep `DISCORD_TOKEN` in the hosting provider's secret/environment-variable settings.

## Discord Developer Portal

Under Bot -> Privileged Gateway Intents, enable Message Content Intent.

The bot already requests Guild Messages, Direct Messages, and Message Content intents. This patch adds `Partials.Channel` so direct messages can be received reliably.

## n8n

Import/use the supplied budget workflow whose Webhook path is:

`/webhook/discord-budget`

Activate the workflow and copy the Production URL into `N8N_BUDGET_WEBHOOK_URL`.

The bot sends this shape to n8n:

```json
{
  "event_type": "message_create",
  "content": { "text": "!expense Coffee 180" },
  "author": { "id": "...", "username": "..." },
  "channel": { "id": "...", "name": "..." },
  "guild": { "id": "...", "name": "..." },
  "message_id": "...",
  "timestamp": "...",
  "is_dm": false
}
```

## Files changed

- `src/services/n8nBudgetTrigger.js` — NEW; all n8n forwarding logic is isolated here.
- `src/events/messageCreate.js` — small hook added before the existing guild command pipeline.
- `src/app.js` — adds `Partials.Channel` for Discord DMs.
- `.env.example` — documents the four new environment variables.

## Deploy

Commit/push these changes to your GitHub repository and redeploy/restart your existing hosting service. No new npm dependency is required: the project already includes `axios`.
