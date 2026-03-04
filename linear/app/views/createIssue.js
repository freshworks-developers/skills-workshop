(function() {
  let client;
  let modalData = {};

  function parseResponse(res) {
    const r = res && res.response;
    if (typeof r === "string") return JSON.parse(r);
    return r;
  }

  async function init() {
    client = await app.initialized();
    const context = await client.instance.context();
    modalData = (context && context.modalData) || {};
    await loadTeams();
    await loadProjects();
  }

  async function loadTeams() {
    try {
      const response = await client.request.invoke("getLinearTeams", {});
      const result = parseResponse(response);
      const teams = result.teams || [];
      const el = document.getElementById("team-select");
      if (el) el.options = teams.map(function(t) { return { value: t.id, text: t.name }; });
    } catch (err) {
      client.interface.trigger("showNotify", { type: "warning", message: "Could not load teams" });
    }
  }

  async function loadProjects() {
    try {
      const response = await client.request.invoke("getLinearProjects", {});
      const result = parseResponse(response);
      const projects = result.projects || [];
      const el = document.getElementById("project-select");
      if (el) el.options = [{ value: "", text: "None" }].concat(
        projects.map(function(p) { return { value: p.id, text: p.name }; })
      );
    } catch (err) {
      client.interface.trigger("showNotify", { type: "warning", message: "Could not load projects" });
    }
  }

  document.getElementById("create-submit-btn").addEventListener("fwClick", function() {
    const title = document.getElementById("issue-title").value;
    const teamId = document.getElementById("team-select").value;
    if (!title || !teamId) {
      client.interface.trigger("showNotify", { type: "error", message: "Title and team are required" });
      return;
    }
    const btn = document.getElementById("create-submit-btn");
    btn.loading = true;
    const description = document.getElementById("issue-description").value || "";
    const projectId = document.getElementById("project-select").value;
    const payload = {
      ticketId: String(modalData.ticketId || ""),
      teamId: teamId,
      title: title,
      description: description
    };
    if (projectId) payload.projectId = projectId;
    client.request.invoke("createLinearIssue", payload).then(function(response) {
      const result = parseResponse(response);
      if (result && (result.status === 400 || result.status === 500)) {
        client.interface.trigger("showNotify", { type: "error", message: result.message || "Create failed" });
        return;
      }
      if (!result || !result.issue) {
        client.interface.trigger("showNotify", { type: "error", message: "Create failed" });
        return;
      }
      const data = {
        identifier: result.issue.identifier,
        title: result.issue.title,
        url: result.issue.url,
        stateName: result.issue.stateName || null,
        createdAt: new Date().toISOString()
      };
      client.instance.send({ message: { action: "linked", data: data } });
      client.instance.close();
    }).catch(function(err) {
      const msg = (err && err.message) ? err.message : "Failed to create issue";
      client.interface.trigger("showNotify", { type: "error", message: msg });
    }).finally(function() {
      btn.loading = false;
    });
  });

  document.getElementById("create-cancel-btn").addEventListener("fwClick", function() {
    client.instance.close();
  });

  init();
})();
