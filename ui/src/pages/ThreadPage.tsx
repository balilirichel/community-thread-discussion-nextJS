import React, { useState, useMemo, useCallback } from 'react';
import { Leaf, AlertTriangle, RotateCcw } from 'lucide-react';
import DesktopSidebar from '../components/layout/DesktopSidebar';
import BottomNav from '../components/layout/BottomNav';
import { CardList, SearchBar } from '../components/ui';
import ThreadCard from '../components/protocol/ThreadCard';
import useThreadSearch from '../hooks/useThreadSearch';
import type { Thread } from '../types/thread';
import type { SortOption } from '../typesense/typesenseCollections';

const SORT_OPTIONS: SortOption[] = ['Newest', 'Top Rated', 'Most Reviews', 'Most Upvoted'];

interface SearchErrorBannerProps {
  message: string;
  onRetry: () => void;
}

const SearchErrorBanner: React.FC<SearchErrorBannerProps> = ({ message, onRetry }) => (
  <div
    id="thread-search-error"
    role="alert"
    className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4"
  >
    <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-amber-800">Search unavailable</p>
      <p className="text-xs text-amber-600 mt-0.5 break-words">{message}</p>
    </div>
    <button
      onClick={onRetry}
      className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-900 transition-colors shrink-0 cursor-pointer"
      aria-label="Retry search"
    >
      <RotateCcw size={13} />
      Retry
    </button>
  </div>
);

const ThreadPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('Newest');

  const { threadHits, found, isLoading, error, retry } = useThreadSearch({
    query,
    sortOption: sortBy,
    perPage: 20,
  });

  interface ThreadHitWithProtocolId {
    thread: Thread;
    protocolId?: number;
  }

  const threadResults = useMemo<ThreadHitWithProtocolId[]>(
    () =>
      threadHits.map((hit) => {
        const createdAt = hit.created_at ? new Date(hit.created_at * 1000).toISOString() : new Date().toISOString();
        const protocolId = hit.protocol_id ? Number(hit.protocol_id) : undefined;

        return {
          thread: {
            id: Number(hit.id),
            title: hit.title,
            body: hit.body,
            protocol: { id: protocolId ?? 0, title: '' },
            author: { id: 0, name: 'Community' },
            user: { id: 0, name: 'Community' },
            comments_count: hit.comments_count,
            upvotes_count: hit.votes,
            downvotes_count: 0,
            created_at: createdAt,
            updated_at: createdAt,
          },
          protocolId,
        };
      }),
    [threadHits],
  );

  const handleQueryChange = useCallback((value: string) => setQuery(value), []);
  const handleSortSelect = useCallback((option: SortOption) => setSortBy(option), []);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DesktopSidebar />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100">
          <div className="px-4 pb-3 lg:pt-4 lg:px-6">
            <SearchBar
              value={query}
              onChange={handleQueryChange}
              placeholder="Search threads by title or body…"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 px-6 pb-3 border-t border-gray-100">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => handleSortSelect(option)}
                className={[
                  'px-4 py-1.5 rounded-[2rem] text-sm font-semibold border cursor-pointer transition-all',
                  sortBy === option
                    ? 'bg-[#118451] text-white border-[#118451]'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-[#118451] hover:text-[#118451]',
                ].join(' ')}
              >
                {option}
              </button>
            ))}
            <span className="ml-auto text-sm text-gray-400">
              {isLoading ? 'Searching…' : `${found} thread${found !== 1 ? 's' : ''}`}
            </span>
          </div>
        </header>

        <section className="flex-1 px-4 py-4 lg:px-6 lg:py-6 pb-24 lg:pb-8">
          {error && <SearchErrorBanner message={error} onRetry={retry} />}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-[#e8f5f0] flex items-center justify-center mb-4">
                <Leaf size={24} color="#118451" />
              </div>
              <h3 className="text-lg font-bold text-gray-700 mb-1">Searching threads…</h3>
    
            </div>
          ) : threadResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-[#e8f5f0] flex items-center justify-center mb-4">
                <Leaf size={24} color="#118451" />
              </div>
              <h3 className="text-lg font-bold text-gray-700 mb-1">No threads found</h3>
              <p className="text-sm text-gray-400">
                {query
                  ? `No results for "${query}". Try a different search or clear the input.`
                  : 'There are no threads yet. Start a discussion to populate search results.'}
              </p>
            </div>
          ) : (
            <CardList className="grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
              {threadResults.map(({ thread, protocolId }) => (
                <ThreadCard
                  key={thread.id}
                  thread={thread}
                  protocolId={protocolId}
                />
              ))}
            </CardList>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
};

export default ThreadPage;
