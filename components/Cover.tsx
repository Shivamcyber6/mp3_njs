import type { Track } from '@/lib/types';
import { cn, hueFor } from '@/lib/utils';

/** Album art: the file's embedded picture, or a generated gradient unique to the track. */
export function Cover({ track, className, seed }: { track?: Track | null; className?: string; seed?: string }) {
  if (track?.cover) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={track.cover} alt="" className={cn('aspect-square shrink-0 rounded-md object-cover', className)} />;
  }
  const key = seed ?? track?.id ?? 'empty';
  const h = hueFor(key);
  const bars = Array.from({ length: 5 }, (_, i) => 30 + ((hueFor(key + i) % 60) as number));
  return (
    <div
      aria-hidden="true"
      className={cn('relative aspect-square shrink-0 overflow-hidden rounded-md', className)}
      style={{
        background: track || seed
          ? `radial-gradient(120% 120% at 15% 10%, hsl(${h} 85% 62%), hsl(${(h + 50) % 360} 70% 38%) 55%, hsl(${(h + 110) % 360} 60% 16%))`
          : 'var(--hover)',
      }}
    >
      {(track || seed) && (
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full opacity-45" preserveAspectRatio="none">
          {bars.map((height, i) => (
            <rect key={i} x={14 + i * 15} y={(100 - height) / 2} width="8" height={height} rx="4" fill="white" />
          ))}
        </svg>
      )}
    </div>
  );
}
