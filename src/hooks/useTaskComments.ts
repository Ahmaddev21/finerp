import { useState, useCallback, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string | null;
  authorName: string;
  body: string;
  editedAt: string | null;
  createdAt: string;
}

function mapRow(row: any): TaskComment {
  return {
    id: row.id,
    taskId: row.task_id,
    authorId: row.author_id ?? null,
    authorName: row.author_name,
    body: row.body,
    editedAt: row.edited_at ?? null,
    createdAt: row.created_at,
  };
}

export function useTaskComments(taskId: string, companyId: string) {
  const { user, profile } = useAuthStore();
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured || !taskId || !companyId) return;
    setLoading(true);
    const { data, err } = await (supabase
      .from('task_comments')
      .select('*')
      .eq('task_id', taskId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: true }) as any);
    setLoading(false);
    if (err) { setError(err.message); return; }
    setComments(data ? data.map(mapRow) : []);
  }, [taskId, companyId]);

  // Subscribe to realtime so both owner and admin see comments appear live
  useEffect(() => {
    if (!isSupabaseConfigured || !taskId || !companyId) return;
    fetch();
    const channel = supabase
      .channel(`task_comments_${taskId}`)
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'task_comments', filter: `task_id=eq.${taskId}` },
        () => { fetch(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [taskId, companyId, fetch]);

  const addComment = useCallback(async (body: string): Promise<boolean> => {
    if (!isSupabaseConfigured || !user?.id || !body.trim()) return false;
    setPosting(true);
    setError(null);
    const authorName = profile?.username || user.name || user.email || 'Unknown';
    const { error: err } = await supabase
      .from('task_comments')
      .insert({
        task_id: taskId,
        company_id: companyId,
        author_id: user.id,
        author_name: authorName,
        body: body.trim(),
      });
    setPosting(false);
    if (err) { setError(err.message); return false; }
    return true;
  }, [taskId, companyId, user, profile]);

  const editComment = useCallback(async (commentId: string, body: string): Promise<boolean> => {
    if (!isSupabaseConfigured || !body.trim()) return false;
    const { error: err } = await supabase
      .from('task_comments')
      .update({ body: body.trim(), edited_at: new Date().toISOString() })
      .eq('id', commentId);
    if (err) { setError(err.message); return false; }
    setComments(prev => prev.map(c =>
      c.id === commentId ? { ...c, body: body.trim(), editedAt: new Date().toISOString() } : c
    ));
    return true;
  }, []);

  const deleteComment = useCallback(async (commentId: string): Promise<void> => {
    if (!isSupabaseConfigured) return;
    const { error: err } = await supabase
      .from('task_comments')
      .delete()
      .eq('id', commentId);
    if (err) { setError(err.message); return; }
    setComments(prev => prev.filter(c => c.id !== commentId));
  }, []);

  return { comments, loading, posting, error, addComment, editComment, deleteComment };
}
