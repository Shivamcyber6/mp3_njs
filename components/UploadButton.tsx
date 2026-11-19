'use client';

import { useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { useLibrary } from '@/lib/library';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

export function useImport() {
  const { addFiles } = useLibrary();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const importFiles = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    try {
      const { added, skipped } = await addFiles(files);
      if (added) toast(`Added ${added} ${added === 1 ? 'track' : 'tracks'}`);
      if (skipped.length) toast(`Skipped ${skipped.length}: ${skipped.slice(0, 2).join(', ')}${skipped.length > 2 ? '…' : ''}`);
    } catch {
      toast('Your browser blocked storage, so files could not be saved');
    } finally {
      setBusy(false);
    }
  };

  return { importFiles, busy };
}

export function UploadButton({ className, label = 'Add your music' }: { className?: string; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const { importFiles, busy } = useImport();

  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className={cn(
          'flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60',
          className,
        )}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        {busy ? 'Reading files…' : label}
      </button>
      <input
        ref={input}
        type="file"
        accept="audio/*,.mp3,.m4a,.flac,.wav,.ogg,.opus"
        multiple
        hidden
        onChange={(e) => {
          importFiles(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
    </>
  );
}
