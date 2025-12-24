import React, { useRef } from 'react';
import { useChat } from '../hooks/useChat';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import ChatHeader from './ChatHeader';

type Props = {
  conversationId: string | null;
  currentUserId: string;
};

export default function ChatWindow({ conversationId, currentUserId }: Props) {
  const { messages, loading, hasMore, loadMore, sendMessage } = useChat(conversationId ?? '', currentUserId);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  if (!conversationId) {
    return (
      <div className="p-6 text-slate-400">
        Select a conversation to start chatting.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 border-l border-slate-900">
      <ChatHeader title="Conversation" />

      <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-4">
        {hasMore && (
          <button onClick={loadMore} className="mx-auto text-sm text-amber-400 py-1 px-3 bg-slate-900 rounded-md">
            Load earlier messages
          </button>
        )}

        {loading && <div className="text-center text-slate-500">Loading...</div>}

        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}>
            <MessageBubble message={msg} isOwn={msg.sender_id === currentUserId} />
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-slate-900">
        <MessageInput
          conversationId={conversationId}
          currentUserId={currentUserId}
          sendMessage={sendMessage}
        />
      </div>
    </div>
  );
}
