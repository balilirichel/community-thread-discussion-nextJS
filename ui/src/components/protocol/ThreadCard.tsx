import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { MessageSquare } from 'lucide-react';
import VoteController from '../ui/VoteController';
import useRequireAuth from '../../hooks/useRequireAuth';
import { threadService } from '../../api/threadService';
import Avatar from '../ui/Avatar';
import type { Thread } from '../../types/thread';

interface ThreadCardProps {
  thread: Thread;
  protocolId?: number;
  compact?: boolean;
  canManage?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

const formatRelativeDate = (value: string) => {
  const now = Date.now();
  const then = new Date(value).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const ThreadCard: React.FC<ThreadCardProps> = ({ thread, protocolId, compact = false, canManage = false, onEdit, onDelete }) => {
  const router = useRouter();
  const authorName = thread.user?.name ?? thread.author?.name ?? 'Unknown';

  const handleNavigate = () => {
    if (protocolId == null) return;
    router.push(`/threads/${thread.id}?protocolId=${protocolId}`);
  };

  const upvotes = thread.upvotes_count ?? 0;
  const downvotes = thread.downvotes_count ?? 0;
  const [upvoteCount, setUpvoteCount] = useState<number>(upvotes);
  const [downvoteCount, setDownvoteCount] = useState<number>(downvotes);
  const [userVote, setUserVote] = useState<1 | -1 | null>(() => {
    const raw = (thread as any).user_vote ?? (thread as any).vote ?? null;
    return typeof raw === 'number' ? (raw as 1 | -1) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => setUpvoteCount(upvotes), [upvotes]);
  useEffect(() => setDownvoteCount(downvotes), [downvotes]);
  useEffect(() => {
    const raw = (thread as any).user_vote ?? (thread as any).vote ?? null;
    setUserVote(typeof raw === 'number' ? (raw as 1 | -1) : null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.id]);

  const handleVote = async (newVote: 1 | -1 | null) => {
    if (!thread.id || loading) return;

    const prevUp = upvoteCount;
    const prevDown = downvoteCount;
    const prevUser = userVote;

    const nextCounts = () => {
      if (prevUser === newVote) {
        return { upvotes: prevUp, downvotes: prevDown };
      }
      if (prevUser === null && newVote === 1) return { upvotes: prevUp + 1, downvotes: prevDown };
      if (prevUser === null && newVote === -1) return { upvotes: prevUp, downvotes: prevDown + 1 };
      if (prevUser === 1 && newVote === null) return { upvotes: prevUp - 1, downvotes: prevDown };
      if (prevUser === -1 && newVote === null) return { upvotes: prevUp, downvotes: prevDown - 1 };
      if (prevUser === 1 && newVote === -1) return { upvotes: prevUp - 1, downvotes: prevDown + 1 };
      if (prevUser === -1 && newVote === 1) return { upvotes: prevUp + 1, downvotes: prevDown - 1 };
      return { upvotes: prevUp, downvotes: prevDown };
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

      // refresh authoritative counts when possible
      if (thread.protocol?.id) {
        const fresh = await threadService.get(thread.protocol.id, thread.id);
        setUpvoteCount(fresh.upvotes_count ?? nextUpvotes);
        setDownvoteCount(fresh.downvotes_count ?? nextDownvotes);
        const raw = (fresh as any).user_vote ?? (fresh as any).vote ?? null;
        setUserVote(typeof raw === 'number' ? (raw as 1 | -1) : newVote);
      }
    } catch (err) {
      setUpvoteCount(prevUp);
      setDownvoteCount(prevDown);
      setUserVote(prevUser);
      // eslint-disable-next-line no-alert
      alert('Vote failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const { isAuthenticated, open } = useRequireAuth();

  const guardClick = (fn?: () => void) => (event: React.MouseEvent) => {
    event.stopPropagation();
    if (isAuthenticated) {
      fn?.();
    } else {
      open();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleNavigate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleNavigate();
        }
      }}
      className={[
        'w-full text-left bg-white rounded-2xl border border-gray-100',
        'hover:border-[#118451]/30 hover:shadow-sm transition-all duration-150',
        compact ? 'p-4' : 'p-5',
        'cursor-pointer',
      ].join(' ')}
    >
      {/* Author row */}
      <div className="flex items-center gap-2 mb-2.5">
        <Avatar name={authorName} size="xs" />
        <span className="text-xs text-gray-500 font-medium truncate flex-1">{authorName}</span>
        <span className="text-xs text-gray-400 flex-shrink-0">
          {formatRelativeDate(thread.created_at)}
        </span>
      </div>

      {/* Title */}
      <h3 className={['font-semibold text-gray-900 mb-2 line-clamp-2', compact ? 'text-sm' : 'text-sm'].join(' ')}>
        {thread.title}
      </h3>

      {/* Body snippet */}
      {!compact && thread.body && (
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-3">
          {thread.body}
        </p>
      )}

      {canManage && (onEdit || onDelete) && (
        <div className="flex items-center gap-3 mb-3">
            {onEdit && (
              <button
                type="button"
                onClick={guardClick(onEdit)}
                className="text-xs font-semibold text-[#118451] hover:text-[#065c38] transition-colors"
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={guardClick(onDelete)}
                className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors"
              >
                Delete
              </button>
            )}
        </div>
      )}

      {/* Metrics */}
      <div className="flex items-center gap-3 mt-2">
        {/* Vote controls - stop propagation so clicks don't navigate away */}
        <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
          <VoteController
            initialUpvotes={upvoteCount}
            initialDownvotes={downvoteCount}
            userVote={userVote}
            size={compact ? 'sm' : 'md'}
            onVote={(v) => { void handleVote(v); }}
          />
        </div>

        {/* Comments */}
        <div className="flex items-center gap-1 text-gray-400 ml-2">
          <MessageSquare size={14} />
          <span className="text-xs font-medium text-gray-500">
            {thread.comments_count ?? 0}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ThreadCard;
