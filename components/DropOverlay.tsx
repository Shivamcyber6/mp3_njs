'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useImport } from './UploadButton';

/** Drag audio files anywhere onto the page to add them. */
export function DropOverlay() {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const { importFiles } = useImport();
  const importRef = useRef(importFiles);
  importRef.current = importFiles;

  useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current++;
      setOver(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (!depth.current) setOver(false);
    };
    const overFn = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setOver(false);
      importRef.current(Array.from(e.dataTransfer?.files ?? []));
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', overFn);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', overFn);
      window.removeEventListener('drop', drop);
    };
  }, []);

  if (!over) return null;
  return (
    <div className="fade-in pointer-events-none fixed inset-0 z-50 grid place-items-center bg-bg/85 p-6 backdrop-blur-sm">
      <div className="grid place-items-center gap-3 rounded-2xl border-2 border-dashed border-accent px-12 py-10 text-center">
        <Upload size={32} className="text-accent" />
        <p className="text-lg font-semibold">Drop to add to your library</p>
        <p className="text-sm text-muted">MP3, M4A, FLAC, WAV or OGG. Files stay in this browser.</p>
      </div>
    </div>
  );
}
