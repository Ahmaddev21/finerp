/**
 * Patches 2 DB functions broken by the Phase 1/2 migrations:
 *   1. create_company_with_admin  — was inserting 'super_admin', now inserts 'owner'
 *   2. join_company_by_invite     — was returning only {id,name,role}, now returns full company row
 */
import { readFileSync } from 'fs';

const PROJECT_REF = 'iwrrratnesjqxwkszwxd';
const PAT = process.env.SUPABASE_PAT;

if (!PAT) {
  console.error('SUPABASE_PAT required');
  process.exit(1);
}

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || JSON.stringify(body));
  return body;
}

const patches = [
  {
    label: 'Fix create_company_with_admin (super_admin → owner)',
    query: `
      CREATE OR REPLACE FUNCTION public.create_company_with_admin(
        p_name text,
        p_currency text DEFAULT 'QR',
        p_user_id uuid DEFAULT NULL
      )
      RETURNS json AS $$
      DECLARE
        v_company_id uuid;
        v_join_code  text;
        v_user_id    uuid;
      BEGIN
        v_user_id := COALESCE(p_user_id, auth.uid());
        IF v_user_id IS NULL THEN
          RAISE EXCEPTION 'User ID required for company creation';
        END IF;

        v_join_code := public.generate_join_code();

        INSERT INTO public.companies (user_id, name, currency, join_code)
        VALUES (v_user_id, p_name, p_currency, v_join_code)
        RETURNING id INTO v_company_id;

        INSERT INTO public.company_users (company_id, user_id, role)
        VALUES (v_company_id, v_user_id, 'owner');

        RETURN json_build_object(
          'id',       v_company_id,
          'name',     p_name,
          'currency', p_currency,
          'join_code',v_join_code
        );
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
    `,
  },
  {
    label: 'Fix join_company_by_invite (return full company row)',
    query: `
      CREATE OR REPLACE FUNCTION public.join_company_by_invite(
        p_code    text,
        p_user_id uuid DEFAULT NULL
      )
      RETURNS json AS $$
      DECLARE
        v_invite         record;
        v_company        record;
        v_user_id        uuid;
        v_already_member boolean;
      BEGIN
        v_user_id := COALESCE(p_user_id, auth.uid());
        IF v_user_id IS NULL THEN
          RAISE EXCEPTION 'User ID required to join company';
        END IF;

        SELECT * INTO v_invite
        FROM public.company_invites
        WHERE upper(trim(code)) = upper(trim(p_code))
          AND (expires_at IS NULL OR expires_at > now())
          AND usage_count < max_uses
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_invite IS NULL THEN
          RAISE EXCEPTION 'Invalid, expired, or fully used invite code';
        END IF;

        v_already_member := EXISTS (
          SELECT 1 FROM public.company_users
          WHERE company_id = v_invite.company_id AND user_id = v_user_id
        );

        IF NOT v_already_member THEN
          UPDATE public.company_invites
          SET usage_count = usage_count + 1
          WHERE id = v_invite.id;
        END IF;

        INSERT INTO public.company_users (company_id, user_id, role)
        VALUES (v_invite.company_id, v_user_id, v_invite.role)
        ON CONFLICT (company_id, user_id)
        DO UPDATE SET role = EXCLUDED.role;

        SELECT * INTO v_company
        FROM public.companies
        WHERE id = v_invite.company_id;

        RETURN json_build_object(
          'id',        v_company.id,
          'name',      v_company.name,
          'currency',  v_company.currency,
          'industry',  v_company.industry,
          'join_code', v_company.join_code,
          'role',      v_invite.role
        );
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

      GRANT EXECUTE ON FUNCTION public.join_company_by_invite(text, uuid) TO authenticated;
    `,
  },
];

console.log('\n── Patching DB functions ─────────────────────────────────');
for (const patch of patches) {
  process.stdout.write(`  ${patch.label}... `);
  try {
    await sql(patch.query);
    console.log('✅');
  } catch (err) {
    console.log(`❌\n  ${err.message}\n`);
    process.exit(1);
  }
}

// Verify
console.log('\n── Verification ──────────────────────────────────────────');
const rows = await sql(`
  SELECT proname, pronargs
  FROM pg_proc
  WHERE proname IN ('create_company_with_admin', 'join_company_by_invite', 'generate_company_invite')
  ORDER BY proname
`);
for (const r of rows) {
  console.log(`  ${r.proname}(${r.pronargs} args)  ✅`);
}
console.log('─────────────────────────────────────────────────────────\n');
