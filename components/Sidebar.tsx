'use client';

import { Heart, Keyboard, Library, ListMusic, Plus, Upload } from 'lucide-react';
import { useLibrary } from '@/lib/library';
import { usePlayer } from '@/lib/player';
import type { View } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Cover } from './Cover';
import { Logo } from './Logo';
import { UploadButton } from './UploadButton';

export function Sidebar({ view, go, onHelp }: { view: View; go: (v: View) => void; onHelp: () => void }) {
  const { tracks, liked, playlists, createPlaylist } = useLibrary();
  const { current, isPlaying } = usePlayer();
  const uploads = tracks.filter((t) => t.source === 'upload').length;

  const nav = [
    { kind: 'all' as const, label: 'All tracks', icon: Library, count: tracks.length },
    { kind: 'liked' as const, label: 'Liked', icon: Heart, count: liked.size },
    { kind: 'uploads' as const, label: 'Your uploads', icon: Upload, count: uploads },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="hidden h-16 shrink-0 items-center px-5 md:flex">
        <Logo />
      </div>

      <nav aria-label="Library" className="px-3 pt-3 md:pt-0">
        <ul className="space-y-0.5">
          {nav.map(({ kind, label, icon: Icon, count }) => {
            const active = view.kind === kind;
            return (
              <li key={kind}>
                <button
                  type="button"
                  onClick={() => go({ kind })}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
                    active ? 'bg-raised text-fg' : 'text-muted hover:bg-hover hover:text-fg',
                  )}
                >
                  <Icon size={18} className={active ? 'text-accent' : ''} />
                  <span className="flex-1">{label}</span>
                  <span className="text-xs tabular-nums text-faint">{count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-6 flex items-center justify-between px-6">
        <h2 className="text-xs font-semibold tracking-wider text-faint uppercase">Playlists</h2>
        <button
          type="button"
          onClick={() => go({ kind: 'playlist', id: createPlaylist().id })}
          className="grid size-7 place-items-center rounded-md text-muted hover:bg-hover hover:text-fg"
          aria-label="New playlist"
          title="New playlist"
        >
          <Plus size={16} />
        </button>
      </div>

      <ul className="mt-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {playlists.length === 0 && (
          <li className="px-3 py-2 text-sm text-faint">No playlists yet. Press + to make one.</li>
        )}
        {playlists.map((p) => {
          const active = view.kind === 'playlist' && view.id === p.id;
          const playingHere = !!current && p.trackIds.includes(current.id) && isPlaying;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => go({ kind: 'playlist', id: p.id })}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors',
                  active ? 'bg-raised' : 'hover:bg-hover',
                )}
              >
                <Cover seed={p.id} className="size-9 rounded" />
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-sm font-medium', active ? 'text-fg' : 'text-fg/90')}>
                    {p.name}
                  </span>
                  <span className="block text-xs text-faint">
                    {p.trackIds.length} {p.trackIds.length === 1 ? 'track' : 'tracks'}
                  </span>
                </span>
                {playingHere && <ListMusic size={14} className="text-accent" aria-label="Playing" />}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="space-y-2 border-t border-line p-3">
        <UploadButton className="w-full" />
        <button
          type="button"
          onClick={onHelp}
          className="hidden w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-faint hover:bg-hover hover:text-fg md:flex"
        >
          <Keyboard size={14} /> Keyboard shortcuts <kbd className="ml-auto rounded border border-line px-1.5">?</kbd>
        </button>
      </div>
    </div>
  );
}
