import React from 'react';
import { useChatContext } from '../context/ChatProvider';
import { LucideUser, LucideActivity } from 'lucide-react';

export default function PresenceList() {
  const { presence, isTypingBy } = useChatContext();

  if (!presence || presence.length === 0) {
    return (
      <div className="flex items-center gap-2 text-slate-400">
        <LucideUser className="w-4 h-4" />
        <span className="text-sm">No one online</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {presence.map(p => (
        <div key={p.key} className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden">
            {p.avatarUrl ? (
              <img src={p.avatarUrl} alt={p.displayName} className="w-full h-full object-cover" />
            ) : (
              <div className="text-xs text-amber-400">{p.displayName?.slice(0, 2).toUpperCase() || '?'}</div>
            )}
          </div>
          <div className="text-sm">
            <div className="text-slate-100 leading-4">{p.displayName ?? 'Unknown'}</div>
            <div className="text-xs text-slate-500">
              {isTypingBy[p.user_id] ? (
                <span className="flex items-center gap-1 text-amber-400">
                  <LucideActivity className="w-3 h-3 animate-pulse" />
                  typing...
                </span>
              ) : (
                <span>{p.role ?? 'member'}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
