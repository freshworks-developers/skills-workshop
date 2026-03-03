# Linear Issue Creator for Freshdesk

A Freshworks Platform 3.0 app that lets agents create and link Linear issues from Freshdesk tickets. The app runs in the ticket sidebar and uses modals for creating and linking issues.

## Features

- **Create issue** — Open a modal to create a new Linear issue with title, description, team (required), and optional project. The new issue is automatically linked to the current ticket.
- **Link existing issue** — Search Linear issues by title and optional team, then link one or more issues to the ticket.
- **Multiple links** — Each ticket can have multiple Linear issues linked. The sidebar lists them with identifier, truncated title, and status.
- **Unlink** — Remove a linked issue from a ticket without affecting the issue in Linear.
- **Open in Linear** — Open any linked issue in Linear in a new tab.

## Requirements

- Freshdesk account with support for custom apps (ticket sidebar).
- Linear workspace and a **Personal API key** (Linear → Settings → API).

## Setup

### Installation parameters

| Parameter        | Description                                                                 |
|------------------|-----------------------------------------------------------------------------|
| **Linear API Key** | Personal API key from Linear (Settings → Security & Access → API). Required. |

### Run locally

```bash
cd linear
fdk run
```

1. In the browser, open the URL shown by FDK (e.g. `http://localhost:10001/custom_configs`) and set **Linear API Key**.
2. Open a Freshdesk ticket with `?dev=true` in the URL.
3. The app appears in the ticket sidebar. Use **Create** or **Link issue** to create or link Linear issues.

### Validate

```bash
fdk validate
```

## Project structure

```
linear/
├── app/
│   ├── index.html              # Sidebar: loading / linked list / no-link actions
│   ├── scripts/
│   │   └── app.js              # Sidebar logic, modals, linked-issues list
│   ├── styles/
│   │   └── style.css           # Sidebar and modal styles
│   └── views/
│       ├── createIssue.html    # Create-issue modal template
│       ├── createIssue.js      # Create form, teams/projects, submit
│       ├── linkIssue.html      # Link-issue modal (search + team)
│       └── linkIssue.js        # Search, results, link-one
├── config/
│   ├── iparams.json            # linear_api_key (required, secure)
│   └── requests.json           # linearGraphQL request template
├── server/
│   └── server.js               # SMI: teams, projects, create, get/link/unlink, search
├── manifest.json               # Platform 3.0, support_ticket sidebar
└── README.md
```

## Backend (SMI)

- **getLinearTeams** / **getLinearProjects** — List teams and projects for dropdowns.
- **createLinearIssue** — Create issue in Linear and store link for the ticket.
- **getLinkedIssue** — Return all issues linked to a ticket.
- **searchLinearIssues** — Search issues by title and optional team ID.
- **linkLinearIssue** — Link an existing issue (by identifier) to a ticket.
- **unlinkLinearIssue** — Remove a link for one issue from a ticket.

Storage uses the Key-Value Store under keys `ticket:{ticketId}` with payload `{ issues: [{ issueId, identifier, url, title, stateName, createdAt }, ...] }`.

## License

Use and modify as needed for your organization.
