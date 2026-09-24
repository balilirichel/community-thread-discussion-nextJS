import { useState, useCallback, useRef, useEffect } from 'react';
import { chatService, type ChatMessage } from '../api/chatService';

const SESSION_KEY = 'chat_session';
const MESSAGES_KEY = 'chat_messages';

interface StoredSession {
  session_token: string;
  conversation_id: string;
}

function loadSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session: StoredSession): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function loadMessages(): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(MESSAGES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMessages(messages: ChatMessage[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages.slice(-50)));
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessages());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<StoredSession | null>(loadSession());

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  const ensureSession = useCallback(async (): Promise<StoredSession> => {
    if (sessionRef.current) {
      return sessionRef.current;
    }

    const session = await chatService.createSession();
    sessionRef.current = session;
    saveSession(session);
    return session;
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    setError(null);
    setIsLoading(true);

    try {
      const session = await ensureSession();

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        flagged_off_topic: false,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);

      const response = await chatService.sendMessage(session.conversation_id, text);

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        flagged_off_topic: false,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr?.message ?? 'Something went wrong. Please try again.');

      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant' as const,
          content: "I'm having trouble answering right now. Please try again shortly.",
          flagged_off_topic: false,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, ensureSession]);

  const createBooking = useCallback(async (data: {
    name: string;
    email: string;
    date: string;
    time: string;
    topic: string;
  }) => {
    try {
      const response = await chatService.createBooking(data);

      const bookingMessage: ChatMessage = {
        id: `booking-${Date.now()}`,
        role: 'assistant',
        content: `Booking confirmed! We'll reach out to ${data.email} shortly to confirm your ${data.date} appointment about "${data.topic}".`,
        flagged_off_topic: false,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, bookingMessage]);
      return response;
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr?.message ?? 'Failed to submit booking. Please try again.');
      throw err;
    }
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
    sessionRef.current = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(MESSAGES_KEY);
    }
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    createBooking,
    clearHistory,
  };
}
