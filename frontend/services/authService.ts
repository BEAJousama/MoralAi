/**
 * Auth API: register, login, and fetch students list (admin).
 */

// When opened from another device (e.g. phone at http://192.168.x.x:3000), use that host for API so requests hit your dev machine
function getApiBase(): string {
  if (typeof window !== 'undefined' && window.location?.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return `http://${window.location.hostname}:4000`;
  }
  return (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE !== undefined)
    ? (import.meta as any).env.VITE_API_BASE
    : 'http://localhost:4000';
}
const API_BASE = getApiBase();

export interface AuthUser {
  id: number;
  username: string;
  role: 'student' | 'admin' | 'counselor';
}

export interface RegisterLoginResponse {
  user: AuthUser;
  token: string;
}

export async function register(username: string, password: string): Promise<RegisterLoginResponse> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username.trim(), password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || data?.message || res.statusText || 'Registration failed';
    throw new Error(msg);
  }
  return data as RegisterLoginResponse;
}

export async function login(username: string, password: string): Promise<RegisterLoginResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username.trim(), password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || data?.message || res.statusText || 'Invalid credentials';
    throw new Error(msg);
  }
  return data as RegisterLoginResponse;
}

export type RiskLevel = 'Low' | 'Medium' | 'High';
export type Trend = 'stable' | 'increasing' | 'decreasing';

export interface AssessmentResult {
  id: number;
  risk_level: RiskLevel;
  risk_score: number;
  concerns: string[];
  ai_recommendation: string;
  keywords: string[];
  trend: Trend;
  created_at: string;
}

export interface ApiStudent {
  id: number;
  username: string;
  created_at: string;
  risk_level: RiskLevel | null;
  risk_score: number | null;
  concerns: string[];
  ai_recommendation: string | null;
  keywords: string[];
  trend: Trend | null;
  assessed_at: string | null;
}

export async function submitAssessment(
  token: string,
  messages: Array<{ role: string; text?: string; parts?: { text: string }[] }>
): Promise<AssessmentResult> {
  const res = await fetch(`${API_BASE}/api/assessment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || res.statusText || 'Assessment failed';
    throw new Error(msg);
  }
  return data?.assessment as AssessmentResult;
}

export interface AssessmentFormData {
  risk_level: RiskLevel;
  risk_score?: number;
  concerns: string[];
  note?: string;
  trend: Trend;
}

export async function submitAssessmentForm(token: string, form: AssessmentFormData): Promise<AssessmentResult> {
  const res = await fetch(`${API_BASE}/api/assessment/form`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      risk_level: form.risk_level,
      risk_score: form.risk_score,
      concerns: form.concerns,
      note: form.note,
      trend: form.trend,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || res.statusText || 'Could not save. Try again.';
    throw new Error(typeof msg === 'string' ? msg : 'Could not save. Try again.');
  }
  return data?.assessment as AssessmentResult;
}

export async function getStudents(token: string): Promise<ApiStudent[]> {
  const res = await fetch(`${API_BASE}/api/students`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || res.statusText || 'Failed to load students';
    throw new Error(msg);
  }
  return (data?.students ?? []) as ApiStudent[];
}

export interface DashboardStats {
  lowRisk: number;
  mediumRisk: number;
  highRisk: number;
  totalActive: number;
  thisWeekCount: number;
  lastWeekCount: number;
  urgentCount: number;
  trend: Array<{ day: string; count: number; avgScore: number }>;
  recentActivity: Array<{ username: string; risk_level: RiskLevel; assessed_at: string }>;
}

export async function getDashboardStats(token: string): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE}/api/admin/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || res.statusText || 'Failed to load dashboard';
    throw new Error(msg);
  }
  return data as DashboardStats;
}

// --- Appointments ---

export type AppointmentType = 'counseling' | 'doctor' | 'follow_up';
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';

export interface Appointment {
  id: number;
  student_id: number;
  assigned_to: number | null;
  scheduled_at: string;
  type: AppointmentType;
  status: AppointmentStatus;
  location: string | null;
  provider_or_notes: string | null;
  admin_notes: string | null;
  counselor_report?: string | null;
  created_by: number;
  created_at: string;
  updated_at: string | null;
  student_username?: string;
  assigned_to_username?: string | null;
}

export interface CreateAppointmentPayload {
  studentId: number;
  scheduledAt: string;
  type?: AppointmentType;
  location?: string;
  providerOrNotes?: string;
  adminNotes?: string;
  assignedTo?: number | null;
}

export async function createAppointment(token: string, payload: CreateAppointmentPayload): Promise<Appointment> {
  const res = await fetch(`${API_BASE}/api/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || res.statusText || 'Failed to book appointment';
    throw new Error(msg);
  }
  if (!data?.appointment) {
    throw new Error(data?.message || data?.error || 'Invalid response: no appointment returned');
  }
  return data.appointment as Appointment;
}

export async function getAppointments(
  token: string,
  filters?: { studentId?: number; status?: AppointmentStatus; from?: string; to?: string }
): Promise<Appointment[]> {
  const params = new URLSearchParams();
  if (filters?.studentId != null) params.set('studentId', String(filters.studentId));
  if (filters?.status != null) params.set('status', filters.status);
  if (filters?.from != null) params.set('from', filters.from);
  if (filters?.to != null) params.set('to', filters.to);
  const qs = params.toString();
  const res = await fetch(`${API_BASE}/api/appointments${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || res.statusText || 'Failed to load appointments';
    throw new Error(msg);
  }
  return (data?.appointments ?? []) as Appointment[];
}

export async function updateAppointment(
  token: string,
  id: number,
  updates: {
    status?: AppointmentStatus;
    scheduled_at?: string;
    type?: AppointmentType;
    location?: string;
    provider_or_notes?: string;
    admin_notes?: string;
    assigned_to?: number | null;
    counselor_report?: string | null;
  }
): Promise<Appointment> {
  const res = await fetch(`${API_BASE}/api/appointments/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(updates),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || res.statusText || 'Failed to update appointment';
    throw new Error(msg);
  }
  return data.appointment as Appointment;
}

export async function deleteAppointment(token: string, id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/appointments/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}));
    const msg = data?.message || data?.error || res.statusText || 'Failed to delete';
    throw new Error(msg);
  }
}

export type ProviderType = 'counselor' | 'doctor';

export interface Counselor {
  id: number;
  username: string;
  created_at: string;
  provider_type?: ProviderType;
}

export async function getCounselors(token: string): Promise<Counselor[]> {
  const res = await fetch(`${API_BASE}/api/users/counselors`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || res.statusText || 'Failed to load counselors';
    throw new Error(msg);
  }
  return (data?.counselors ?? []) as Counselor[];
}

export async function createCounselor(
  token: string,
  username: string,
  password: string,
  providerType?: ProviderType
): Promise<{ id: number; username: string; role: string; provider_type?: ProviderType }> {
  const res = await fetch(`${API_BASE}/api/users/counselors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ username: username.trim(), password, providerType: providerType ?? 'counselor' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || data?.message || res.statusText || 'Failed to create counselor';
    throw new Error(msg);
  }
  return data.user as { id: number; username: string; role: string; provider_type?: ProviderType };
}

// --- Availability & slots ---

export interface AvailabilityWindow {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface SlotOption {
  start: string;
  end: string;
  counselor_id: number;
  counselor_username: string;
}

export async function getAvailability(token: string): Promise<AvailabilityWindow[]> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/availability`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to load availability');
  return (data?.availability ?? []) as AvailabilityWindow[];
}

export async function setAvailability(token: string, availability: AvailabilityWindow[]): Promise<void> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/availability`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ availability }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to save availability');
}

export async function getSlots(
  token: string,
  date: string,
  opts?: { counselorId?: number; type?: AppointmentType }
): Promise<SlotOption[]> {
  const base = getApiBase();
  const params = new URLSearchParams({ date });
  if (opts?.counselorId != null) params.set('counselorId', String(opts.counselorId));
  if (opts?.type) params.set('type', opts.type);
  const res = await fetch(`${base}/api/slots?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to load slots');
  return (data?.slots ?? []) as SlotOption[];
}

/** Get dates (YYYY-MM-DD) in a month that have at least one available slot */
export async function getSlotDates(
  token: string,
  month: string,
  opts?: { counselorId?: number; type?: AppointmentType }
): Promise<string[]> {
  const base = getApiBase();
  const params = new URLSearchParams({ month });
  if (opts?.counselorId != null) params.set('counselorId', String(opts.counselorId));
  if (opts?.type) params.set('type', opts.type);
  const res = await fetch(`${base}/api/slots/dates?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to load dates');
  return (data?.dates ?? []) as string[];
}

// --- Notifications ---

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  body: string;
  read_at: string | null;
  related_type: string | null;
  related_id: number | null;
  created_at: string;
}

export async function getNotifications(token: string, unreadOnly?: boolean): Promise<Notification[]> {
  const qs = unreadOnly ? '?unreadOnly=true' : '';
  const res = await fetch(`${API_BASE}/api/notifications${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || res.statusText || 'Failed to load notifications';
    throw new Error(msg);
  }
  return (data?.notifications ?? []) as Notification[];
}

export async function getUnreadNotificationCount(token: string): Promise<number> {
  const res = await fetch(`${API_BASE}/api/notifications/unread-count`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return 0;
  return typeof data?.count === 'number' ? data.count : 0;
}

export async function markNotificationRead(token: string, id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/notifications/${id}/read`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || res.statusText || 'Failed to mark as read';
    throw new Error(msg);
  }
}
