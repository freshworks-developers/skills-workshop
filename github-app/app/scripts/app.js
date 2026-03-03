(function () {
  function byId(id) {
    return document.getElementById(id);
  }

  function toast(toastEl, type, content) {
    toastEl.trigger({ type, content });
  }

  function getDeep(obj, path) {
    let cur = obj;
    for (let i = 0; i < path.length; i += 1) {
      if (!cur) return null;
      cur = cur[path[i]];
    }
    return cur || null;
  }

  function setLoading(isLoading, text) {
    const loadingRow = byId("loadingRow");
    const loadingText = byId("loadingText");
    const createBtn = byId("createIssueBtn");
    const linkBtn = byId("linkIssueBtn");
    const unlinkBtn = byId("unlinkBtn");
    const issueInput = byId("existingIssueNumber");

    if (isLoading) {
      loadingText.textContent = text || "Working…";
      loadingRow.classList.add("visible");
    } else {
      loadingRow.classList.remove("visible");
    }

    createBtn.disabled = isLoading;
    linkBtn.disabled = isLoading;
    issueInput.disabled = isLoading;
    if (unlinkBtn) unlinkBtn.disabled = isLoading;
  }

  function normalizeFreshdeskDomain(endpointUrl) {
    if (!endpointUrl || typeof endpointUrl !== "string") return null;
    return endpointUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  }

  function buildTicketUrl(freshdeskEndpointUrl, ticketId) {
    if (!freshdeskEndpointUrl || !ticketId) return null;
    const base = freshdeskEndpointUrl.replace(/\/+$/, "");
    return `${base}/a/tickets/${ticketId}`;
  }

  function firstNonEmptyString(values, fallbackValue) {
    for (let i = 0; i < values.length; i += 1) {
      const v = values[i];
      if (typeof v === "string" && v.trim().length > 0) return v;
    }
    return fallbackValue;
  }

  function safeNumber(value) {
    const n = Number.parseInt(String(value || "").trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function messageFromError(e, fallbackMsg) {
    if (e && typeof e.message === "string" && e.message.trim().length > 0) return e.message;
    return fallbackMsg;
  }

  async function loadContext(client) {
    const [ticketData, requesterData, hostData, iparamsData] = await Promise.all([
      client.data.get("ticket"),
      client.data.get("requester"),
      client.data.get("currentHost"),
      client.iparams.get()
    ]);

    const ticket = ticketData.ticket;
    const requester = requesterData.requester;
    const iparams = iparamsData;

    const freshdeskEndpointUrl = getDeep(hostData, ["currentHost", "endpoint_urls", "freshdesk"]);
    const freshdeskDomain = normalizeFreshdeskDomain(freshdeskEndpointUrl);
    const ticketId = ticket ? ticket.id : null;
    const ticketUrl = buildTicketUrl(freshdeskEndpointUrl, ticketId);

    return {
      ticket,
      requester,
      iparams,
      freshdeskDomain,
      ticketUrl
    };
  }

  function renderRepoText(iparams) {
    const repoText = byId("repoText");
    if (iparams && iparams.default_repo) {
      repoText.textContent = `Default repo: ${iparams.default_repo}`;
      return;
    }
    repoText.textContent = "Default repo is not configured (check app settings).";
  }

  async function init() {
    const client = await app.initialized();
    const toastEl = document.querySelector("#toast");

    let ctx = null;

    try {
      ctx = await loadContext(client);
    } catch (e) {
      toast(toastEl, "error", "Failed to load ticket context.");
      return;
    }

    renderRepoText(ctx.iparams);

    async function refreshLinkedIssue() {
      setLoading(true, "Loading linked issue…");
      try {
        const resp = await client.request.invoke("getLinkedIssue", { ticketId: ctx.ticket.id });
        const data = resp ? resp.response : null;
        renderLinkedIssue(data);
      } catch (e) {
        renderLinkedIssue({ linked: false });
      } finally {
        setLoading(false);
      }
    }

    function renderLinkedIssue(data) {
      const issueBox = byId("issueBox");
      const issueLink = byId("issueLink");
      if (!data || !data.linked) {
        issueBox.style.display = "none";
        issueLink.textContent = "";
        return;
      }

      issueBox.style.display = "flex";
      const url = data.issueUrl;
      const number = data.issueNumber;
      const repo = data.repo;
      if (url) {
        while (issueLink.firstChild) issueLink.removeChild(issueLink.firstChild);
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noreferrer";
        a.textContent = repo && number ? `${repo} #${number}` : url;
        issueLink.appendChild(a);
      } else {
        issueLink.textContent = "Linked issue";
      }
    }

    byId("createIssueBtn").addEventListener("fwClick", async function () {
      setLoading(true, "Creating GitHub issue…");
      try {
        const description = firstNonEmptyString(
          [ctx.ticket.description_text, ctx.ticket.description],
          "(No description available on ticket)"
        );

        const payload = {
          ticketId: ctx.ticket.id,
          ticketSubject: firstNonEmptyString(
            [ctx.ticket.subject],
            `Ticket #${ctx.ticket.id}`
          ),
          ticketDescription: String(description),
          requesterName: ctx.requester ? ctx.requester.name : null,
          requesterEmail: ctx.requester ? ctx.requester.email : null,
          ticketUrl: ctx.ticketUrl,
          freshdesk_domain: ctx.freshdeskDomain
        };

        const resp = await client.request.invoke("createGithubIssue", payload);
        const data = resp ? resp.response : null;
        const successMsg = data && data.issueUrl
          ? `Created GitHub issue #${data.issueNumber}`
          : "Created GitHub issue.";
        toast(toastEl, "success", successMsg);
        renderLinkedIssue({
          linked: true,
          issueUrl: data.issueUrl,
          issueNumber: data.issueNumber,
          repo: data.repo
        });
      } catch (e) {
        toast(toastEl, "error", messageFromError(e, "Failed to create GitHub issue."));
      } finally {
        setLoading(false);
      }
    });

    byId("linkIssueBtn").addEventListener("fwClick", async function () {
      const issueNumber = safeNumber(byId("existingIssueNumber").value);
      if (!issueNumber) {
        toast(toastEl, "warning", "Enter a valid issue number.");
        return;
      }

      setLoading(true, "Linking issue…");
      try {
        const resp = await client.request.invoke("linkExistingIssue", {
          ticketId: ctx.ticket.id,
          issueNumber: issueNumber,
          freshdesk_domain: ctx.freshdeskDomain
        });
        const data = resp ? resp.response : null;
        renderLinkedIssue({
          linked: true,
          issueUrl: data.issueUrl,
          issueNumber: data.issueNumber,
          repo: data.repo
        });
        toast(toastEl, "success", `Linked issue #${data.issueNumber}`);
      } catch (e) {
        toast(toastEl, "error", messageFromError(e, "Failed to link issue."));
      } finally {
        setLoading(false);
      }
    });

    byId("unlinkBtn").addEventListener("fwClick", async function () {
      setLoading(true, "Unlinking…");
      try {
        await client.request.invoke("unlinkIssue", { ticketId: ctx.ticket.id });
        renderLinkedIssue({ linked: false });
        toast(toastEl, "success", "Unlinked issue.");
      } catch (e) {
        toast(toastEl, "error", "Failed to unlink issue.");
      } finally {
        setLoading(false);
      }
    });

    await refreshLinkedIssue();
  }

  init();
})();

