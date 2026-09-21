export type Role = "unassigned" | "branch_staff" | "hq_staff" | "technician" | "admin";

export type TicketStatus =
  | "pending"
  | "assigned"
  | "pending_review"
  | "completed"
  | "cancelled";

export type Priority = "normal" | "urgent";

export interface AppUser {
  id: string;
  line_user_id: string;
  display_name: string;
  role: Role;
  branch_id: string | null;
  is_active: boolean;
}

export interface Branch {
  id: string;
  name: string;
  is_active: boolean;
}

export interface Ticket {
  id: string;
  title: string;
  branch_id: string;
  location_detail: string | null;
  category: string;
  priority: Priority;
  description: string;
  status: TicketStatus;
  completion_note: string | null;
  rejection_note: string | null;
  is_archived: boolean;
  created_at: string;
  dispatched_at: string | null;
  completed_at: string | null;
  accepted_at: string | null;
  submitted_by: string;
  assigned_technician_id: string | null;
  branch?: { id: string; name: string } | null;
  submitter?: { id: string; display_name: string } | null;
  technician?: { id: string; display_name: string } | null;
}

export interface TicketLog {
  id: string;
  from_status: TicketStatus | null;
  to_status: TicketStatus;
  note: string | null;
  created_at: string;
  changed_by: { display_name: string } | null;
}

export const CATEGORIES = [
  "空調冷氣",
  "房務設備",
  "水電管線",
  "門窗鎖具",
  "床具寢具",
  "公共設施",
  "資訊網路",
  "其他",
];

export const STATUS_LABEL: Record<TicketStatus, string> = {
  pending: "待處理",
  assigned: "已派工／處理中",
  pending_review: "待驗收",
  completed: "已完成",
  cancelled: "已取消",
};

export const ROLE_LABEL: Record<Role, string> = {
  unassigned: "未指派角色",
  branch_staff: "分館人員",
  hq_staff: "總務窗口人員",
  technician: "工務人員",
  admin: "系統管理員",
};
