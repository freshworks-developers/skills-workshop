exports = {
  exportToWebhook: async function(args) {
    const { markdown, ticketId } = args;
    const webhookUrl = args.iparams?.webhook_url;
    const parsed = parseWebhookUrl(webhookUrl);

    if (!parsed) {
      return { success: false, error: 'Webhook URL not configured. Add it in App settings.' };
    }

    try {
      await $request.invokeTemplate('sendToWebhook', {
        context: {
          webhook_host: parsed.host,
          webhook_path: parsed.path
        },
        body: JSON.stringify({
          markdown,
          ticketId,
          exportedAt: new Date().toISOString()
        })
      });

      return { success: true };
    } catch (error) {
      console.error('Webhook export error:', error.message);
      return { success: false, error: error.message };
    }
  }
};

function parseWebhookUrl(url) {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return null;
  }
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'https:') {
      return null;
    }
    return {
      host: u.hostname,
      path: u.pathname + (u.search || '')
    };
  } catch {
    return null;
  }
}
