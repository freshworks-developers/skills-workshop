(async function() {
  const client = await app.initialized();

  client.events.on('app.activated', async () => {
    document.getElementById('btnCopy').addEventListener('fwClick', () => handleCopy(client));
    document.getElementById('btnWebhook').addEventListener('fwClick', () => handleWebhook(client));
    await refreshPreview(client);
  });

  async function getTicketData(client) {
    const [ticketRes, requesterRes] = await Promise.all([
      client.data.get('ticket'),
      client.data.get('requester').catch(() => null)
    ]);
    return {
      ticket: ticketRes?.ticket || ticketRes,
      requester: requesterRes?.requester || requesterRes
    };
  }

  function toMarkdown(data) {
    const t = data.ticket || {};
    const r = data.requester || {};
    const lines = [
      ...headerLines(t),
      ...detailsTableLines(t),
      ...requesterLines(r),
      ...descriptionLines(t),
      ...tagsLines(t),
      ...attachmentsLines(t)
    ];
    return lines.join('\n').trim();
  }

  function headerLines(t) {
    const id = t.id || t.model_id || '?';
    return [`# Ticket #${id}: ${escapeMd(t.subject || 'No subject')}`, ''];
  }

  function detailsTableLines(t) {
    return [
      '## Details',
      '',
      '| Field | Value |',
      '|-------|-------|',
      `| Status | ${escapeMd(String(t.status ?? ''))} |`,
      `| Priority | ${escapeMd(String(t.priority ?? ''))} |`,
      `| Created | ${escapeMd(t.created_at || '')} |`,
      `| Updated | ${escapeMd(t.updated_at || '')} |`,
      ''
    ];
  }

  function requesterLines(r) {
    return [
      '## Requester',
      '',
      `- **Name:** ${escapeMd(r.name || '—')}`,
      `- **Email:** ${escapeMd(r.email || '—')}`,
      `- **Phone:** ${escapeMd(r.phone || '—')}`,
      ''
    ];
  }

  function descriptionLines(t) {
    const desc = t.description_text || t.description || '—';
    return ['## Description', '', desc.replace(/\n/g, '\n\n')];
  }

  function tagsLines(t) {
    if (!t.tags || t.tags.length === 0) return [];
    return ['', '## Tags', '', t.tags.map(tag => `\`${escapeMd(tag)}\``).join(' ')];
  }

  function attachmentsLines(t) {
    if (!t.attachments || t.attachments.length === 0) return [];
    const items = t.attachments.map(a =>
      `- ${escapeMd(a.name || 'attachment')} (${a.file_size || 0} bytes)`
    );
    return ['', '## Attachments', '', ...items];
  }

  function escapeMd(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/[#*_`\][()]/g, '\\$&')
      .replace(/\|/g, '\\|');
  }

  function showMessage(container, type, text) {
    container.innerHTML = '';
    const msg = document.createElement('fw-inline-message');
    msg.setAttribute('type', type);
    msg.textContent = text;
    container.appendChild(msg);
  }

  async function refreshPreview(client) {
    const preview = document.getElementById('preview');
    try {
      const data = await getTicketData(client);
      const md = toMarkdown(data);
      preview.textContent = md || 'No ticket data available.';
    } catch (e) {
      preview.textContent = 'Unable to load ticket: ' + (e.message || 'Unknown error');
    }
  }

  async function handleCopy(client) {
    const resultEl = document.getElementById('result');
    try {
      const data = await getTicketData(client);
      const md = toMarkdown(data);

      let copied = false;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(md);
          copied = true;
        } catch (clipboardErr) {
          copied = fallbackCopy(md);
        }
      } else {
        copied = fallbackCopy(md);
      }

      if (copied) {
        showMessage(resultEl, 'success', 'Markdown copied to clipboard.');
      } else {
        showMessage(resultEl, 'error', 'Copy failed. Try selecting and copying from the preview below.');
      }
    } catch (e) {
      showMessage(resultEl, 'error', 'Copy failed: ' + (e.message || 'Unknown error'));
    }
  }

  function fallbackCopy(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '0';
      ta.setAttribute('readonly', '');
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  async function handleWebhook(client) {
    const resultEl = document.getElementById('result');
    const btn = document.getElementById('btnWebhook');

    btn.setAttribute('loading', 'true');
    resultEl.innerHTML = '';

    try {
      const data = await getTicketData(client);
      const md = toMarkdown(data);
      const ticketId = data.ticket?.id || data.ticket?.model_id;

      const result = await client.request.invoke('exportToWebhook', {
        markdown: md,
        ticketId: ticketId
      });

      btn.removeAttribute('loading');

      if (result && result.success) {
        showMessage(resultEl, 'success', 'Exported to webhook successfully.');
      } else {
        const err = result?.error || 'Webhook URL not configured. Add it in app settings.';
        showMessage(resultEl, 'error', err);
      }
    } catch (e) {
      btn.removeAttribute('loading');
      showMessage(resultEl, 'error', 'Send failed: ' + (e.message || 'Unknown error'));
    }
  }
})();
