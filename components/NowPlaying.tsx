'use client';

import { useEffect } from 'react';
import { ChevronDown, Heart, X } from 'lucide-react';
import { useLibrary } from '@/lib/library';
import { usePlayer } from '@/lib/player';
import { cn, formatTime } from '@/lib/utils';
import { Cover } from './Cover';
import { SeekBar, TransportButtons, VolumeControl } from './Controls';
import { Visualizer } from './Visualizer';

function UpNext({ limit = 20 }: { limit?: number }) {
  const { queue, current, playList } = usePlayer();
  const { trackById } = useLibrary();
  const at = current ? queue.indexOf(current.id) : -1;
  const upcoming = queue.slice(at + 1, at + 1 + limit).map((id) => trackById.get(id)).filter(Boolean);

  if (!upcoming.length) return <p className="px-1 text-sm text-faint">Nothing queued after this track.</p>;
  return (
    <ol className="space-y-0.5">
      {upcoming.map((t) => (
        <li key={t!.id}>
          <button
            type="button"
            onClick={() => playList(queue, t!.id)}
            className="flex w-full items-center gap-3 rounded-lg p-1.5 text-left hover:bg-hover"
          >
            <Cover track={t} className="size-9 rounded" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{t!.title}</span>
              <span className="block truncate text-xs text-muted">{t!.artist}</span>
            </span>
            <span className="text-xs tabular-nums text-faint">{formatTime(t!.duration)}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/** Desktop right-hand panel. */
export function NowPlayingPanel({ onClose }: { onClose: () => void }) {
  const { current } = usePlayer();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between px-5">
        <h2 className="text-sm font-semibold">Now playing</h2>
        <button
          type="button"
          onClick={onClose}
          className="grid size-8 place-items-center rounded-full text-muted hover:bg-hover hover:text-fg"
          aria-label="Hide now playing"
        >
          <X size={16} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <Cover track={current} className="w-full rounded-xl shadow-xl" />
        <div className="mt-4">
          <p className="truncate text-xl font-bold">{current?.title ?? 'Nothing playing'}</p>
          <p className="truncate text-sm text-muted">{current ? current.artist : 'Pick a track from the list'}</p>
          {current && (current.genre || current.bpm) && (
            <p className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {current.genre && <span className="rounded-full bg-raised px-2 py-0.5 text-muted">{current.genre}</span>}
              {current.bpm && <span className="rounded-full bg-raised px-2 py-0.5 text-muted">{current.bpm} BPM</span>}
            </p>
          )}
        </div>
        <Visualizer className="mt-5 h-16 w-full" bars={32} />
        <h3 className="mt-6 mb-2 text-xs font-semibold tracking-wider text-faint uppercase">Up next</h3>
        <UpNext />
      </div>
    </div>
  );
}

/** Mobile full-screen player. */
export function NowPlayingSheet({ onClose }: { onClose: () => void }) {
  const { current } = usePlayer();
  const lib = useLibrary();
  const liked = current ? lib.liked.has(current.id) : false;

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  if (!current) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Now playing"
      className="sheet-in fixed inset-0 z-40 flex flex-col overflow-y-auto bg-bg px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] md:hidden"
      style={{
        backgroundImage: 'linear-gradient(to bottom, var(--accent-soft), transparent 60%)',
      }}
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          className="grid size-10 place-items-center rounded-full text-fg hover:bg-hover"
          aria-label="Close now playing"
          autoFocus
        >
          <ChevronDown size={24} />
        </button>
        <p className="text-xs font-semibold tracking-wider text-muted uppercase">Now playing</p>
        <span className="size-10" />
      </div>

      <Cover track={current} className="mx-auto mt-4 w-full max-w-[min(24rem,42vh)] rounded-2xl shadow-2xl" />

      <div className="mx-auto mt-6 flex w-full max-w-sm items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-2xl font-bold">{current.title}</p>
          <p className="truncate text-muted">{current.artist}</p>
        </div>
        <button
          type="button"
          onClick={() => lib.toggleLike(current.id)}
          className={cn('grid size-11 place-items-center rounded-full', liked ? 'text-accent' : 'text-muted')}
          aria-label={liked ? 'Remove from Liked' : 'Add to Liked'}
          aria-pressed={liked}
        >
          <Heart size={24} fill={liked ? 'currentColor' : 'none'} />
        </button>
      </div>

      <Visualizer className="mx-auto mt-4 h-10 w-full max-w-sm" bars={36} />

      <div className="mx-auto mt-3 w-full max-w-sm">
        <SeekBar />
      </div>
      <div className="mx-auto mt-4 flex w-full max-w-sm justify-center">
        <TransportButtons size="lg" />
      </div>
      <div className="mx-auto mt-6 flex w-full max-w-sm justify-center">
        <VolumeControl />
      </div>

      <div className="mx-auto mt-8 w-full max-w-sm">
        <h3 className="mb-2 text-xs font-semibold tracking-wider text-faint uppercase">Up next</h3>
        <UpNext limit={10} />
      </div>
    </div>
  );
}
