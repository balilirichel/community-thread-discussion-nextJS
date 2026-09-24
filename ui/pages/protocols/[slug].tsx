import dynamic from 'next/dynamic';

const ProtocolDetailPage = dynamic(() => import('../../src/pages/ProtocolDetailPage'), { ssr: false });

export default function ProtocolDetailPageWrapper() {
  return <ProtocolDetailPage />;
}
