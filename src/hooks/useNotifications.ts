import { useAuthStore } from '../store/auth';
import { isAdminRole } from '../lib/roles';
// FinERP Notification Engine — Client-side alerts
import { useMemo } from 'react';
import type { Transaction } from './useTransactions';
import type { EmployeeForNotif } from './useAllCompanyEmployees';

export interface Notification {
  id: string;
  type: 'overdue_invoice' | 'pending_approval' | 'task_assigned' | 'contract_expiring' | 'change_request' | 'qid_expiring';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  link: string;
}

const DISMISSED_KEY = 'finerp-dismissed-notifications';

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

export function dismissNotification(id: string) {
  const dismissed = getDismissed();
  dismissed.add(id);
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]));
}

export function clearDismissed() {
  localStorage.removeItem(DISMISSED_KEY);
}

export function useNotifications(
  transactions: Transaction[],
  tasks: any[],
  contracts: any[],
  userRole: string,
  userName?: string,
  pendingChangeRequests = 0,
  employees: EmployeeForNotif[] = []
) {
  const notifications = useMemo(() => {
    const items: Notification[] = [];
    const dismissed = getDismissed();
    const today = new Date();

    // 1. Overdue Invoices
    (transactions || [])
      .filter(tx =>
        tx?.type === 'Invoice' && tx.due_date &&
        new Date(tx.due_date) < today &&
        tx.status !== 'paid' && tx.status !== 'cancelled' && tx.status !== 'rejected'
      )
      .forEach(tx => {
        const id = `overdue-${tx.id}`;
        if (!dismissed.has(id)) {
          const daysOverdue = Math.floor((today.getTime() - new Date(tx.due_date!).getTime()) / 86400000);
          items.push({
            id,
            type: 'overdue_invoice',
            title: 'Overdue Invoice',
            message: `${tx.invoice_number || tx.desc} is ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue (QR ${Math.abs(tx.amount).toLocaleString()})`,
            severity: daysOverdue > 14 ? 'high' : daysOverdue > 7 ? 'medium' : 'low',
            link: '/accounting',
          });
        }
      });

    // 2. Pending Approvals (for admins)
    if (isAdminRole(userRole)) {
      const pendingCount = (transactions || []).filter(tx => tx?.status === 'pending').length;
      if (pendingCount > 0) {
        const id = `pending-approvals-${pendingCount}`;
        if (!dismissed.has(id)) {
          items.push({
            id,
            type: 'pending_approval',
            title: 'Pending Approvals',
            message: `${pendingCount} transaction${pendingCount > 1 ? 's' : ''} awaiting your approval`,
            severity: pendingCount > 5 ? 'high' : 'medium',
            link: '/accounting',
          });
        }
      }

      const crCount = Number(pendingChangeRequests) || 0;
      if (crCount > 0) {
        const id = `change-requests-${crCount}`;
        if (!dismissed.has(id)) {
          items.push({
            id,
            type: 'change_request',
            title: 'Edit Approval Requests',
            message: `${crCount} protected edit request${crCount > 1 ? 's' : ''} waiting for review`,
            severity: crCount > 3 ? 'high' : 'medium',
            link: '/accounting',
          });
        }
      }
    }

    // 3. Assigned Tasks
    if (userName) {
      (tasks || [])
        .filter(t => t?.assignee === userName && t.status !== 'completed')
        .forEach(t => {
          const id = `task-${t.id}`;
          if (!dismissed.has(id)) {
            const isOverdue = t.due_date && t.due_date !== '—' && new Date(t.due_date) < today;
            items.push({
              id,
              type: 'task_assigned',
              title: isOverdue ? 'Overdue Task' : 'Task Assigned',
              message: `"${t.title}" ${isOverdue ? 'is overdue' : 'is pending'}`,
              severity: isOverdue ? 'high' : t.priority === 'High' ? 'medium' : 'low',
              link: '/tasks',
            });
          }
        });
    }

    // 4. Expiring Contracts (within 30 days)
    (contracts || [])
      .filter(c => {
        if (!c?.end_date || c.status === 'Expired') return false;
        const endDate = new Date(c.end_date);
        const daysLeft = Math.floor((endDate.getTime() - today.getTime()) / 86400000);
        return daysLeft >= 0 && daysLeft <= 30;
      })
      .forEach(c => {
        const id = `contract-${c.id}`;
        if (!dismissed.has(id)) {
          const daysLeft = Math.floor((new Date(c.end_date).getTime() - today.getTime()) / 86400000);
          items.push({
            id,
            type: 'contract_expiring',
            title: 'Contract Expiring',
            message: `"${c.title}" expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
            severity: daysLeft <= 7 ? 'high' : 'medium',
            link: '/erp/contracting',
          });
        }
      });

    // 5. QID / Passport Expiry Alerts (owner and admin only, across all company entities)
    if ((userRole === 'owner' || userRole === 'admin') && employees.length > 0) {
      employees.forEach(emp => {
        if (!emp.idExpiryDate) return;
        const expiry = new Date(emp.idExpiryDate);
        expiry.setHours(23, 59, 59, 999); // count until end of expiry day
        const daysLeft = Math.floor((expiry.getTime() - today.getTime()) / 86400000);
        if (daysLeft < 0) return; // already expired — skip (don't spam after the fact)

        const entityLabel: Record<string, string> = {
          shareup: 'Shareup',
          trading: 'RAA Trading',
          consultancy: 'RAA Consultancy',
        };
        const company = entityLabel[emp.entity] ?? emp.entity;

        if (daysLeft <= 7) {
          const id = `qid-7d-${emp.id}`;
          if (!dismissed.has(id)) {
            items.push({
              id,
              type: 'qid_expiring',
              title: 'QID Expiring in 7 Days',
              message: `${emp.name} (${company}) — QID expires ${daysLeft === 0 ? 'today' : `in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}`,
              severity: 'high',
              link: `/company/${emp.entity}`,
            });
          }
        } else if (daysLeft <= 30) {
          const id = `qid-30d-${emp.id}`;
          if (!dismissed.has(id)) {
            items.push({
              id,
              type: 'qid_expiring',
              title: 'QID Expiring in 30 Days',
              message: `${emp.name} (${company}) — QID expires in ${daysLeft} days`,
              severity: 'medium',
              link: `/company/${emp.entity}`,
            });
          }
        }
      });
    }

    // Sort by severity (high first)
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }, [transactions, tasks, contracts, userRole, userName, pendingChangeRequests, employees]);

  return notifications;
}
