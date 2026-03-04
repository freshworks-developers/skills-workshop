exports = {
  onAppInstallHandler: function (args) {
    const repo = args && args.iparams ? args.iparams.default_repo : null;
    if (!repo || typeof repo !== "string" || !repo.includes("/")) {
      console.error("Invalid or missing iparam: default_repo");
      return;
    }
    console.info("github-app installed with default repo configured.");
  },

  getLinkedIssue: async function (options) {
    const ticketId = options ? options.ticketId : null;
    const key = makeTicketKey(ticketId);
    if (!key) {
      renderData(null, { linked: false });
      return;
    }

    try {
      const result = await $db.get(key);
      const stored = result && result.value ? result.value : null;
      if (!stored) {
        renderData(null, { linked: false });
        return;
      }
      renderData(null, {
        linked: true,
        issueUrl: stored.issueUrl,
        issueNumber: stored.issueNumber,
        repo: stored.repo
      });
    } catch (e) {
      renderData(null, { linked: false });
    }
  },

  createGithubIssue: async function (options) {
    const createCtx = getCreateIssueContext(options);
    if (createCtx.error) {
      renderData({ status: 400, message: createCtx.error });
      return;
    }

    try {
      const created = await createIssueOnGithub(createCtx.title, createCtx.body, createCtx.labels);
      await storeLinkedIssue(createCtx.ticketId, createCtx.repo, created);
      await maybeAddTicketNote(createCtx.iparams, options, created.html_url);

      renderData(null, {
        issueUrl: created.html_url,
        issueNumber: created.number,
        repo: createCtx.repo
      });
    } catch (e) {
      console.error("createGithubIssue failed:", errorMessage(e));
      renderData({ status: 500, message: "Failed to create GitHub issue." });
    }
  },

  linkExistingIssue: async function (options) {
    const linkCtx = getLinkIssueContext(options);
    if (linkCtx.error) {
      renderData({ status: 400, message: linkCtx.error });
      return;
    }

    try {
      const response = await $request.invokeTemplate("githubGetIssue", {
        context: { issue_number: String(linkCtx.issueNumber) }
      });
      const issue = safeJsonParse(getResponseString(response));
      if (!isGithubIssue(issue)) {
        renderData({ status: 404, message: "Issue not found in the configured repo." });
        return;
      }

      await storeLinkedIssue(linkCtx.ticketId, linkCtx.repo, issue);
      await maybeAddTicketNote(linkCtx.iparams, options, issue.html_url);

      renderData(null, {
        issueUrl: issue.html_url,
        issueNumber: issue.number,
        repo: linkCtx.repo
      });
    } catch (e) {
      console.error("linkExistingIssue failed:", errorMessage(e));
      renderData({ status: 500, message: "Failed to link GitHub issue." });
    }
  },

  unlinkIssue: async function (options) {
    const ticketId = options ? options.ticketId : null;
    const key = makeTicketKey(ticketId);
    if (!key) {
      renderData({ status: 400, message: "Invalid ticketId." });
      return;
    }

    try {
      await $db.delete(key);
      renderData(null, { deleted: true });
    } catch (e) {
      renderData({ status: 500, message: "Failed to unlink issue." });
    }
  }
};

function makeTicketKey(ticketId) {
  const id = safePositiveInt(ticketId);
  if (!id) return null;
  return `ticket:${id}`;
}

function safePositiveInt(value) {
  const n = Number.parseInt(String(value || "").trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseLabels(labelsCsv) {
  if (!labelsCsv || typeof labelsCsv !== "string") return [];
  return labelsCsv
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 20);
}

function validateCreateOptions(options) {
  if (!options) return "Missing request payload.";
  if (!safePositiveInt(options.ticketId)) return "Invalid ticketId.";
  if (!options.ticketSubject || typeof options.ticketSubject !== "string") return "Invalid ticketSubject.";
  if (typeof options.ticketDescription !== "string") return "Invalid ticketDescription.";
  return null;
}

function buildGithubIssueBody(options) {
  const requesterLine = formatRequesterLine(options);
  const ticketLinkLine = formatTicketLinkLine(options);
  const description = formatDescriptionBlock(options);

  return ["### Ticket", `- Requester: ${requesterLine}`, ticketLinkLine, "", "### Description", description]
    .filter((s) => s !== null)
    .join("\n");
}

async function maybeAddTicketNote(iparams, options, issueUrl) {
  if (!iparams) return;
  if (!iparams.store_in_ticket_note) return;
  if (!iparams.freshdesk_api_key) return;

  const noteCtx = getFreshdeskNoteContext(options);
  if (!noteCtx) return;

  const noteBody = {
    body: `Linked GitHub issue: ${issueUrl}`,
    private: true
  };

  try {
    await $request.invokeTemplate("freshdeskCreateNote", {
      context: { freshdesk_domain: noteCtx.domain, ticket_id: String(noteCtx.ticketId) },
      body: JSON.stringify(noteBody)
    });
  } catch (e) {
    console.error("freshdesk note failed:", errorMessage(e));
  }
}

function safeJsonParse(maybeJson) {
  if (!maybeJson || typeof maybeJson !== "string") return null;
  try {
    return JSON.parse(maybeJson);
  } catch (e) {
    return null;
  }
}

function getIparamsFromOptions(options) {
  if (!options) return {};
  return options.iparams || {};
}

function requireDefaultRepo(iparams) {
  const repo = iparams ? iparams.default_repo : null;
  if (!repo || typeof repo !== "string") return null;
  const trimmed = repo.trim();
  if (!trimmed.includes("/")) return null;
  return trimmed;
}

function getCreateIssueContext(options) {
  const validationError = validateCreateOptions(options);
  if (validationError) return { error: validationError };

  const iparams = getIparamsFromOptions(options);
  const repo = requireDefaultRepo(iparams);
  if (!repo) return { error: "Missing or invalid iparam: default_repo" };

  return {
    ticketId: safePositiveInt(options.ticketId),
    title: String(options.ticketSubject).trim(),
    body: buildGithubIssueBody(options),
    labels: parseLabels(iparams.labels),
    iparams,
    repo
  };
}

function getLinkIssueContext(options) {
  const ticketId = options ? safePositiveInt(options.ticketId) : null;
  if (!ticketId) return { error: "Invalid ticketId." };

  const issueNumber = options ? safePositiveInt(options.issueNumber) : null;
  if (!issueNumber) return { error: "Invalid issueNumber." };

  const iparams = getIparamsFromOptions(options);
  const repo = requireDefaultRepo(iparams);
  if (!repo) return { error: "Missing or invalid iparam: default_repo" };

  return { ticketId, issueNumber, iparams, repo };
}

async function createIssueOnGithub(title, body, labels) {
  const reqBody = { title, body };
  if (labels && labels.length > 0) reqBody.labels = labels;

  const response = await $request.invokeTemplate("githubCreateIssue", {
    body: JSON.stringify(reqBody)
  });

  const created = safeJsonParse(getResponseString(response));
  if (!created || !created.html_url || !created.number) {
    throw new Error("GitHub API returned an unexpected response.");
  }

  return created;
}

async function storeLinkedIssue(ticketId, repo, issue) {
  const ticketKey = makeTicketKey(ticketId);
  await $db.set(ticketKey, {
    issueUrl: issue.html_url,
    issueNumber: issue.number,
    repo: repo,
    updatedAt: Date.now()
  });
}

function formatRequesterLine(options) {
  const parts = [];
  if (options && options.requesterName) parts.push(String(options.requesterName));
  if (options && options.requesterEmail) parts.push(`<${String(options.requesterEmail)}>`);
  if (parts.length === 0) return "Unknown requester";
  return parts.join(" ");
}

function formatTicketLinkLine(options) {
  const url = options && options.ticketUrl ? String(options.ticketUrl) : null;
  if (!url) return null;
  return `- Link: ${url}`;
}

function formatDescriptionBlock(options) {
  const raw = options && typeof options.ticketDescription === "string" ? options.ticketDescription : "";
  const trimmed = String(raw).trim();
  return trimmed.length ? trimmed : "(No description)";
}

function getFreshdeskNoteContext(options) {
  if (!options) return null;
  const ticketId = safePositiveInt(options.ticketId);
  if (!ticketId) return null;
  const domain = options.freshdesk_domain ? String(options.freshdesk_domain) : null;
  if (!domain) return null;
  return { ticketId, domain };
}

function getResponseString(response) {
  if (!response) return null;
  return response.response || null;
}

function isGithubIssue(issue) {
  if (!issue) return false;
  if (!issue.html_url) return false;
  if (!issue.number) return false;
  return true;
}

function errorMessage(e) {
  if (!e) return "unknown_error";
  if (!e.message) return "unknown_error";
  return String(e.message);
}

