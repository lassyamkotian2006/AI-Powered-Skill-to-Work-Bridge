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

// Create Supabase client with explicit schema config
const supabase = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        db: { schema: 'public' },
        auth: { persistSession: false }
    })
    : null;

module.exports = supabase;

