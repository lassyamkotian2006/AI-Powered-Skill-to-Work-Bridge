/**
 * Supabase Configuration
 * ----------------------
 * Initializes Supabase client for database operations.
 * Uses service role key for backend operations (has full access).
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// Validate credentials
if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ Supabase credentials not found - database features disabled');
}

// Create Supabase client
const supabase = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

module.exports = supabase;
