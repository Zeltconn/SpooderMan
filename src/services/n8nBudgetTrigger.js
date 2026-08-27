/**
 * DEPRECATED — budget commands are now handled by slash commands:
 *   /expense  → src/commands/Budget/expense.js
 *   /income   → src/commands/Budget/income.js
 *
 * Those commands forward directly to the n8n webhook.
 * This file is kept only to avoid breaking any lingering imports.
 */

export async function handleN8nBudgetTrigger(_message) {
  return false;
}
