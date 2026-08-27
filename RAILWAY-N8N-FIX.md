# SpooderMan Railway + n8n Fix

## What was fixed
- `!expense` and `!income` now reach n8n even when `BUDGET_CHANNEL_ID` is not set.
- If `BUDGET_CHANNEL_ID` is set, those commands only trigger in that exact channel.
- Successful forwarding reacts to the Discord message with ✅.
- `BUDGET_ALLOWED_USER_IDS` supports comma-separated IDs; leave blank/unset to allow everyone.
- `!help`, `!play`, `!queue`, and `!shop` are enabled as prefix commands.
- Advanced configuration/dashboard commands remain slash-only because they depend on interaction-only UI flows.

## Railway variables
Required:
- `N8N_BUDGET_WEBHOOK_URL=https://YOUR-N8N/webhook/discord-budget`

Optional:
- `BUDGET_CHANNEL_ID=...` — blank/unset means any server channel
- `BUDGET_ALLOWED_USER_IDS=111,222` — blank/unset means everyone
- `BUDGET_ALLOW_DMS=true`

## Deploy
1. Push these files to the GitHub repository connected to Railway.
2. Railway -> SpooderMan -> Variables: add/update the values above.
3. Railway -> Deployments: deploy the latest commit/restart.
4. n8n: activate the workflow and use its Production webhook URL.

## Tests
- `!help` -> should show the help UI
- `!ping` -> should work as before
- `!play <song>` -> should invoke music play
- `!expense Coffee 180` -> should get a ✅ reaction when n8n accepts the webhook
- `!income Salary 60000` -> should get a ✅ reaction when n8n accepts the webhook

If `!expense` replies with an n8n connection error, inspect Railway logs and verify the webhook is the Production URL (`/webhook/...`), not the Test URL (`/webhook-test/...`).
