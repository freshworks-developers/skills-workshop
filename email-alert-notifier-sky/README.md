# Email Alert Notifier (Resend)

Sends email alerts via [Resend](https://resend.com) when tickets are created or escalated in Freshdesk or Freshservice.

## Features

- Alerts on new ticket creation (filtered by priority)
- Alerts on ticket escalation (priority increase or SLA escalation)
- Configurable recipient list, subject prefix, and priority filter
- Works with both **Freshdesk** and **Freshservice**

## Prerequisites

1. A [Resend](https://resend.com) account (free tier: 3,000 emails/month)
2. A verified sender domain or email in Resend
3. A Resend API key from [resend.com/api-keys](https://resend.com/api-keys)

## Installation Parameters

| Parameter | Description |
|-----------|-------------|
| **Resend API Key** | Your Resend API key (stored securely) |
| **From Email** | Verified sender email address in Resend |
| **Recipient Emails** | Comma-separated list of alert recipients |
| **Email Subject Prefix** | Custom prefix for subjects (default: `[Ticket Alert]`) |
| **Priority Filter** | Which priorities trigger alerts: `all`, `high_and_urgent`, `high`, `urgent` |

## How It Works

- **New Tickets**: When a ticket is created matching the priority filter, an email is sent to all recipients.
- **Escalated Tickets**: When a ticket's priority is raised or it becomes SLA-escalated, an email is sent.

## Local Development

```bash
cd email-alert-notifier
fdk run
```

Test with the Freshworks product at `https://<domain>.freshdesk.com?dev=true` or `https://<domain>.freshservice.com?dev=true`.
