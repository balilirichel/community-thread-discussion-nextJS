import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useAppSelector } from '../../src/store/hooks';
import { useEffect, useState } from 'react';

const CreateProtocolPage = dynamic(() => import('../../src/pages/CreateProtocolPage'), { ssr: false });

export default function CreateProtocolPageWrapper() {
  const router = useRouter();
  const { isAuthenticated, isLoadingUser } = useAppSelector((s) => s.auth);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && !isLoadingUser && !isAuthenticated) {
      router.replace('/login');
    }
  }, [mounted, isLoadingUser, isAuthenticated, router]);

  if (!mounted || isLoadingUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#118451] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <CreateProtocolPage />;
}
