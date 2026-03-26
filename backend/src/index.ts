import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import {
  initDb,
  createStudent,
  findUserByUsername,
  verifyPassword,
  listStudentsWithLatestAssessment,
  saveAssessment,
  getDashboardStats,
  createAppointment,
  listAppointments,
  getAppointmentById,
  updateAppointment,
  deleteAppointment,
  listCounselors,
  createCounselor,
  getCounselorAvailability,
  setCounselorAvailability,
  getAvailableSlots,
  getDatesWithSlots,
  getAdminUserIds,
  createNotification,
  listNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationCount,
  type UserRole,
  type RiskLevel,
  type Trend,
  type AppointmentType,
  type AppointmentStatus,
} from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load root .env first (used by Docker via docker-compose; local runs from backend/ so ../../.env = root)
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });
// When running locally (cd backend && npm run dev), backend/.env overrides (e.g. ELEVENLABS_API_KEY)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// --- LLM Provider Setup ---
// Set LLM_PROVIDER=ollama in .env to use local Llama via Ollama.
// Default is Gemini if GEMINI_API_KEY is set.
const LLM_PROVIDER = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const gemini = LLM_PROVIDER === 'gemini' && GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: GEMINI_API_KEY })
  : null;

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1';
const ollamaClient = LLM_PROVIDER === 'ollama'
  ? new OpenAI({ baseURL: OLLAMA_BASE_URL, apiKey: 'ollama' })
  : null;

const llmReady = gemini !== null || ollamaClient !== null;

console.log(
  `[LLM] provider=${LLM_PROVIDER} geminiModel=${gemini ? GEMINI_MODEL : '-'} ollamaModel=${ollamaClient ? OLLAMA_MODEL : '-'}`
);

/** User-facing message for chat/API errors (no technical details). */
const CHAT_ERROR_USER_MESSAGE =
  "I'm on a little break right now — think of me as napping or on leave 🌙 Maybe I had too much coffee and need a reset. Try again in a minute, or use the form to complete your check-in. I'll be back soon!";

/** Unified LLM params for both Gemini and Ollama. */
interface LLMParams {
  systemPrompt?: string;
  messages: Array<{ role: 'user' | 'model'; text: string }>;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

/** Call the configured LLM (Gemini or Ollama/Llama). */
async function generateContent(params: LLMParams): Promise<{ text: string }> {
  const { systemPrompt, messages, temperature = 0.7, maxTokens = 1024, jsonMode = false } = params;

  if (LLM_PROVIDER === 'ollama' && ollamaClient) {
    const oMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (systemPrompt) oMessages.push({ role: 'system', content: systemPrompt });
    for (const m of messages) {
      oMessages.push({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text });
    }
    // Note: not all Ollama models support response_format json_object — omit it and rely on prompt + parseAssessmentJson
    const completion = await ollamaClient.chat.completions.create({
      model: OLLAMA_MODEL,
      messages: oMessages,
      temperature,
      max_tokens: maxTokens,
    });
    return { text: (completion.choices[0]?.message?.content ?? '').trim() };
  }

  // Gemini
  const geminiContents = messages.map((m) => ({
    role: m.role === 'model' ? 'model' as const : 'user' as const,
    parts: [{ text: m.text }],
  }));
  const response = await gemini!.models.generateContent({
    model: GEMINI_MODEL,
    contents: geminiContents,
    config: {
      systemInstruction: systemPrompt,
      temperature,
      maxOutputTokens: maxTokens,
      ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  });
  return { text: (response.text ?? '').trim() };
}

function llmErrorToResponse(_err: unknown): { status: number; message: string } {
  return { status: 500, message: CHAT_ERROR_USER_MESSAGE };
}

/** Normalize SQLite datetime (UTC) to ISO string with Z so frontend parses correctly. */
function toISOUTC(s: string | null | undefined): string | null {
  if (s == null || s === '') return null;
  const normalized = s.replace(' ', 'T');
  return normalized.includes('Z') || /[+-]\d{2}:?\d{2}$/.test(normalized) ? normalized : normalized + 'Z';
}

const app = express();
const PORT = process.env.PORT ?? 4000;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB

app.use(cors({ origin: '*' }));
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

/** Auth: ensure Authorization Bearer and attach user to req */
function requireAuth(req: Request, res: Response, next: () => void) {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid token' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number; username: string; role: UserRole };
    (req as Request & { user?: typeof payload }).user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}

/** Require admin role (call after requireAuth) */
function requireAdmin(req: Request, res: Response, next: () => void) {
  const user = (req as Request & { user?: { role: string } }).user;
  if (user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden', message: 'Admin only' });
  }
  next();
}

/** Require counselor role (call after requireAuth) */
function requireCounselor(req: Request, res: Response, next: () => void) {
  const user = (req as Request & { user?: { role: string } }).user;
  if (user?.role !== 'counselor') {
    return res.status(403).json({ error: 'Forbidden', message: 'Counselor only' });
  }
  next();
}

/** POST /api/auth/register – employee only */
app.post('/api/auth/register', (req: Request, res: Response) => {
  initDb();
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (username.length < 2 || password.length < 6) {
    return res.status(400).json({ error: 'Username at least 2 characters, password at least 6' });
  }
  try {
    const user = createStudent(username, password);
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    return res.status(201).json({ user: { id: user.id, username: user.username, role: user.role }, token });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Username already taken' });
    }
    console.error('Register error:', e);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

/** POST /api/auth/login – employee or admin */
app.post('/api/auth/login', (req: Request, res: Response) => {
  initDb();
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const user = findUserByUsername(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  return res.json({ user: { id: user.id, username: user.username, role: user.role }, token });
});

/** GET /api/students – counselors only (admin cannot see employee names for privacy); returns registered employees with latest assessment */
app.get('/api/students', requireAuth, (req: Request, res: Response) => {
  const user = (req as Request & { user?: { role: string } }).user;
  if (user?.role === 'admin') {
    return res.status(403).json({ error: 'Forbidden', message: 'Access to student list is restricted for privacy.' });
  }
  initDb();
  const students = listStudentsWithLatestAssessment();
  return res.json({ students });
});

/** GET /api/admin/dashboard – admin only, aggregate stats only (no employee names); recent activity anonymized */
app.get('/api/admin/dashboard', requireAuth, requireAdmin, (_req: Request, res: Response) => {
  initDb();
  const stats = getDashboardStats();
  stats.recentActivity = stats.recentActivity.map((a) => ({ ...a, username: 'Student', assessed_at: toISOUTC(a.assessed_at) ?? a.assessed_at }));
  return res.json(stats);
});

// --- Appointments (admin: create/list/update; student: list own) ---

/** POST /api/appointments – students (for themselves) or counselors; creates in-app notification for student */
app.post('/api/appointments', requireAuth, (req: Request, res: Response) => {
  const user = (req as Request & { user?: { userId: number; role: string } }).user;
  if (user?.role === 'admin') {
    return res.status(403).json({ error: 'Forbidden', message: 'Appointment booking is restricted. Use counselor or student flow.' });
  }
  initDb();
  const body = req.body as {
    studentId?: number;
    scheduledAt?: string;
    type?: AppointmentType;
    location?: string;
    providerOrNotes?: string;
    adminNotes?: string;
    assignedTo?: number | null | string;
  };
  let studentId: number;
  if (user?.role === 'student') {
    studentId = user!.userId;
  } else if (user?.role === 'counselor') {
    const raw =
      typeof body.studentId === 'number'
        ? body.studentId
        : typeof body.studentId === 'string'
          ? parseInt(body.studentId, 10)
          : undefined;
    if (raw == null || Number.isNaN(raw)) {
      return res.status(400).json({ error: 'Bad request', message: 'studentId (number) required' });
    }
    studentId = raw;
  } else {
    return res.status(403).json({ error: 'Forbidden', message: 'Only students or counselors can create appointments.' });
  }
  const scheduledAt = body.scheduledAt;
  const type = body.type;
  const location = body.location;
  const providerOrNotes = body.providerOrNotes;
  const adminNotes = body.adminNotes;
  const rawAssignedTo = body.assignedTo;
  let assignedTo: number | undefined;
  if (rawAssignedTo != null && rawAssignedTo !== '') {
    const parsed = typeof rawAssignedTo === 'number' ? rawAssignedTo : parseInt(String(rawAssignedTo), 10);
    if (!Number.isNaN(parsed)) {
      const counselorIds = listCounselors().map((c) => c.id);
      if (counselorIds.includes(parsed)) assignedTo = parsed;
    }
  }
  if (user?.role === 'counselor' && assignedTo == null) assignedTo = undefined;
  if (user?.role === 'student') {
    // students may choose a preferred counselor; already validated above
  }
  if (!scheduledAt || typeof scheduledAt !== 'string') {
    return res.status(400).json({ error: 'Bad request', message: 'scheduledAt (ISO datetime string) required' });
  }
  const scheduled = new Date(scheduledAt);
  if (Number.isNaN(scheduled.getTime())) {
    return res.status(400).json({ error: 'Bad request', message: 'scheduledAt must be a valid ISO date/time' });
  }
  const student = listStudentsWithLatestAssessment().find((s) => s.id === studentId);
  if (!student) {
    return res.status(404).json({ error: 'Not found', message: 'Student not found' });
  }
  try {
    const appointment = createAppointment(studentId, scheduledAt, user!.userId, {
      type: type && ['counseling', 'doctor', 'follow_up'].includes(type) ? type : undefined,
      location: location && typeof location === 'string' ? location.slice(0, 200) : undefined,
      providerOrNotes: providerOrNotes && typeof providerOrNotes === 'string' ? providerOrNotes.slice(0, 500) : undefined,
      adminNotes: adminNotes && typeof adminNotes === 'string' ? adminNotes.slice(0, 500) : undefined,
      assignedTo: assignedTo,
    });
    const typeLabel = appointment.type === 'doctor' ? 'Doctor' : appointment.type === 'follow_up' ? 'Follow-up' : 'Counseling';
    const dateStr = new Date(appointment.scheduled_at).toLocaleString(undefined, {
      dateStyle: 'long',
      timeStyle: 'short',
    });
    const counselorName =
      appointment.assigned_to != null
        ? listCounselors().find((c) => c.id === appointment.assigned_to)?.username
        : null;
    let body =
      (appointment.location ? `When: ${dateStr}\nWhere: ${appointment.location}` : `When: ${dateStr}`) +
      (counselorName ? `\nWith: ${counselorName}` : '') +
      (appointment.provider_or_notes ? `\n${appointment.provider_or_notes}` : '') +
      '\n\nPlease contact campus wellness if you need to reschedule or have questions.';
    createNotification(
      studentId,
      'appointment_booked',
      `${typeLabel} appointment scheduled for you`,
      body,
      'appointment',
      appointment.id
    );
    // Future: send email to student if user has email (e.g. queue or mailer here)
    return res.status(201).json({ appointment });
  } catch (e) {
    console.error('Create appointment error:', e);
    const message = e instanceof Error ? e.message : String(e);
    const isFk = /foreign key|FOREIGN KEY|constraint failed/i.test(message);
    return res
      .status(isFk ? 400 : 500)
      .json({
        error: 'Failed to create appointment',
        message: isFk ? 'Invalid student or assigned counselor (not found).' : message,
      });
  }
});

/** GET /api/appointments – counselor: assigned to me; student: own only; admin: no access (privacy) */
app.get('/api/appointments', requireAuth, (req: Request, res: Response) => {
  const user = (req as Request & { user?: { userId: number; role: string } }).user;
  const role = user?.role;
  if (role === 'admin') {
    return res.status(403).json({ error: 'Forbidden', message: 'Access to appointments is restricted for privacy.' });
  }
  initDb();
  const { studentId, status, from, to } = req.query as { studentId?: string; status?: string; from?: string; to?: string };
  const filters: Parameters<typeof listAppointments>[0] = { limit: 200 };
  if (role === 'counselor') {
    filters.assignedToMeOrUnassigned = user!.userId;
    if (status != null && ['scheduled', 'completed', 'cancelled', 'no_show'].includes(status)) filters.status = status as AppointmentStatus;
  } else {
    filters.studentId = user!.userId;
  }
  const appointments = listAppointments(filters);
  return res.json({ appointments });
});

/** PATCH /api/appointments/:id – counselor only (status + report); admin cannot edit (privacy) */
app.patch('/api/appointments/:id', requireAuth, (req: Request, res: Response) => {
  const user = (req as Request & { user?: { userId: number; role: string; username?: string } }).user;
  if (user?.role === 'admin') {
    return res.status(403).json({ error: 'Forbidden', message: 'Appointment updates are restricted for privacy.' });
  }
  initDb();
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid appointment id' });
  const existing = getAppointmentById(id);
  if (!existing) return res.status(404).json({ error: 'Appointment not found' });
  const { status, scheduled_at, location, provider_or_notes, admin_notes, assigned_to, counselor_report } = req.body as {
    status?: AppointmentStatus;
    scheduled_at?: string;
    location?: string;
    provider_or_notes?: string;
    admin_notes?: string;
    assigned_to?: number | null;
    counselor_report?: string | null;
  };
  if (user?.role === 'counselor') {
    const isAssignedToMe = existing.assigned_to === user!.userId;
    const isUnassigned = existing.assigned_to == null;
    if (!isAssignedToMe && !isUnassigned) {
      return res.status(403).json({ error: 'Forbidden', message: 'Not your appointment' });
    }
    const newStatus = status && ['scheduled', 'completed', 'cancelled', 'no_show'].includes(status) ? status : undefined;
    const reportText = counselor_report != null && typeof counselor_report === 'string' ? counselor_report.slice(0, 2000) : undefined;
    const newScheduledAt = scheduled_at && typeof scheduled_at === 'string' ? scheduled_at : undefined;
    const newAssignedTo = assigned_to !== undefined ? (typeof assigned_to === 'number' ? assigned_to : null) : undefined;
    const updated = updateAppointment(id, {
      status: newStatus,
      counselor_report: reportText !== undefined ? reportText : undefined,
      scheduled_at: newScheduledAt,
      assigned_to: newAssignedTo,
    });
    if (updated && newStatus && (newStatus === 'completed' || newStatus === 'no_show')) {
      const dateStr = new Date(existing.scheduled_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
      const counselorName = user?.username ?? 'Counselor';
      const outcomeLabel = newStatus === 'completed' ? 'Completed' : 'Missed (no-show)';
      const reportSnippet = (updated as { counselor_report?: string | null }).counselor_report ? `\n\nReport: ${(updated as { counselor_report?: string | null }).counselor_report}` : '';
      const title = `Appointment ${outcomeLabel}`;
      const body = `${outcomeLabel} on ${dateStr} by ${counselorName}.${reportSnippet}`;
      createNotification(existing.student_id, 'appointment_outcome', title, body, 'appointment', id);
    }
    return res.json({ appointment: updated });
  }
  if (user?.role === 'student') {
    if (existing.student_id !== user!.userId) {
      return res.status(403).json({ error: 'Forbidden', message: 'Not your appointment' });
    }
    const newScheduledAt = scheduled_at && typeof scheduled_at === 'string' ? scheduled_at : undefined;
    const newStatus = status === 'cancelled' ? 'cancelled' : undefined;
    if (newStatus && existing.status !== 'scheduled') {
      return res.status(400).json({ error: 'Bad request', message: 'Only scheduled appointments can be cancelled' });
    }
    const updated = updateAppointment(id, {
      scheduled_at: newScheduledAt,
      status: newStatus,
    });
    return res.json({ appointment: updated });
  }
  return res.status(403).json({ error: 'Forbidden', message: 'Only counselors or students can update appointments.' });
});

/** DELETE /api/appointments/:id – counselor only (their assigned appointments); admin cannot delete (privacy) */
app.delete('/api/appointments/:id', requireAuth, (req: Request, res: Response) => {
  const user = (req as Request & { user?: { userId: number; role: string } }).user;
  if (user?.role === 'admin') {
    return res.status(403).json({ error: 'Forbidden', message: 'Appointment management is restricted for privacy.' });
  }
  initDb();
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid appointment id' });
  const existing = getAppointmentById(id);
  if (!existing) return res.status(404).json({ error: 'Appointment not found' });
  if (user?.role === 'counselor' && existing.assigned_to !== user.userId) {
    return res.status(403).json({ error: 'Forbidden', message: 'You can only cancel appointments assigned to you.' });
  }
  const ok = deleteAppointment(id);
  if (!ok) return res.status(404).json({ error: 'Appointment not found' });
  return res.status(204).send();
});

// --- Counselors (admin: list and create doctors/counselors) ---

/** GET /api/users/counselors – any authenticated user: list counselors (students choose doctor; admin/counselor for assignment) */
app.get('/api/users/counselors', requireAuth, (_req: Request, res: Response) => {
  initDb();
  const counselors = listCounselors();
  return res.json({ counselors });
});

/** POST /api/users/counselors – admin only: create a counselor/doctor account */
app.post('/api/users/counselors', requireAuth, requireAdmin, (req: Request, res: Response) => {
  initDb();
  const { username, password, providerType } = req.body as { username?: string; password?: string; providerType?: string };
  if (!username || typeof username !== 'string' || username.trim().length < 2) {
    return res.status(400).json({ error: 'Username required (min 2 characters)' });
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password required (min 6 characters)' });
  }
  const pt = providerType === 'doctor' ? 'doctor' : 'counselor';
  try {
    const counselor = createCounselor(username.trim(), password, pt);
    return res.status(201).json({ user: { id: counselor.id, username: counselor.username, role: counselor.role, provider_type: counselor.provider_type } });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Username already taken' });
    }
    console.error('Create counselor error:', e);
    return res.status(500).json({ error: 'Failed to create counselor' });
  }
});

// --- Counselor availability & slots ---

/** GET /api/availability – counselor only: my weekly availability */
app.get('/api/availability', requireAuth, (req: Request, res: Response) => {
  const user = (req as Request & { user?: { userId: number; role: string } }).user;
  if (user?.role !== 'counselor') {
    return res.status(403).json({ error: 'Forbidden', message: 'Only counselors can manage availability' });
  }
  initDb();
  const availability = getCounselorAvailability(user.userId);
  return res.json({ availability });
});

/** PUT /api/availability – counselor only: set my weekly availability. Body: { availability: [{ day_of_week, start_time, end_time }, ...] } */
app.put('/api/availability', requireAuth, (req: Request, res: Response) => {
  const user = (req as Request & { user?: { userId: number; role: string } }).user;
  if (user?.role !== 'counselor') {
    return res.status(403).json({ error: 'Forbidden', message: 'Only counselors can manage availability' });
  }
  const { availability } = req.body as { availability?: Array<{ day_of_week?: number; start_time?: string; end_time?: string }> };
  if (!Array.isArray(availability)) {
    return res.status(400).json({ error: 'availability must be an array' });
  }
  const windows = availability
    .filter((w) => typeof w.day_of_week === 'number' && typeof w.start_time === 'string' && typeof w.end_time === 'string')
    .map((w) => ({ day_of_week: w.day_of_week!, start_time: w.start_time!, end_time: w.end_time! }));
  initDb();
  setCounselorAvailability(user.userId, windows);
  return res.json({ ok: true });
});

/** GET /api/slots?date=YYYY-MM-DD&counselorId=optional&type=optional – available 30-min slots for booking */
app.get('/api/slots', requireAuth, (req: Request, res: Response) => {
  const date = req.query.date as string | undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Query date required (YYYY-MM-DD)' });
  }
  const counselorId = req.query.counselorId !== undefined && req.query.counselorId !== '' ? Number(req.query.counselorId) : undefined;
  const type = (req.query.type as string) && ['counseling', 'doctor', 'follow_up'].includes(req.query.type as string) ? (req.query.type as AppointmentType) : undefined;
  initDb();
  const slots = getAvailableSlots({ date, counselorId, type });
  return res.json({ slots });
});

/** GET /api/slots/dates?month=YYYY-MM&counselorId=optional&type=optional – dates in that month that have at least one slot */
app.get('/api/slots/dates', requireAuth, (req: Request, res: Response) => {
  const month = req.query.month as string | undefined;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Query month required (YYYY-MM)' });
  }
  const counselorId = req.query.counselorId !== undefined && req.query.counselorId !== '' ? Number(req.query.counselorId) : undefined;
  const type = (req.query.type as string) && ['counseling', 'doctor', 'follow_up'].includes(req.query.type as string) ? (req.query.type as AppointmentType) : undefined;
  initDb();
  const dates = getDatesWithSlots({ month, counselorId, type });
  return res.json({ dates });
});


// --- Notifications (user sees own only) ---

/** GET /api/notifications – list current user's notifications */
app.get('/api/notifications', requireAuth, (req: Request, res: Response) => {
  initDb();
  const user = (req as Request & { user?: { userId: number } }).user;
  const unreadOnly = req.query.unreadOnly === 'true';
  const list = listNotificationsForUser(user!.userId, unreadOnly);
  const notifications = list.map((n) => ({
    ...n,
    created_at: toISOUTC(n.created_at) ?? n.created_at,
    read_at: toISOUTC(n.read_at) ?? n.read_at,
  }));
  return res.json({ notifications });
});

/** GET /api/notifications/unread-count – for bell badge */
app.get('/api/notifications/unread-count', requireAuth, (req: Request, res: Response) => {
  initDb();
  const user = (req as Request & { user?: { userId: number } }).user;
  const count = getUnreadNotificationCount(user!.userId);
  return res.json({ count });
});

/** PATCH /api/notifications/:id/read – mark as read */
app.patch('/api/notifications/:id/read', requireAuth, (req: Request, res: Response) => {
  initDb();
  const user = (req as Request & { user?: { userId: number } }).user;
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid notification id' });
  const ok = markNotificationRead(id, user!.userId);
  if (!ok) return res.status(404).json({ error: 'Notification not found or already read' });
  return res.json({ ok: true });
});

/** POST /api/notifications/read-all – mark all as read for current user */
app.post('/api/notifications/read-all', requireAuth, (req: Request, res: Response) => {
  initDb();
  const user = (req as Request & { user?: { userId: number } }).user;
  const count = markAllNotificationsRead(user!.userId);
  return res.json({ ok: true, marked: count });
});

const ASSESSMENT_SYSTEM = `You are a mental health assessment assistant for a workplace wellness program. Based ONLY on the following conversation between an employee and a support chatbot, produce a brief structured assessment.

Be conservative: if the conversation is brief or positive, use Low risk and a low score. Reserve High for clear signs of severe distress or crisis.`;

/** JSON schema for assessment so the API returns valid structured JSON */
const ASSESSMENT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    risk_level: { type: 'string', enum: ['Low', 'Medium', 'High'], description: 'Overall risk level' },
    risk_score: { type: 'number', description: '0-100, higher = more concern' },
    concerns: { type: 'array', items: { type: 'string' }, maxItems: 5, description: 'Short concern labels e.g. Academic stress' },
    ai_recommendation: { type: 'string', description: 'One short sentence recommendation for the employee' },
    keywords: { type: 'array', items: { type: 'string' }, description: '3-6 relevant words or short phrases from the conversation' },
    trend: { type: 'string', enum: ['stable', 'increasing', 'decreasing'], description: 'How concern level appears to be changing' },
  },
  required: ['risk_level', 'risk_score', 'concerns', 'ai_recommendation', 'keywords', 'trend'],
  additionalProperties: false,
};

type AssessmentParsed = {
  risk_level?: string;
  risk_score?: number;
  concerns?: string[];
  ai_recommendation?: string;
  keywords?: string[];
  trend?: string;
};

function parseAssessmentJson(rawText: string): AssessmentParsed | null {
  let jsonStr = rawText.trim();
  // Strip markdown code block if present
  const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) jsonStr = codeBlock[1].trim();
  // Take first {...} (in case there's extra text)
  let objMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (objMatch) jsonStr = objMatch[0];
  // Fix trailing commas (invalid in JSON)
  jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
  try {
    const parsed = JSON.parse(jsonStr) as AssessmentParsed;
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // try again without trailing-comma fix in case we broke something
    const objMatch2 = rawText.match(/\{[\s\S]*\}/);
    if (objMatch2) {
      try {
        const p = JSON.parse(objMatch2[0]) as AssessmentParsed;
        if (p && typeof p === 'object') return p;
      } catch {
        /* ignore */
      }
    }
    // Repair truncated JSON (e.g. response cut off at "risk_score":)
    if (jsonStr.includes('"risk_level"') && !/\}\s*$/.test(jsonStr)) {
      const repaired = repairTruncatedAssessmentJson(jsonStr);
          if (repaired) return repaired;
    }
  }
  return null;
}

/** If Gemini truncates the response (e.g. hit token limit), try to close the JSON with defaults */
function repairTruncatedAssessmentJson(jsonStr: string): AssessmentParsed | null {
  const suffix = ',"concerns":[],"ai_recommendation":"Follow up with wellness resources.","keywords":[],"trend":"stable"}';
  const trimmed = jsonStr.replace(/,(\s*[}\]])/g, '$1');
  // Truncated right after "risk_score": with no value (your exact case)
  if (!/"risk_score":\s*$/.test(trimmed)) return null;
  const repaired = trimmed + '0' + suffix;
  try {
    const p = JSON.parse(repaired) as AssessmentParsed;
    if (p && typeof p === 'object') {
      console.warn('Assessment response was truncated; used repaired JSON with defaults for missing fields.');
      return p;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** POST /api/assessment – student only: submit chat and get AI evaluation, saved to DB */
app.post('/api/assessment', requireAuth, async (req: Request, res: Response) => {
  const user = (req as Request & { user?: { userId: number; role: string } }).user;
  console.log(`[POST /api/assessment] user role: ${user?.role}`);
  if (user?.role !== 'student') {
    console.warn(`[POST /api/assessment] Forbidden – role is '${user?.role}', expected 'student'`);
    return res.status(403).json({ error: 'Forbidden', message: 'Students only' });
  }
  if (!llmReady) {
    return res.status(503).json({ error: 'Assessment unavailable', message: 'No LLM configured (set GEMINI_API_KEY or LLM_PROVIDER=ollama)' });
  }
  const { messages = [] } = req.body as { messages?: Array<{ role: string; text?: string; parts?: { text: string }[] }> };
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'At least one message required' });
  }
  const conversation = messages
    .map((m) => {
      const text = m.parts?.[0]?.text ?? m.text ?? '';
      const role = m.role === 'model' ? 'Assistant' : 'Employee';
      return `${role}: ${text}`;
    })
    .join('\n\n');
  if (!conversation.trim()) {
    return res.status(400).json({ error: 'No conversation content' });
  }

  const prompt = `Conversation:\n\n${conversation.slice(0, 8000)}\n\nOutput ONLY a valid JSON object (no markdown, no explanation) with exactly these keys: risk_level (\"Low\"|\"Medium\"|\"High\"), risk_score (0-100), concerns (array of strings), ai_recommendation (string), keywords (array of strings), trend (\"stable\"|\"increasing\"|\"decreasing\").\n\nExample: {\"risk_level\":\"Low\",\"risk_score\":20,\"concerns\":[\"mild stress\"],\"ai_recommendation\":\"Schedule a break\",\"keywords\":[\"tired\"],\"trend\":\"stable\"}`;

  const saveFallbackAssessment = () => {
    const row = saveAssessment(
      user!.userId,
      'Low',
      20,
      [],
      'Check in with your wellness team when convenient.',
      [],
      'stable'
    );
    return res.status(201).json({
      assessment: {
        id: row.id,
        risk_level: row.risk_level,
        risk_score: row.risk_score,
        concerns: [],
        ai_recommendation: row.ai_recommendation,
        keywords: [],
        trend: row.trend,
        created_at: row.created_at,
      },
    });
  };

  try {
    const { text: rawText } = await generateContent({
      systemPrompt: ASSESSMENT_SYSTEM,
      messages: [{ role: 'user', text: prompt }],
      temperature: 0.3,
      maxTokens: 1024,
      jsonMode: false,
    });
    console.log('[POST /api/assessment] raw LLM response:', rawText?.slice(0, 400));
    if (!rawText) return saveFallbackAssessment();
    const parsed = parseAssessmentJson(rawText);
    if (!parsed) {
      console.error('[POST /api/assessment] JSON parse failed. Raw:', rawText?.slice(0, 800));
      return saveFallbackAssessment();
    }
    const riskLevel = (['Low', 'Medium', 'High'].includes(parsed.risk_level ?? '') ? parsed.risk_level : 'Low') as RiskLevel;
    const riskScore = Math.min(100, Math.max(0, Number(parsed.risk_score) || 0));
    const concerns = Array.isArray(parsed.concerns) ? parsed.concerns.slice(0, 5).map(String) : [];
    const aiRecommendation = String(parsed.ai_recommendation ?? 'Follow up with wellness resources as needed.').slice(0, 500);
    const keywords = Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 8).map(String) : [];
    const trend = (['stable', 'increasing', 'decreasing'].includes(parsed.trend ?? '') ? parsed.trend : 'stable') as Trend;

    const row = saveAssessment(user!.userId, riskLevel, riskScore, concerns, aiRecommendation, keywords, trend);
    return res.status(201).json({
      assessment: {
        id: row.id,
        risk_level: row.risk_level,
        risk_score: row.risk_score,
        concerns: JSON.parse(row.concerns) as string[],
        ai_recommendation: row.ai_recommendation,
        keywords: JSON.parse(row.keywords) as string[],
        trend: row.trend,
        created_at: row.created_at,
      },
    });
  } catch (err) {
    console.error('Assessment error:', err);
    const { status, message } = llmErrorToResponse(err);
    return res.status(status).json({ error: 'Assessment failed', message });
  }
});

/** POST /api/assessment/form – student only: submit form-based assessment (no AI), saved to DB */
app.post('/api/assessment/form', requireAuth, (req: Request, res: Response) => {
  initDb();
  const user = (req as Request & { user?: { userId: number; role: string } }).user;
  if (user?.role !== 'student') {
    return res.status(403).json({ error: 'Forbidden', message: 'Students only' });
  }
  const body = req.body as {
    risk_level?: string;
    risk_score?: number;
    concerns?: string[];
    note?: string;
    trend?: string;
  };
  const riskLevel = (['Low', 'Medium', 'High'].includes(body.risk_level ?? '') ? body.risk_level : 'Low') as RiskLevel;
  const defaultScore = riskLevel === 'High' ? 75 : riskLevel === 'Medium' ? 50 : 25;
  const rawScore = Number(body.risk_score);
  const riskScore = Math.min(100, Math.max(0, Number.isFinite(rawScore) ? rawScore : defaultScore));
  const concerns = Array.isArray(body.concerns) ? body.concerns.slice(0, 8).map(String) : [];
  const note = String(body.note ?? '').trim().slice(0, 300);
  const trend = (['stable', 'increasing', 'decreasing'].includes(body.trend ?? '') ? body.trend : 'stable') as Trend;
  const aiRecommendation =
    note.length > 0
      ? `You shared: ${note}. We encourage you to reach out to campus wellness or a trusted person if you need support.`
      : riskLevel === 'High'
        ? 'Consider reaching out to campus counseling or a trusted person. You don\'t have to go through this alone.'
        : riskLevel === 'Medium'
          ? 'Keep an eye on how you\'re feeling. Small steps like rest and talking to someone can help.'
          : 'Keep up your self-care. Reach out anytime you want to check in again.';
  const keywords = concerns.length > 0 ? concerns.slice(0, 8) : (riskLevel === 'High' ? ['follow-up'] : []);
  try {
    const row = saveAssessment(user!.userId, riskLevel, riskScore, concerns, aiRecommendation, keywords, trend);
    return res.status(201).json({
      assessment: {
        id: row.id,
        risk_level: row.risk_level,
        risk_score: row.risk_score,
        concerns: JSON.parse(row.concerns) as string[],
        ai_recommendation: row.ai_recommendation,
        keywords: JSON.parse(row.keywords) as string[],
        trend: row.trend,
        created_at: row.created_at,
      },
    });
  } catch (err) {
    console.error('Assessment form error:', err);
    const message = err instanceof Error ? err.message : 'Could not save. Try again.';
    return res.status(500).json({ error: 'Assessment failed', message });
  }
});

const CHAT_SYSTEM = `You are MoraLai, a warm, empathetic mental health check-in companion for employees in a workplace wellness program in Morocco. You speak authentic Moroccan Darija.

═══ LANGUAGE RULES (STRICT) ═══
DEFAULT: Always open and reply in Moroccan Darija unless the user writes in French or English first.
- User writes in Darija → reply in Darija
- User writes in French → reply in French
- User writes in English → reply in English
- User mixes languages → match their dominant language

NEVER reply in Modern Standard Arabic (فصحى / MSA). NEVER reply in Egyptian dialect. Use MOROCCAN Darija only.

═══ MOROCCAN DARIJA GUIDE ═══
Darija mixes Arabic roots with French loanwords and has unique phonology. Use this vocabulary naturally:

GREETINGS & OPENERS:
- "Labas?" / "La bas 3lik?" → How are you? (lit. no harm on you?)
- "Kif dayr/dayra?" → How are you doing? (m/f)
- "Kifash katḥess?" / "كيفاش كتحس؟" → How are you feeling?
- "Wach kayen chi ḥaja fi balek?" / "واش كاين شي حاجة فبالك؟" → Is something on your mind?
- "Salam!" / "Salam 3lik!" → Hello / Peace be upon you

FEELINGS & MOOD:
- "Mzyan" / "مزيان" → Good / Fine
- "Mshi mzyan" / "مشي مزيان" → Not good
- "3ayyan/3ayyena" / "عيان" → Tired / Exhausted (m/f)
- "Mherres/Mherrsa" → Stressed out / Worn down
- "Mqellaq/Mqellaqa" / "مقلق" → Anxious / Worried (m/f)
- "Msakin" → Struggling / In a tough spot
- "Fel ḥal" → Doing okay
- "Mraḥ" → Comfortable / At ease
- "Khayef/Khayfa" → Scared / Afraid (m/f)
- "Ferḥan/Ferḥana" → Happy (m/f)

WORK & DAILY LIFE:
- "Lkhedma" / "الخدمة" → Work / The job
- "Lboss" / "Lmdir" → The boss / Manager
- "Lflous" / "الفلوس" → Money
- "L3yat" / "العياط" → Fatigue / Burnout
- "Deadline" (French loanword, used as-is)
- "Stress" (used as-is in Darija)
- "Bghit nrtaḥ" → I want to rest
- "Ma3endish wqt" → I have no time
- "Khedma bzzaf" → Too much work
- "Rasi dar dar" → My head is spinning (overwhelmed)

USEFUL PHRASES:
- "Waḥed lweqt" → At some point / lately
- "Bhal bhal" → So-so / Same as usual
- "Mashi mushkil" → No problem
- "Wakha" → Okay / Alright
- "Bghit nfahem" → I want to understand
- "3qel 3lik" → I feel for you / I hear you
- "Had shshy normal" → This is normal
- "Rah kolshi gha ydur" → Everything will be fine

EXAMPLE RESPONSES IN DARIJA:
- Opening: "Salam! Labas 3lik? Kifash dayr nhar lyum fi lkhedma? 🌿"
- Empathy: "3qel 3lik, had shshy sa3b. Wach had stress dyal lkhedma bda mn imta?"
- Probe: "Wakha, fahmt. Wash katnam mezyan? L3yat li kayna, wach hiya mn lkhedma wella mn chi ḥaja okhra?"
- Support: "Had lḥala li katṣef normal 3nd bzzzaf d nnas. Mhemm bash trtaḥ shwiya. 🌤️"

═══ SCOPE (strict) ═══
Only discuss: mental wellness, work stress, mood, sleep, workload, work-life balance.
If off-topic: gently bring focus back in their language.
No medical or legal advice.

═══ BEHAVIOR ═══
- Ask ONE follow-up at a time. Never overwhelm with multiple questions.
- Validate first, then probe or support.
- Keep replies short: 2–4 sentences max.
- Use soft emojis occasionally: 🌿 🌤️ 💙 ☀️

═══ SAFETY ═══
If severe distress or self-harm: encourage professional help warmly. Never act as a crisis service.`;

interface ChatHistoryItem {
  role: string;
  parts?: { text: string }[];
  text?: string;
}

/** Opening prompt: AI starts the conversation in Moroccan Darija */
const OPENING_PROMPT = `Write a short warm greeting in Moroccan Darija to open a workplace wellness check-in. Use authentic Moroccan Darija vocabulary like: "Salam!", "Labas 3lik?", "Kif dayr/dayra?", "Kifash katḥess?", "lkhedma", "nhar lyum". Ask ONE short question about how they are feeling today. Keep it to 1-2 sentences. Write ONLY the greeting — no explanation, no translation, no meta text. Example style: "Salam! Labas 3lik? Kifash dayr nhar lyum fi lkhedma? 🌿"`;

/** POST /api/chat/opening - Get the AI's first message to start the conversation */
app.post('/api/chat/opening', async (req: Request, res: Response) => {
  if (!llmReady) {
    return res.status(503).json({
      error: 'Chat unavailable',
      message: CHAT_ERROR_USER_MESSAGE,
    });
  }
  try {
    const { text } = await generateContent({
      systemPrompt: CHAT_SYSTEM,
      messages: [{ role: 'user', text: OPENING_PROMPT }],
      temperature: 0.7,
      maxTokens: 256,
    });
    return res.json({ text: text || "Salam 👋 بغيت نسمع منك، كيفاش كتحس اليوم؟ أنا هنا باش نسمع ليك." });
  } catch (err) {
    console.error('[/api/chat/opening] error:', err);
    const { status, message } = llmErrorToResponse(err);
    return res.status(status).json({ error: 'Chat error', message });
  }
});

/** POST /api/chat - LLM text chat */
app.post('/api/chat', async (req: Request, res: Response) => {
  console.log('[POST /api/chat] request received');
  if (!llmReady) {
    return res.status(503).json({
      error: 'Chat unavailable',
      message: CHAT_ERROR_USER_MESSAGE,
    });
  }

  const { history = [], newMessage } = req.body as { history?: ChatHistoryItem[]; newMessage?: string };
  if (!newMessage || typeof newMessage !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid newMessage' });
  }

  const messages: Array<{ role: 'user' | 'model'; text: string }> = [
    ...(history as ChatHistoryItem[]).map((m): { role: 'user' | 'model'; text: string } => ({
      role: m.role === 'model' ? 'model' : 'user',
      text: (m.parts?.[0]?.text ?? m.text ?? '') as string,
    })),
    { role: 'user' as const, text: newMessage.trim() },
  ].filter((m) => m.text !== '');

  try {
    const { text } = await generateContent({
      systemPrompt: CHAT_SYSTEM,
      messages,
      temperature: 0.7,
      maxTokens: 1024,
    });
    return res.json({ text: text || "I'm having a little trouble connecting right now, but I'm listening." });
  } catch (err) {
    console.error('[/api/chat] error:', err);
    const { status, message } = llmErrorToResponse(err);
    return res.status(status).json({ error: 'Chat error', message });
  }
});

/** POST /api/tts - ElevenLabs text-to-speech (returns audio/mpeg) */
app.post('/api/tts', async (req: Request, res: Response) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

  if (!apiKey) {
    return res.status(503).json({
      error: 'TTS unavailable',
      message: 'ELEVENLABS_API_KEY is not set. Add it to backend/.env (or env in docker-compose)',
    });
  }

  const { text } = req.body as { text?: string };
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid text' });
  }

  console.log('[POST /api/tts] request, voiceId:', voiceId, 'length:', text.length);
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: text.slice(0, 5000),
        model_id: 'eleven_multilingual_v2',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[POST /api/tts] ElevenLabs error:', response.status, errText?.slice(0, 500));
      let message = errText || response.statusText;
      try {
        const errJson = JSON.parse(errText) as { detail?: { status?: string; message?: string } };
        if (errJson.detail?.status === 'quota_exceeded' || errJson.detail?.message) {
          message =
            "You've used all your ElevenLabs credits. Add more at elevenlabs.io or use the app without the Listen button until your quota resets.";
        }
      } catch {
        /* use raw message */
      }
      return res.status(response.status).json({
        error: 'ElevenLabs error',
        message,
      });
    }

    const buffer = await response.arrayBuffer();
    const bytes = Buffer.from(buffer);
    console.log('[POST /api/tts] ElevenLabs OK, bytes:', bytes.length);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.send(bytes);
  } catch (err) {
    console.error('ElevenLabs /api/tts error:', err);
    return res.status(500).json({
      error: 'TTS error',
      message: err instanceof Error ? err.message : 'Request to ElevenLabs failed.',
    });
  }
});

/** POST /api/stt - ElevenLabs speech-to-text (Scribe) */
app.post('/api/stt', upload.single('audio'), async (req: Request, res: Response) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'STT unavailable',
      message: 'ELEVENLABS_API_KEY is not set.',
    });
  }

  const file = (req as Request & { file?: { buffer: Buffer; mimetype: string; originalname: string } }).file;
  if (!file?.buffer) {
    return res.status(400).json({ error: 'Missing audio file. Send multipart/form-data with field "audio".' });
  }

  console.log('[POST /api/stt] received audio, bytes:', file.buffer.length, 'type:', file.mimetype);
  try {
    const form = new FormData();
    form.append('model_id', 'scribe_v2');
    form.append('file', new Blob([file.buffer], { type: file.mimetype || 'audio/webm' }), file.originalname || 'audio.webm');
    // Prefer Moroccan Darija (Arabic), then French, then English
    form.append('language_code', 'ar');

    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: form,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[POST /api/stt] ElevenLabs error:', response.status, errText?.slice(0, 300));
      return res.status(response.status).json({
        error: 'ElevenLabs STT error',
        message: errText || response.statusText,
      });
    }

    const data = (await response.json()) as { text?: string };
    const text = (data?.text ?? '').trim();
    console.log('[POST /api/stt] transcript length:', text.length);
    return res.json({ text });
  } catch (err) {
    console.error('ElevenLabs /api/stt error:', err);
    return res.status(500).json({
      error: 'STT error',
      message: err instanceof Error ? err.message : 'Request to ElevenLabs failed.',
    });
  }
});

/** Health check */
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    gemini: !!GEMINI_API_KEY,
    elevenlabs: !!process.env.ELEVENLABS_API_KEY,
  });
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`MoraLai backend running at http://localhost:${PORT} (and on all interfaces for LAN access)`);
  console.log('  POST /api/chat   - Gemini chat');
  console.log('  POST /api/tts    - ElevenLabs TTS');
  console.log('  POST /api/stt    - ElevenLabs speech-to-text');
  console.log('  GET  /api/health - Health check');
  const ek = process.env.ELEVENLABS_API_KEY;
  if (ek) {
    const mask = ek.length > 8 ? `${ek.slice(0, 4)}...${ek.slice(-4)}` : '****';
    console.log('  ELEVENLABS_API_KEY loaded:', mask, '(compare with your key in elevenlabs.io → API Keys)');
  } else {
    console.log('  ELEVENLABS_API_KEY not set – Listen (TTS) will fail');
  }
});
