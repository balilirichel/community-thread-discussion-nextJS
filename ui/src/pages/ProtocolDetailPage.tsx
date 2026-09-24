import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import {
  ChevronLeft,
  Star,
  MessageSquare,
  Plus,
  Calendar,
  ArrowRight, CornerDownLeft, Sparkles
} from 'lucide-react';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import BottomNav from '../components/layout/BottomNav';
import DesktopSidebar from '../components/layout/DesktopSidebar';
import { ReviewSection, ThreadSection, EditProtocolModal, DeleteProtocolDialog } from '../components/protocol';
import { protocolService } from '../api/protocolService';
import { threadService } from '../api/threadService';
import { useAppSelector } from '../store/hooks';
import useRequireAuth from '../hooks/useRequireAuth';
import GuardedEditDeleteButtons from '../components/auth/GuardedActions';
import type { Protocol } from '../types/protocol';
import type { Thread } from '../types/thread';
import type { ApiError } from '../types/api';

// ****Helpers ***********//─────────────
const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

// ****Page-level skeleton ***********//─
import Skeleton from '../components/ui/Skeleton';

const PageSkeleton: React.FC = () => (
  <div className="flex min-h-screen bg-white">
    {/* Sidebar placeholder */}
    <div className="hidden lg:block w-64 flex-shrink-0 border-r border-gray-100" />

    <div className="flex-1 flex flex-col lg:flex-row min-w-0">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Hero skeleton */}
        <div className="h-48 bg-gradient-to-br from-gray-200 to-gray-100">
          <div className="h-full w-full" />
        </div>

        {/* Author row skeleton */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
          <Skeleton width={40} height={40} className="flex-shrink-0" rounded />
          <div className="space-y-1.5 flex-1">
            <Skeleton width="40%" height="12px" />
            <Skeleton width="25%" height="10px" />
          </div>
          <Skeleton width={80} height={32} />
        </div>

        {/* Tab bar skeleton */}
        <div className="flex border-b border-gray-100">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 py-3 px-4">
              <Skeleton width={64} height={12} className="mx-auto" />
            </div>
          ))}
        </div>

        {/* Content skeleton */}
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} width={`${100 - i * 10}%`} height="12px" />
          ))}
        </div>
      </div>

      {/* Desktop right panel skeleton */}
      <div className="hidden lg:flex flex-col flex-1 min-w-0 bg-gray-50 border-l border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100">
          <Skeleton width={112} height={16} />
          <Skeleton width={80} height={12} className="mt-2" />
        </div>
        <div className="p-5 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton width={24} height={24} rounded />
                <Skeleton width={80} height={12} />
              </div>
              <Skeleton width="75%" height={12} />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// ****Stat pill ***********//───────────
interface StatPillProps {
  icon: React.ReactNode;
  label: string;
}
const StatPill: React.FC<StatPillProps> = ({ icon, label }) => (
  <div className="flex items-center gap-1.5 text-white/90">
    {icon}
    <span className="text-sm">{label}</span>
  </div>
);

// ****Tab type ***********//────────────
type ActiveTab = 'overview' | 'reviews' | 'threads';

// ****Protocol Detail Page ***********//
const ProtocolDetailPage: React.FC = () => {
  const router = useRouter();
  const slug = router.query.slug as string | undefined;

  // ── Auth ──
  const currentUserId = useAppSelector((s) => s.auth.user?.id ?? null);

  // ── State ──
  const [protocol, setProtocol] = useState<Protocol | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsError, setThreadsError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  // ── Edit/Delete state ──
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { isAuthenticated, open } = useRequireAuth();

  // ── Derived ──
  const tags = useMemo(() => protocol?.tags ?? [], [protocol]);
  const reviewCount = protocol?.reviews_count ?? 0;
  const threadCount = threads.length > 0 ? threads.length : (protocol?.threads_count ?? 0);
  const canManage = Boolean(currentUserId && protocol?.author?.id === currentUserId);

  // ── Fetch protocol ***********//───
  useEffect(() => {
    if (!slug) {
      setPageError('Protocol identifier missing.');
      setPageLoading(false);
      return;
    }

    let cancelled = false;

    const fetchProtocol = async () => {
      setPageLoading(true);
      setPageError(null);
      try {
        const data = await protocolService.get(slug);
        if (!cancelled) setProtocol(data);
      } catch (err) {
        if (!cancelled) {
          const apiError = err as ApiError;
          setPageError(apiError.message ?? 'Unable to load protocol details.');
        }
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    };

    fetchProtocol();
    return () => { cancelled = true; };
  }, [slug]);

  // ── Fetch threads ***********//────
  const fetchThreads = useCallback(async () => {
    if (!protocol) return;

    let cancelled = false;
    setThreadsLoading(true);
    setThreadsError(null);
    try {
      const response = await threadService.listByProtocol(protocol.id);
      if (!cancelled) setThreads(response.data ?? []);
    } catch (err) {
      if (!cancelled) {
        const apiError = err as ApiError;
        setThreadsError(apiError.message ?? 'Failed to load threads.');
      }
    } finally {
      if (!cancelled) setThreadsLoading(false);
    }
    return () => { cancelled = true; };
  }, [protocol]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // ── Thread created handler (optimistic prepend) ───────────────────────────
  const handleThreadCreated = (newThread: Thread) => {
    setThreads((prev) => [newThread, ...prev]);
  };

  const handleThreadUpdated = (updatedThread: Thread) => {
    setThreads((prev) => prev.map((thread) => (thread.id === updatedThread.id ? updatedThread : thread)));
  };

  const handleThreadDeleted = (deletedThread: Thread) => {
    setThreads((prev) => prev.filter((thread) => thread.id !== deletedThread.id));
  };

  // ── Edit handler ──────────────────────────────────────────────────────────
  const handleEditSuccess = (updated: Protocol) => {
    setProtocol(updated);
    setIsEditModalOpen(false);
  };

  // ── Delete handler ────────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!protocol) return;
    await protocolService.delete(protocol.id);
    // Redirect to home page after successful deletion
    router.replace('/');
  };

  // ── Loading / Error screens ───────────────────────────────────────────────
  if (pageLoading) return <PageSkeleton />;

  if (pageError || !protocol) {
    return (
      <div className="flex min-h-screen bg-white">
        <DesktopSidebar />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <div className="text-5xl mb-4">⚠️</div>
            <p className="text-lg font-bold text-gray-900 mb-2">Unable to load protocol</p>
            <p className="text-sm text-gray-500 mb-6">
              {pageError ?? 'The protocol may not exist or the server could not be reached.'}
            </p>
            <Button variant="primary" onClick={() => router.back()}>
              Go back
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ── Tab labels ***********//───────
  const tabConfig: { id: ActiveTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'reviews', label: `Reviews${reviewCount > 0 ? ` (${reviewCount})` : ''}` },
    { id: 'threads', label: `Threads${threadCount > 0 ? ` (${threadCount})` : ''}` },
  ];

  return (
    <div className="flex min-h-screen bg-[#f8faf9]">
      <DesktopSidebar />

      {/* ── Main scroll area ── */}
      <div className="flex-1 flex flex-col lg:flex-row min-w-0 overflow-hidden">

        {/* ══ LEFT / MAIN COLUMN ══════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col min-w-0 lg:max-w-[60%] xl:max-w-[58%] lg:border-r lg:border-gray-100 bg-white">

          {/* ── Hero header ── */}
          <div className="relative bg-gradient-to-br from-[#0d6e4f] via-[#118451] to-emerald-400 overflow-hidden">
            {/* Decorative blobs */}
            <div className="absolute -right-12 -top-12 w-56 h-56 rounded-full bg-white/10" />
            <div className="absolute right-8 bottom-0 w-36 h-36 rounded-full bg-white/5" />
            <div className="absolute left-16 -bottom-6 w-24 h-24 rounded-full bg-white/5" />
            <div className="absolute -left-6 top-16 w-20 h-20 rounded-full bg-white/8" />

            {/* Top nav */}
            <div className="relative z-10 flex items-center justify-between px-4 pt-5 pb-2">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-1.5 text-white/90 hover:text-white transition-colors"
                aria-label="Go back"
              >
                <ChevronLeft size={20} strokeWidth={2.5} />
                <span className="text-sm font-medium">Back</span>
              </button>

              {/* Edit/Delete buttons for owner */}
               {canManage && (
                <div className="flex items-center gap-2">
                  {/* Guard edit/delete so unauthenticated users see login modal */}
                  <GuardedEditDeleteButtons
                    onEdit={() => setIsEditModalOpen(true)}
                    onDelete={() => setIsDeleteDialogOpen(true)}
                  />
                </div>
              )}
            </div>

            {/* Protocol info */}
            <div className="relative z-10 px-4 pt-3 pb-8">
              {/* Tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white uppercase tracking-wide backdrop-blur-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Title */}
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight mb-4 max-w-2xl">
                {protocol.title}
              </h1>

              {/* Stats row */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <StatPill
                  icon={<Star size={14} fill="white" strokeWidth={0} />}
                  label={`${protocol.rating ?? '—'} (${reviewCount} review${reviewCount === 1 ? '' : 's'})`}
                />
                <StatPill
                  icon={<MessageSquare size={14} />}
                  label={`${threadCount} thread${threadCount === 1 ? '' : 's'}`}
                />
                <StatPill
                  icon={<Calendar size={14} />}
                  label={formatDate(protocol.created_at)}
                />
              </div>
            </div>
          </div>

          {/* ── Author row ── */}
          <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-gray-100 bg-white flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar name={protocol.author.name} size="md" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{protocol.author.name}</p>
                <p className="text-xs text-gray-400">Protocol creator</p>
              </div>
            </div>
            {/* <button
              onClick={() => setFollowing((v) => !v)}
              className={[
                'px-4 py-2 rounded-full text-sm font-semibold transition-all duration-150 cursor-pointer flex-shrink-0',
                following
                  ? 'bg-[#e8f5f0] text-[#118451] border border-[#118451]/30'
                  : 'bg-[#118451] text-white hover:bg-[#065c38]',
              ].join(' ')}
            >
              {following ? '✓ Following' : 'Follow'}
            </button> */}
          </div>

          {/* ── Tab bar ── */}
          <div className="sticky top-0 z-30 bg-white border-b border-gray-100 flex">
            {tabConfig.map(({ id, label }) => (
              <button
                key={id}
                id={`tab-${id}`}
                onClick={() => setActiveTab(id)}
                className={[
                  'flex-1 py-3 text-sm font-semibold capitalize cursor-pointer transition-colors border-b-2 whitespace-nowrap px-2',
                  activeTab === id
                    ? 'border-[#118451] text-[#118451]'
                    : 'border-transparent text-gray-500 hover:text-gray-700',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Tab content ── */}
          <div className="flex-1 overflow-y-auto px-4 py-5 pb-36 lg:pb-8 space-y-0">

            {/* Overview tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Content body */}
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {protocol.content}
                </div>

                {/* Metadata grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Tags card */}
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                    <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-3">Tags</p>
                    <div className="flex flex-wrap gap-2">
                      {tags.length > 0 ? (
                        tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center rounded-full bg-[#e8f5f0] px-3 py-1 text-xs font-semibold text-[#0f5132]"
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-gray-400">No tags added yet.</span>
                      )}
                    </div>
                  </div>

                  {/* Details card */}
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                    <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-3">
                      Protocol Details
                    </p>
                    <div className="space-y-2.5 text-sm">
                      {[
                        {
                          label: 'Rating',
                          value: protocol.rating ? (
                            <div className="flex items-center gap-2">
                              {/* 5-Star Row Wrapper */}
                              <div className="flex items-center gap-0.5 text-amber-500" aria-label={`Rating: ${protocol.rating} out of 5 stars`}>
                                {Array.from({ length: 5 }).map((_, index) => {
                                  const starValue = index + 1;
                                  
                                  // Determine if the star should be full, half, or empty
                                  if (protocol.rating as number >= starValue) {
                                    // Full Star
                                    return <Star key={index} size={13} fill="currentColor" className="text-amber-500" />;
                                  } else if (protocol.rating as number > starValue - 1) {
                                    // Half Star (Requires Lucide's half fill clip effect or customized styling, alternatively clean stroke)
                                    return (
                                      <div key={index} className="relative inline-block">
                                        {/* Background Empty Star */}
                                        <Star size={13} className="text-gray-200" />
                                        {/* Foreground Clipped Half Star */}
                                        <div className="absolute top-0 left-0 overflow-hidden w-[50%]">
                                          <Star size={13} fill="currentColor" className="text-amber-500 max-w-none" />
                                        </div>
                                      </div>
                                    );
                                  } else {
                                    // Empty Star
                                    return <Star key={index} size={13} className="text-gray-200" />;
                                  }
                                })}
                              </div>
                              {/* Numerical Value Tag */}
                              <span className="font-bold text-gray-800 tabular-nums">
                                {typeof protocol.rating === 'number' ? protocol.rating.toFixed(1) : protocol.rating}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          ),
                        },
                        { label: 'Reviews', value: <span className="font-bold text-gray-800">{reviewCount}</span> },
                        { label: 'Threads', value: <span className="font-bold text-gray-800">{threadCount}</span> },
                        {
                          label: 'Last updated',
                          value: <span className="font-bold text-gray-800">{formatDate(protocol.updated_at)}</span>,
                        },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between">
                          <span className="text-gray-500">{label}</span>
                          {value}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Reviews tab */}
            {activeTab === 'reviews' && (
              <ReviewSection protocol={protocol} />
            )}

            {/* Threads tab */}
            {activeTab === 'threads' && (
              <ThreadSection
                protocol={protocol}
                threads={threads}
                isLoading={threadsLoading}
                error={threadsError}
                onThreadCreated={handleThreadCreated}
                onThreadUpdated={handleThreadUpdated}
                onThreadDeleted={handleThreadDeleted}
              />
            )}
          </div>
        </div>

        {/* ══ RIGHT / DESKTOP DISCUSSION PANEL ════════════════════════════════ */}
      
{/* ══ RIGHT / DESKTOP DISCUSSION PANEL ════════════════════════════════ */}
<div className="hidden lg:flex flex-col flex-1 min-w-0 bg-slate-50/50 border-l border-gray-100">

  {/* Panel Header */}
  <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4.5 flex items-center justify-between">
    <div>
      <div className="flex items-center gap-1.5">
        <h2 className="text-sm font-bold text-gray-900 tracking-tight">Community Discussion</h2>
        <Sparkles size={14} className="text-amber-500 fill-amber-500 animate-pulse" />
      </div>
      <p className="text-xs text-gray-400 mt-0.5 font-medium">
        {threadCount > 0 ? `${threadCount} active thread${threadCount === 1 ? '' : 's'}` : 'No conversations yet'}
      </p>
    </div>
    <button
      onClick={() => setActiveTab('threads')}
      className="inline-flex items-center gap-1 text-xs font-semibold text-[#118451] hover:text-[#065c38] bg-[#e8f5f0] hover:bg-[#dbefe6] px-2.5 py-1.5 rounded-lg transition-all cursor-pointer group"
    >
      View all
      <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
    </button>
  </div>

  {/* Thread List Preview */}
  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5 custom-scrollbar">
    {threadsLoading ? (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 animate-pulse space-y-3 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-gray-100" />
              <div className="h-2 w-16 rounded bg-gray-100" />
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-full rounded bg-gray-100" />
              <div className="h-3 w-4/5 rounded bg-gray-100" />
            </div>
            <div className="h-2 w-10 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    ) : threadsError ? (
      <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4 text-center">
        <p className="text-xs text-red-600 font-medium">{threadsError}</p>
      </div>
    ) : threads.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center my-2 shadow-sm">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-50 text-xl mb-3 shadow-inner">
          💬
        </div>
        <p className="text-sm font-bold text-gray-800">No threads yet</p>
        <p className="text-xs text-gray-400 mt-1 max-w-[200px] mx-auto">Be the voice that jumpshots the discussion!</p>
      </div>
    ) : (
      threads.slice(0, 6).map((thread) => {
        const authorName = thread.user?.name ?? thread.author?.name ?? 'Unknown';
        return (
          <button
            key={thread.id}
            onClick={() => router.push(`/threads/${thread.id}?protocolId=${protocol.id}`)}
            className="w-full text-left bg-white rounded-2xl border border-gray-100 p-4 
                       hover:border-transparent hover:shadow-[0_8px_20px_-6px_rgba(17,132,81,0.12)] 
                       hover:-translate-y-0.5 transition-all duration-200 ease-out group relative block"
          >
            {/* Meta context header */}
            <div className="flex items-center gap-2 mb-2">
              <Avatar name={authorName} size="xs" className="ring-1 ring-slate-100" />
              <span className="text-[11px] text-gray-500 font-medium truncate flex-1">{authorName}</span>
            </div>

            {/* Title */}
            <h4 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug group-hover:text-[#118451] transition-colors mb-2.5">
              {thread.title}
            </h4>

            {/* Interaction Footer badge */}
            <div className="flex items-center justify-between border-t border-gray-50 pt-2 mt-1">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 text-slate-500 rounded-md text-[11px] font-medium transition-colors group-hover:bg-[#e8f5f0] group-hover:text-[#118451]">
                <MessageSquare size={12} strokeWidth={2} />
                {thread.comments_count ?? 0} {thread.comments_count === 1 ? 'reply' : 'replies'}
              </span>
              
              {/* Ghost prompt arrow */}
              <span className="text-xs text-[#118451] font-medium opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 inline-flex items-center gap-0.5">
                Join <ArrowRight size={12} />
              </span>
            </div>
          </button>
        );
      })
    )}
  </div>

  {/* Compose New Thread Wrapper */}
  <div className="border-t border-gray-100 p-4.5 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.02)] space-y-3">
    <div className="flex items-center justify-between">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
        Start a conversation
      </p>
      {/* UX Hint helper tag for shortcut execution */}
      <span className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-gray-400 font-medium bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded-md">
        <CornerDownLeft size={8} /> ⌘ + Enter
      </span>
    </div>

    <div className="relative">
        <textarea
          id="desktop-thread-composer"
        placeholder="Ask a question or share an insight with the community…"
        rows={3} // Bounded up for cleaner visual context depth while filling text
         onKeyDown={async (e) => {
           if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            if (!isAuthenticated) { open(); return; }

            const target = e.currentTarget;
            const body = target.value.trim();
            if (!body) return;
            try {
              const created = await threadService.create(protocol.id, {
                title: body.slice(0, 120),
                body,
              });
              handleThreadCreated(created);
              target.value = '';
            } catch {
              // non-422 errors handled globally
            }
          }
        }}
        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm placeholder-gray-400 
                   focus:outline-none focus:ring-2 focus:ring-[#118451]/30 focus:border-[#118451] 
                   resize-none bg-slate-50/50 focus:bg-white transition-all duration-150 leading-relaxed"
      />
    </div>

    <Button
      variant="primary"
      size="md"
      fullWidth
      className="shadow-sm hover:shadow-md active:scale-[0.99] transition-all"
      onClick={async () => {
        if (!isAuthenticated) { open(); return; }

        const textarea = document.getElementById('desktop-thread-composer') as HTMLTextAreaElement | null;
        const body = textarea?.value.trim();
        if (!body) return;
        try {
          const created = await threadService.create(protocol.id, {
            title: body.slice(0, 120),
            body,
          });
          handleThreadCreated(created);
          if (textarea) textarea.value = '';
        } catch {
          // non-422 errors handled globally
        }
      }}
    >
      Post Thread
    </Button>
  </div>
</div>
      </div>

      {/* ── Mobile bottom action bar ── */}
      <div
        className="fixed bottom-16 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-gray-100 px-4 py-2.5 flex gap-3 lg:hidden"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}
      >
        <Button
          variant="primary"
          fullWidth
          size="sm"
          icon={<MessageSquare size={15} />}
          onClick={() => setActiveTab('threads')}
        >
          Threads
        </Button>
        <Button
          variant="outline"
          size="sm"
          icon={<Star size={15} />}
          onClick={() => setActiveTab('reviews')}
        >
          Reviews
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<Plus size={15} />}
          onClick={() => {
            setActiveTab('threads');
          }}
        >
          New
        </Button>
      </div>

      <BottomNav />

      {/* Edit modal */}
      {protocol && (
        <EditProtocolModal
          protocol={protocol}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Delete confirmation dialog */}
      {protocol && (
        <DeleteProtocolDialog
          protocol={protocol}
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
};

export default ProtocolDetailPage;
