'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, Clock3, Heart, ListEnd, ListPlus, MoreHorizontal, Pause, Play, Plus, Search, Shuffle, Trash2, X,
} from 'lucide-react';
import { useLibrary } from '@/lib/library';
import { usePlayer } from '@/lib/player';
import { useToast } from '@/lib/toast';
import type { Track, View } from '@/lib/types';
import { cn, formatTime, formatTotal, matches } from '@/lib/utils';
import { Cover } from './Cover';
import { Menu, type MenuItem } from './Menu';
import { UploadButton } from './UploadButton';

type Props = { view: View; go: (v: View) => void; query: string; setQuery: (q: string) => void };

export function TrackView({ view, go, query, setQuery }: Props) {
  const lib = useLibrary();
  const player = usePlayer();
  const toast = useToast();
  const listRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(query);

  const playlist = view.kind === 'playlist' ? lib.playlists.find((p) => p.id === view.id) : undefined;

  const base: Track[] = useMemo(() => {
    switch (view.kind) {
      case 'liked':
        return lib.tracks.filter((t) => lib.liked.has(t.id));
      case 'uploads':
        return lib.tracks.filter((t) => t.source === 'upload');
      case 'playlist':
        return (playlist?.trackIds ?? []).map((id) => lib.trackById.get(id)).filter((t): t is Track => !!t);
      default:
        return lib.tracks;
    }
  }, [view.kind, lib.tracks, lib.liked, lib.trackById, playlist]);

  const shown = useMemo(
    () => (query ? base.filter((t) => matches(query, [t.title, t.artist, t.album, t.genre])) : base),
    [base, query],
  );

  const ids = useMemo(() => shown.map((t) => t.id), [shown]);
  const total = base.reduce((s, t) => s + t.duration, 0);
  const playingThis = !!player.current && ids.includes(player.current.id);

  const title =
    view.kind === 'liked' ? 'Liked' : view.kind === 'uploads' ? 'Your uploads' : playlist?.name ?? 'All tracks';
  const kindLabel = view.kind === 'playlist' ? 'Playlist' : 'Library';

  const onPlayAll = () => {
    if (playingThis) player.toggle();
    else player.playList(ids);
  };

  const onShuffleAll = () => {
    if (!player.shuffle) player.toggleShuffle();
    player.playList(ids, ids[Math.floor(Math.random() * ids.length)]);
  };

  // j/k or arrows move between rows; Enter plays.
  const onListKey = (e: React.KeyboardEvent) => {
    const rows = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-row]') ?? []);
    const i = rows.indexOf(document.activeElement as HTMLElement);
    if (i === -1) return;
    if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault();
      rows[Math.min(rows.length - 1, i + 1)]?.focus();
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault();
      rows[Math.max(0, i - 1)]?.focus();
    }
  };

  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onSearch = (v: string) => {
    setDraft(v);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setQuery(v.trim()), 150);
  };

  return (
    <div className="pb-36 md:pb-32">
      {/* Header */}
      <section
        className="relative px-4 pt-6 pb-5 md:px-8 md:pt-8"
        style={{
          background: `linear-gradient(to bottom, color-mix(in oklab, ${
            playlist ? `hsl(${hueOf(playlist.id)} 70% 45%)` : 'var(--accent)'
          } 22%, transparent), transparent)`,
        }}
      >
        <div className="flex flex-row items-end gap-4 md:gap-5">
          {view.kind === 'playlist' ? (
            <Cover seed={view.id} className="size-24 rounded-xl shadow-2xl sm:size-36 md:size-44" />
          ) : (
            <LibraryArt kind={view.kind} />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wider text-muted uppercase">{kindLabel}</p>
            {playlist ? (
              <EditableTitle key={playlist.id} value={playlist.name} onSave={(n) => lib.renamePlaylist(playlist.id, n)} />
            ) : (
              <h1 className="mt-1 truncate text-2xl font-bold tracking-tight sm:text-3xl md:text-5xl">{title}</h1>
            )}
            <p className="mt-2 text-sm text-muted">
              {base.length} {base.length === 1 ? 'track' : 'tracks'}
              {base.length > 0 && <> · {formatTotal(total)}</>}
              {view.kind === 'uploads' && ' · stored only in this browser'}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onPlayAll}
            disabled={!ids.length}
            className="grid size-12 place-items-center rounded-full bg-accent text-accent-ink shadow-lg transition hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
            aria-label={playingThis && player.isPlaying ? 'Pause' : 'Play all'}
          >
            {playingThis && player.isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={onShuffleAll}
            disabled={ids.length < 2}
            className="grid size-10 place-items-center rounded-full text-muted hover:bg-hover hover:text-fg disabled:opacity-40"
            aria-label="Shuffle play"
            title="Shuffle play"
          >
            <Shuffle size={20} />
          </button>
          {playlist && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete “${playlist.name}”? Tracks stay in your library.`)) {
                  lib.deletePlaylist(playlist.id);
                  go({ kind: 'all' });
                  toast('Playlist deleted');
                }
              }}
              className="grid size-10 place-items-center rounded-full text-muted hover:bg-hover hover:text-red-400"
              aria-label="Delete playlist"
              title="Delete playlist"
            >
              <Trash2 size={18} />
            </button>
          )}

          <label className="relative ml-auto w-full sm:w-64">
            <span className="sr-only">Search tracks</span>
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
            <input
              type="search"
              value={draft}
              onChange={(e) => onSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  onSearch('');
                  e.currentTarget.blur();
                } else if (e.key === 'Enter' && ids.length) player.playList(ids);
              }}
              placeholder="Search title, artist, genre"
              className="h-10 w-full rounded-full border border-line bg-panel pr-9 pl-9 text-sm placeholder:text-faint focus:border-accent focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {draft && (
              <button
                type="button"
                onClick={() => onSearch('')}
                className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-faint hover:text-fg"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
            {!draft && (
              <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-line px-1.5 text-[11px] text-faint md:block">
                /
              </kbd>
            )}
          </label>
        </div>
      </section>

      {/* Track list */}
      <div className="px-2 md:px-6" ref={listRef} onKeyDown={onListKey}>
        {shown.length > 0 && (
          <div
            className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-3 py-2 text-xs font-medium tracking-wide text-faint uppercase md:grid-cols-[2rem_minmax(0,1.6fr)_minmax(0,1fr)_5rem_auto]"
            aria-hidden="true"
          >
            <span className="text-center">#</span>
            <span>Title</span>
            <span className="hidden md:block">Album</span>
            <span className="hidden justify-self-end md:block"><Clock3 size={14} /></span>
            <span className="w-16" />
          </div>
        )}

        <ul role="list" className="py-2">
          {shown.map((track, i) => (
            <TrackRow
              key={track.id}
              track={track}
              index={i}
              query={query}
              view={view}
              onPlay={() => {
                if (player.current?.id === track.id) player.toggle();
                else player.playList(ids, track.id);
              }}
              canMove={!!playlist && !query}
              onMove={(dir) => playlist && lib.moveInPlaylist(playlist.id, i, i + dir)}
              isLast={i === shown.length - 1}
            />
          ))}
        </ul>

        {shown.length === 0 && <Empty view={view} query={query} go={go} />}

        {playlist && !query && <Suggestions playlistId={playlist.id} exclude={playlist.trackIds} />}
      </div>
    </div>
  );
}

function hueOf(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

function LibraryArt({ kind }: { kind: 'all' | 'liked' | 'uploads' }) {
  const Icon = kind === 'liked' ? Heart : kind === 'uploads' ? ListPlus : null;
  return (
    <div className="grid size-24 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent to-[#7a2bd6] shadow-2xl sm:size-36 md:size-44">
      {Icon ? (
        <Icon size={44} className="text-white" fill={kind === 'liked' ? 'currentColor' : 'none'} />
      ) : (
        <svg viewBox="0 0 64 64" className="size-14 text-white sm:size-20" aria-hidden="true">
          {[14, 30, 22, 40, 18].map((h, i) => (
            <rect key={i} x={6 + i * 11} y={32 - h / 2} width="6" height={h} rx="3" fill="currentColor" />
          ))}
        </svg>
      )}
    </div>
  );
}

function EditableTitle({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  if (!editing)
    return (
      <h1 className="mt-1">
        <button
          type="button"
          onClick={() => {
            setText(value);
            setEditing(true);
          }}
          className="max-w-full truncate text-left text-2xl font-bold tracking-tight hover:opacity-80 sm:text-3xl md:text-5xl"
          title="Rename playlist"
        >
          {value}
        </button>
      </h1>
    );

  const commit = () => {
    setEditing(false);
    if (text.trim() && text.trim() !== value) onSave(text);
  };

  return (
    <input
      autoFocus
      value={text}
      maxLength={80}
      aria-label="Playlist name"
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setEditing(false);
      }}
      className="mt-1 w-full rounded-md border border-line bg-panel px-2 text-3xl font-bold tracking-tight focus:border-accent focus:outline-none md:text-5xl"
    />
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const words = query.split(/\s+/).filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!words.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(${words.join('|')})`, 'gi'));
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <mark key={i} className="rounded-sm bg-accent-soft text-fg">
            {p}
          </mark>
        ) : (
          p
        ),
      )}
    </>
  );
}

function TrackRow({
  track, index, query, view, onPlay, canMove, onMove, isLast,
}: {
  track: Track;
  index: number;
  query: string;
  view: View;
  onPlay: () => void;
  canMove: boolean;
  onMove: (dir: 1 | -1) => void;
  isLast: boolean;
}) {
  const lib = useLibrary();
  const player = usePlayer();
  const toast = useToast();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const isCurrent = player.current?.id === track.id;
  const liked = lib.liked.has(track.id);
  const closeMenu = useCallback(() => setMenuAnchor(null), []);

  const items: MenuItem[] = [
    { label: 'Play next', icon: <ListEnd size={16} />, onSelect: () => { player.playNext(track.id); toast('Playing next'); } },
    { label: liked ? 'Remove from Liked' : 'Add to Liked', icon: <Heart size={16} />, onSelect: () => lib.toggleLike(track.id) },
    { separator: true },
    { heading: 'Add to playlist' },
    {
      label: 'New playlist…',
      icon: <Plus size={16} />,
      onSelect: () => {
        const name = prompt('Playlist name', track.title);
        if (name !== null) {
          lib.createPlaylist(name || undefined, [track.id]);
          toast(`Created “${name || 'playlist'}”`);
        }
      },
    },
    ...lib.playlists
      .filter((p) => !(view.kind === 'playlist' && p.id === view.id))
      .map((p) => ({
        label: p.name,
        icon: <ListPlus size={16} />,
        onSelect: () => toast(lib.addToPlaylist(p.id, track.id) ? `Added to “${p.name}”` : `Already in “${p.name}”`),
      })),
  ];
  if (canMove) {
    items.push({ separator: true });
    if (index > 0) items.push({ label: 'Move up', icon: <ArrowUp size={16} />, onSelect: () => onMove(-1) });
    if (!isLast) items.push({ label: 'Move down', icon: <ArrowDown size={16} />, onSelect: () => onMove(1) });
  }
  if (view.kind === 'playlist') {
    items.push({ separator: true }, {
      label: 'Remove from this playlist', icon: <X size={16} />, onSelect: () => lib.removeFromPlaylist(view.id, track.id),
    });
  }
  if (track.source === 'upload') {
    items.push({ separator: true }, {
      label: 'Delete from library', icon: <Trash2 size={16} />, danger: true,
      onSelect: () => {
        if (confirm(`Delete “${track.title}” from this browser?`)) lib.removeTrack(track.id).then(() => toast('Track deleted'));
      },
    });
  }

  return (
    <li>
      <div
        data-row
        tabIndex={0}
        role="button"
        aria-label={`${isCurrent && player.isPlaying ? 'Pause' : 'Play'} ${track.title} by ${track.artist}`}
        onClick={onPlay}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onPlay();
          }
        }}
        className={cn(
          'group grid cursor-pointer grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-2 outline-none select-none hover:bg-hover focus-visible:bg-hover focus-visible:ring-1 focus-visible:ring-accent md:grid-cols-[2rem_minmax(0,1.6fr)_minmax(0,1fr)_5rem_auto]',
          isCurrent && 'bg-accent-soft hover:bg-accent-soft',
        )}
      >
        <span className="grid place-items-center text-sm tabular-nums text-faint">
          {isCurrent ? (
            <span className={cn('eq group-hover:hidden', !player.isPlaying && 'paused')} aria-hidden="true">
              <span /><span /><span />
            </span>
          ) : (
            <span className="group-hover:hidden">{index + 1}</span>
          )}
          <span className="hidden text-fg group-hover:block">
            {isCurrent && player.isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
          </span>
        </span>

        <span className="flex min-w-0 items-center gap-3">
          <Cover track={track} className="size-10" />
          <span className="min-w-0">
            <span className={cn('block truncate text-[15px] font-medium', isCurrent && 'text-accent')}>
              <Highlight text={track.title} query={query} />
            </span>
            <span className="block truncate text-[13px] text-muted">
              <Highlight text={track.artist} query={query} />
              {track.genre && <span className="text-faint"> · <Highlight text={track.genre} query={query} /></span>}
            </span>
          </span>
        </span>

        <span className="hidden truncate text-sm text-muted md:block">
          <Highlight text={track.album} query={query} />
        </span>

        <span className="hidden justify-self-end text-sm tabular-nums text-muted md:block">{formatTime(track.duration)}</span>

        <span className="flex items-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              lib.toggleLike(track.id);
            }}
            className={cn(
              'grid size-8 place-items-center rounded-full hover:bg-raised',
              liked ? 'text-accent' : 'text-faint opacity-100 hover:text-fg md:opacity-0 md:group-hover:opacity-100 md:group-focus-visible:opacity-100',
            )}
            aria-label={liked ? `Unlike ${track.title}` : `Like ${track.title}`}
            aria-pressed={liked}
          >
            <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuAnchor(menuAnchor ? null : e.currentTarget);
            }}
            className="grid size-8 place-items-center rounded-full text-faint hover:bg-raised hover:text-fg"
            aria-label={`More options for ${track.title}`}
            aria-haspopup="menu"
            aria-expanded={!!menuAnchor}
          >
            <MoreHorizontal size={18} />
          </button>
        </span>
      </div>
      {menuAnchor && <Menu anchor={menuAnchor} items={items} onClose={closeMenu} />}
    </li>
  );
}

function Empty({ view, query, go }: { view: View; query: string; go: (v: View) => void }) {
  if (query)
    return (
      <div className="px-4 py-16 text-center">
        <p className="font-semibold">No tracks match “{query}”</p>
        <p className="mt-1 text-sm text-muted">Try fewer words, or search by genre.</p>
      </div>
    );
  if (view.kind === 'liked')
    return (
      <div className="px-4 py-16 text-center">
        <Heart size={28} className="mx-auto text-faint" />
        <p className="mt-3 font-semibold">Nothing liked yet</p>
        <p className="mt-1 text-sm text-muted">Tap the heart on any track to keep it here.</p>
        <button type="button" onClick={() => go({ kind: 'all' })} className="mt-4 text-sm font-semibold text-accent hover:underline">
          Browse all tracks
        </button>
      </div>
    );
  if (view.kind === 'uploads')
    return (
      <div className="mx-auto max-w-md px-4 py-14 text-center">
        <p className="font-semibold">Play your own music</p>
        <p className="mt-1 text-sm text-muted">
          Add MP3, M4A, FLAC, WAV or OGG files, or drag them onto the page. They’re saved in this browser
          only and never uploaded to a server.
        </p>
        <UploadButton className="mx-auto mt-5" label="Choose files" />
      </div>
    );
  return (
    <div className="px-4 py-10 text-center text-sm text-muted">
      This playlist is empty. Add tracks from the suggestions below, or with the ⋯ menu on any track.
    </div>
  );
}

function Suggestions({ playlistId, exclude }: { playlistId: string; exclude: string[] }) {
  const lib = useLibrary();
  const picks = lib.tracks.filter((t) => !exclude.includes(t.id)).slice(0, 6);
  if (!picks.length) return null;
  return (
    <section className="mt-8 px-3">
      <h2 className="text-lg font-bold">Add to this playlist</h2>
      <ul className="mt-3 space-y-1">
        {picks.map((t) => (
          <li key={t.id} className="flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-hover">
            <Cover track={t} className="size-10" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{t.title}</span>
              <span className="block truncate text-xs text-muted">{t.artist}</span>
            </span>
            <button
              type="button"
              onClick={() => lib.addToPlaylist(playlistId, t.id)}
              className="rounded-full border border-line px-4 py-1.5 text-sm font-semibold hover:border-fg"
              aria-label={`Add ${t.title}`}
            >
              Add
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
