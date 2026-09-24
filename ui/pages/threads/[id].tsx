import dynamic from 'next/dynamic';

const ThreadDetailsPage = dynamic(() => import('../../src/pages/ThreadDetailsPage'), { ssr: false });

export default function ThreadDetailsPageWrapper() {
  return <ThreadDetailsPage />;
}
