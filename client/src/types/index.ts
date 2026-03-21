export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  company_name?: string;
  website_url?: string;
  client_notes?: string;
  role: 'client' | 'admin';
  is_active: boolean;
  has_pending_invite?: boolean;
  has_pending_reset?: boolean;
  created_at: string;
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
  client_name?: string;
  client_email?: string;
  company_name?: string;
  website_url?: string;
  attachment_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: number;
  ticket_id: number;
  filename: string;
  filepath: string;
  uploaded_at: string;
}

export interface TicketActivity {
  id: number;
  ticket_id: number;
  user_id?: number;
  action: string;
  detail?: string;
  created_at: string;
  user_name?: string;
  user_role?: string;
}

export interface DashboardStats {
  pending: number;
  in_progress: number;
  completed_this_month: number;
  total: number;
  total_clients?: number;
}
