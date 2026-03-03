# Ticket Export (Markdown)

Exports ticket details as Markdown for pasting into docs, with optional webhook storage.

## Features

- **One-click copy** – Copy ticket details in Markdown to clipboard
- **Preview** – See the Markdown output in the sidebar
- **Optional webhook** – Send exports to a webhook URL (Zapier, Make, etc.)

## Installation

1. Install the app from the Freshworks Marketplace or via FDK.
2. (Optional) Configure **Webhook URL** in App settings to enable Send to webhook.

## Usage

1. Open a ticket in Freshdesk.
2. In the sidebar, use **Copy to clipboard** to paste into docs/notes.
3. Use **Send to webhook** (requires configured URL) to store externally.

## Webhook Payload

When webhook URL is configured, the app sends a POST request with:

```json
{
  "markdown": "# Ticket #123: ...",
  "ticketId": 123,
  "exportedAt": "2025-03-03T12:00:00.000Z"
}
```

## Platform

- Freshworks Platform 3.0
- Freshdesk (support_ticket module)
