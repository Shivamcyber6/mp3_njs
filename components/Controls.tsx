'use client';

import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from 'lucide-react';
import { usePlayer } from '@/lib/player';
import { cn, formatTime } from '@/lib/utils';

export function TransportButtons({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const p = usePlayer();
  const big = size === 'lg';
  const RepeatIcon = p.repeat === 'one' ? Repeat1 : Repeat;
  return (
    <div className={cn('flex items-center', big ? 'gap-6' : 'gap-2 md:gap-4')}>
      <IconButton
        label={p.shuffle ? 'Turn shuffle off' : 'Turn shuffle on'}
        pressed={p.shuffle}
        onClick={p.toggleShuffle}
        className={cn(!big && 'hidden sm:grid')}
      >
        <Shuffle size={big ? 22 : 18} />
      </IconButton>
      <IconButton label="Previous" onClick={p.previous}>
        <SkipBack size={big ? 28 : 20} fill="currentColor" />
      </IconButton>
      <button
        type="button"
        onClick={p.toggle}
        aria-label={p.isPlaying ? 'Pause' : 'Play'}
        className={cn(
          'grid place-items-center rounded-full bg-fg text-bg transition hover:scale-105 active:scale-95',
          big ? 'size-16' : 'size-10',
        )}
      >
        {p.isPlaying ? (
          <Pause size={big ? 28 : 18} fill="currentColor" />
        ) : (
          <Play size={big ? 28 : 18} fill="currentColor" className="ml-0.5" />
        )}
      </button>
      <IconButton label="Next" onClick={p.next}>
        <SkipForward size={big ? 28 : 20} fill="currentColor" />
      </IconButton>
      <IconButton
        label={p.repeat === 'off' ? 'Repeat all' : p.repeat === 'all' ? 'Repeat one' : 'Turn repeat off'}
        pressed={p.repeat !== 'off'}
        onClick={p.cycleRepeat}
        className={cn(!big && 'hidden sm:grid')}
      >
        <RepeatIcon size={big ? 22 : 18} />
      </IconButton>
    </div>
  );
}

export function IconButton({
  label, onClick, pressed, className, children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={cn(
        'relative grid size-9 place-items-center rounded-full transition-colors hover:text-fg',
        pressed ? 'text-accent hover:text-accent' : 'text-muted',
        className,
      )}
    >
      {children}
      {pressed && <span className="absolute bottom-0.5 size-1 rounded-full bg-accent" aria-hidden="true" />}
    </button>
  );
}

export function SeekBar({ compact = false }: { compact?: boolean }) {
  const p = usePlayer();
  const max = p.duration || p.current?.duration || 0;
  const pct = max ? Math.min(100, (p.time / max) * 100) : 0;
  return (
    <div className="flex w-full items-center gap-2 text-[11px] tabular-nums text-faint">
      {!compact && <span className="w-9 text-right">{formatTime(p.time)}</span>}
      <input
        type="range"
        className="range"
        min={0}
        max={max || 1}
        step={0.1}
        value={Math.min(p.time, max || 0)}
        disabled={!p.current}
        onChange={(e) => p.seek(Number(e.target.value))}
        style={{ '--pct': `${pct}%` } as React.CSSProperties}
        aria-label="Seek"
        aria-valuetext={`${formatTime(p.time)} of ${formatTime(max)}`}
      />
      {!compact && <span className="w-9">{formatTime(max)}</span>}
    </div>
  );
}

export function VolumeControl() {
  const p = usePlayer();
  const level = p.muted ? 0 : p.volume;
  const Icon = level === 0 ? VolumeX : level < 0.5 ? Volume1 : Volume2;
  return (
    <div className="flex items-center gap-1">
      <IconButton label={p.muted ? 'Unmute' : 'Mute'} onClick={p.toggleMute}>
        <Icon size={18} />
      </IconButton>
      <input
        type="range"
        className="range w-24"
        min={0}
        max={1}
        step={0.01}
        value={level}
        onChange={(e) => p.setVolume(Number(e.target.value))}
        style={{ '--pct': `${level * 100}%` } as React.CSSProperties}
        aria-label="Volume"
        aria-valuetext={`${Math.round(level * 100)}%`}
      />
    </div>
  );
}
