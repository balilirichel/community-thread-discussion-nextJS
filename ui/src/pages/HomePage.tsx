/**
 * HomePage.tsx
 * ********************────────────────────
 * Main browse / search page for protocols.
 *
 * SEARCH STRATEGY — Typesense-first, REST-enriched:
 *
 *   Phase 1 — Typesense search (fast, <50ms):
 *     useProtocolSearch fires directly against Typesense 'protocols' collection.
 *     Returns ranked/sorted/filtered IDs, title, tags, votes, rating, reviews_count.
 *     This drives the sort order and result set — Typesense is the source of truth
 *     for ranking.
 *
 *   Phase 2 — REST enrichment (runs once on mount):
 *     The REST /protocols endpoint is called once to get the rich protocol data
 *     (author name, content/description) which is not stored in Typesense.
 *     Results are stored in a lookup map keyed by protocol ID.
 *
 *   Phase 3 — Merge:
 *     For each Typesense hit, we merge in the REST data by ID to get the full
 *     card data. The Typesense sort order is always preserved.
 *
 * WHY THIS APPROACH?
 *   • Typesense controls ranking — the order of results reflects real-time
 *     search relevance / sort parameters, not the REST API's default ordering.
 *   • The REST call is a one-time background fetch that does NOT block rendering.
 *     Cards render immediately from Typesense data; author/description fill in
 *     once the REST response lands (imperceptible to the user in practice).
 *   • If the REST call fails, cards still render with empty author — graceful.
 *   • If Typesense is unavailable, a retry banner is shown and REST data is
 *     NOT displayed (there is no meaningful sort/filter without Typesense).
 */

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  Leaf,
  SlidersHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { useRouter } from 'next/router';
import BottomNav from '../components/layout/BottomNav';
import DesktopSidebar from '../components/layout/DesktopSidebar';
import { SearchBar, CategoryPill } from '../components/ui';
import ProtocolCard from '../components/protocol/ProtocolCard';

// ─── REST API service (used for author/content enrichment only) ───────────────
import { protocolService } from '../api/protocolService';
import type { Protocol } from '../types/protocol';

// ─── Typesense hooks ********************─
// These query Typesense directly — no Laravel backend proxy involved.
import useProtocolSearch from '../hooks/useProtocolSearch';
import useThreadSearch from '../hooks/useThreadSearch';
import type { SortOption } from '../typesense/typesenseCollections';

// ─── Constants ********************───────

/**
 * Sort options shown in the UI.
 * Each label maps to a Typesense sort_by string via PROTOCOL_SORT_MAP
 * (defined in src/typesense/typesenseCollections.ts):
 *
 *   'Newest'       → sort_by: 'created_at:desc'
 *   'Top Rated'    → sort_by: 'rating:desc'
 *   'Most Reviews' → sort_by: 'reviews_count:desc'
 *   'Most Upvoted' → sort_by: 'votes:desc'
 */
const SORT_OPTIONS: SortOption[] = ['Newest', 'Top Rated', 'Most Reviews', 'Most Upvoted'];

const SLUGIFY_RE = /[^a-z0-9]+/g;
const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(SLUGIFY_RE, '-')
    .replace(/(^-|-$)/g, '');

// ─── Thread Preview Rail ──────────────────────────────────────────────────────
/**
 * Sidebar rail showing the 4 most recent threads.
 * Uses useThreadSearch — queries Typesense 'threads' collection directly.
 * sortOption 'Newest' → sort_by: 'created_at:desc'
 */
const ThreadPreviewRail: React.FC = () => {
  const router = useRouter();

  const { threadHits, isLoading: threadsLoading } = useThreadSearch({
    query: '',           // empty → Typesense match-all ('*') internally
    sortOption: 'Newest',
    perPage: 4,
  });

  return (
    <aside
      id="thread-preview-rail"
      className="hidden xl:flex flex-col sticky top-0 h-screen w-[220px] flex-shrink-0 border-l border-gray-100 bg-white py-6 px-4 gap-4 overflow-y-auto"
    >
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Active Threads
      </p>
      {threadsLoading ? (
        <p className="text-xs text-gray-400">Loading threads…</p>
      ) : threadHits.length === 0 ? (
        <p className="text-xs text-gray-400">No active threads yet.</p>
      ) : (
        threadHits.map((thread) => (
          <button
            key={thread.id}
            onClick={() => router.push(`/threads/${thread.id}?protocolId=${thread.protocol_id}`)}
            className="text-left group cursor-pointer"
            id={`thread-preview-${thread.id}`}
          >
            <p className="text-xs text-[#118451] font-semibold mb-0.5">Thread</p>
            <p className="text-sm font-medium text-gray-800 leading-snug group-hover:text-[#118451] transition-colors line-clamp-2">
              {thread.title}
            </p>
            <p className="text-xs text-gray-400 mt-1">{thread.comments_count ?? 0} replies</p>
            <div className="mt-2 border-b border-gray-100" />
          </button>
        ))
      )}
    </aside>
  );
};

// ─── Search Error Banner ──────────────────────────────────────────────────────
/**
 * Non-crashing error display for Typesense failures.
 */
interface SearchErrorBannerProps {
  message: string;
  onRetry: () => void;
}

const SearchErrorBanner: React.FC<SearchErrorBannerProps> = ({ message, onRetry }) => (
  <div
    id="search-error-banner"
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

// ─── Discovery Page ********************──

const HomePage: React.FC = () => {
  const router = useRouter();

  // ── UI state ********************────
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('Newest');
  const [showFilters, setShowFilters] = useState(false);

  // ── REST enrichment data ─────────────────────────────────────────────────
  /**
   * Lookup map: protocol ID (as string) → full Protocol object from REST API.
   * Used to enrich Typesense hits with author names and content (description).
   * Populated once on mount; Typesense handles all subsequent search/sort.
   */
  const [restMap, setRestMap] = useState<Map<string, Protocol>>(new Map());

  useEffect(() => {
    let mounted = true;
    // Fetch all protocols once to build the enrichment map.
    // This is a background call — it does NOT block the Typesense search.
    protocolService.list().then((response) => {
      if (!mounted) return;
      const map = new Map<string, Protocol>();
      response.data.forEach((p) => map.set(String(p.id), p));
      setRestMap(map);
    }).catch(() => {
      // Non-fatal: cards will render without author/description if REST fails.
      // Typesense search results are unaffected.
    });
    return () => { mounted = false; };
  }, []);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const handleScroll = (direction: 'left' | 'right') => {
    scrollContainerRef.current?.scrollBy({
      left: direction === 'left' ? -200 : 200,
      behavior: 'smooth',
    });
  };

  // ── Build Typesense filter_by for tag selection ──────────────────────────
  /**
   * Typesense array-contains filter syntax: tags:=[value]
   * When 'All' is active → undefined (no filter applied, show all results).
   * When a tag is active → 'tags:=[tagname]' (only protocols with that tag).
   *
   * You can compose multiple filters with &&:
   *   'tags:=[nutrition] && rating:>3'
   */
  const tagFilter = useMemo(
    () => activeCategory === 'All' ? undefined : `tags:=[${activeCategory}]`,
    [activeCategory],
  );

  // ── Typesense protocol search ────────────────────────────────────────────
  /**
   * useProtocolSearch — fires directly against Typesense 'protocols' collection.
   *
   * Reactive params (re-fires automatically on change, debounced 200ms):
   *   query      → full-text search on 'title,tags' fields
   *   sortOption → maps to sort_by via PROTOCOL_SORT_MAP:
   *                  'Newest'       → 'created_at:desc'
   *                  'Top Rated'    → 'rating:desc'
   *                  'Most Reviews' → 'reviews_count:desc'
   *                  'Most Upvoted' → 'votes:desc'
   *   tagFilter  → filter_by expression (e.g. 'tags:=[nutrition]')
   *   perPage    → number of hits per page (20 for the discovery grid)
   *
   * Returns:
   *   protocolHits → ProtocolDocument[] — flat Typesense docs, Typesense sort order
   *   found        → total matching count in the collection
   *   isLoading    → true while a search request is in-flight
   *   error        → error message or null
   *   retry        → call to manually re-fire the search
   */
  const {
    protocolHits,
    found,
    isLoading,
    error: searchError,
    retry,
  } = useProtocolSearch({
    query,
    sortOption: sortBy,
    tagFilter,
    perPage: 20,
  });

  // ── Derive unique tags from Typesense results ────────────────────────────
  /**
   * Build the category pill list from tags present in the current search results.
   * This ensures the pill row always reflects what's actually searchable.
   * Recalculated whenever Typesense returns a new result set.
   */
  const tags = useMemo(() => {
    const uniqueTags = new Set<string>();
    protocolHits.forEach((p) => p.tags?.forEach((t) => uniqueTags.add(t)));
    return ['All', ...Array.from(uniqueTags).sort()];
  }, [protocolHits]);

  // Reset to 'All' if the active tag disappears from the result set.
  useEffect(() => {
    if (activeCategory !== 'All' && !tags.includes(activeCategory)) {
      setActiveCategory('All');
    }
  }, [tags, activeCategory]);

  // ── Merge Typesense hits with REST enrichment data ───────────────────────
  /**
   * For each Typesense hit, look up the matching Protocol from the REST map.
   * The Typesense result order is ALWAYS preserved (it reflects sort/relevance).
   * REST data fills in author + content; falls back to '' if not yet loaded.
   */
  const enrichedHits = useMemo(
    () =>
      protocolHits.map((hit) => ({
        tsDoc: hit,                         // Typesense document (ranking fields)
        restData: restMap.get(hit.id) ?? null, // REST data (author, content)
      })),
    [protocolHits, restMap],
  );

  // ── Handlers ********************────
  /**
   * Update query state. useProtocolSearch auto-fires with 200ms debounce.
   * No manual setTimeout or debounce needed in the component.
   */
  const handleQueryChange = useCallback((val: string) => setQuery(val), []);

  const handleSortChange = useCallback((opt: SortOption) => {
    setSortBy(opt);
    setShowFilters(false);
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <DesktopSidebar />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">

        {/* ── Sticky Header ──────────────────────────────────────────────── */}
        <header
          id="discovery-header"
          className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100"
        >
          {/* Mobile wordmark bar */}
          <div className="flex items-center justify-between px-4 h-14 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-[10px] bg-[#118451] flex items-center justify-center">
                <Leaf size={13} color="white" strokeWidth={2.5} />
              </div>
              <span className="font-extrabold text-gray-900 text-xs sm:text-sm md:text-base tracking-tight truncate block w-full min-w-0">
                Community-Powered Protocol & Discussion Platform
              </span>
            </div>
            <button
              id="filter-toggle"
              onClick={() => setShowFilters((s) => !s)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[2rem] border border-gray-200 text-gray-600 text-sm font-medium hover:border-[#118451] hover:text-[#118451] transition-colors cursor-pointer"
            >
              <SlidersHorizontal size={14} />
              Filters
            </button>
          </div>

          {/* Search bar ─ typing here fires Typesense search-as-you-type */}
          <div className="px-4 pb-3 lg:pt-4 lg:px-6">
            <SearchBar
              value={query}
              onChange={handleQueryChange}
              placeholder="Search ...."
            />
          </div>

          {/* Mobile filter sheet */}
          {showFilters && (
            <div className="lg:hidden border-t border-gray-100 px-4 py-3 bg-white">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700">Sort By</span>
                <button
                  onClick={() => setShowFilters(false)}
                  className="text-gray-400 cursor-pointer"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    id={`sort-mobile-${opt.toLowerCase().replace(/\s+/g, '-')}`}
                    onClick={() => handleSortChange(opt)}
                    className={[
                      'flex-1 min-w-[7rem] py-2 rounded-[2rem] text-xs font-semibold border cursor-pointer transition-all',
                      sortBy === opt
                        ? 'bg-[#118451] text-white border-[#118451]'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-[#118451] hover:text-[#118451]',
                    ].join(' ')}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category / tag pill row ─ tags derived from Typesense hits */}
          <div className="relative flex items-center bg-white h-12 w-full border-b border-gray-100 overflow-hidden">
            <button
              onClick={() => handleScroll('left')}
              className="absolute left-0 bg-white/90 backdrop-blur pl-4 pr-2 h-full text-[#118451] hover:text-[#18ac6a] transition-colors cursor-pointer flex items-center justify-center z-10"
              aria-label="Scroll tags left"
            >
              <ChevronLeft size={18} strokeWidth={2.5} />
            </button>

            <div
              ref={scrollContainerRef}
              className="flex gap-8 overflow-x-auto no-scrollbar h-full items-center px-12 w-full select-none"
              style={{ scrollbarWidth: 'none' }}
            >
              {tags.map((tag) => (
                <CategoryPill
                  key={tag}
                  label={tag}
                  active={activeCategory === tag}
                  onClick={() => setActiveCategory(tag)}
                />
              ))}
            </div>

            <button
              onClick={() => handleScroll('right')}
              className="absolute right-0 bg-white/90 backdrop-blur pr-4 pl-2 h-full text-[#118451] hover:text-[#18ac6a] transition-colors cursor-pointer flex items-center justify-center z-10"
              aria-label="Scroll tags right"
            >
              <ChevronRight size={18} strokeWidth={2.5} />
            </button>
          </div>

          {/* Desktop sort row */}
          <div className="hidden lg:flex items-center gap-2 px-6 pb-3 border-t border-gray-50 pt-2">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt}
                id={`sort-desktop-${opt.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => setSortBy(opt)}
                className={[
                  'px-4 py-1.5 rounded-[2rem] text-sm font-semibold border cursor-pointer transition-all',
                  sortBy === opt
                    ? 'bg-[#118451] text-white border-[#118451]'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-[#118451] hover:text-[#118451]',
                ].join(' ')}
              >
                {opt}
              </button>
            ))}
            {/* 'found' comes from Typesense — it's the total matching count, not just this page */}
            <span className="ml-auto text-sm text-gray-400">
              {isLoading ? '…' : `${found} result${found !== 1 ? 's' : ''}`}
            </span>
          </div>
        </header>

        {/* ── Protocol Grid ───────────────────────────────────────────────── */}
        <section
          id="protocol-grid"
          className="flex-1 px-4 py-4 lg:px-6 lg:py-6 pb-24 lg:pb-8"
        >
          {/* Typesense error banner — non-crashing, includes retry */}
          {searchError && (
            <SearchErrorBanner message={searchError} onRetry={retry} />
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-[#e8f5f0] flex items-center justify-center mb-4">
                <Leaf size={24} color="#118451" />
              </div>
              <h3 className="text-lg font-bold text-gray-700 mb-1">Searching…</h3>
              <p className="text-sm text-gray-400">Querying Typesense for matching protocols.</p>
            </div>
          ) : !searchError && enrichedHits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-[#e8f5f0] flex items-center justify-center mb-4">
                <Leaf size={24} color="#118451" />
              </div>
              <h3 className="text-lg font-bold text-gray-700 mb-1">No protocols found</h3>
              <p className="text-sm text-gray-400">
                {query
                  ? `No results for "${query}". Try a different search or clear the filter.`
                  : 'Try adjusting your category filter.'}
              </p>
            </div>
          ) : (
            /**
             * Render protocol cards from the merged Typesense + REST data.
             *
             * Data sources per field:
             *   id            → Typesense (tsDoc.id)
             *   title         → Typesense (tsDoc.title) — always present
             *   category      → Typesense (tsDoc.tags[0]) — indexed field
             *   rating        → Typesense (tsDoc.rating) — indexed field
             *   reviews       → Typesense (tsDoc.reviews_count) — indexed field
             *   upvotes       → Typesense (tsDoc.votes) — indexed field
             *   steps         → Typesense (tsDoc.tags.length) — derived
             *   description   → REST (restData.content) — not in Typesense
             *   author        → REST (restData.author.name) — not in Typesense
             *   comments      → REST (restData.threads_count) — not in Typesense
             */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {enrichedHits.map(({ tsDoc, restData }, index) => (
                <ProtocolCard
                  key={tsDoc.id}
                  id={Number(tsDoc.id)}
                  title={tsDoc.title}
                  description={restData?.content ?? ''}
                  author={restData?.author?.name ?? ''}
                  category={tsDoc.tags?.[0] ?? 'General'}
                  rating={tsDoc.rating ?? 0}
                  reviews={tsDoc.reviews_count ?? 0}
                  comments={restData?.threads_count ?? 0}
                  upvotes={tsDoc.votes ?? 0}
                  steps={tsDoc.tags?.length || 1}
                  gradientIndex={index}
                  slug={slugify(tsDoc.title)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Thread Preview Rail — powered by useThreadSearch (Typesense direct) */}
      <ThreadPreviewRail />

      {/* Mobile FAB */}
      <button
        id="fab-create-protocol"
        onClick={() => router.push('/protocols/create')}
        aria-label="Create new protocol"
        className="fixed bottom-20 right-4 z-40 rounded-full bg-[#118451] text-white shadow-lg hover:bg-[#065c38] active:scale-95 transition-all duration-150 flex items-center justify-center lg:hidden cursor-pointer"
        style={{ width: '52px', height: '52px' }}
      >
        <Plus size={22} strokeWidth={2.5} />
      </button>

      {/* Mobile Bottom Nav */}
      <BottomNav />
    </div>
  );
};

export default HomePage;
