(function() {
  let client;
  let ticketId = "";

  function parseResponse(res) {
    const r = res && res.response;
    if (typeof r === "string") return JSON.parse(r);
    return r;
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function escapeAttr(s) {
    return String(s).replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  async function init() {
    client = await app.initialized();
    const context = await client.instance.context();
    const data = (context && context.modalData) || (context && context.data) || {};
    const raw = data.ticketId !== null && data.ticketId !== undefined ? data.ticketId : (context && context.ticketId);
    ticketId = String((raw !== null && raw !== undefined) ? raw : "");
    await loadTeams();
  }

  async function loadTeams() {
    try {
      const response = await client.request.invoke("getLinearTeams", {});
      const result = parseResponse(response);
      const teams = result.teams || [];
      const el = document.getElementById("link-team-select");
      if (el) el.options = [{ value: "", text: "All teams" }].concat(
        teams.map(function(t) { return { value: t.id, text: t.name }; })
      );
    } catch (err) {
      client.interface.trigger("showNotify", { type: "warning", message: "Could not load teams" });
    }
  }

  function renderResults(issues) {
    const container = document.getElementById("link-search-results");
    if (!container) return;
    container.innerHTML = "";
    if (!issues || issues.length === 0) {
      container.innerHTML = "<p class=\"link-results-empty\">No issues found. Try a different search or team.</p>";
      return;
    }
    issues.forEach(function(issue) {
      const row = document.createElement("div");
      row.className = "link-result-row";
      const id = issue.identifier || "";
      const title = (issue.title || "").length > 40 ? (issue.title || "").substring(0, 40) + "…" : (issue.title || "");
      const stateName = issue.stateName || "";
      row.innerHTML =
        "<span class=\"issue-badge\">" + escapeHtml(id) + "</span>" +
        "<span class=\"issue-title\">" + escapeHtml(title) + "</span>" +
        (stateName ? "<span class=\"issue-status\">" + escapeHtml(stateName) + "</span>" : "") +
        "<fw-button class=\"link-one-btn\" color=\"primary\" size=\"small\" data-identifier=\"" + escapeAttr(id) + "\">Link</fw-button>";
      container.appendChild(row);
    });
    container.querySelectorAll(".link-one-btn").forEach(function(btn) {
      btn.addEventListener("fwClick", function() {
        const identifier = btn.getAttribute("data-identifier");
        if (identifier) linkOne(identifier, btn);
      });
    });
  }

  function getErrorMessage(err) {
    if (!err) return "Failed to link issue";
    if (typeof err.message === "string" && err.message) return err.message;
    if (typeof err.status === "number" && err.message) return err.message;
    if (err.response && typeof err.response === "object" && err.response.message) return err.response.message;
    return "Failed to link issue";
  }

  function linkOne(identifier, btnEl) {
    if (!ticketId) {
      client.interface.trigger("showNotify", { type: "error", message: "Ticket context is missing. Please close and open the Link issue modal again." });
      return;
    }
    btnEl.loading = true;
    client.request.invoke("linkLinearIssue", { ticketId: ticketId, identifier: identifier })
      .then(function(response) {
        const result = parseResponse(response);
        if (result && (result.status === 400 || result.status === 500)) {
          client.interface.trigger("showNotify", { type: "error", message: result.message || "Link failed" });
          return;
        }
        if (!result || !result.linked || !result.data) {
          client.interface.trigger("showNotify", { type: "error", message: "Link failed" });
          return;
        }
        const data = result.data;
        if (data.createdAt === undefined) data.createdAt = new Date().toISOString();
        client.instance.send({ message: { action: "linked", data: data } });
        client.instance.close();
      })
      .catch(function(err) {
        const msg = getErrorMessage(err);
        client.interface.trigger("showNotify", { type: "error", message: msg });
      })
      .finally(function() {
        btnEl.loading = false;
      });
  }

  document.getElementById("link-search-btn").addEventListener("fwClick", function() {
    const teamEl = document.getElementById("link-team-select");
    const searchEl = document.getElementById("link-search-input");
    const teamId = teamEl ? (teamEl.value || "").trim() : "";
    const query = searchEl ? String(searchEl.value || "").trim() : "";
    if (!query && !teamId) {
      client.interface.trigger("showNotify", { type: "warning", message: "Enter search text or select a team" });
      return;
    }
    const btn = document.getElementById("link-search-btn");
    btn.loading = true;
    const container = document.getElementById("link-search-results");
    if (container) container.innerHTML = "<p class=\"link-results-empty\">Searching…</p>";
    client.request.invoke("searchLinearIssues", { query: query, teamId: teamId || undefined })
      .then(function(response) {
        const result = parseResponse(response);
        if (result && (result.status === 400 || result.status === 500)) {
          client.interface.trigger("showNotify", { type: "error", message: result.message || "Search failed" });
          renderResults([]);
          return;
        }
        const issues = result.issues || [];
        renderResults(issues);
      })
      .catch(function(err) {
        const msg = (err && err.message) ? err.message : "Search failed";
        client.interface.trigger("showNotify", { type: "error", message: msg });
        renderResults([]);
      })
      .finally(function() {
        btn.loading = false;
      });
  });

  document.getElementById("link-cancel-btn").addEventListener("fwClick", function() {
    client.instance.close();
  });

  init();
})();
