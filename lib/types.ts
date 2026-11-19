export type Track = {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre?: string;
  bpm?: number;
  duration: number; // seconds
  /** 'demo' tracks ship with the app; 'upload' tracks live in this browser's IndexedDB. */
  source: 'demo' | 'upload';
  /** URL for demo tracks. Uploaded tracks get an object URL created from IndexedDB when played. */
  src?: string;
  /** Embedded cover art as a data URL, if the file had one. */
  cover?: string;
  addedAt: number;
};

export type Playlist = {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
};

export type RepeatMode = 'off' | 'all' | 'one';

/** What the main panel is showing. */
export type View =
  | { kind: 'all' }
  | { kind: 'liked' }
  | { kind: 'uploads' }
  | { kind: 'playlist'; id: string };
