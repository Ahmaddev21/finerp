// FinERP Export Utilities — CSV + PDF generation
import type { Transaction } from '../hooks/useTransactions';

// ── CSV Export ─────────────────────────────────
function downloadCSV(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeCSV(val: any): string {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportTransactionsCSV(transactions: Transaction[]) {
  const headers = ['Date', 'Invoice #', 'Type', 'Description', 'Project', 'Client', 'Amount (QR)', 'Status', 'Due Date'];
  const rows = transactions.map(tx => [
    tx.date,
    tx.invoice_number || '',
    tx.type,
    tx.desc,
    tx.project,
    tx.client_name || '',
    Math.abs(tx.amount),
    tx.status,
    tx.due_date || '',
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.map(escapeCSV).join(','))].join('\n');
  downloadCSV(`finerp-transactions-${new Date().toISOString().split('T')[0]}.csv`, csv);
}

export function exportProjectsCSV(projects: any[]) {
  const headers = [
    'ID', 'Name', 'Client', 'Status',
    'Contract Value (QR)', 'Investment (QR)', 'Expenses (QR)', 'Additional Costs (QR)',
    'Total Cost (QR)', 'Net Profit (QR)', 'Profit Margin (%)',
    'Payment Received (QR)', 'Pending Balance (QR)',
  ];
  const rows = projects.map(p => {
    const revenue          = Number(p.revenue          || 0);
    const investment       = Number(p.investment       || 0);
    const expenses         = Number(p.expenses         || 0);
    const additional_costs = Number(p.additional_costs || 0);
    const payment_received = Number(p.payment_received || 0);
    const totalCost        = investment + expenses + additional_costs;
    const netProfit        = revenue - totalCost;
    const margin           = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : '0.0';
    const pending          = Math.max(0, revenue - payment_received);
    return [
      p.id,
      p.name,
      p.client_name || p.client || '',
      p.status,
      revenue, investment, expenses, additional_costs,
      totalCost, netProfit, margin,
      payment_received, pending,
    ];
  });

  const csv = [headers.join(','), ...rows.map(r => r.map(escapeCSV).join(','))].join('\n');
  downloadCSV(`finerp-projects-${new Date().toISOString().split('T')[0]}.csv`, csv);
}

// ── PDF Export ─────────────────────────────────
// Dynamic import to avoid bundling jspdf if not used
async function getJsPDF() {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  return { jsPDF, autoTable };
}

export async function exportTransactionsPDF(transactions: Transaction[], companyName = 'FinERP') {
  const { jsPDF } = await getJsPDF();
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName.toUpperCase(), 14, 22);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('Transaction Report', 14, 30);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 36);

  // Table
  const tableData = transactions.map(tx => [
    tx.date,
    tx.invoice_number || '—',
    tx.type,
    tx.desc.substring(0, 30),
    tx.project.substring(0, 15),
    `QR ${Math.abs(tx.amount).toLocaleString()}`,
    tx.status.toUpperCase(),
  ]);

  (doc as any).autoTable({
    startY: 44,
    head: [['Date', 'Inv #', 'Type', 'Description', 'Project', 'Amount', 'Status']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7 },
    columnStyles: {
      5: { halign: 'right' },
      6: { halign: 'center', fontStyle: 'bold' },
    },
  });

  // Totals
  const totalRevenue = transactions.filter(t => t.amount > 0 && (t.status === 'approved' || t.status === 'paid')).reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.amount < 0 && (t.status === 'approved' || t.status === 'paid')).reduce((s, t) => s + Math.abs(t.amount), 0);
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.text(`Approved Revenue: QR ${totalRevenue.toLocaleString()}`, 14, finalY);
  doc.text(`Approved Expenses: QR ${totalExpenses.toLocaleString()}`, 14, finalY + 6);
  doc.text(`Net: QR ${(totalRevenue - totalExpenses).toLocaleString()}`, 14, finalY + 12);

  doc.save(`finerp-transactions-${new Date().toISOString().split('T')[0]}.pdf`);
}

export async function exportProjectsPDF(projects: any[], companyName = 'FinERP') {
  const { jsPDF } = await getJsPDF();
  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName.toUpperCase(), 14, 22);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('Projects Financial Report', 14, 30);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 36);

  const tableData = projects.map(p => {
    const rev  = Number(p.revenue          || 0);
    const inv  = Number(p.investment       || 0);
    const exp  = Number(p.expenses         || 0);
    const ac   = Number(p.additional_costs || 0);
    const pr   = Number(p.payment_received || 0);
    const tc   = inv + exp + ac;
    const np   = rev - tc;
    const mar  = rev > 0 ? `${((np / rev) * 100).toFixed(1)}%` : '0.0%';
    const pend = Math.max(0, rev - pr);
    const fmt  = (n: number) => `QR ${n.toLocaleString()}`;
    return [
      p.id, p.name, p.client_name || p.client || '', p.status,
      fmt(rev), fmt(tc), fmt(np), mar, fmt(pr), fmt(pend),
    ];
  });

  (doc as any).autoTable({
    startY: 44,
    head: [['ID', 'Name', 'Client', 'Status', 'Contract Value', 'Total Cost', 'Net Profit', 'Margin', 'Received', 'Pending']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235], fontSize: 7, fontStyle: 'bold' },
    bodyStyles: { fontSize: 6.5 },
    columnStyles: {
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right', fontStyle: 'bold' },
      7: { halign: 'center', fontStyle: 'bold' },
      8: { halign: 'right' },
      9: { halign: 'right' },
    },
  });

  // Summary totals
  const totRev  = projects.reduce((s, p) => s + Number(p.revenue          || 0), 0);
  const totCost = projects.reduce((s, p) => s + Number(p.investment || 0) + Number(p.expenses || 0) + Number(p.additional_costs || 0), 0);
  const totProf = totRev - totCost;
  const finalY  = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(8);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Contract Value: QR ${totRev.toLocaleString()}   |   Total Cost: QR ${totCost.toLocaleString()}   |   Net Profit: QR ${totProf.toLocaleString()}`, 14, finalY);

  doc.save(`finerp-projects-${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportFleetCSV(fleet: any[]) {
  const headers = ['Category', 'EMP Number', 'Name', 'Company', 'Snoonu ID', 'Snoonu Email', 'QID', 'QID Expiry', 'Passport', 'Passport Expiry', 'Vehicle No.', 'Vehicle Expiry', 'Mobile', 'Status'];
  const rows = fleet.map(d => [
    d.category,
    d.emp_number,
    d.name,
    d.company,
    d.snoonu_id,
    d.snoonu_email,
    d.qid,
    d.qid_expiry || '',
    d.passport_number,
    d.passport_expiry || '',
    d.category === 'Rider' ? d.bike_number : d.car_number,
    d.category === 'Rider' ? (d.bike_expiry || '') : (d.car_expiry || ''),
    d.mobile_number,
    d.status,
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.map(escapeCSV).join(','))].join('\n');
  downloadCSV(`finerp-fleet-${new Date().toISOString().split('T')[0]}.csv`, csv);
}
