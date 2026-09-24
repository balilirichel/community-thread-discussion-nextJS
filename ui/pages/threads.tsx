import dynamic from 'next/dynamic';

const ThreadPage = dynamic(() => import('../src/pages/ThreadPage'), { ssr: false });

export default function ThreadsPage() {
  return <ThreadPage />;
}
