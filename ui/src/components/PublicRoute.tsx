import { type ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAppSelector } from '../store/hooks';

interface PublicRouteProps {
  children: ReactNode;
}

export function PublicRoute({ children }: PublicRouteProps) {
  const router = useRouter();
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && isAuthenticated) {
      router.replace('/');
    }
  }, [mounted, isAuthenticated, router]);

  if (!mounted) return null;

  if (isAuthenticated) return null;

  return <>{children}</>;
}
