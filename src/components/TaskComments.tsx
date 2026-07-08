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

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-rose-500',   'bg-amber-500', 'bg-indigo-500', 'bg-cyan-500',
];

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  return (
    <div className={cn(
      'rounded-full flex items-center justify-center text-white font-bold shrink-0',
      color,
      size === 'sm' ? 'w-8 h-8 text-sm' : 'w-9 h-9 text-sm'
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
  const [editing, setEditing]   = useState(false);
  const [draft,   setDraft]     = useState(comment.body);
  const [saving,  setSaving]    = useState(false);
  const textareaRef             = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (editing) textareaRef.current?.focus(); }, [editing]);

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
    <div className="flex gap-3 group">
      <Avatar name={comment.authorName} size="sm" />

      <div className="flex-1 min-w-0">
        {/* Bubble */}
        <div className="bg-slate-50 dark:bg-slate-800/70 rounded-2xl rounded-tl-sm px-4 py-3">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {comment.authorName}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {relativeTime(comment.createdAt)}
                {comment.editedAt && ' · edited'}
              </span>
            </div>

            {/* Action buttons — visible at 40% opacity, full on hover */}
            {!editing && (canEdit || canDelete) && (
              <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                {canEdit && (
                  <button
                    onClick={() => setEditing(true)}
                    title="Edit"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-400 transition-all"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => { if (window.confirm('Delete this comment?')) onDelete(comment.id); }}
                    title="Delete"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Body or edit textarea */}
          {editing ? (
            <div className="space-y-2">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={3}
                className="w-full text-sm px-3 py-2.5 bg-white dark:bg-slate-900 border-2 border-indigo-400 dark:border-indigo-500 rounded-xl text-slate-800 dark:text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all leading-relaxed"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !draft.trim()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 shadow-sm"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save
                </button>
                <button
                  onClick={() => { setEditing(false); setDraft(comment.body); }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
                <span className="text-xs text-slate-400">⌘ Enter to save</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
              {comment.body}
            </p>
          )}
        </div>
      </div>
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
  const bottomRef         = useRef<HTMLDivElement>(null);

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
    <div className="space-y-4 pt-1">

      {/* Section header */}
      <div className="flex items-center gap-2.5">
        <MessageSquare className="w-4 h-4 text-indigo-500" />
        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
          Comments
        </span>
        {comments.length > 0 && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
            {comments.length}
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
          <p className="text-sm text-rose-600 dark:text-rose-400 font-medium">{error}</p>
        </div>
      )}

      {/* Thread */}
      {loading ? (
        <div className="flex items-center gap-2.5 py-3 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading comments…</span>
        </div>
      ) : comments.length === 0 ? (
        <div className="py-4 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-center">
          <MessageSquare className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-1.5" />
          <p className="text-sm text-slate-400 dark:text-slate-500">No comments yet — start the conversation.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
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
      <div className="flex gap-3 items-end">
        {user && <Avatar name={user.name || user.email || '?'} size="sm" />}
        <div className="flex-1 relative">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a comment…"
            rows={2}
            className="w-full text-sm px-4 py-3 pr-12 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none transition-all leading-relaxed shadow-sm"
          />
          <button
            onClick={handlePost}
            disabled={!draft.trim() || posting}
            title="Post (⌘ Enter)"
            className={cn(
              'absolute right-3 bottom-3 p-2 rounded-xl transition-all',
              draft.trim() && !posting
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-200 dark:shadow-none'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
            )}
          >
            {posting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-400 ml-12">⌘ Enter to post</p>
    </div>
  );
}
