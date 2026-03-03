exports = {
  getLinearTeams: async function() {
    const fallback = "Failed to fetch teams";
    const result = await queryLinearAndRender("{ teams { nodes { id name } } }", "teams", "nodes", fallback);
    if (result) { renderData(null, { teams: result }); }
  },

  getLinearProjects: async function() {
    const fallback = "Failed to fetch projects";
    const result = await queryLinearAndRender("{ projects(first: 100) { nodes { id name } } }", "projects", "nodes", fallback);
    if (result) { renderData(null, { projects: result }); }
  },

  createLinearIssue: async function(options) {
    if (!options.teamId || !options.title) {
      renderData({ status: 400, message: "Team ID and title are required" });
      return;
    }
    try {
      const result = await executeCreateIssue(options);
      renderData(null, result);
    } catch (error) {
      renderData({ status: 500, message: error.message });
    }
  },

  getLinkedIssue: async function(options) {
    if (!options.ticketId) {
      renderData({ status: 400, message: "Ticket ID is required" });
      return;
    }
    try {
      const raw = await $db.get("ticket:" + options.ticketId);
      const issues = normalizeToIssuesArray(raw);
      renderData(null, { linked: true, data: { issues: issues } });
    } catch (error) {
      renderData(null, { linked: false, data: { issues: [] } });
    }
  },

  searchLinearIssues: async function(options) {
    try {
      const query = String(options.query || "").trim();
      const teamId = options.teamId ? String(options.teamId).trim() : null;
      const issues = await searchIssuesInLinear({ query: query, teamId: teamId });
      renderData(null, { issues: issues });
    } catch (error) {
      renderData({ status: 500, message: (error && error.message) ? error.message : "Search failed" });
    }
  },

  linkLinearIssue: async function(options) {
    if (!options.ticketId || !options.identifier) {
      renderData({ status: 400, message: "Ticket ID and issue identifier are required" });
      return;
    }
    try {
      const issue = await fetchIssueByIdentifier(options.identifier);
      if (!issue) {
        renderData({ status: 404, message: "Issue not found" });
        return;
      }
      await appendIssueMapping(options.ticketId, issue);
      renderData(null, { linked: true, data: issue });
    } catch (error) {
      renderData({ status: 500, message: error.message });
    }
  },

  unlinkLinearIssue: async function(options) {
    if (!options.ticketId || !options.identifier) {
      renderData({ status: 400, message: "Ticket ID and issue identifier are required" });
      return;
    }
    try {
      await removeIssueMapping(options.ticketId, options.identifier);
      renderData(null, { success: true });
    } catch (error) {
      renderData({ status: 500, message: error.message });
    }
  },

  onAppInstallHandler: async function() {
    try {
      await validateLinearApiKey();
    } catch (error) {
      console.error("Installation validation failed");
      throw error;
    }
  }
};

function normalizeToIssuesArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw.issues)) return raw.issues;
  if (raw.identifier || raw.issueId) return [raw];
  return [];
}

async function removeIssueMapping(ticketId, identifier) {
  const key = "ticket:" + ticketId;
  let raw;
  try {
    raw = await $db.get(key);
  } catch (e) {
    return;
  }
  const issues = normalizeToIssuesArray(raw).filter(function(issue) {
    return issue.identifier !== identifier && (issue.issueId || issue.id) !== identifier;
  });
  if (issues.length === 0) {
    await $db.delete(key);
    return;
  }
  await $db.set(key, { issues: issues });
}

async function appendIssueMapping(ticketId, issue) {
  const key = "ticket:" + ticketId;
  const payload = {
    issueId: issue.id || issue.issueId,
    identifier: issue.identifier,
    url: issue.url,
    title: issue.title,
    stateName: issue.stateName || (issue.state && issue.state.name) || null,
    createdAt: issue.createdAt || new Date().toISOString()
  };
  let existing;
  try {
    existing = await $db.get(key);
  } catch (e) {
    await $db.set(key, { issues: [payload] });
    return;
  }
  const issues = normalizeToIssuesArray(existing);
  issues.push(payload);
  await $db.set(key, { issues: issues });
}

function getLinearError(data) {
  if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors.map(function(e) { return e.message || String(e); }).join("; ");
  }
  return null;
}

function extractNodes(data, rootKey, nodesKey) {
  const root = data.data && data.data[rootKey];
  return (root && root[nodesKey]) ? root[nodesKey] : [];
}

async function queryLinearAndRender(query, rootKey, nodesKey, fallbackMsg) {
  try {
    const response = await $request.invokeTemplate("linearGraphQL", {
      body: JSON.stringify({ query: query })
    });
    const data = JSON.parse(response.response);
    const errMsg = getLinearError(data);
    if (errMsg) {
      renderData({ status: 500, message: errMsg });
      return null;
    }
    return extractNodes(data, rootKey, nodesKey);
  } catch (error) {
    const msg = (error && error.message) ? error.message : fallbackMsg;
    renderData({ status: 500, message: msg });
    return null;
  }
}

async function validateLinearApiKey() {
  const response = await $request.invokeTemplate("linearGraphQL", {
    body: JSON.stringify({ query: "{ viewer { id name } }" })
  });
  const data = JSON.parse(response.response);
  if (data.errors) {
    throw new Error("Invalid Linear API key");
  }
  return data;
}

async function searchIssuesInLinear(opts) {
  const teamId = opts.teamId ? String(opts.teamId).trim() : null;
  const queryStr = (opts.query || "").trim();
  const filter = {};
  if (teamId) filter.team = { id: { eq: teamId } };
  if (queryStr.length > 0) filter.title = { containsIgnoreCase: queryStr };
  if (Object.keys(filter).length === 0) return [];
  const gqlQuery = "query SearchIssues($filter: IssueFilter) { issues(first: 25, filter: $filter) { nodes { id identifier url title state { name } } } }";
  const response = await $request.invokeTemplate("linearGraphQL", {
    body: JSON.stringify({ query: gqlQuery, variables: { filter: filter } })
  });
  const data = JSON.parse(response.response);
  if (getLinearError(data)) throw new Error(getLinearError(data));
  const nodes = extractNodes(data, "issues", "nodes");
  return (nodes || []).map(function(issue) {
    const stateName = (issue.state && issue.state.name) || null;
    return {
      issueId: issue.id,
      identifier: issue.identifier,
      url: issue.url,
      title: issue.title || "",
      stateName: stateName
    };
  });
}

async function fetchIssueByIdentifier(identifier) {
  const id = String(identifier).trim();
  const query = 'query GetIssue($id: String!) { issue(id: $id) { id identifier url title state { name } } }';
  const response = await $request.invokeTemplate("linearGraphQL", {
    body: JSON.stringify({ query: query, variables: { id: id } })
  });
  const data = JSON.parse(response.response);
  if (getLinearError(data)) return null;
  const issue = data.data && data.data.issue;
  if (!issue) return null;
  const stateName = (issue.state && issue.state.name) || null;
  return {
    issueId: issue.id,
    identifier: issue.identifier,
    url: issue.url,
    title: issue.title,
    stateName: stateName,
    createdAt: new Date().toISOString()
  };
}

async function executeCreateIssue(options) {
  const input = buildIssueInput(options);
  const query = 'mutation IssueCreate($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url title state { name } } } }';
  const response = await $request.invokeTemplate("linearGraphQL", {
    body: JSON.stringify({ query: query, variables: { input: input } })
  });
  const data = JSON.parse(response.response);
  if (!data.data || !data.data.issueCreate || !data.data.issueCreate.success) {
    const msg = extractErrorMessage(data);
    throw new Error(msg);
  }
  const issue = data.data.issueCreate.issue;
  const stateName = (issue.state && issue.state.name) || null;
  if (options.ticketId) {
    const payload = {
      issueId: issue.id,
      identifier: issue.identifier,
      url: issue.url,
      title: issue.title,
      stateName: stateName,
      createdAt: new Date().toISOString()
    };
    await appendIssueMapping(options.ticketId, payload);
  }
  return { issue: Object.assign({}, issue, { stateName: stateName }) };
}

function buildIssueInput(options) {
  const input = { teamId: options.teamId, title: options.title };
  if (options.description) { input.description = options.description; }
  if (options.projectId) { input.projectId = options.projectId; }
  return input;
}

function extractErrorMessage(data) {
  if (data.errors && data.errors.length > 0) {
    return data.errors.map(function(e) { return e.message; }).join(", ");
  }
  return "Issue creation failed";
}
