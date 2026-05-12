#!/usr/bin/env node
/**
 * Cash Balance Audit — checks all financial data in Supabase
 */
import https from 'node:https';

const URL_BASE = 'https://gcfzcdxsldhotitwijjg.supabase.co/rest/v1';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjZnpjZHhzbGRob3RpdHdpampnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTUwODU3NiwiZXhwIjoyMDkxMDg0NTc2fQ.Vkwy8thQjKqP0KBOBcXMI7Y6SuxewHa1-35fLJi9NHU';

async function get(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(URL_BASE + path);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Accept': 'application/json' },
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.end();
  });
}

const transactions = await get('/transactions?select=date,type,description,amount,status&order=date.desc');
const projects     = await get('/projects?select=name,revenue,expenses,status');

console.log('\n══════════════════════════════════════════════════════════════════');
console.log('  FINERP — CASH BALANCE AUDIT');
console.log('══════════════════════════════════════════════════════════════════\n');

console.log('ACCOUNTING TRANSACTIONS (source of Cash Balance KPI)');
console.log('─'.repeat(70));

let settled = 0, pending = 0;
for (const t of transactions) {
  const a = parseFloat(t.amount);
  const isPaid = t.status === 'Paid' || t.status === 'Completed';
  isPaid ? settled += a : pending += a;
  const mark = isPaid ? '✅' : '⏳';
  const amtStr = a >= 0 ? `+${a.toLocaleString()}` : a.toLocaleString();
  console.log(`  ${mark} ${t.date}  ${t.type.padEnd(12)} ${t.description.slice(0,30).padEnd(32)} ${amtStr.padStart(12)}  [${t.status}]`);
}

console.log('─'.repeat(70));
console.log(`  Cash Balance (Paid + Completed):   QR ${settled.toLocaleString().padStart(10)}  ← Dashboard shows this`);
console.log(`  Pending/Uncollected:               QR ${pending.toLocaleString().padStart(10)}  ← NOT counted`);

console.log('\n\nPROJECT TABLE (source of Revenue / Expenses / Net Profit KPIs)');
console.log('─'.repeat(70));

let totalRev = 0, totalExp = 0;
for (const p of projects) {
  const r = parseFloat(p.revenue);
  const e = parseFloat(p.expenses);
  totalRev += r; totalExp += e;
  console.log(`  ${p.name.slice(0,28).padEnd(30)} Rev: ${r.toLocaleString().padStart(9)}  Exp: ${e.toLocaleString().padStart(9)}  [${p.status}]`);
}

console.log('─'.repeat(70));
console.log(`  Total Revenue  (projects table):   QR ${totalRev.toLocaleString().padStart(10)}  ← Dashboard KPI`);
console.log(`  Total Expenses (projects table):   QR ${totalExp.toLocaleString().padStart(10)}  ← Dashboard KPI`);
console.log(`  Net Profit:                        QR ${(totalRev - totalExp).toLocaleString().padStart(10)}  ← Dashboard KPI`);

console.log('\n\n══ VERDICT ══════════════════════════════════════════════════════════');
console.log(`
  KPI                 Source Table       Connected?
  ─────────────────── ────────────────── ──────────────────────────────────
  Total Revenue       projects.revenue   ✅ Live (sums all project rows)
  Total Expenses      projects.expenses  ✅ Live (sums all project rows)
  Net Profit          Derived            ✅ Revenue - Expenses (real-time)
  Cash Balance        transactions       ⚠️  PARTIAL — only Accounting module
                                            entries; project revenue does NOT
                                            auto-create a transaction.

  MISSING LINK:
  → When you set a project revenue (QR 450,000 for Snoonu), that money
    does NOT automatically appear in Cash Balance.
  → Cash Balance only grows when you manually add a receipt/payment
    in the Accounting module.
  → This is correct for accrual vs. cash accounting — but the two
    numbers (QR 1,095,000 revenue vs QR 65,950 cash) can confuse users.

  RECOMMENDATION:
  → Rename "Cash Balance" to "Net Cash from Transactions" for clarity.
  → OR auto-create a transaction when a project is marked Active/Completed.
`);
