# github-app (Freshdesk)

Create and link GitHub issues from Freshdesk tickets.

## What it does
- Ticket sidebar button: **Create GitHub Issue**
- Creates a GitHub issue with:
  - **Title**: ticket subject
  - **Body**: ticket description + requester details + ticket link
- Shows the created/linked issue URL + number in the sidebar
- Optional: link an existing issue by number
- Optional: store the issue link in a **private ticket note** (requires Freshdesk API key)

## Configure GitHub OAuth
1. Create a GitHub OAuth App.
2. Set the callback URL:
   - Local testing: `http://localhost:10001/auth/callback`
   - Production: `https://oauth.freshdev.io/auth/callback`
3. During app installation, provide **Client ID** and **Client Secret** when prompted.

## Installation parameters (iparams)
- `default_repo` (required): `org/repo`
- `labels` (optional): comma-separated labels (e.g. `bug, customer`)
- `store_in_ticket_note` (optional): add a private note with the issue link
- `freshdesk_api_key` (optional, secure): required only if `store_in_ticket_note` is enabled.
  - Enter as `APIKEY:X` (this is what Freshdesk expects for Basic auth; the request template Base64-encodes it).

## Local dev
```bash
cd github-app
fdk validate
fdk run
```

Then open Freshdesk with `?dev=true` so it loads the local app.

