const SCHEDULE_NAME_DAILY_DIGEST = 'telegram_daily_digest';
const DB_KEY_DIGEST_TICKETS = 'digest_tickets';

function isHighOrUrgentPriority(priority) {
  if (priority === null || priority === undefined) return false;
  const p = Number(priority);
  return p === 3 || p === 4;
}

function getPriorityLabel(priority) {
  if (priority === null || priority === undefined) return 'N/A';
  const p = Number(priority);
  const labels = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Urgent' };
  return labels[p] || 'Priority ' + p;
}

function buildTicketLink(domain, ticketId, isFreshservice) {
  const hasProtocol = domain.indexOf('http') === 0;
  const base = hasProtocol ? domain : 'https://' + domain.replace(/^https?:\/\//, '');
  const path = isFreshservice ? '/helpdesk/tickets/' + ticketId : '/a/tickets/' + ticketId;
  return base.replace(/\/$/, '') + path;
}

function getRequesterStr(requester) {
  if (!requester) return '—';
  const name = requester.name ? String(requester.name) : '—';
  const email = requester.email ? String(requester.email) : '';
  return email ? name + ' (' + email + ')' : name;
}

function buildAlertMessage(ticket, requester, ticketLink, priorityLabel) {
  const subject = (ticket.subject && String(ticket.subject)) || '(No subject)';
  const requesterStr = getRequesterStr(requester);
  return 'Subject: ' + subject + '\nRequester: ' + requesterStr + '\nPriority: ' + priorityLabel + '\nLink: ' + ticketLink;
}

async function sendTelegramMessage(iparams, text) {
  if (!iparams.telegram_bot_token || !iparams.telegram_chat_id) return;
  await $request.invokeTemplate('telegramSendMessage', {
    context: { bot_token: iparams.telegram_bot_token },
    body: JSON.stringify({
      chat_id: iparams.telegram_chat_id,
      text: text
    })
  });
}

function getTicketId(ticket) {
  if (ticket.id !== null && ticket.id !== undefined) return ticket.id;
  if (ticket.ticket_id !== null && ticket.ticket_id !== undefined) return ticket.ticket_id;
  return null;
}

function getTicketPriority(ticket) {
  if (ticket.priority !== null && ticket.priority !== undefined) return ticket.priority;
  return ticket.urgency;
}

function checkIsFreshservice(domain, currentHost) {
  if (domain && domain.indexOf('freshservice') !== -1) return true;
  return !!(currentHost && currentHost.endpoint_urls && currentHost.endpoint_urls.freshservice);
}

function getTicketContext(args) {
  const data = args.data || {};
  const ticket = data.ticket || {};
  const domain = args.domain || '';
  const isFreshservice = checkIsFreshservice(domain, args.currentHost);
  const ticketId = getTicketId(ticket);
  const priority = getTicketPriority(ticket);
  return {
    ticket: ticket,
    requester: data.requester || {},
    domain: domain,
    isFreshservice: isFreshservice,
    ticketId: ticketId,
    priority: priority,
    priorityLabel: getPriorityLabel(priority),
    ticketLink: buildTicketLink(domain, ticketId, isFreshservice)
  };
}

exports = {
  onTicketCreateHandler: async function (args) {
    const iparams = args.iparams || {};
    const ctx = getTicketContext(args);
    const shouldSendInstant = !iparams.filter_high_priority_only || isHighOrUrgentPriority(ctx.priority);

    if (shouldSendInstant) {
      try {
        const messageText = buildAlertMessage(ctx.ticket, ctx.requester, ctx.ticketLink, ctx.priorityLabel);
        await sendTelegramMessage(iparams, messageText);
      } catch (err) {
        console.error('Telegram Ticket Alerts: onTicketCreateHandler error', err);
      }
    }

    if (iparams.daily_digest_enabled) {
      try {
        await appendToDigest(args.account_id, { ticketId: ctx.ticketId, ticket: ctx.ticket, domain: ctx.domain, isFreshservice: ctx.isFreshservice });
      } catch (e) {
        console.error('Telegram Ticket Alerts: appendToDigest error', e);
      }
    }
  },

  onAppInstallHandler: async function (args) {
    const iparams = args.iparams || {};
    if (!iparams.daily_digest_enabled) return;
    try {
      const scheduleAt = new Date();
      scheduleAt.setUTCHours(9, 0, 0, 0);
      if (scheduleAt.getTime() <= Date.now()) {
        scheduleAt.setUTCDate(scheduleAt.getUTCDate() + 1);
      }
      await $schedule.create({
        name: SCHEDULE_NAME_DAILY_DIGEST,
        data: { account_id: args.account_id },
        schedule_at: scheduleAt.toISOString(),
        repeat: { time_unit: 'days', frequency: 1 }
      });
    } catch (err) {
      console.error('Telegram Ticket Alerts: onAppInstall schedule create error', err);
    }
  },

  onAppUninstallHandler: async function () {
    try {
      await $schedule.delete({ name: SCHEDULE_NAME_DAILY_DIGEST });
    } catch (err) {
      console.error('Telegram Ticket Alerts: onAppUninstall schedule delete error', err);
    }
  },

  onScheduledEventHandler: async function (args) {
    await runDailyDigest(args);
  }
};

async function getStoredDigestList(key) {
  try {
    const stored = await $db.get(key);
    return (stored && Array.isArray(stored)) ? stored : [];
  } catch (_) { /* key not set */ }
  return [];
}

function makeDigestEntry(entry) {
  const priority = entry.ticket && ((entry.ticket.priority !== null && entry.ticket.priority !== undefined) ? entry.ticket.priority : entry.ticket.urgency);
  return {
    ticketId: entry.ticketId,
    subject: (entry.ticket && entry.ticket.subject) || '(No subject)',
    priority: priority,
    link: buildTicketLink(entry.domain || '', entry.ticketId, !!entry.isFreshservice),
    createdAt: new Date().toISOString()
  };
}

async function appendToDigest(accountId, entry) {
  if (!accountId) return;
  const key = DB_KEY_DIGEST_TICKETS + '_' + accountId;
  const list = await getStoredDigestList(key);
  list.push(makeDigestEntry(entry));
  await $db.set(key, list);
}

function formatDigestLines(list) {
  return list.map(function (t) {
    return '• ' + (t.subject || '(No subject)') + '\n  ' + (t.link || '');
  });
}

async function sendDigestAndClear(iparams, key, list) {
  const lines = formatDigestLines(list);
  const messageText = 'Daily digest – ' + list.length + ' new ticket(s):\n\n' + lines.join('\n\n');
  await sendTelegramMessage(iparams, messageText);
  try {
    await $db.set(key, []);
  } catch (e) {
    console.error('Telegram Ticket Alerts: digest clear error', e);
  }
}

function getDigestAccountId(args) {
  return args.account_id || (args.data && args.data.account_id);
}

async function runDailyDigest(args) {
  const accountId = getDigestAccountId(args);
  const iparams = args.iparams || {};
  if (!iparams.telegram_bot_token || !iparams.telegram_chat_id) return;
  const key = DB_KEY_DIGEST_TICKETS + '_' + accountId;
  const list = await getStoredDigestList(key);
  if (list.length === 0) return;
  try {
    await sendDigestAndClear(iparams, key, list);
  } catch (err) {
    console.error('Telegram Ticket Alerts: digest send error', err);
  }
}
