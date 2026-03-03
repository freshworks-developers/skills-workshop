/**
 * Freshdesk → Supabase Ticket Snapshot App
 *
 * Persists ticket data in Supabase on every onTicketCreate event.
 * Schema: id, ticket_id, subject, requester_email, status, priority,
 *         tags, created_at, raw_json, synced_at
 *
 * NOTE on renderData():
 *   – async handlers: do NOT call renderData(). The FDK framework calls it
 *     automatically when the returned promise resolves. Calling it manually
 *     inside an async function causes "Cannot set headers after they are sent".
 *   – sync handlers: call renderData() once at the end as normal.
 */

// Freshdesk API uses numeric codes for status and priority.
const STATUS_MAP = {
  2: 'Open',
  3: 'Pending',
  4: 'Resolved',
  5: 'Closed',
  6: 'Waiting on Customer',
  7: 'Waiting on Third Party'
};

const PRIORITY_MAP = {
  1: 'Low',
  2: 'Medium',
  3: 'High',
  4: 'Urgent'
};

exports = {

  /**
   * onTicketCreate – inserts a snapshot row into Supabase.
   * async: framework handles renderData() via promise resolution.
   */
  onTicketCreateHandler: async function (args) {
    const ticket    = args['data']['ticket'];
    const requester = args['data']['requester'] || {};

    const snapshot = {
      ticket_id:       ticket.id,
      subject:         ticket.subject           || null,
      requester_email: requester.email          || null,
      status:          STATUS_MAP[ticket.status]    || String(ticket.status),
      priority:        PRIORITY_MAP[ticket.priority] || String(ticket.priority),
      tags:            Array.isArray(ticket.tags) ? ticket.tags : [],
      created_at:      ticket.created_at        || new Date().toISOString(),
      raw_json:        args['data']
    };

    try {
      await $request.invokeTemplate('supabaseInsert', {
        body: JSON.stringify(snapshot)
      });
      console.log('[Supabase Sync] ✓ Ticket #' + ticket.id + ' ("' + ticket.subject + '") inserted.');
    } catch (err) {
      // Log the failure but don't re-throw – a sync error shouldn't kill the handler.
      console.error(
        '[Supabase Sync] ✗ Failed to insert ticket #' + ticket.id + ': ' +
        JSON.stringify(err)
      );
    }
    // No renderData() here – framework resolves it when the promise settles.
  },

  /**
   * onAppInstall – validates the Supabase connection.
   * async: throw an Error to block installation; framework catches it and
   * surfaces the message to the admin (no renderData() needed).
   */
  onAppInstallHandler: async function (args) {
    console.log('[Supabase Sync] App installing – validating Supabase connection…');

    try {
      // supabaseCheck → GET /rest/v1/<table>?limit=0 – fast and non-destructive
      await $request.invokeTemplate('supabaseCheck', {});
      console.log('[Supabase Sync] ✓ Connection to Supabase verified.');
    } catch (err) {
      const detail = JSON.stringify(err);
      console.error('[Supabase Sync] ✗ Install validation failed: ' + detail);

      // Throwing blocks the installation and shows the message to the admin.
      throw new Error(
        'Cannot connect to Supabase. ' +
        'Check your Project Reference, API Key, and that the table "' +
        args.iparams.table_name + '" exists. Detail: ' + detail
      );
    }
    // No renderData() – framework resolves via promise.
  },

  /**
   * onAppUninstall – sync handler, so renderData() is required.
   */
  onAppUninstallHandler: function (args) {
    console.log('[Supabase Sync] App uninstalled by account ' + args.account_id);
    renderData();
  }

};
