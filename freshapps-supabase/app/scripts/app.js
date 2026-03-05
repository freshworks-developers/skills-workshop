(async function () {
  'use strict';

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  let client;
  try {
    client = await app.initialized();
  } catch (e) {
    showError('App client failed to initialise: ' + e.message);
    return;
  }

  // ── Load non-secure iparams and render connection info ──────────────────────
  try {
    const iparams = await client.iparams.get();
    const ref   = iparams.supabase_project_ref || '—';
    const table = iparams.table_name           || 'ticket_snapshots';

    setText('project-ref',   ref);
    setText('conn-table',    table);
    setText('conn-endpoint', 'https://' + ref + '.supabase.co/rest/v1/' + table);

    // Update SQL queries with the real table name
    replaceTableName(table);
  } catch (e) {
    showError('Could not load installation parameters: ' + e.message);
  }

  // ── Ticket context (sidebar only) ──────────────────────────────────────────
  client.events.on('app.activated', async function () {
    try {
      const ticketData = await client.data.get('ticket');
      const ticket     = ticketData.ticket;

      if (ticket) {
        setText('ticket-id',      '#' + ticket.id);
        setText('ticket-subject', ticket.subject || '—');
        const iparams2 = await client.iparams.get();
        setText('table-name', iparams2.table_name || 'ticket_snapshots');
        show('ticket-card');
      }
    } catch (_) {
      // ticket data not available in full_page_app context – that is fine
    }
  });

  // ── Copy-to-clipboard buttons ───────────────────────────────────────────────
  document.querySelectorAll('.copy-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const targetId = btn.getAttribute('data-target');
      const pre      = document.getElementById(targetId);
      if (!pre) return;

      const text = pre.innerText || pre.textContent;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function () {
          flashCopied(btn);
        });
      } else {
        // Fallback for environments without clipboard API
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        flashCopied(btn);
      }
    });
  });

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function show(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  }

  function showError(msg) {
    const el = document.getElementById('error-msg');
    if (el) {
      el.textContent = msg;
      el.classList.remove('hidden');
    }
  }

  function flashCopied(btn) {
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(function () {
      btn.textContent = orig;
      btn.classList.remove('copied');
    }, 1500);
  }

  /**
   * Replaces the placeholder table name in the SQL snippets with the
   * configured table_name iparam so the queries are ready to paste.
   */
  function replaceTableName(table) {
    const ids = ['q1', 'q2', 'q3', 'q4'];
    ids.forEach(function (id) {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = el.textContent.replace(/ticket_snapshots/g, table);
      }
    });
  }

})();
