(async function () {
  let client;
  let ticketData;
  let linkedIssues = [];

  function parseResponse(res) {
    const r = res && res.response;
    if (typeof r === "string") return JSON.parse(r);
    return r;
  }

  try {
    client = await app.initialized();
    const tData = await client.data.get("ticket");
    ticketData = tData && tData.ticket;
    client.instance.receive(function(event) {
      const payload = event.helper.getData();
      const msg = payload && payload.message;
      if (msg && msg.action === "linked" && msg.data) {
        showNotify("success", msg.data.identifier ? "Linked " + msg.data.identifier : "Done");
        refreshLinkedIssues();
      }
    });
    requestAnimationFrame(function() {
      checkLinkedIssue();
    });
  } catch (err) {
    showNotify("error", "Failed to initialize app");
  }

  function getIssuesFromResult(result) {
    if (!result) return [];
    if (Array.isArray(result.data && result.data.issues)) return result.data.issues;
    if (Array.isArray(result.issues)) return result.issues;
    return [];
  }

  async function checkLinkedIssue() {
    if (!ticketData || ticketData.id === null || ticketData.id === undefined) {
      showNoLinkSection();
      return;
    }
    showSection("loading-section");
    try {
      const response = await client.request.invoke("getLinkedIssue", {
        ticketId: String(ticketData.id),
      });
      const result = parseResponse(response);
      const issues = getIssuesFromResult(result);
      if (issues.length > 0) {
        linkedIssues = issues;
        renderLinkedIssuesList();
        showSection("linked-section");
      } else {
        showNoLinkSection();
      }
    } catch (err) {
      showNoLinkSection();
    }
  }

  async function refreshLinkedIssues() {
    if (!ticketData || ticketData.id === null || ticketData.id === undefined) return;
    try {
      const response = await client.request.invoke("getLinkedIssue", {
        ticketId: String(ticketData.id),
      });
      const result = parseResponse(response);
      const issues = getIssuesFromResult(result);
      linkedIssues = issues;
      renderLinkedIssuesList();
      showSection(issues.length > 0 ? "linked-section" : "no-link-section");
    } catch (err) {
      linkedIssues = [];
      renderLinkedIssuesList();
      showSection("no-link-section");
    }
  }

  function showNoLinkSection() {
    showSection("no-link-section");
  }

  const TITLE_MAX_LEN = 32;

  function renderLinkedIssuesList() {
    const listEl = document.getElementById("linked-issues-list");
    if (!listEl) return;
    listEl.innerHTML = "";
    linkedIssues.forEach(function(issue) {
      const row = document.createElement("div");
      row.className = "linked-issue-row";
      const id = issue.identifier || "";
      const rawTitle = issue.title || "";
      const title = rawTitle.length > TITLE_MAX_LEN ? rawTitle.substring(0, TITLE_MAX_LEN) + "…" : rawTitle;
      const stateName = issue.stateName || "";
      const statusHtml = stateName ? "<span class=\"issue-status\">" + escapeHtml(stateName) + "</span>" : "";
      row.innerHTML =
        "<span class=\"issue-badge\">" + escapeHtml(id) + "</span> " +
        statusHtml +
        "<span class=\"issue-title\" title=\"" + escapeAttr(rawTitle) + "\">" + escapeHtml(title) + "</span>" +
        "<div class=\"issue-row-actions\">" +
        "<fw-button class=\"open-issue-btn\" color=\"link\" size=\"small\" data-url=\"" + escapeAttr(issue.url || "") + "\">Open</fw-button>" +
        "<fw-button class=\"unlink-issue-btn\" color=\"danger\" size=\"small\" data-identifier=\"" + escapeAttr(id) + "\">Unlink</fw-button>" +
        "</div>";
      listEl.appendChild(row);
    });
    listEl.querySelectorAll(".open-issue-btn").forEach(function(btn) {
      btn.addEventListener("fwClick", function() {
        const url = btn.getAttribute("data-url");
        if (url) window.open(url, "_blank");
      });
    });
    listEl.querySelectorAll(".unlink-issue-btn").forEach(function(btn) {
      btn.addEventListener("fwClick", function() {
        const identifier = btn.getAttribute("data-identifier");
        if (identifier) unlinkIssue(identifier);
      });
    });
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function escapeAttr(s) {
    return String(s).replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  async function unlinkIssue(identifier) {
    try {
      await client.request.invoke("unlinkLinearIssue", {
        ticketId: String(ticketData.id),
        identifier: identifier,
      });
      linkedIssues = linkedIssues.filter(function(i) { return i.identifier !== identifier; });
      if (linkedIssues.length === 0) {
        showNoLinkSection();
      } else {
        renderLinkedIssuesList();
      }
      showNotify("success", "Unlinked " + identifier);
    } catch (err) {
      showNotify("error", (err && err.message) ? err.message : "Unlink failed");
    }
  }

  function openCreateModal() {
    if (!ticketData) {
      showNotify("error", "Ticket not loaded");
      return;
    }
    client.interface.trigger("showModal", {
      title: "Create Issue",
      template: "views/createIssue.html",
      data: {
        ticketId: ticketData.id,
        subject: ticketData.subject || "",
        description_text: ticketData.description_text || "",
        description: ticketData.description || ""
      }
    });
  }

  function openLinkModal() {
    const tid = ticketData && ticketData.id !== null && ticketData.id !== undefined ? String(ticketData.id) : "";
    client.interface.trigger("showModal", {
      title: "Link issue",
      template: "views/linkIssue.html",
      data: {
        ticketId: tid
      }
    });
  }

  document.getElementById("open-create-modal-btn").addEventListener("fwClick", openCreateModal);
  document.getElementById("create-another-btn").addEventListener("fwClick", openCreateModal);
  document.getElementById("open-link-modal-btn").addEventListener("fwClick", openLinkModal);
  document.getElementById("link-existing-from-linked-btn").addEventListener("fwClick", openLinkModal);

  function showSection(sectionId) {
    const sections = ["loading-section", "linked-section", "no-link-section"];
    sections.forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
    const target = document.getElementById(sectionId);
    if (target) target.style.display = "block";
  }

  function showNotify(type, message) {
    client.interface.trigger("showNotify", { type: type, message: message });
  }
})();
