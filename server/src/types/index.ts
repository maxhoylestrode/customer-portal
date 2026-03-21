export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  company_name?: string;
  website_url?: string;
  client_notes?: string;
  password_hash: string;
  role: 'client' | 'admin';
  is_active: boolean;
  invite_token?: string;
  invite_token_expires?: Date;
  password_reset_token?: string;
  password_reset_expires?: Date;
  created_at: Date;
}

export interface Ticket {
  id: number;
  user_id: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'complete' | 'out_of_scope';
  scope_flag: 'in_scope' | 'out_of_scope' | 'unknown';
  priority: 'low' | 'normal' | 'high';
  admin_notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Attachment {
  id: number;
  ticket_id: number;
  filename: string;
  filepath: string;
  uploaded_at: Date;
}

export interface TicketActivity {
  id: number;
  ticket_id: number;
  user_id?: number;
  action: string;
  detail?: string;
  created_at: Date;
  user_name?: string;
}

export interface JwtPayload {
  userId: number;
  role: 'client' | 'admin';
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
