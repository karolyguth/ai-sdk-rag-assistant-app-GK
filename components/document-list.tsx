'use client';

import { Loader2, RotateCw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Ezzel jelzi a feltöltő panel és a chat, ha változott a tudásbázis
const DOCUMENTS_CHANGED = 'documents-changed';
export function notifyDocumentsChanged() {
  window.dispatchEvent(new Event(DOCUMENTS_CHANGED));
}

type DocumentItem = {
  id: string;
  fileName: string | null;
  title: string | null;
  source: 'upload' | 'chat';
  status: 'uploaded' | 'processing' | 'processed' | 'failed';
  error: string | null;
  metadata: { difficulty?: string | null; prepTime?: string | null } | null;
  chunkCount: number;
  createdAt: string;
};

const STATUS_STYLES: Record<DocumentItem['status'], string> = {
  processed: 'bg-green-100 text-green-800',
  processing: 'bg-blue-100 text-blue-800',
  uploaded: 'bg-zinc-100 text-zinc-700',
  failed: 'bg-red-100 text-red-800',
};

export function DocumentList() {
  const [documents, setDocuments] = useState<DocumentItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/documents');
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setDocuments(body.documents);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load documents');
    }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(DOCUMENTS_CHANGED, load);
    return () => window.removeEventListener(DOCUMENTS_CHANGED, load);
  }, [load]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!documents || !q) return documents ?? [];
    return documents.filter(d =>
      `${d.title ?? ''} ${d.fileName ?? ''}`.toLowerCase().includes(q),
    );
  }, [documents, filter]);

  const handleDelete = async (doc: DocumentItem) => {
    const name = doc.title ?? doc.fileName ?? 'this document';
    if (!window.confirm(`Delete "${name}" from the knowledge base?`)) return;
    setBusyId(doc.id);
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(doc.id)}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      toast.success(`Deleted "${name}"`);
      await load();
    } catch (e) {
      toast.error(`Could not delete "${name}": ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleRetry = async (doc: DocumentItem) => {
    setBusyId(doc.id);
    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: doc.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      toast.success(`Processed "${doc.title ?? doc.fileName}"`);
    } catch (e) {
      toast.error(`Processing failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setBusyId(null);
      await load();
    }
  };

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">Knowledge base</h2>
        {documents && (
          <span className="text-sm text-muted-foreground">
            {documents.length} document{documents.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {documents && documents.length > 5 && (
        <Input
          placeholder="Filter by name…"
          value={filter}
          onChange={e => setFilter(e.currentTarget.value)}
          aria-label="Filter documents"
        />
      )}

      {loadError && (
        <p className="text-sm text-red-700">
          Could not load the documents: {loadError}{' '}
          <button className="underline" onClick={load}>
            Try again
          </button>
        </p>
      )}

      {!documents && !loadError && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      )}

      {documents && documents.length === 0 && (
        <p className="text-sm text-muted-foreground">No documents yet. Upload some recipes above.</p>
      )}

      {documents && documents.length > 0 && (
        <ul className="max-h-[50vh] divide-y overflow-y-auto">
          {visible.map(doc => (
            <li key={doc.id} className="flex items-start gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={doc.title ?? undefined}>
                  {doc.title ?? doc.fileName ?? 'Untitled'}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                  <span
                    className={cn('rounded px-1.5 py-0.5', STATUS_STYLES[doc.status])}
                    title={doc.error ?? undefined}
                  >
                    {doc.status}
                  </span>
                  {doc.source === 'chat' && (
                    <span className="rounded bg-purple-100 px-1.5 py-0.5 text-purple-800">from chat</span>
                  )}
                  <span>
                    {doc.chunkCount} chunk{doc.chunkCount !== 1 ? 's' : ''}
                  </span>
                  {doc.metadata?.difficulty && <span>· {doc.metadata.difficulty}</span>}
                  {doc.metadata?.prepTime && <span>· {doc.metadata.prepTime}</span>}
                </div>
                {doc.status === 'failed' && doc.error && (
                  <p className="mt-1 text-xs text-red-700">{doc.error}</p>
                )}
              </div>

              {(doc.status === 'failed' || doc.status === 'uploaded') && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => handleRetry(doc)}
                  disabled={busyId !== null}
                  aria-label={`Process ${doc.title ?? doc.fileName}`}
                  title="Process again"
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-700"
                onClick={() => handleDelete(doc)}
                disabled={busyId !== null}
                aria-label={`Delete ${doc.title ?? doc.fileName}`}
                title="Delete"
              >
                {busyId === doc.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </li>
          ))}
          {visible.length === 0 && (
            <li className="py-2 text-sm text-muted-foreground">No document matches “{filter}”.</li>
          )}
        </ul>
      )}
    </section>
  );
}
