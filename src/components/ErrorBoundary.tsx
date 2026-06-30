import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

function isChunkError(err: Error): boolean {
  const msg = err?.message ?? '';
  const name = err?.name ?? '';
  return (
    name === 'ChunkLoadError' ||
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('Unable to preload CSS for') ||
    msg.includes('error loading dynamically imported module')
  );
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(err: Error): State {
    // Chunk errors mean stale build — reload to get fresh chunks
    if (isChunkError(err)) {
      const key = 'finerp_chunk_reload_at';
      const last = Number(sessionStorage.getItem(key) ?? 0);
      if (Date.now() - last > 15_000) {
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
        return { hasError: false, message: '' };
      }
    }
    return { hasError: true, message: err?.message ?? 'Unknown error' };
  }

  componentDidCatch(err: Error, info: React.ErrorInfo) {
    if (!isChunkError(err)) {
      console.error('[ErrorBoundary] caught:', err, info.componentStack);
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-4 p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <p className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">Something went wrong</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-mono max-w-sm">{this.state.message}</p>
        </div>
        <button
          onClick={() => { this.setState({ hasError: false, message: '' }); window.location.reload(); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Reload page
        </button>
      </div>
    );
  }
}
