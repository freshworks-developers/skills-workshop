function getRequesterEmail(ticket) {
  return ticket.requester ? ticket.requester.email : null;
}

function getTicketStatus(ticket) {
  return ticket.status_name || ticket.status || null;
}

function extractTicketData(ticket) {
  return {
    ticket_id: ticket.id,
    subject: ticket.subject || null,
    requester_email: getRequesterEmail(ticket),
    status: getTicketStatus(ticket),
    priority: ticket.priority || null,
    tags: ticket.tags || [],
    created_at: ticket.created_at || new Date().toISOString(),
    raw_json: ticket
  };
}

function getHttpErrorMessage(status) {
  const statusMessages = {
    401: 'Invalid Supabase API key. Please check your API key in app settings.',
    403: 'Access forbidden. Please check your Supabase API key permissions.',
    404: 'Supabase table not found. Please ensure the table exists in your database.'
  };
  return statusMessages[status];
}

function extractResponseMessage(error) {
  if (!error.response) {
    return null;
  }
  try {
    const responseData = JSON.parse(error.response);
    return responseData.message || null;
  } catch (e) {
    return null;
  }
}

function getErrorMessage(error) {
  // Handle specific HTTP status codes
  if (error.status) {
    const httpMessage = getHttpErrorMessage(error.status);
    if (httpMessage) {
      return httpMessage;
    }
    if (error.status >= 500) {
      return 'Supabase server error. Please try again later.';
    }
  }
  
  // Try to extract message from response
  const responseMessage = extractResponseMessage(error);
  if (responseMessage) {
    return responseMessage;
  }
  
  // Fallback to error message or status
  return error.message || `HTTP ${error.status || 'Unknown error'}`;
}

function logError(ticketId, error) {
  const errorMessage = getErrorMessage(error);
  console.error(`Failed to store ticket snapshot for ticket ${ticketId}: ${errorMessage}`);
  
  // Log only safe, non-sensitive error information
  if (error.status) {
    console.error(`HTTP Status: ${error.status}`);
  }
}

async function checkTableExists() {
  try {
    await $request.invokeTemplate('supabaseCheckTable', {});
    return true;
  } catch (error) {
    if (error.status === 404) {
      return false;
    }
    // Other errors might indicate connection issues, but we'll assume table doesn't exist
    return false;
  }
}

async function createTable() {
  try {
    await $request.invokeTemplate('supabaseCreateTable', {});
    return { success: true, message: 'Table created successfully' };
  } catch (error) {
    // Function might not exist, which is fine - user needs to run migration manually
    if (error.status === 404 || error.status === 400) {
      return { 
        success: false, 
        message: 'Table creation function not found. Please run the migration SQL manually.',
        requiresManualMigration: true 
      };
    }
    throw error;
  }
}

exports = {
  onAppInstallHandler: async function(args) {
    const iparams = args.iparams;
    const tableName = iparams.table_name || 'ticket_snapshots';
    
    console.log('App installed. Checking if table exists...');
    
    try {
      // Check if table exists
      const tableExists = await checkTableExists();
      
      if (tableExists) {
        console.log(`Table '${tableName}' already exists. Setup complete!`);
        renderData();
        return;
      }
      
      // Try to create table automatically
      console.log(`Table '${tableName}' not found. Attempting to create...`);
      const createResult = await createTable();
      
      if (createResult.success) {
        console.log('Table created successfully via migration function!');
        renderData();
        return;
      }
      
      // If automatic creation failed, provide migration instructions
      console.log('Automatic table creation not available.');
      console.log('Please run the migration SQL from migrations/001_create_ticket_snapshots_table.sql');
      console.log('Or create the helper function from migrations/002_create_table_helper_function.sql for automatic creation');
      
      // Allow installation to complete even if table doesn't exist yet
      // User can create it manually and the app will work
      renderData();
    } catch (error) {
      console.error('Error during table setup:', getErrorMessage(error));
      console.log('Please run the migration SQL from migrations/001_create_ticket_snapshots_table.sql');
      
      // Allow installation to complete - user can fix table setup later
      renderData();
    }
  },

  onTicketCreateHandler: async function(args) {
    const ticket = args.data.ticket;
    const ticketData = extractTicketData(ticket);
    
    try {
      await $request.invokeTemplate('supabaseInsert', {
        body: JSON.stringify(ticketData)
      });
      
      console.log('Ticket snapshot stored successfully:', ticket.id);
      return { success: true, ticket_id: ticket.id };
    } catch (error) {
      logError(ticket.id, error);
      const errorMessage = getErrorMessage(error);
      return { success: false, error: errorMessage, ticket_id: ticket.id };
    }
  }
};
