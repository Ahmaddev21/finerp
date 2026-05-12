// FinERP Reconciliation Engine
// Compares project-level financial fields with actual transaction sums
import type { Transaction } from '../hooks/useTransactions';

export interface ReconciliationResult {
  projectId: number | string;
  projectName: string;
  bookRevenue: number; // project.revenue field
  actualRevenue: number; // sum of approved/paid invoice transactions for this project
  revenueGap: number;
  bookExpenses: number; // project.expenses field (if exists)
  actualExpenses: number; // sum of approved/paid expense transactions
  expenseGap: number;
  isReconciled: boolean;
}

export function reconcileProjectFinancials(
  projects: any[],
  transactions: Transaction[]
): ReconciliationResult[] {
  // Only approved/paid transactions count
  const countableTx = transactions.filter(
    tx => tx.status === 'approved' || tx.status === 'paid'
  );

  return projects.map(project => {
    const projectName = project.name || project.project_name || `Project #${project.id}`;
    const projectId = project.id;

    // Sum transactions matching this project — EXACT match only
    const projectTx = countableTx.filter(tx => {
      const txProject = (tx.project || '').toLowerCase().trim();
      const pName = projectName.toLowerCase().trim();
      const pId = String(projectId).toLowerCase().trim();
      // Exact match on project name or project ID
      return txProject === pName || txProject === pId;
    });

    const actualRevenue = projectTx
      .filter(tx => tx.type === 'Invoice')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const actualExpenses = projectTx
      .filter(tx => tx.type === 'Expense' || (tx.type === 'Petty Cash' && (Number(tx.amount) || 0) < 0))
      .reduce((sum, tx) => sum + Math.abs(Number(tx.amount) || 0), 0);

    const bookRevenue = Number(project.revenue || 0);
    const bookExpenses = Number(project.expenses || 0);

    const revenueGap = bookRevenue - actualRevenue;
    const expenseGap = bookExpenses - actualExpenses;

    // Consider reconciled if gaps are within 1% tolerance or < QR 10
    const isReconciled =
      (Math.abs(revenueGap) <= Math.max(bookRevenue * 0.01, 10)) &&
      (Math.abs(expenseGap) <= Math.max(bookExpenses * 0.01, 10));

    return {
      projectId,
      projectName,
      bookRevenue,
      actualRevenue,
      revenueGap,
      bookExpenses,
      actualExpenses,
      expenseGap,
      isReconciled,
    };
  });
}
