let client;

function getBotTokenEl() {
  return document.querySelector('.bot-token-field');
}

function getChatIdEl() {
  return document.querySelector('.chat-id-field');
}

function getFilterHighPriorityEl() {
  return document.querySelector('.filter-high-priority-field');
}

function getDailyDigestEl() {
  return document.querySelector('.daily-digest-field');
}

function getErrorDiv() {
  return document.getElementById('error_div');
}

function showError(msg) {
  const el = getErrorDiv();
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
  }
}

function hideError() {
  const el = getErrorDiv();
  if (el) el.style.display = 'none';
}

function postConfigs() {
  const botTokenEl = getBotTokenEl();
  const chatIdEl = getChatIdEl();
  const filterEl = getFilterHighPriorityEl();
  const digestEl = getDailyDigestEl();
  return {
    __meta: {
      secure: ['telegram_bot_token']
    },
    telegram_bot_token: botTokenEl && botTokenEl.value ? botTokenEl.value.trim() : '',
    telegram_chat_id: chatIdEl && chatIdEl.value ? chatIdEl.value.trim() : '',
    filter_high_priority_only: filterEl ? !!filterEl.checked : false,
    daily_digest_enabled: digestEl ? !!digestEl.checked : false
  };
}

function getConfigs(configs) {
  if (!configs) return;
  const chatIdEl = getChatIdEl();
  const filterEl = getFilterHighPriorityEl();
  const digestEl = getDailyDigestEl();
  if (chatIdEl) chatIdEl.value = configs.telegram_chat_id || '';
  if (filterEl) filterEl.checked = !!configs.filter_high_priority_only;
  if (digestEl) digestEl.checked = !!configs.daily_digest_enabled;
  // Bot token is secure and not returned to frontend; leave field empty on edit
}

async function validate() {
  hideError();
  const botTokenEl = getBotTokenEl();
  const chatIdEl = getChatIdEl();
  const token = botTokenEl && botTokenEl.value ? botTokenEl.value.trim() : '';
  const chatId = chatIdEl && chatIdEl.value ? chatIdEl.value.trim() : '';
  if (!token) {
    showError('Please enter the Telegram bot token.');
    return false;
  }
  if (!chatId) {
    showError('Please enter the Telegram chat ID.');
    return false;
  }
  try {
    const res = await client.request.invokeTemplate('telegramGetMe', {
      context: { bot_token: token }
    });
    const status = res.status;
    let data = {};
    try {
      data = res.response ? JSON.parse(res.response) : {};
    } catch (_) {}
    if (status === 200 && data.ok === true) {
      return true;
    }
    showError('Invalid bot token. Please check the token from @BotFather.');
    return false;
  } catch (err) {
    console.error('Telegram validation error:', err);
    showError('Invalid bot token or connection error. Please check the token and try again.');
    return false;
  }
}

document.addEventListener('DOMContentLoaded', function () {
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    init();
  }
});

async function init() {
  try {
    client = await app.initialized();
    window.client = client;
  } catch (err) {
    console.error('App init error:', err);
  }
}
