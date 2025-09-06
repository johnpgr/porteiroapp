export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import SuccessClient from './SuccessClient';

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Carregando...</div>}>
      <SuccessClient />
    </Suspense>
  );
}