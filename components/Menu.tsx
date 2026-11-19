'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type MenuItem =
  | { label: string; onSelect: () => void; danger?: boolean; icon?: React.ReactNode }
  | { separator: true }
  | { heading: string };

/** A small popover menu, positioned next to its button and kept on screen. */
export function Menu({
  anchor,
  items,
  onClose,
}: {
  anchor: HTMLElement;
  items: MenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const a = anchor.getBoundingClientRect();
    const m = ref.current!.getBoundingClientRect();
    const gap = 6;
    let top = a.bottom + gap;
    if (top + m.height > window.innerHeight - 8) top = Math.max(8, a.top - m.height - gap);
    let left = a.right - m.width;
    left = Math.max(8, Math.min(left, window.innerWidth - m.width - 8));
    setPos({ top, left });
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [anchor]);

  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      const els = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
      const i = els.indexOf(document.activeElement as HTMLElement);
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        anchor.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        els[(i + 1) % els.length]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        els[(i - 1 + els.length) % els.length]?.focus();
      } else if (e.key === 'Tab') onClose();
    };
    const scroll = () => onClose();
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key, true);
    document.getElementById('main')?.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('resize', scroll);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('keydown', key, true);
      document.getElementById('main')?.removeEventListener('scroll', scroll);
      window.removeEventListener('resize', scroll);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      className="fade-in fixed z-50 max-h-[70vh] min-w-52 overflow-y-auto rounded-xl border border-line bg-raised p-1.5 shadow-2xl"
      style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }}
    >
      {items.map((item, i) => {
        if ('separator' in item) return <div key={i} className="my-1 h-px bg-line" />;
        if ('heading' in item)
          return (
            <div key={i} className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-wider text-faint uppercase">
              {item.heading}
            </div>
          );
        return (
          <button
            key={i}
            type="button"
            role="menuitem"
            onClick={() => {
              onClose();
              item.onSelect();
            }}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm outline-none hover:bg-hover focus-visible:bg-hover ${
              item.danger ? 'text-red-400' : 'text-fg'
            }`}
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
