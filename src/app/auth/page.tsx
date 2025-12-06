import { Suspense } from 'react';
import AuthPageClient from './AuthPageClient';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Log In or Sign Up',
};

export default function Page() {
  return (
    <Suspense>
      <AuthPageClient />
    </Suspense>
  );
}
