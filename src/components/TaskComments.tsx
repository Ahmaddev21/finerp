import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, Pencil, Trash2, X, Check, Loader2, MessageSquare } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTaskComments, TaskComment } from '../hooks/useTaskComments';
import { useAuthStore } from '../store/auth';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Avatar({ name }: { name: string }) {
  const colors = [
    'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
    'bg-rose-500',   'bg-amber-500', 'bg-indigo-500',
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <div className={cn(
      'w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0',
      colors[idx]
    )}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

interface CommentItemProps {
  comment: TaskComment;
  isOwn: boolean;
  isOwner: boolean;
  onEdit: (id: string, body: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
}

function CommentItem({ comment, isOwn, isOwner, onEdit, onDelete }: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  const handleSave = async () => {
    if (!draft.trim() || draft.trim() === comment.body) { setEditing(false); return; }
    setSaving(true);
    const ok = await onEdit(comment.id, draft);
    setSaving(false);
    if (ok) setEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') { setEditing(false); setDraft(comment.body); }
  };

  const canEdit   = isOwn;
  const canDelete = isOwn || isOwner;

  return (
    <div className="flex gap-2.5 group">
      <Avatar name={comment.authorName} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {comment.authorName}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            {relativeTime(comment.createdAt)}
            {comment.editedAt && ' · edited'}
          </span>
        </div>

        {editing ? (
          <div className="mt-1">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 border border-indigo-400 dark:border-indigo-500 rounded-xl text-slate-800 dark:text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
            />
            <div className="flex items-center gap-2 mt-1.5">
              <button
                onClick={handleSave}
                disabled={saving || !draft.trim()}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Save
              </button>
              <button
                onClick={() => { setEditing(false); setDraft(comment.body); }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-3 h-3" /> Cancel
              </button>
              <span className="text-[10px] text-slate-400">⌘ Enter to save</span>
            </div>
          </div>
        ) : (
          <p className="mt-0.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
            {comment.body}
          </p>
        )}
      </div>

      {/* Action buttons — visible on hover */}
      {!editing && (canEdit || canDelete) && (
        <div className="flex items-start gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-0.5">
          {canEdit && (
            <button
              onClick={() => setEditing(true)}
              title="Edit"
              className="p-1 rounded-lg text-slate-300 dark:text-slate-600 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => {
                if (window.confirm('Delete this comment?')) onDelete(comment.id);
              }}
              title="Delete"
              className="p-1 rounded-lg text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  taskId: string;
  companyId: string;
}

export default function TaskComments({ taskId, companyId }: Props) {
  const { user } = useAuthStore();
  const { comments, loading, posting, error, addComment, editComment, deleteComment } =
    useTaskComments(taskId, companyId);

  const [draft, setDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef   = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new comments arrive
  useEffect(() => {
    if (comments.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [comments.length]);

  const handlePost = async () => {
    if (!draft.trim() || posting) return;
    const ok = await addComment(draft);
    if (ok) setDraft('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handlePost(); }
  };

  const isOwner = user?.role === 'owner';

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Comments {comments.length > 0 && `(${comments.length})`}
        </p>
      </div>

      {/* Error */}
      {error && (
        <p className="text-[11px] text-rose-500 font-medium">{error}</p>
      )}

      {/* Thread */}
      {loading ? (
        <div className="flex items-center gap-2 py-2 text-slate-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span className="text-xs">Loading comments…</span>
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500 italic py-1">
          No comments yet. Be the first to comment.
        </p>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
          {comments.map(c => (
            <CommentItem
              key={c.id}
              comment={c}
              isOwn={c.authorId === user?.id}
              isOwner={isOwner}
              onEdit={editComment}
              onDelete={deleteComment}
            />
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Compose */}
      <div className="flex gap-2 items-end pt-1">
        {user && <Avatar name={user.name || user.email || '?'} />}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a comment…"
            rows={1}
            className={cn(
              'w-full text-xs px-3 py-2 pr-10 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700',
              'rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400',
              'focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400',
              'resize-none transition-all leading-relaxed'
            )}
          />
          <button
            onClick={handlePost}
            disabled={!draft.trim() || posting}
            className="absolute right-2 bottom-2 p-1 rounded-lg text-slate-300 hover:text-indigo-600 disabled:opacity-40 transition-colors"
            title="Post (⌘ Enter)"
          >
            {posting
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      <p className="text-[10px] text-slate-400 ml-9">⌘ Enter to post</p>
    </div>
  );
}
