import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gcfzcdxsldhotitwijjg.supabase.co';
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjZnpjZHhzbGRob3RpdHdpampnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTUwODU3NiwiZXhwIjoyMDkxMDg0NTc2fQ.Vkwy8thQjKqP0KBOBcXMI7Y6SuxewHa1-35fLJi9NHU';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
  console.log('🚀 Renaming asset expiry column...');
  
  // Try to rename the column using a raw SQL RPC or tagged template if available
  // Since we don't know if supabase.sql is available in this environment's supabase-js version,
  // we'll try a common approach or just provide the instruction if it fails.
  
  if (typeof supabase.sql === 'function') {
    const { error } = await supabase.sql`ALTER TABLE public.assets RENAME COLUMN estemara_expiry_date TO expiry_date;`;
    if (error) {
      console.error('❌ Error renaming column:', error);
    } else {
      console.log('✅ Column renamed successfully via supabase.sql');
    }
  } else {
    console.log('❌ supabase.sql is not available. Please run this in the Supabase SQL Editor:');
    console.log('ALTER TABLE public.assets RENAME COLUMN estemara_expiry_date TO expiry_date;');
  }
}

main();
