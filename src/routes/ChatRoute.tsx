import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useChatContext } from '../context/ChatProvider';
import ChatWindow from '../components/ChatWindow';

export default function ChatRoute() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { setCurrentConversationId, currentUser } = useChatContext();

  useEffect(() => {
    if (conversationId) {
      setCurrentConversationId(conversationId);
    } else {
      setCurrentConversationId(null);
    }

    return () => {
      setCurrentConversationId(null);
    };
  }, [conversationId, setCurrentConversationId]);

  if (!conversationId) {
    return <div className="p-6 text-slate-400">No conversation selected.</div>;
  }

  return <ChatWindow conversationId={conversationId} currentUserId={currentUser.id} />;
}
