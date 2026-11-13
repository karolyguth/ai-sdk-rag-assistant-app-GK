'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { notifyDocumentsChanged } from '@/components/document-list';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ALLOWED_EXTENSIONS, MAX_FILE_BYTES } from '@/lib/api';

type Progress = { done: number; total: number; current: string };

async function callApi<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (HTTP ${res.status})`);
  return body as T;
}

async function uploadAndProcess(file: File) {
  const form = new FormData();
  form.append('file', file);
  const { id } = await callApi<{ id: string }>('/api/upload', { method: 'POST', body: form });
  return callApi<{ chunkCount: number }>('/api/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
}

// Ugyanazok a szabályok, mint a szerveren, az azonnali visszajelzéshez
function validate(file: File): string | null {
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) return `only ${ALLOWED_EXTENSIONS.join(', ')} files are supported`;
  if (file.size === 0) return 'the file is empty';
  if (file.size > MAX_FILE_BYTES) return `the file is larger than ${MAX_FILE_BYTES / 1_000_000} MB`;
  return null;
}

export function DocumentUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);

  const handleUpload = async () => {
    const valid: File[] = [];
    for (const file of files) {
      const problem = validate(file);
      if (problem) toast.error(`${file.name}: ${problem}`);
      else valid.push(file);
    }

    let succeeded = 0;
    for (const [i, file] of valid.entries()) {
      setProgress({ done: i, total: valid.length, current: file.name });
      try {
        await uploadAndProcess(file);
        succeeded++;
      } catch (e) {
        toast.error(`${file.name}: ${e instanceof Error ? e.message : 'upload failed'}`);
      }
    }
    setProgress(null);

    if (succeeded > 0) {
      toast.success(`${succeeded} document${succeeded > 1 ? 's' : ''} added to the knowledge base`);
    }
    if (valid.length > 0) notifyDocumentsChanged();
    setFiles([]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const busy = progress !== null;

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div>
        <h2 className="font-semibold">Add recipes</h2>
        <p className="text-sm text-muted-foreground">
          Markdown (.md) or text (.txt) files, up to 1 MB each. Recipes are searchable right after processing.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="document-files" className="sr-only">
          Files to upload
        </Label>
        <Input
          id="document-files"
          ref={inputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(',')}
          multiple
          disabled={busy}
          onChange={e => setFiles(Array.from(e.currentTarget.files ?? []))}
        />
      </div>

      <Button onClick={handleUpload} disabled={busy || files.length === 0} className="w-full">
        {busy
          ? `Processing ${progress.done + 1} / ${progress.total}…`
          : files.length > 1
            ? `Upload ${files.length} files`
            : 'Upload'}
      </Button>

      {busy && (
        <p className="truncate text-xs text-muted-foreground" aria-live="polite">
          {progress.current}
        </p>
      )}
    </section>
  );
}
