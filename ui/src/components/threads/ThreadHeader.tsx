import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { ChevronLeft, MessageSquare, Edit2, Trash2 } from 'lucide-react';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import useRequireAuth from '../../hooks/useRequireAuth';
import VoteController from '../ui/VoteController';
import type { Thread } from '../../types/thread';
import { threadService } from '../../api/threadService';

interface ThreadHeaderProps {
  thread: Thread;
  canManage?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

const formatRelativeDate = (value: string): string => {
  const now = Date.now();
  const then = new Date(value).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_360_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const ThreadHeader: React.FC<ThreadHeaderProps> = ({ thread, canManage = false, onEdit, onDelete }) => {
  const router = useRouter();

  const upvotes = thread.upvotes_count ?? 0;
  const downvotes = thread.downvotes_count ?? 0;
  const commentsCount = thread.comments_count ?? 0;
  const authorName = thread.user?.name ?? thread.author?.name ?? 'Unknown';
  const protocolTitle = thread.protocol?.title ?? '';

  const [upvoteCount, setUpvoteCount] = useState<number>(upvotes);
  const [downvoteCount, setDownvoteCount] = useState<number>(downvotes);
  const [userVote, setUserVote] = useState<1 | -1 | null>(() => {
    const raw = (thread as any).user_vote ?? (thread as any).vote ?? null;
    return typeof raw === 'number' ? (raw as 1 | -1) : null;
  });
  const [loading, setLoading] = useState(false);

  const handleProtocolNavigate = () => {
    if (thread.protocol?.id) {
      router.push(`/protocols/${thread.protocol.id}`);
    }
  };

  const { isAuthenticated, open } = useRequireAuth();

  const guard = (fn?: () => void) => () => {
    if (isAuthenticated) return fn?.();
    open();
  };

  return (
    <header
      id="thread-header"
      className="sticky top-0 z-30 bg-white border-b border-gray-100 w-full"
    >
      {/* TOP BAR: Unified Control Strip */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-50">
        {/* Navigation / Breadcrumbs */}
        <div className="flex items-center gap-2 overflow-hidden">
          <button
            id="thread-back-btn"
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex items-center gap-1 text-gray-500 hover:text-[#118451] cursor-pointer transition-colors flex-shrink-0"
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>

          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-gray-400 overflow-hidden">
            <button
              onClick={() => router.push('/')}
              className="hover:text-[#118451] cursor-pointer truncate flex-shrink-0 transition-colors"
            >
              Protocol
            </button>
            <span>/</span>
            {protocolTitle && (
              <>
                <button
                  onClick={handleProtocolNavigate}
                  className="hover:text-[#118451] cursor-pointer truncate flex-shrink max-w-[160px] transition-colors"
                >
                  {protocolTitle}
                </button>
                <span className="flex-shrink-0">/</span>
              </>
            )}
            <span className="text-gray-600 font-medium truncate">Thread</span>
          </nav>
        </div>

        {/* Management Controls pushed clean to the right */}
        {canManage && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {onEdit && (
               <Button
                 variant="outline"
                 size="sm"
                 icon={<Edit2 size={14} />}
                 onClick={guard(onEdit)}
               >
                 Edit
               </Button>
             )}
            {onDelete && (
               <Button
                 variant="ghost"
                 size="sm"
                 icon={<Trash2 size={14} />}
                 onClick={guard(onDelete)}
               >
                 Delete
               </Button>
            )}
          </div>
        )}
      </div>

      {/* MAIN CONTENT BLOCK: Vertically aligned content body */}
      <div className="max-w-4xl px-4 pt-4 pb-4 mx-auto md:mx-0">
        {/* Author meta component placed at the top of content for community forum readability */}
        <div className="flex items-center gap-2 mb-3">
          <Avatar name={authorName} size="xs" />
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-gray-800">{authorName}</span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-400">{formatRelativeDate(thread.created_at)}</span>
          </div>
        </div>

        {/* Thread Title */}
        <h1 className="text-xl font-extrabold text-gray-900 leading-snug mb-2">
          {thread.title}
        </h1>

        {/* Thread body description */}
        {thread.body && (
          <p className="text-sm text-gray-600 leading-relaxed mb-4">{thread.body}</p>
        )}

        {/* Action metrics toolbar panel */}
        <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
          <VoteController
            initialUpvotes={upvoteCount}
            initialDownvotes={downvoteCount}
            userVote={userVote}
            size="sm"
            onVote={async (newVote) => {
              if (!thread.id || loading) return;

              const prevUpvotes = upvoteCount;
              const prevDownvotes = downvoteCount;
              const prevUser = userVote;

              const nextCounts = () => {
                if (prevUser === newVote) {
                  return {
                    upvotes: prevUpvotes,
                    downvotes: prevDownvotes,
                  };
                }

                if (prevUser === null && newVote === 1) {
                  return { upvotes: prevUpvotes + 1, downvotes: prevDownvotes };
                }

                if (prevUser === null && newVote === -1) {
                  return { upvotes: prevUpvotes, downvotes: prevDownvotes + 1 };
                }

                if (prevUser === 1 && newVote === null) {
                  return { upvotes: prevUpvotes - 1, downvotes: prevDownvotes };
                }

                if (prevUser === -1 && newVote === null) {
                  return { upvotes: prevUpvotes, downvotes: prevDownvotes - 1 };
                }

                if (prevUser === 1 && newVote === -1) {
                  return { upvotes: prevUpvotes - 1, downvotes: prevDownvotes + 1 };
                }

                if (prevUser === -1 && newVote === 1) {
                  return { upvotes: prevUpvotes + 1, downvotes: prevDownvotes - 1 };
                }

                return { upvotes: prevUpvotes, downvotes: prevDownvotes };
              };

              const { upvotes: nextUpvotes, downvotes: nextDownvotes } = nextCounts();
              setUpvoteCount(nextUpvotes);
              setDownvoteCount(nextDownvotes);
              setUserVote(newVote);
              setLoading(true);

              try {
                if (newVote === null) {
                  await threadService.removeVote(thread.id);
                } else {
                  await threadService.vote(thread.id, { vote: newVote });
                }

                if (thread.protocol?.id) {
                  const fresh = await threadService.get(thread.protocol.id, thread.id);
                  setUpvoteCount(fresh.upvotes_count ?? nextUpvotes);
                  setDownvoteCount(fresh.downvotes_count ?? nextDownvotes);
                  const raw = (fresh as any).user_vote ?? (fresh as any).vote ?? null;
                  setUserVote(typeof raw === 'number' ? (raw as 1 | -1) : newVote);
                }
              } catch (err) {
                setUpvoteCount(prevUpvotes);
                setDownvoteCount(prevDownvotes);
                setUserVote(prevUser);
                // eslint-disable-next-line no-alert
                alert('Vote failed. Please try again.');
              } finally {
                setLoading(false);
              }
            }}
          />
          <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full">
            <MessageSquare size={14} className="text-gray-400" />
            <span className="font-medium">
              {commentsCount} {commentsCount === 1 ? 'comment' : 'comments'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default ThreadHeader;
