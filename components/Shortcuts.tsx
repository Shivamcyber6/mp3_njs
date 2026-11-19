'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

const rows: [string[], string][] = [
  [['Space'], 'Play / pause'],
  [['←', '→'], 'Seek 5 seconds'],
  [['Shift', '←'], 'Previous track'],
  [['Shift', '→'], 'Next track'],
  [['M'], 'Mute'],
  [['S'], 'Shuffle'],
  [['R'], 'Repeat off / all / one'],
  [['/'], 'Search'],
  [['J', 'K'], 'Move through the track list'],
  [['Enter'], 'Play the focused track'],
  [['?'], 'Show this list'],
];

export function Shortcuts({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    return () => d?.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && onClose()}
      className="fade-in m-auto w-[min(92vw,26rem)] rounded-2xl border border-line bg-raised p-0 text-fg shadow-2xl backdrop:bg-black/60"
      aria-labelledby="shortcuts-title"
    >
      <div className="flex items-center justify-between px-5 pt-4">
        <h2 id="shortcuts-title" className="font-semibold">Keyboard shortcuts</h2>
        <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-full text-muted hover:bg-hover hover:text-fg" aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <dl className="space-y-2.5 px-5 pt-3 pb-5 text-sm">
        {rows.map(([keys, label]) => (
          <div key={label} className="flex items-center justify-between gap-4">
            <dt className="text-muted">{label}</dt>
            <dd className="flex gap-1">
              {keys.map((k) => (
                <kbd key={k} className="min-w-7 rounded-md border border-line bg-panel px-1.5 py-0.5 text-center text-xs font-medium">
                  {k}
                </kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </dialog>
  );
}
