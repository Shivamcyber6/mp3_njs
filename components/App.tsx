'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Menu as MenuIcon, X } from 'lucide-react';
import { LibraryProvider, useLibrary } from '@/lib/library';
import { PlayerProvider } from '@/lib/player';
import { ToastProvider, useToast } from '@/lib/toast';
import type { View } from '@/lib/types';
import { Sidebar } from './Sidebar';
import { TrackView } from './TrackView';
import { PlayerBar } from './PlayerBar';
import { NowPlayingPanel } from './NowPlaying';
import { DropOverlay } from './DropOverlay';
import { Shortcuts } from './Shortcuts';
import { Logo } from './Logo';

export function App() {
  return (
    <ToastProvider>
      <LibraryProvider>
        <PlayerProvider>
          <Shell />
        </PlayerProvider>
      </LibraryProvider>
    </ToastProvider>
  );
}

function useView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const view = useMemo<View>(() => {
    const p = params.get('p');
    if (p) return { kind: 'playlist', id: p };
    const v = params.get('view');
    if (v === 'liked' || v === 'uploads') return { kind: v };
    return { kind: 'all' };
  }, [params]);

  const query = params.get('q') ?? '';

  const go = useCallback(
    (next: View) => {
      const sp = new URLSearchParams();
      if (next.kind === 'playlist') sp.set('p', next.id);
      else if (next.kind !== 'all') sp.set('view', next.kind);
      const qs = sp.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const setQuery = useCallback(
    (q: string) => {
      // Read the live URL, not the render-time params, so a pending navigation is never overwritten.
      const sp = new URLSearchParams(window.location.search);
      if (q) sp.set('q', q);
      else sp.delete('q');
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  return { view, go, query, setQuery };
}

function Shell() {
  const { view, go, query, setQuery } = useView();
  const { playlists, ready } = useLibrary();
  const [menuOpen, setMenuOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const toast = useToast();

  // A playlist link from another browser (or a deleted playlist) falls back to the library.
  useEffect(() => {
    if (ready && view.kind === 'playlist' && !playlists.some((p) => p.id === view.id)) {
      toast('That playlist isn’t in this browser');
      go({ kind: 'all' });
    }
  }, [ready, view, playlists, go, toast]);

  useEffect(() => setMenuOpen(false), [view]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, [contenteditable="true"]')) return;
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setHelpOpen((o) => !o);
      } else if (e.key === '/') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
      } else if (e.key === 'Escape') {
        setHelpOpen(false);
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-fg">
      {/* Mobile top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4 md:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="grid size-10 place-items-center rounded-full text-muted hover:bg-hover hover:text-fg"
          aria-label={menuOpen ? 'Close library menu' : 'Open library menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={20} /> : <MenuIcon size={20} />}
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Sidebar: fixed column on desktop, slide-over drawer on mobile */}
        <aside
          className={`absolute inset-y-0 left-0 z-30 w-72 border-r border-line bg-panel pb-20 transition-transform duration-200 md:static md:pb-0 md:w-64 md:translate-x-0 lg:w-72 ${
            menuOpen ? 'translate-x-0 shadow-2xl' : 'invisible -translate-x-full md:visible'
          }`}
        >
          <Sidebar view={view} go={go} onHelp={() => setHelpOpen(true)} />
        </aside>
        {menuOpen && (
          <button
            type="button"
            aria-label="Close library menu"
            className="fade-in absolute inset-0 z-20 bg-black/50 md:hidden"
            onClick={() => setMenuOpen(false)}
          />
        )}

        <main className="min-w-0 flex-1 overflow-y-auto" id="main">
          <TrackView key={view.kind === 'playlist' ? view.id : view.kind} view={view} go={go} query={query} setQuery={setQuery} />
        </main>

        {panelOpen && (
          <aside className="hidden w-80 shrink-0 border-l border-line bg-panel xl:block">
            <NowPlayingPanel onClose={() => setPanelOpen(false)} />
          </aside>
        )}
      </div>

      <PlayerBar panelOpen={panelOpen} onTogglePanel={() => setPanelOpen((o) => !o)} />
      <DropOverlay />
      {helpOpen && <Shortcuts onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
