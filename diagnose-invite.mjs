import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://iwrrratnesjqxwkszwxd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3cnJyYXRuZXNqcXh3a3N6d3hkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjUxNjY3MiwiZXhwIjoyMDkyMDkyNjcyfQ.CvQv0JenT3z9AvvEqWeQT4WzBUxFY9vGIllFnXTrwlQ',
  { auth: { persistSession: false } }
);

async function check() {
  // Test member_profiles view
  const { data, error } = await supabase.from('member_profiles').select('*').limit(3);
  console.log('member_profiles:', error ? `❌ ${error.message}` : `✅ ${data?.length} rows`);
  if (data) console.log('  Sample:', JSON.stringify(data[0], null, 2));

  // Test company_users direct
  const { data: cu, error: cuErr } = await supabase.from('company_users').select('*').limit(3);
  console.log('company_users:', cuErr ? `❌ ${cuErr.message}` : `✅ ${cu?.length} rows`);
}
check();
