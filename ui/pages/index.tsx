import dynamic from 'next/dynamic';

const HomePage = dynamic(() => import('../src/pages/HomePage'), { ssr: false });

export default function Home() {
  return <HomePage />;
}
