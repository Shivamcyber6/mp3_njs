export function Logo() {
  return (
    <div className="flex items-center gap-2.5 font-semibold tracking-tight">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <rect width="26" height="26" rx="7" fill="var(--accent)" />
        <g fill="var(--accent-ink)">
          <rect x="5.5" y="10" width="2.6" height="6" rx="1.3" />
          <rect x="10" y="6" width="2.6" height="14" rx="1.3" />
          <rect x="14.5" y="8.5" width="2.6" height="9" rx="1.3" />
          <rect x="19" y="11" width="2.6" height="4" rx="1.3" />
        </g>
      </svg>
      <span className="text-[17px]">Tempo</span>
    </div>
  );
}
