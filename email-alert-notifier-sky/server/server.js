const HIGH_PRIORITIES = new Set(['3', '4']);

exports = {
  onAppInstallHandler: function() {
    console.info('Email Alert Notifier installed successfully');
    renderData();
  },

  onTicketCreateHandler: async function(args) {
    await sendAlert(args, 'created', 'freshdesk');
  },

  onTicketUpdateHandler: async function(args) {
    await handleTicketUpdate(args, 'freshdesk');
  },

  onServiceTicketCreateHandler: async function(args) {
    await sendAlert(args, 'created', 'freshservice');
  },

  onServiceTicketUpdateHandler: async function(args) {
    await handleTicketUpdate(args, 'freshservice');
  }
};

function getPriorityLabel(priority) {
  const labels = { '1': 'Low', '2': 'Medium', '3': 'High', '4': 'Urgent' };
  return labels[String(priority)] || 'Unknown';
}

function getStatusLabel(status) {
  const labels = { '2': 'Open', '3': 'Pending', '4': 'Resolved', '5': 'Closed' };
  return labels[String(status)] || 'Unknown';
}

function shouldAlertForPriority(priority, filter) {
  const p = String(priority);
  if (filter === 'all') return true;
  if (filter === 'high_and_urgent') return HIGH_PRIORITIES.has(p);
  if (filter === 'urgent') return p === '4';
  return p === '3' || p === '4';
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function buildEmailHtml(ticket, eventType, priorityLabel, ticketUrl, product) {
  const productLabel = product === 'freshservice' ? 'Freshservice' : 'Freshdesk';
  const changes = ticket.changes || {};
  const priorityRow = changes.priority
    ? row('Priority', getPriorityLabel(changes.priority[0]) + ' &rarr; ' + priorityLabel)
    : row('Priority', priorityLabel);
  return '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">'
    + '<h2 style="color:#264966;border-bottom:2px solid #264966;padding-bottom:8px">'
    + 'Ticket ' + capitalize(eventType) + '</h2>'
    + '<table style="width:100%;border-collapse:collapse;margin:16px 0">'
    + row('Ticket ID', '#' + ticket.id)
    + row('Subject', escapeHtml(ticket.subject || 'No subject'))
    + priorityRow
    + row('Status', getStatusLabel(ticket.status))
    + row('Product', productLabel)
    + '</table>'
    + '<p style="margin-top:20px"><a href="' + ticketUrl
    + '" style="background:#2979ff;color:#fff;padding:10px 20px;'
    + 'text-decoration:none;border-radius:4px">View Ticket</a></p></div>';
}

function row(label, value) {
  return '<tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee">'
    + label + '</td><td style="padding:8px;border-bottom:1px solid #eee">'
    + value + '</td></tr>';
}

function formatError(err) {
  if (err.message) return err.message;
  const status = err.status || 'unknown';
  const body = typeof err.response === 'string' ? err.response : JSON.stringify(err.response);
  return 'HTTP ' + status + ' - ' + body;
}

async function handleTicketUpdate(args, product) {
  const changes = args.data.ticket.changes || {};
  if (changes.priority) {
    await sendAlert(args, 'updated', product);
  }
}

function getDomain(args) {
  if (args.domain) return args.domain;
  const urls = args.currentHost && args.currentHost.endpoint_urls;
  if (urls) {
    const first = urls.freshdesk || urls.freshservice || Object.values(urls)[0];
    if (first) return first.replace(/^https?:\/\//, '');
  }
  return '';
}

async function sendAlert(args, eventType, product) {
  const ticket = args.data.ticket;
  const iparams = args.iparams;
  if (!shouldAlertForPriority(ticket.priority, iparams.priority_filter)) {
    return;
  }
  const prefix = iparams.email_subject_prefix || '[Alert]';
  const priorityLabel = getPriorityLabel(ticket.priority);
  const domain = getDomain(args);
  const ticketUrl = 'https://' + domain + '/a/tickets/' + ticket.id;
  const subject = prefix + ' Ticket #' + ticket.id + ': ' + (ticket.subject || 'No subject');
  const recipients = iparams.recipient_emails.split(',').map(function(e) { return e.trim(); });
  const htmlBody = buildEmailHtml(ticket, eventType, priorityLabel, ticketUrl, product);
  try {
    await $request.invokeTemplate('sendEmail', {
      body: JSON.stringify({
        from: iparams.from_email,
        to: recipients,
        subject: subject,
        html: htmlBody
      })
    });
    console.info('Alert sent for ticket #' + ticket.id + ' (' + eventType + ')');
  } catch (err) {
    console.error('Failed to send alert for ticket #' + ticket.id + ':', formatError(err));
  }
}
