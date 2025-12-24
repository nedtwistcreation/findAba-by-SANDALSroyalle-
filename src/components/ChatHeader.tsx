import React from 'react';
import { useChatContext } from '../context/ChatProvider';
import { LucideUser, LucideActivity } from 'lucide-react';

type Props = {
  title?: string;
};

export default function ChatHeader({ title }: Props) {
  const { presence, isTypingBy, currentUser } = useChatContext();

  const typingUsers = presence
    .filter(p => isTypingBy[p.user_id] && p.user_id !== currentUser.id)
    .map(p => p.displayName || 'Unknown');

  const onlineCount = presence.length;

  const renderTypingLine = () => {
    if (typingUsers.length === 0) {
      return `${onlineCount} online`;
    }

    if (typingUsers.length === 1) return `${typingUsers[0]} is typing...`;
    if (typingUsers.length === 2) return `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
    return `${typingUsers[0]} and ${typingUsers.length - 1} others are typing...`;
  };

  return (
    <div className="px-4 py-3 border-b border-slate-900 flex items-center justify-between bg-slate-950">
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2">
          {presence.slice(0, 3).map((p) => (
            <div key={p.key} className="w-9 h-9 rounded-full bg-slate-800 border border-slate-900 flex items-center justify-center overflow-hidden text-xs">
              {p.avatarUrl ? (
                <img src={p.avatarUrl} alt={p.displayName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-amber-400">{(p.displayName || '?').slice(0, 2).toUpperCase()}</span>
              )}
            </div>
          ))}
        </div>

        <div>
          <div className="text-slate-100 font-semibold">{title ?? 'Conversation'}</div>
          <div className="text-xs text-slate-500 flex items-center gap-2">
            {typingUsers.length > 0 ? (
              <span className="text-amber-400 flex items-center gap-1">
                <LucideActivity className="w-3 h-3 animate-pulse" />
                {renderTypingLine()}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <LucideUser className="w-3 h-3 text-slate-500" />
                <span>{renderTypingLine()}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="text-xs text-slate-500">
      </div>
    </div>
  );
}
