import { useAuthStore } from '../store/auth';
import { useEffect } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export function usePresenceHeartbeat(enabled = true) {
  const userId = useAuthStore(s => s.user?.id);

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured || !userId) return;

    let stopped = false;

    const setOffline = () => {
      void supabase
        .from('profiles')
        .update({ status: 'offline' })
        .eq('id', userId);
    };

    const ping = async () => {
      const { error } = await supabase.rpc('update_user_activity');
      if (error && !stopped) {
        const missingFunction =
          error.message?.includes('update_user_activity') &&
          error.message?.includes('Could not find');
        if (!missingFunction) {
          console.warn('[Presence] Failed to update user activity:', error.message);
        }
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        setOffline();
      } else {
        void ping();
      }
    };

    void ping();
    const interval = window.setInterval(() => { void ping(); }, 60_000);

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', setOffline);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', setOffline);
      setOffline();
    };
  }, [enabled, userId]);
}
