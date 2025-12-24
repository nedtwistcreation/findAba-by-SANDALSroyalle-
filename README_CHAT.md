FindAba Chat (Supabase) — Quick Setup & Notes

Overview
- Real-time buyer ↔ merchant chat implemented using Supabase Realtime (Postgres row changes).
- Secure by RLS: only conversation participants can access messages.
- Attachments uploaded to a Storage bucket "chat-attachments".

Supabase Console Steps
1. Run the SQL migration supabase/migrations/001_create_chat_tables.sql in your Supabase SQL editor.
2. Create a Storage bucket named chat-attachments and make sure your app has permission to upload. Using public URLs is convenient; for tighter security use signed URLs.
3. Ensure Row Level Security (RLS) is enabled (the migration enables it) and policies are in place.
4. If you want to create a conversation from server or client, use the SQL function `create_conversation_with_participants` or insert into conversations + participants (respecting RLS).

Environment variables (.env)
- VITE_SUPABASE_URL=https://xyzcompany.supabase.co
- VITE_SUPABASE_ANON_KEY=public-anon-key

Front-end notes
- The hook useChat handles initial fetch, pagination, realtime insert/update listeners and optimistic message sending.
- For file uploads: ensure the Storage bucket exists and the anon key is allowed to upload (or perform uploads from server).
- Add Outfit font (Google Fonts) in index.html and use Tailwind config to include the font family.
- Components use Tailwind classes tuned for slate-950 background and Aba Gold (#FFD700 / Tailwind amber-400) accents.

Presence & Typing
- Presence and typing implemented using Supabase Realtime presence channels. The ChatProvider (src/context/ChatProvider.tsx) manages presence subscriptions for the active conversation.
- MessageInput calls ChatProvider.setTyping(true) while typing; ChatProvider debounces clearing after 3s of inactivity.
- ChatRoute syncs the route param /chat/:conversationId with the ChatProvider so presence joins when you navigate to a conversation.

Integration
- Wrap your Router with ChatProvider and pass the authenticated user:

```tsx
import { BrowserRouter } from 'react-router-dom';
import { ChatProvider } from './context/ChatProvider';

function App({ currentUser }) {
  return (
    <BrowserRouter>
      <ChatProvider currentUser={currentUser}>
        <YourRoutesOrLayout />
      </ChatProvider>
    </BrowserRouter>
  );
}
```

- Add route: <Route path="/chat/:conversationId" element={<ChatRoute />} />

Security notes
- Presence metadata should not contain secrets. The presence channel is ephemeral and for UI only.
