export type Role = 'buyer' | 'merchant' | 'logistics' | 'admin';

export interface Conversation {
  id: string;
  title?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
  last_message_at?: string | null;
}

export interface Participant {
  id: string;
  conversation_id: string;
  user_id: string;
  role: Role;
  joined_at: string;
  metadata?: Record<string, any>;
}

export interface MessageAttachment {
  url: string;
  name?: string;
  mime?: string;
  size?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body?: string | null;
  attachments: MessageAttachment[];
  status: 'sent' | 'delivered' | 'read';
  metadata?: Record<string, any>;
  created_at: string;
  updated_at?: string;
}

export interface PresenceUser {
  key: string; // presence key (usually session id)
  user_id: string;
  displayName?: string;
  role?: Role;
  avatarUrl?: string;
  typing?: boolean;
  online_at?: string;
}
