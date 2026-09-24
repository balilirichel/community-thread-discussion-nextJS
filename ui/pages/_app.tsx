import "@/styles/globals.css";
import 'react-toastify/dist/ReactToastify.css';
import type { AppProps } from "next/app";
import { Provider } from 'react-redux';
import { store } from '../src/store';
import { AuthModalProvider } from '../src/components/auth/AuthModalContext';
import { ToastContainer } from 'react-toastify';
import ChatLauncher from '../src/components/chat/ChatLauncher';
import ChatWindow from '../src/components/chat/ChatWindow';
import { useChat } from '../src/hooks/useChat';
import { useAuth } from '../src/hooks/useAuth';
import { useEffect, useRef, useState, useCallback } from 'react';

function AppProviders({ children }: { children: React.ReactNode }) {
  const { token, fetchUser } = useAuth();
  const fetchedUserOnStartup = useRef(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { messages, isLoading, sendMessage } = useChat();

  useEffect(() => {
    if (!token || fetchedUserOnStartup.current) {
      return;
    }

    fetchedUserOnStartup.current = true;
    fetchUser().catch(() => {
      // auth interceptor clears invalid token state on 401
    });
  }, [token, fetchUser]);

  const handleToggleChat = useCallback(() => {
    setIsChatOpen((prev) => !prev);
  }, []);

  const handleCloseChat = useCallback(() => {
    setIsChatOpen(false);
  }, []);

  return (
    <>
      <AuthModalProvider>
        {children}
      </AuthModalProvider>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar
        newestOnTop
        closeOnClick
        pauseOnHover
        theme="colored"
      />
      <ChatLauncher isOpen={isChatOpen} onToggle={handleToggleChat} />
      <ChatWindow
        isOpen={isChatOpen}
        onClose={handleCloseChat}
        messages={messages}
        isLoading={isLoading}
        onSendMessage={sendMessage}
      />
    </>
  );
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Provider store={store}>
      <AppProviders>
        <Component {...pageProps} />
      </AppProviders>
    </Provider>
  );
}
