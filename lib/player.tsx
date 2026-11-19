'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLibrary } from './library';
import { useToast } from './toast';
import type { RepeatMode, Track } from './types';
import { readStorage, shuffle as shuffled, writeStorage } from './utils';

const STATE_KEY = 'tempo:player';

type Saved = {
  trackId?: string;
  position?: number;
  queue?: string[];
  volume?: number;
  muted?: boolean;
  shuffle?: boolean;
  repeat?: RepeatMode;
};

type PlayerContext = {
  current: Track | null;
  queue: string[];
  isPlaying: boolean;
  time: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  /** Play `ids` as the queue, starting at `startId` (or the first / a random one). */
  playList: (ids: string[], startId?: string) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  playNext: (id: string) => void;
  getAnalyser: () => AnalyserNode | null;
};

const Ctx = createContext<PlayerContext | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { trackById, getAudioUrl, ready } = useLibrary();
  const toast = useToast();
  const audio = useRef<HTMLAudioElement>(null);
  const objectUrl = useRef<string | null>(null);
  const graph = useRef<{ ctx: AudioContext; analyser: AnalyserNode } | null>(null);
  const restored = useRef(false);
  const loadToken = useRef(0);
  const pendingSeek = useRef(0);

  const [currentId, setCurrentId] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [baseQueue, setBaseQueue] = useState<string[]>([]); // order before shuffling
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');

  const current = currentId ? trackById.get(currentId) ?? null : null;

  // Web Audio is created on the first play (browsers require a user gesture) and feeds the visualizer.
  const ensureGraph = useCallback(() => {
    const el = audio.current;
    if (!el || graph.current) {
      if (graph.current?.ctx.state === 'suspended') graph.current.ctx.resume().catch(() => {});
      return;
    }
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaElementSource(el);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      graph.current = { ctx, analyser };
    } catch {
      /* visualizer is optional */
    }
  }, []);

  /** Point the <audio> element at a track. Resolves once the source is set. */
  const load = useCallback(
    async (track: Track, { autoplay, at = 0 }: { autoplay: boolean; at?: number }) => {
      const el = audio.current;
      if (!el) return;
      const token = ++loadToken.current;
      const url = await getAudioUrl(track);
      if (token !== loadToken.current) {
        if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
        return; // a newer request won
      }
      if (!url) {
        toast(`Couldn't load “${track.title}”`);
        return;
      }
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = url.startsWith('blob:') ? url : null;

      setCurrentId(track.id);
      setDuration(track.duration);
      setTime(at);
      pendingSeek.current = at;
      el.src = url;
      if (autoplay) {
        ensureGraph();
        el.play().catch(() => setIsPlaying(false));
      }
    },
    [getAudioUrl, ensureGraph, toast],
  );

  const playId = useCallback(
    (id: string) => {
      const track = trackById.get(id);
      if (track) load(track, { autoplay: true });
    },
    [trackById, load],
  );

  const playList = useCallback(
    (ids: string[], startId?: string) => {
      if (!ids.length) return;
      const start = startId ?? (shuffle ? ids[Math.floor(Math.random() * ids.length)] : ids[0]);
      setBaseQueue(ids);
      setQueue(shuffle ? [start, ...shuffled(ids.filter((i) => i !== start))] : ids);
      playId(start);
    },
    [shuffle, playId],
  );

  const toggle = useCallback(() => {
    const el = audio.current;
    if (!el) return;
    if (!el.src) {
      const first = queue[0] ?? [...trackById.keys()][0];
      if (first) playList(queue.length ? queue : [...trackById.keys()], first);
      return;
    }
    if (el.paused) {
      ensureGraph();
      el.play().catch(() => {});
    } else el.pause();
  }, [queue, trackById, playList, ensureGraph]);

  const step = useCallback(
    (dir: 1 | -1, fromEnded = false) => {
      if (!queue.length || !currentId) return;
      const i = queue.indexOf(currentId);
      let n = i + dir;
      if (n >= queue.length || n < 0) {
        if (repeat === 'all' || !fromEnded) n = (n + queue.length) % queue.length;
        else {
          audio.current?.pause();
          if (audio.current) audio.current.currentTime = 0;
          return;
        }
      }
      playId(queue[n]);
    },
    [queue, currentId, repeat, playId],
  );

  const next = useCallback(() => step(1), [step]);
  const previous = useCallback(() => {
    const el = audio.current;
    if (el && el.currentTime > 3) {
      el.currentTime = 0;
      return;
    }
    step(-1);
  }, [step]);

  const seek = useCallback((s: number) => {
    const el = audio.current;
    if (!el || !Number.isFinite(s)) return;
    el.currentTime = Math.max(0, Math.min(s, el.duration || s));
    setTime(el.currentTime);
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    if (clamped > 0) setMuted(false);
  }, []);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  const toggleShuffle = useCallback(() => {
    const nextOn = !shuffle;
    setShuffle(nextOn);
    if (!baseQueue.length) return;
    if (!nextOn) setQueue(baseQueue);
    else {
      const rest = shuffled(baseQueue.filter((id) => id !== currentId));
      setQueue(currentId ? [currentId, ...rest] : rest);
    }
  }, [shuffle, baseQueue, currentId]);

  const cycleRepeat = useCallback(() => setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')), []);

  const playNext = useCallback(
    (id: string) => {
      if (!currentId) {
        playList([id], id);
        return;
      }
      const insert = (q: string[]) => {
        const without = q.filter((x) => x !== id);
        const i = without.indexOf(currentId);
        without.splice(i + 1, 0, id);
        return without;
      };
      setQueue(insert);
      setBaseQueue(insert);
    },
    [currentId, playList],
  );

  const getAnalyser = useCallback(() => graph.current?.analyser ?? null, []);

  // Apply volume.
  useEffect(() => {
    if (audio.current) {
      audio.current.volume = volume;
      audio.current.muted = muted;
    }
  }, [volume, muted]);

  // Restore the last session once the library (with uploads) has loaded.
  useEffect(() => {
    if (!ready || restored.current) return;
    restored.current = true;
    const saved = readStorage<Saved>(STATE_KEY, {});
    if (typeof saved.volume === 'number') setVolumeState(saved.volume);
    if (saved.muted) setMuted(true);
    if (saved.shuffle) setShuffle(true);
    if (saved.repeat) setRepeat(saved.repeat);
    const q = (saved.queue ?? []).filter((id) => trackById.has(id));
    if (q.length) {
      setQueue(q);
      setBaseQueue(q);
    }
    const track = saved.trackId ? trackById.get(saved.trackId) : undefined;
    if (track) load(track, { autoplay: false, at: saved.position ?? 0 });
  }, [ready, trackById, load]);

  // Save state. The position only counts in 5-second steps, so this runs rarely during playback.
  const savedTick = Math.floor(time / 5);
  useEffect(() => {
    if (!restored.current) return;
    writeStorage(STATE_KEY, {
      trackId: currentId ?? undefined,
      position: Math.floor(time),
      queue: queue.slice(0, 500),
      volume,
      muted,
      shuffle,
      repeat,
    } satisfies Saved);
  }, [currentId, savedTick, queue, volume, muted, shuffle, repeat]); // eslint-disable-line react-hooks/exhaustive-deps

  // If the current upload is deleted, stop.
  useEffect(() => {
    if (currentId && ready && !trackById.has(currentId)) {
      audio.current?.pause();
      audio.current?.removeAttribute('src');
      setCurrentId(null);
      setIsPlaying(false);
    }
    setQueue((q) => (q.every((id) => trackById.has(id)) ? q : q.filter((id) => trackById.has(id))));
  }, [trackById, currentId, ready]);

  // System media controls (lock screen, headphones, keyboard media keys).
  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist,
      album: current.album,
      artwork: current.cover
        ? [{ src: current.cover, sizes: '300x300', type: 'image/jpeg' }]
        : [{ src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' }],
    });
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => toggle()],
      ['pause', () => toggle()],
      ['previoustrack', () => previous()],
      ['nexttrack', () => next()],
      ['seekto', (d) => d.seekTime != null && seek(d.seekTime)],
      ['seekbackward', () => seek((audio.current?.currentTime ?? 0) - 10)],
      ['seekforward', () => seek((audio.current?.currentTime ?? 0) + 10)],
    ];
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        /* unsupported action */
      }
    }
  }, [current, toggle, previous, next, seek]);

  useEffect(() => {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, [contenteditable="true"], select')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = audio.current;
      switch (e.key) {
        case ' ':
          if (target.closest('button, [role="button"], a')) return; // let buttons handle Space
          e.preventDefault();
          toggle();
          break;
        case 'ArrowRight':
          if (target.closest('[role="slider"]')) return;
          e.preventDefault();
          if (e.shiftKey) next();
          else seek((el?.currentTime ?? 0) + 5);
          break;
        case 'ArrowLeft':
          if (target.closest('[role="slider"]')) return;
          e.preventDefault();
          if (e.shiftKey) previous();
          else seek((el?.currentTime ?? 0) - 5);
          break;
        case 'm':
          toggleMute();
          break;
        case 's':
          toggleShuffle();
          break;
        case 'r':
          cycleRepeat();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, next, previous, seek, toggleMute, toggleShuffle, cycleRepeat]);

  const value = useMemo(
    () => ({
      current, queue, isPlaying, time, duration, volume, muted, shuffle, repeat,
      playList, toggle, next, previous, seek, setVolume, toggleMute, toggleShuffle, cycleRepeat, playNext, getAnalyser,
    }),
    [current, queue, isPlaying, time, duration, volume, muted, shuffle, repeat, playList, toggle, next, previous, seek,
      setVolume, toggleMute, toggleShuffle, cycleRepeat, playNext, getAnalyser],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <audio
        ref={audio}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          if (Number.isFinite(el.duration)) setDuration(el.duration);
          if (pendingSeek.current) {
            el.currentTime = Math.min(pendingSeek.current, el.duration || pendingSeek.current);
            pendingSeek.current = 0;
          }
        }}
        onEnded={() => {
          if (repeat === 'one' && audio.current) {
            audio.current.currentTime = 0;
            audio.current.play().catch(() => {});
          } else step(1, true);
        }}
        onError={() => {
          if (audio.current?.getAttribute('src')) {
            setIsPlaying(false);
            toast('This track could not be played');
          }
        }}
      />
    </Ctx.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePlayer must be used inside <PlayerProvider>');
  return ctx;
}
