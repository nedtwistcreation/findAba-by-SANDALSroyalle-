import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Message } from '../types/chat';
import { v4 as uuidv4 } from 'uuid';

export function useChat(conversationId: string | null, currentUserId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const pageSize = 30;
  const lastLoadedAt = useRef<string | null>(null);
  const channelRef = useRef<any>(null);

  const conversationIdMemo = useMemo(() => conversationId, [conversationId]);

  useEffect(() => {
    if (!conversationIdMemo) return;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from<Message>('messages')
        .select('*')
        .eq('conversation_id', conversationIdMemo)
        .order('created_at', { ascending: false })
        .limit(pageSize);

      if (error) {
        console.error('Failed loading messages', error);
        setLoading(false);
        return;
      }
      const items = data ?? [];
      setMessages(items.reverse());
      lastLoadedAt.current = items.length ? items[items.length - 1].created_at : null;
      setHasMore((data?.length ?? 0) === pageSize);
      setLoading(false);
    })();

    const channel = supabase.channel(`public:messages:conversation=${conversationIdMemo}`);
    channelRef.current = channel;

    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationIdMemo}` },
      (payload: any) => {
        const newRow = payload.new as Message;
        setMessages(prev => {
          if (prev.some(m => m.id === newRow.id)) return prev;
          return [...prev, newRow];
        });
      }
    );

    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationIdMemo}` },
      (payload: any) => {
        const updated = payload.new as Message;
        setMessages(prev => prev.map(m => (m.id === updated.id ? updated : m)));
      }
    );

    channel.subscribe(status => {
      // status: 'SUBSCRIBED' etc.
    });

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [conversationIdMemo]);

  async function loadMore() {
    if (!conversationIdMemo || !lastLoadedAt.current) return;
    setLoading(true);
    const { data, error } = await supabase
      .from<Message>('messages')
      .select('*')
      .eq('conversation_id', conversationIdMemo)
      .lt('created_at', lastLoadedAt.current)
      .order('created_at', { ascending: false })
      .limit(pageSize);

    if (error) {
      console.error('Failed to load more messages', error);
      setLoading(false);
      return;
    }
    const items = data ?? [];
    setMessages(prev => [...items.reverse(), ...prev]);
    lastLoadedAt.current = items.length ? items[items.length - 1].created_at : lastLoadedAt.current;
    setHasMore((data?.length ?? 0) === pageSize);
    setLoading(false);
  }

  async function sendMessage(body?: string, files?: File[]) {
    if (!conversationIdMemo) throw new Error('No conversation selected');
    const tempId = `temp-${uuidv4()}`;
    const optimistic: Message = {
      id: tempId,
      conversation_id: conversationIdMemo,
      sender_id: currentUserId,
      body: body ?? null,
      attachments: [],
      status: 'sent',
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, optimistic]);

    const attachments: any[] = [];
    if (files && files.length > 0) {
      const bucket = 'chat-attachments';
      for (const f of files) {
        const path = `conversations/${conversationIdMemo}/${uuidv4()}-${f.name}`;
        const { error: uploadErr } = await supabase.storage.from(bucket).upload(path, f, {
          cacheControl: '3600',
          upsert: false,
          contentType: f.type
        });
        if (uploadErr) {
          console.error('Upload failed for attachment', uploadErr);
          continue;
        }
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
        attachments.push({ url: urlData.publicUrl, name: f.name, mime: f.type, size: f.size });
      }
    }

    const { data, error } = await supabase
      .from<Message>('messages')
      .insert({
        conversation_id: conversationIdMemo,
        sender_id: currentUserId,
        body: body ?? null,
        attachments,
        status: 'sent'
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to send message', error);
      setMessages(prev => prev.map(m => (m.id === tempId ? { ...m, metadata: { failed: true } } : m)));
      return { error };
    }

    setMessages(prev => prev.map(m => (m.id === tempId ? data! : m)));
    return { data };
  }

  async function markAsRead(messageId: string) {
    if (!conversationIdMemo) return;
    await supabase
      .from('messages')
      .update({ status: 'read' })
      .eq('id', messageId)
      .eq('conversation_id', conversationIdMemo);
  }

  return {
    messages,
    loading,
    hasMore,
    loadMore,
    sendMessage,
    markAsRead
  };
}
