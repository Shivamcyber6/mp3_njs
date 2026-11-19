'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { del, get, set } from 'idb-keyval';
import { defaultPlaylists, demoTracks } from './demo-tracks';
import type { Playlist, Track } from './types';
import { readStorage, uid, writeStorage } from './utils';

// Where things live (all in this browser, nothing is sent to a server):
//   localStorage  tempo:playlists, tempo:liked   small JSON
//   IndexedDB     tempo:uploads                  metadata of uploaded tracks
//                 tempo:audio:<id>               the audio file itself (Blob)
const PLAYLISTS_KEY = 'tempo:playlists';
const LIKED_KEY = 'tempo:liked';
const UPLOADS_KEY = 'tempo:uploads';
const audioKey = (id: string) => `tempo:audio:${id}`;

const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|webm)$/i;
const MAX_FILE_MB = 60;

type AddResult = { added: number; skipped: string[] };

type LibraryContext = {
  ready: boolean;
  tracks: Track[];
  trackById: Map<string, Track>;
  playlists: Playlist[];
  liked: Set<string>;
  addFiles: (files: File[]) => Promise<AddResult>;
  removeTrack: (id: string) => Promise<void>;
  getAudioUrl: (track: Track) => Promise<string | null>;
  toggleLike: (id: string) => void;
  createPlaylist: (name?: string, trackIds?: string[]) => Playlist;
  renamePlaylist: (id: string, name: string) => void;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (playlistId: string, trackId: string) => boolean;
  removeFromPlaylist: (playlistId: string, trackId: string) => void;
  moveInPlaylist: (playlistId: string, from: number, to: number) => void;
};

const Ctx = createContext<LibraryContext | null>(null);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  // The first render matches the static HTML (demo content only); saved data loads right after.
  const [ready, setReady] = useState(false);
  const [uploads, setUploads] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>(defaultPlaylists);
  const [liked, setLiked] = useState<Set<string>>(new Set());

  useEffect(() => {
    setPlaylists(readStorage(PLAYLISTS_KEY, defaultPlaylists));
    setLiked(new Set(readStorage<string[]>(LIKED_KEY, [])));
    get<Track[]>(UPLOADS_KEY)
      .then((saved) => setUploads(saved ?? []))
      .catch(() => setUploads([]))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) writeStorage(PLAYLISTS_KEY, playlists);
  }, [playlists, ready]);

  useEffect(() => {
    if (ready) writeStorage(LIKED_KEY, [...liked]);
  }, [liked, ready]);

  const tracks = useMemo(() => [...demoTracks, ...uploads], [uploads]);
  const trackById = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);

  const addFiles = useCallback(async (files: File[]): Promise<AddResult> => {
    const skipped: string[] = [];
    const added: Track[] = [];
    for (const file of files) {
      const isAudio = file.type.startsWith('audio/') || AUDIO_EXT.test(file.name);
      if (!isAudio) {
        skipped.push(`${file.name} (not an audio file)`);
        continue;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        skipped.push(`${file.name} (over ${MAX_FILE_MB} MB)`);
        continue;
      }
      try {
        const track = await readTrack(file);
        await set(audioKey(track.id), file);
        added.push(track);
      } catch {
        skipped.push(`${file.name} (could not be read)`);
      }
    }
    if (added.length) {
      setUploads((prev) => {
        const next = [...prev, ...added];
        set(UPLOADS_KEY, next).catch(() => {});
        return next;
      });
    }
    return { added: added.length, skipped };
  }, []);

  const removeTrack = useCallback(async (id: string) => {
    await del(audioKey(id)).catch(() => {});
    setUploads((prev) => {
      const next = prev.filter((t) => t.id !== id);
      set(UPLOADS_KEY, next).catch(() => {});
      return next;
    });
    setPlaylists((prev) => prev.map((p) => ({ ...p, trackIds: p.trackIds.filter((t) => t !== id) })));
    setLiked((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const getAudioUrl = useCallback(async (track: Track) => {
    if (track.source === 'demo') return track.src ?? null;
    const blob = await get<Blob>(audioKey(track.id)).catch(() => undefined);
    return blob ? URL.createObjectURL(blob) : null;
  }, []);

  const toggleLike = useCallback((id: string) => {
    setLiked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const createPlaylist = useCallback((name?: string, trackIds: string[] = []) => {
    const playlist: Playlist = {
      id: `pl-${uid()}`,
      name: name?.trim().slice(0, 80) || `My Playlist #${playlists.length + 1}`,
      trackIds,
      createdAt: Date.now(),
    };
    setPlaylists((prev) => [playlist, ...prev]);
    return playlist;
  }, [playlists.length]);

  const renamePlaylist = useCallback((id: string, name: string) => {
    const clean = name.trim();
    if (!clean) return;
    setPlaylists((prev) => prev.map((p) => (p.id === id ? { ...p, name: clean.slice(0, 80) } : p)));
  }, []);

  const deletePlaylist = useCallback((id: string) => {
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const addToPlaylist = useCallback(
    (playlistId: string, trackId: string) => {
      const playlist = playlists.find((p) => p.id === playlistId);
      if (!playlist || playlist.trackIds.includes(trackId)) return false;
      setPlaylists((prev) =>
        prev.map((p) => (p.id === playlistId ? { ...p, trackIds: [...p.trackIds, trackId] } : p)),
      );
      return true;
    },
    [playlists],
  );

  const removeFromPlaylist = useCallback((playlistId: string, trackId: string) => {
    setPlaylists((prev) =>
      prev.map((p) => (p.id === playlistId ? { ...p, trackIds: p.trackIds.filter((t) => t !== trackId) } : p)),
    );
  }, []);

  const moveInPlaylist = useCallback((playlistId: string, from: number, to: number) => {
    setPlaylists((prev) =>
      prev.map((p) => {
        if (p.id !== playlistId || from === to) return p;
        const ids = p.trackIds.slice();
        const [moved] = ids.splice(from, 1);
        ids.splice(Math.max(0, Math.min(ids.length, to)), 0, moved);
        return { ...p, trackIds: ids };
      }),
    );
  }, []);

  const value = useMemo(
    () => ({
      ready,
      tracks,
      trackById,
      playlists,
      liked,
      addFiles,
      removeTrack,
      getAudioUrl,
      toggleLike,
      createPlaylist,
      renamePlaylist,
      deletePlaylist,
      addToPlaylist,
      removeFromPlaylist,
      moveInPlaylist,
    }),
    [ready, tracks, trackById, playlists, liked, addFiles, removeTrack, getAudioUrl, toggleLike, createPlaylist,
      renamePlaylist, deletePlaylist, addToPlaylist, removeFromPlaylist, moveInPlaylist],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLibrary() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLibrary must be used inside <LibraryProvider>');
  return ctx;
}

/** Read tags, duration and cover art from an audio file, entirely in the browser. */
async function readTrack(file: File): Promise<Track> {
  const fallbackTitle = file.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ');
  let title = fallbackTitle;
  let artist = 'Unknown Artist';
  let album = 'Uploads';
  let genre: string | undefined;
  let bpm: number | undefined;
  let duration = 0;
  let cover: string | undefined;

  try {
    const { parseBlob } = await import('music-metadata');
    const meta = await parseBlob(file, { duration: true, skipCovers: false });
    title = meta.common.title?.trim() || fallbackTitle;
    artist = meta.common.artist?.trim() || artist;
    album = meta.common.album?.trim() || album;
    genre = meta.common.genre?.[0];
    bpm = meta.common.bpm ? Math.round(meta.common.bpm) : undefined;
    duration = meta.format.duration ?? 0;
    const pic = meta.common.picture?.[0];
    if (pic) cover = await shrinkCover(new Blob([new Uint8Array(pic.data)], { type: pic.format }));
  } catch {
    // Tags are optional: fall back to the file name.
  }

  if (!duration) duration = await probeDuration(file);
  if (!duration) throw new Error('Unplayable file');

  return {
    id: `up-${uid()}`,
    title,
    artist,
    album,
    genre,
    bpm,
    duration: Math.round(duration),
    source: 'upload',
    cover,
    addedAt: Date.now(),
  };
}

function probeDuration(file: Blob) {
  return new Promise<number>((resolve) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    const done = (d: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) ? d : 0);
    };
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => done(audio.duration);
    audio.onerror = () => done(0);
    audio.src = url;
  });
}

/** Downscale embedded artwork to 300px so it fits comfortably in IndexedDB. */
async function shrinkCover(blob: Blob) {
  try {
    const bitmap = await createImageBitmap(blob);
    const size = 300;
    const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return undefined;
  }
}
