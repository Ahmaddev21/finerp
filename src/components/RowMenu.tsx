import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { MoreVertical, Check } from 'lucide-react';
import { cn } from '../lib/utils';

export type MenuAction =
  | {
      kind?: 'item';
      label: string;
      icon?: React.ReactNode;
      /** Tailwind classes for the icon container */
      iconCls?: string;
      onClick: () => void;
      danger?: boolean;
      disabled?: boolean;
      checked?: boolean;
    }
  | { kind: 'header'; label: string }
  | { kind: 'divider' };

interface Props {
  actions: MenuAction[];
  align?: 'left' | 'right';
}

interface DropPos {
  top: number;
  // one of these will be set
  right?: number;
  left?: number;
}

export function RowMenu({ actions, align = 'right' }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<DropPos | null>(null);
  const btnRef  = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape / scroll
  useEffect(() => {
    if (!open) return;

    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') setOpen(false);
        return;
      }
      const target = e.target as Node;
      const inBtn  = btnRef.current?.contains(target);
      const inDrop = dropRef.current?.contains(target);
      if (!inBtn && !inDrop) setOpen(false);
    };

    const onScroll = () => setOpen(false);

    document.addEventListener('mousedown', close, true);
    document.addEventListener('keydown', close, true);
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });

    return () => {
      document.removeEventListener('mousedown', close, true);
      document.removeEventListener('keydown', close, true);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    if (!btnRef.current) return;

    const r = btnRef.current.getBoundingClientRect();

    // Estimate dropdown height to decide if we should open upward
    const itemCount = actions.filter(a => !('kind' in a) || a.kind === 'item').length;
    const estimatedH = Math.min(itemCount * 36 + 24, 320);
    const spaceBelow = window.innerHeight - r.bottom - 8;
    const openUp = spaceBelow < estimatedH && r.top > estimatedH;

    const top = openUp ? r.top - estimatedH - 4 : r.bottom + 4;

    setPos({
      top,
      ...(align === 'right'
        ? { right: window.innerWidth - r.right }
        : { left: r.left }),
    });

    setOpen(o => !o);
  }

  const dropdown = open && pos
    ? ReactDOM.createPortal(
        <div
          ref={dropRef}
          style={{
            position: 'fixed',
            top:   pos.top,
            right: pos.right,
            left:  pos.left,
            zIndex: 9999,
            animation: 'rowMenuFade 0.11s ease forwards',
          }}
          className={cn(
            'min-w-[180px] max-w-[240px]',
            'bg-white dark:bg-gray-900',
            'border border-slate-200 dark:border-slate-700',
            'rounded-xl shadow-xl py-1',
          )}
          onClick={e => e.stopPropagation()}
        >
          {actions.map((action, i) => {
            if (action.kind === 'divider') {
              return <div key={i} className="my-0.5 mx-2 border-t border-slate-100 dark:border-slate-800" />;
            }
            if (action.kind === 'header') {
              return (
                <p key={i} className="px-3 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600 select-none">
                  {action.label}
                </p>
              );
            }

            const item = action as Extract<MenuAction, { kind?: 'item' }>;

            return (
              <button
                key={i}
                onClick={() => { item.onClick(); setOpen(false); }}
                disabled={item.disabled}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left transition-colors duration-100',
                  'disabled:cursor-not-allowed',
                  item.danger
                    ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40'
                    : item.disabled
                    ? 'text-slate-400 dark:text-slate-600 bg-slate-50/60 dark:bg-slate-800/30'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                )}
              >
                <span className="w-3.5 shrink-0 flex items-center justify-center">
                  {item.checked
                    ? <Check className="w-3 h-3 text-blue-600 dark:text-blue-400" strokeWidth={3} />
                    : null}
                </span>
                {item.icon && (
                  <span className={cn(
                    'w-4 h-4 shrink-0 flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4',
                    item.danger
                      ? 'text-red-500 dark:text-red-400'
                      : (item.iconCls ?? 'text-slate-400 dark:text-slate-500')
                  )}>
                    {item.icon}
                  </span>
                )}
                <span className={cn('flex-1 font-medium', item.disabled && !item.danger && 'font-semibold text-slate-700 dark:text-slate-300')}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>,
        document.body
      )
    : null;

  return (
    <div className="relative inline-block" onClick={e => e.stopPropagation()}>
      <button
        ref={btnRef}
        onClick={handleOpen}
        aria-label="Row actions"
        className={cn(
          'p-1.5 rounded border transition-all duration-150 select-none outline-none active:scale-95',
          open
            ? 'bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300'
            : 'border-transparent text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:text-slate-600 dark:hover:text-slate-300'
        )}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {dropdown}

      <style>{`
        @keyframes rowMenuFade {
          from { opacity: 0; transform: translateY(-4px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
      `}</style>
    </div>
  );
}
