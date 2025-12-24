import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { PresenceUser } from '../types/chat';
import { useNavigate } from 'react-router-dom';

type CurrentUser = {
  id: string;
  displayName?: string;
  role?: string;
  avatarUrl?: string;
};

type ChatContextValue = {
  currentConversationId: string | null;
  setCurrentConversationId: (id: string | null) => void;
  joinConversationPresence: (conversationId: string) => Promise<void>;
  leaveConversationPresence: (conversationId: string) => Promise<void>;
  presence: PresenceUser[];
  setTyping: (isTyping: boolean) => void;
  isTypingBy: Record<string, boolean>;
  currentUser: CurrentUser;
};

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

type Props = {
  children: React.ReactNode;
  currentUser: CurrentUser;
};

export function ChatProvider({ children, currentUser }: Props) {
  const [currentConversationId, setCurrentConversationIdState] = useState<string | null>(null);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [isTypingBy, setIsTypingBy] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();

  const channelRef = useRef<any | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  const cleanupChannel = useCallback(async () => {
    if (channelRef.current) {
      try {
        await channelRef.current.untrack();
      } catch (e) {
      }
      try {
        channelRef.current.unsubscribe();
      } catch (e) {
      }
      channelRef.current = null;
    }
    setPresence([]);
    setIsTypingBy({});
  }, []);

  const joinConversationPresence = useCallback(
    async (conversationId: string) => {
      if (!conversationId) return;
      if (channelRef.current?.topic === `presence:conversation:${conversationId}`) return;

      await cleanupChannel();

      const topic = `presence:conversation:${conversationId}`;
      const channel = supabase.channel(topic, { config: { presence: { key: currentUser.id } } });

      channel.on('presence', { event: 'sync' }, () => {
        try {
          // @ts-ignore
          const state = channel.presenceState();
          const users: PresenceUser[] = [];
          for (const key in state) {
            const metas = state[key] as any[];
            const meta = metas[metas.length - 1] ?? {};
            users.push({
              key,
              user_id: meta.user_id ?? meta.userId ?? meta.uid ?? meta.id ?? 'unknown',
              displayName: meta.displayName || meta.name || '',
              role: meta.role,
              avatarUrl: meta.avatarUrl,
              typing: !!meta.typing,
              online_at: meta.online_at
            });
          }
          setPresence(users);
          const typingMap: Record<string, boolean> = {};
          for (const u of users) typingMap[u.user_id] = !!u.typing;
          setIsTypingBy(typingMap);
        } catch (err) {
          console.error('Error parsing presence sync state', err);
        }
      });

      channel.on('presence', { event: 'join' }, ({ newPresences }: any) => {
        try {
          const usersToAdd: PresenceUser[] = [];
          for (const key in newPresences) {
            const metas = newPresences[key] as any[];
            const meta = metas[metas.length - 1];
            usersToAdd.push({
              key,
              user_id: meta.user_id ?? meta.userId ?? meta.uid ?? meta.id ?? 'unknown',
              displayName: meta.displayName || meta.name || '',
              role: meta.role,
              avatarUrl: meta.avatarUrl,
              typing: !!meta.typing,
              online_at: meta.online_at
            });
          }
          setPresence(prev => {
            const map = new Map(prev.map(p => [p.key, p]));
            for (const u of usersToAdd) map.set(u.key, u);
            const arr = Array.from(map.values());
            const typingMap: Record<string, boolean> = {};
            for (const p of arr) typingMap[p.user_id] = !!p.typing;
            setIsTypingBy(typingMap);
            return arr;
          });
        } catch (err) {
          console.error('presence join handler error', err);
        }
      });

      channel.on('presence', { event: 'leave' }, ({ leftPresences }: any) => {
        try {
          const keysLeft = Object.keys(leftPresences || {});
          if (keysLeft.length === 0) return;
          setPresence(prev => {
            const filtered = prev.filter(p => !keysLeft.includes(p.key));
            const typingMap: Record<string, boolean> = {};
            for (const p of filtered) typingMap[p.user_id] = !!p.typing;
            setIsTypingBy(typingMap);
            return filtered;
          });
        } catch (err) {
          console.error('presence leave handler error', err);
        }
      });

      channelRef.current = channel;
      channel.subscribe(async (status: any) => {
        if (status === 'SUBSCRIBED') {
          try {
            const trackPayload = {
              user_id: currentUser.id,
              displayName: currentUser.displayName ?? '',
              role: currentUser.role ?? '',
              avatarUrl: currentUser.avatarUrl ?? '',
              typing: false,
              online_at: new Date().toISOString()
            };
            await channel.track(trackPayload);
          } catch (err) {
            console.error('Error tracking presence', err);
          }
        }
      });
    },
    [cleanupChannel, currentUser]
  );

  const leaveConversationPresence = useCallback(
    async (conversationId: string) => {
      if (!channelRef.current) return;
      try {
        await channelRef.current.untrack();
      } catch (err) {
      }
      try {
        channelRef.current.unsubscribe();
      } catch (err) {
      }
      channelRef.current = null;
      setPresence([]);
      setIsTypingBy({});
    },
    []
  );

  const setTyping = useCallback(
    async (isTyping: boolean) => {
      if (!channelRef.current) return;
      try {
        const trackPayload = {
          user_id: currentUser.id,
          displayName: currentUser.displayName ?? '',
          role: currentUser.role ?? '',
          avatarUrl: currentUser.avatarUrl ?? '',
          typing: !!isTyping,
          online_at: new Date().toISOString()
        };
        await channelRef.current.track(trackPayload);
        setIsTypingBy(prev => ({ ...prev, [currentUser.id]: !!isTyping }));

        if (typingTimeoutRef.current) {
          window.clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
        if (isTyping) {
          typingTimeoutRef.current = window.setTimeout(async () => {
            try {
              const payload = { ...trackPayload, typing: false };
              await channelRef.current?.track(payload);
              setIsTypingBy(prev => ({ ...prev, [currentUser.id]: false }));
            } catch (err) {
            } finally {
              typingTimeoutRef.current = null;
            }
          }, 3000);
        }
      } catch (err) {
        console.error('Failed to set typing', err);
      }
    },
    [currentUser.id, currentUser.displayName, currentUser.role]
  );

  const setCurrentConversationId = useCallback(
    (id: string | null) => {
      setCurrentConversationIdState(id);
      if (id) {
        navigate(`/chat/${id}`, { replace: false });
        joinConversationPresence(id).catch(err => {
          console.error('Failed joining conversation presence', err);
        });
      } else {
        cleanupChannel();
        navigate(`/chat`, { replace: true });
      }
    },
    [cleanupChannel, joinConversationPresence, navigate]
  );

  useEffect(() => {
    return () => {
      cleanupChannel();
    };
  }, [cleanupChannel]);

  const value: ChatContextValue = {
    currentConversationId,
    setCurrentConversationId,
    joinConversationPresence,
    leaveConversationPresence,
    presence,
    setTyping,
    isTypingBy,
    currentUser
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider');
  return ctx;
}
