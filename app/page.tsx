import { Suspense } from 'react';
import { App } from '@/components/App';

export default function Page() {
  // The player is a client app; Suspense lets it read ?view= / ?q= from the URL in a static export.
  return (
    <Suspense fallback={<div className="h-dvh bg-bg" />}>
      <App />
    </Suspense>
  );
}
