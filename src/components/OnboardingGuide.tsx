import React, { useState } from 'react';
import { Rocket, FolderPlus, Receipt, Check, X, ChevronRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  projectCount: number;
  transactionCount: number;
}

const STORAGE_KEY = 'finerp-onboarding-completed';

export default function OnboardingGuide({ projectCount, transactionCount }: Props) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true');

  if (dismissed || (projectCount > 0 && transactionCount > 0)) return null;

  const steps = [
    {
      done: projectCount > 0,
      icon: <FolderPlus className="w-5 h-5" />,
      title: 'Create your first project',
      desc: 'Set up a project to organize your financial data',
      action: () => navigate('/projects'),
      actionLabel: 'Go to Projects',
    },
    {
      done: transactionCount > 0,
      icon: <Receipt className="w-5 h-5" />,
      title: 'Add your first transaction',
      desc: 'Record an invoice, expense, or receipt',
      action: () => navigate('/accounting'),
      actionLabel: 'Go to Accounting',
    },
  ];

  const allDone = steps.every(s => s.done);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setDismissed(true);
  };

  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-blue-900 dark:to-indigo-950 rounded-xl border border-blue-500/20 p-6 shadow-lg shadow-blue-600/10 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <Rocket className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Welcome to FinERP</h3>
              <p className="text-blue-200 text-sm">Let's set up your workspace in 2 quick steps</p>
            </div>
          </div>
          <button onClick={handleDismiss} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={i} className={`flex items-center gap-4 p-4 rounded-xl transition-all ${step.done ? 'bg-white/5' : 'bg-white/10 hover:bg-white/15'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${step.done ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/60'}`}>
                {step.done ? <Check className="w-4 h-4" /> : step.icon}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-semibold ${step.done ? 'text-blue-200 line-through' : 'text-white'}`}>{step.title}</p>
                <p className="text-xs text-blue-300/60">{step.desc}</p>
              </div>
              {!step.done && (
                <button onClick={step.action} className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition-colors">
                  {step.actionLabel} <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        {allDone && (
          <div className="mt-4 text-center">
            <div className="flex items-center justify-center gap-2 text-white mb-2">
              <Sparkles className="w-5 h-5 text-amber-300" />
              <span className="font-bold">You're all set!</span>
            </div>
            <button onClick={handleDismiss} className="text-xs text-blue-200 hover:text-white underline transition-colors">
              Dismiss this guide
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
