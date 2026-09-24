import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import DesktopSidebar from '../components/layout/DesktopSidebar';
import { ThreadHeader, CommentStream, CommentComposer } from '../components/threads';
import useRequireAuth from '../hooks/useRequireAuth';
import { useAppSelector } from '../store/hooks';
import { threadService } from '../api/threadService';
import { commentService } from '../api/commentService';
import type { Thread } from '../types/thread';
import type { Comment, CreateCommentRequest } from '../types/comment';
import type { ApiError } from '../types/api';

// ****Thread loading skeleton ──────────────────────────────────────────────────
import Skeleton from '../components/ui/Skeleton';
import Button from '../components/ui/Button';

const ThreadHeaderSkeleton: React.FC = () => (
  <header className="sticky top-0 z-30 bg-white border-b border-gray-100">
    <div className="flex items-center gap-2 px-4 py-3">
      <Skeleton width={20} height={20} rounded />
      <Skeleton width={160} height={12} />
    </div>
    <div className="px-4 pb-4 space-y-3">
      <Skeleton width="75%" height={20} />
      <div className="flex items-center gap-2">
        <Skeleton width={24} height={24} rounded />
        <Skeleton width={80} height={12} />
        <Skeleton width={56} height={12} />
      </div>
      <div className="space-y-1.5">
        <Skeleton width="100%" height={12} />
        <Skeleton width="80%" height={12} />
        <Skeleton width="60%" height={12} />
      </div>
    </div>
  </header>
);

// ****Thread Page ***********//***───────
const ThreadDetailsPage: React.FC = () => {
  const router = useRouter();
  const id = router.query.id as string | undefined;

  const protocolIdFromState = router.query.protocolId ? Number(router.query.protocolId) : undefined;

  const [thread, setThread] = useState<Thread | null>(null);
  const [threadLoading, setThreadLoading] = useState(true);
  const [threadError, setThreadError] = useState<string | null>(null);

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);

  const [replyTo, setReplyTo] = useState<{ id: number; author: string } | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const currentUserId = useAppSelector((s) => s.auth.user?.id ?? null);
  const { isAuthenticated, open } = useRequireAuth();

  const updateCommentInTree = (items: Comment[], commentId: number, updater: (comment: Comment) => Comment): Comment[] =>
    items.map((item) => {
      if (item.id === commentId) {
        return updater(item);
      }

      if (item.replies) {
        return { ...item, replies: updateCommentInTree(item.replies, commentId, updater) };
      }

      return item;
    });

  const removeCommentFromTree = (items: Comment[], commentId: number): Comment[] =>
    items.reduce<Comment[]>((result, item) => {
      if (item.id === commentId) {
        return result;
      }

      if (item.replies) {
        const replies = removeCommentFromTree(item.replies, commentId);
        return [...result, { ...item, replies }];
      }

      return [...result, item];
    }, []);

  const handleCommentUpdated = (updatedComment: Comment) => {
    setComments((current) => updateCommentInTree(current, updatedComment.id, () => updatedComment));
  };

  const handleCommentDeleted = (commentId: number) => {
    setComments((current) => removeCommentFromTree(current, commentId));
  };

  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // ****Window resize listener ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // ****Fetch thread ***********//***──────
  useEffect(() => {
    if (!id) {
      setThreadError('Thread identifier missing.');
      setThreadLoading(false);
      return;
    }

    if (!protocolIdFromState) {
      setThreadError('Unable to determine which protocol this thread belongs to. Please navigate back and try again.');
      setThreadLoading(false);
      return;
    }

    let cancelled = false;

    const fetchThread = async () => {
      setThreadLoading(true);
      setThreadError(null);
      try {
        const data = await threadService.get(protocolIdFromState, id);
        if (!cancelled) {
          setThread(data);
        }
      } catch (err) {
        if (!cancelled) {
          const apiError = err as ApiError;
          setThreadError(apiError.message ?? 'Failed to load thread.');
        }
      } finally {
        if (!cancelled) {
          setThreadLoading(false);
        }
      }
    };

    fetchThread();

    return () => {
      cancelled = true;
    };
  }, [id, protocolIdFromState]);

  // ****Fetch comments ***********//***────
  const fetchComments = useCallback(async () => {
    if (!id) return;

    let cancelled = false;

    setCommentsLoading(true);
    setCommentsError(null);
    try {
      const response = await commentService.listByThread(id);
      if (!cancelled) {
        setComments(response.data ?? []);
      }
    } catch (err) {
      if (!cancelled) {
        const apiError = err as ApiError;
        setCommentsError(apiError.message ?? 'Failed to load comments.');
      }
    } finally {
      if (!cancelled) {
        setCommentsLoading(false);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // ****Handlers ***********//***─────────
  const handleReply = (commentId: number, authorName: string) => {
    if (!isAuthenticated) {
      open();
      return;
    }

    setReplyTo({ id: commentId, author: authorName });
    setCommentText(`@${authorName} `);
    setTimeout(() => composerRef.current?.focus(), 100);
  };

  const handleCancelReply = () => {
    setReplyTo(null);
    setCommentText('');
  };

  const handleEditThread = () => {
    if (!isAuthenticated) { open(); return; }
    setIsEditing(true);
  };

  const handleDeleteThread = async () => {
    if (!isAuthenticated) { open(); return; }
    if (!id || !protocolIdFromState) return;
    if (!window.confirm('Delete this thread? This action cannot be undone.')) return;

    try {
      await threadService.delete(protocolIdFromState, id);
      router.back();
    } catch {
      // eslint-disable-next-line no-alert
      window.alert('Failed to delete thread. Please try again.');
    }
  };

  const handleThreadUpdated = (updated: Thread) => {
    setThread(updated);
    setIsEditing(false);
  };

  const handleSubmit = async () => {
    if (!isAuthenticated) { open(); return; }
    if (!commentText.trim() || !id || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const payload: CreateCommentRequest = {
        body: commentText.trim(),
        parent_id: replyTo?.id ?? null,
      };

      await commentService.create(id, payload);

      setCommentText('');
      setReplyTo(null);
      // Re-fetch comments to show the newly added one
      await fetchComments();
    } catch {
      // Errors for non-422 responses are handled globally by the API client
      // 422 validation errors are silent here; could be surfaced via a toast
    } finally {
      setIsSubmitting(false);
    }
  };

  // ****Error state ***********//***───────
  if (!threadLoading && threadError) {
    return (
      <div className="flex min-h-screen bg-white">
        <DesktopSidebar />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <p className="text-base font-semibold text-gray-900 mb-2">Unable to load thread</p>
            <p className="text-sm text-gray-500 mb-6">{threadError}</p>
            <button
              onClick={() => router.back()}
              className="px-5 py-2.5 rounded-[2rem] bg-[#118451] text-white text-sm font-semibold hover:bg-[#065c38] transition-colors cursor-pointer"
            >
              Go back
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* Desktop Sidebar */}
      <DesktopSidebar />

      {/* Main thread content */}
      <main className="flex-1 flex flex-col min-w-0">

        {/* Thread header */}
        {threadLoading || !thread ? (
          <ThreadHeaderSkeleton />
        ) : (
          <ThreadHeader
            thread={thread}
            canManage={Boolean(currentUserId && (thread.author?.id ?? thread.user?.id) === currentUserId)}
            onEdit={handleEditThread}
            onDelete={handleDeleteThread}
          />
        )}

        {/* Comment stream */}
        <CommentStream
          comments={comments}
          isLoading={commentsLoading}
          error={commentsError}
          isDesktop={isDesktop}
          currentUserId={currentUserId}
          onReply={handleReply}
          onCommentUpdated={handleCommentUpdated}
          onCommentDeleted={handleCommentDeleted}
        />

        {/* Compose bar */}
        <CommentComposer
          commentText={commentText}
          replyTo={replyTo}
          isDesktop={isDesktop}
          isSubmitting={isSubmitting}
          onChange={setCommentText}
          onSubmit={handleSubmit}
          onCancelReply={handleCancelReply}
          composerRef={composerRef}
        />

        {thread && isEditing && (
          <EditThreadModal
            thread={thread}
            protocolId={protocolIdFromState!}
            onClose={() => setIsEditing(false)}
            onSuccess={handleThreadUpdated}
          />
        )}
      </main>
    </div>
  );
};

interface EditThreadModalProps {
  thread: Thread;
  protocolId: number;
  onClose: () => void;
  onSuccess: (thread: Thread) => void;
}

const EditThreadModal: React.FC<EditThreadModalProps> = ({ thread, protocolId, onClose, onSuccess }) => {
  const [title, setTitle] = useState(thread.title);
  const [body, setBody] = useState(thread.body);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const updated = await threadService.update(protocolId, thread.id, {
        title: title.trim(),
        body: body.trim(),
      });
      onSuccess(updated);
      onClose();
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message ?? 'Failed to update thread. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end lg:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Edit thread"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl lg:rounded-2xl w-full max-w-lg p-6 shadow-2xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Edit Thread</h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{thread.title}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="edit-thread-title" className="text-sm font-semibold text-gray-700 block mb-1.5">
              Thread Title
            </label>
            <input
              id="edit-thread-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Update your thread title"
              maxLength={200}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#118451]/40 focus:border-[#118451] transition-colors"
            />
          </div>

          <div>
            <label htmlFor="edit-thread-body" className="text-sm font-semibold text-gray-700 block mb-1.5">
              Body
            </label>
            <textarea
              id="edit-thread-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Update the thread details."
              rows={4}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#118451]/40 focus:border-[#118451] resize-none transition-colors"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3">
            <Button variant="outline" size="md" onClick={onClose} disabled={isSubmitting} className="flex-1">
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={handleSubmit} isLoading={isSubmitting} loadingText="Saving changes..." className="flex-1">
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreadDetailsPage;
