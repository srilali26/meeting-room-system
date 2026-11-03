import { Suspense } from 'react';
import { CancelClientView } from './CancelClientView';

export const dynamic = 'force-dynamic';

export default function CancelPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-corporate-offwhite flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-corporate-navy border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <CancelClientView />
    </Suspense>
  );
}
