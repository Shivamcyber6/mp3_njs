'use client';

import { useState } from 'react';
import { Heart, PanelRight, Pause, Play, SkipForward } from 'lucide-react';
import { useLibrary } from '@/lib/library';
import { usePlayer } from '@/lib/player';
import { cn } from '@/lib/utils';
import { Cover } from './Cover';
import { IconButton, SeekBar, TransportButtons, VolumeControl } from './Controls';
import { NowPlayingSheet } from './NowPlaying';

export function PlayerBar({ panelOpen, onTogglePanel }: { panelOpen: boolean; onTogglePanel: () => void }) {
  const p = usePlayer();
  const lib = useLibrary();
  const [sheet, setSheet] = useState(false);
  const t = p.current;
  const liked = t ? lib.liked.has(t.id) : false;
  const pct = p.duration ? (p.time / p.duration) * 100 : 0;

  return (
    <>
      {/* Mobile mini player */}
      <div className="fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-30 md:hidden">
        <div className="relative overflow-hidden rounded-xl border border-line bg-raised/95 shadow-2xl backdrop-blur">
          <div className="flex items-center gap-3 p-2">
            <button
              type="button"
              onClick={() => t && setSheet(true)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
              aria-label={t ? `Open now playing: ${t.title}` : 'Nothing playing'}
            >
              <Cover track={t} className="size-11" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{t?.title ?? 'Pick a track'}</span>
                <span className="block truncate text-xs text-muted">{t?.artist ?? 'Tap any song to start'}</span>
              </span>
            </button>
            <button
              type="button"
              onClick={p.toggle}
              className="grid size-10 place-items-center rounded-full text-fg"
              aria-label={p.isPlaying ? 'Pause' : 'Play'}
            >
              {p.isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
            </button>
            <button type="button" onClick={p.next} className="grid size-10 place-items-center rounded-full text-fg" aria-label="Next">
              <SkipForward size={20} fill="currentColor" />
            </button>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-line">
            <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* Desktop bar */}
      <footer className="hidden h-[84px] shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] items-center gap-4 border-t border-line bg-panel px-4 md:grid">
        <div className="flex min-w-0 items-center gap-3">
          <Cover track={t} className="size-14" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{t?.title ?? 'Nothing playing'}</p>
            <p className="truncate text-xs text-muted">{t ? `${t.artist} · ${t.album}` : 'Choose a track to start'}</p>
          </div>
          {t && (
            <button
              type="button"
              onClick={() => lib.toggleLike(t.id)}
              className={cn('grid size-8 shrink-0 place-items-center rounded-full', liked ? 'text-accent' : 'text-faint hover:text-fg')}
              aria-label={liked ? 'Remove from Liked' : 'Add to Liked'}
              aria-pressed={liked}
            >
              <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>

        <div className="flex flex-col items-center gap-1">
          <TransportButtons />
          <div className="w-full max-w-xl">
            <SeekBar />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <VolumeControl />
          <IconButton
            label={panelOpen ? 'Hide now playing' : 'Show now playing'}
            pressed={panelOpen}
            onClick={onTogglePanel}
            className="hidden xl:grid"
          >
            <PanelRight size={18} />
          </IconButton>
        </div>
      </footer>

      {sheet && t && <NowPlayingSheet onClose={() => setSheet(false)} />}
    </>
  );
}
