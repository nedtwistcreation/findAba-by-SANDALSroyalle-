import React from 'react';
import type { Message } from '../types/chat';

type Props = {
  message: Message;
  isOwn: boolean;
};

export default function MessageBubble({ message, isOwn }: Props) {
  return (
    <div className={`max-w-[78%] ${isOwn ? 'ml-auto text-right' : 'mr-auto text-left'}`}>
      <div
        className={`inline-block p-3 rounded-2xl rounded-tighter ${isOwn ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-100'}`}
      >
        {message.body && <div className="whitespace-pre-wrap">{message.body}</div>}
        {message.attachments?.length ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {message.attachments.map((a, idx) => (
              <a
                key={idx}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-amber-100 hover:underline"
              >
                {a.name ?? 'Attachment'}
              </a>
            ))}
          </div>
        ) : null}
      </div>
      <div className="text-xs text-slate-500 mt-1">
        <span>{new Date(message.created_at).toLocaleTimeString()}</span>
        {message.status ? <span className="ml-2">• {message.status}</span> : null}
      </div>
    </div>
  );
}
