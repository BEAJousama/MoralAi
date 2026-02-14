import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.SQLITE_DB_PATH || path.resolve(__dirname, '..', '..', 'data', 'mindadapt.db');

export type UserRole = 'student' | 'admin' | 'counselor';

export interface User {
  id: number;
  username: string;
  password_hash: string;
  role: UserRole;
  created_at: string;
}

let db: Database.Database;

function ensureDirSync(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export type RiskLevel = 'Low' | 'Medium' | 'High';
export type Trend = 'increasing' | 'decreasing' | 'stable';

export interface AssessmentRow {
  id: number;
  user_id: number;
  risk_level: RiskLevel;
  risk_score: number;
  concerns: string;
  ai_recommendation: string;
  keywords: string;
  trend: Trend;
  created_at: string;
}

function initSchema() {
  ensureDirSync(path.dirname(DB_PATH));
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student','admin','counselor')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE TABLE IF NOT EXISTS assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      risk_level TEXT NOT NULL CHECK(risk_level IN ('Low','Medium','High')),
      risk_score INTEGER NOT NULL,
      concerns TEXT NOT NULL,
      ai_recommendation TEXT NOT NULL,
      keywords TEXT NOT NULL,
      trend TEXT NOT NULL CHECK(trend IN ('increasing','decreasing','stable')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_assessments_user_id ON assessments(user_id);
    CREATE INDEX IF NOT EXISTS idx_assessments_created_at ON assessments(created_at DESC);
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES users(id),
      assigned_to INTEGER REFERENCES users(id),
      scheduled_at TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'counseling' CHECK(type IN ('counseling','doctor','follow_up')),
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','completed','cancelled','no_show')),
      location TEXT,
      provider_or_notes TEXT,
      admin_notes TEXT,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_appointments_student_id ON appointments(student_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at ON appointments(scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      read_at TEXT,
      related_type TEXT,
      related_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);
    CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
    CREATE TABLE IF NOT EXISTS counselor_availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_counselor_availability_user_id ON counselor_availability(user_id);
  `);
  migrateSchema();
  seedAdminIfNeeded();
  seedCounselorIfNeeded();
}

/** Migrate existing DBs: add assigned_to to appointments if missing; allow counselor role in users. */
function migrateSchema() {
  const info = db.prepare("PRAGMA table_info(appointments)").all() as Array<{ name: string }>;
  const hasAssignedTo = info.some((c) => c.name === 'assigned_to');
  if (!hasAssignedTo) {
    db.exec('ALTER TABLE appointments ADD COLUMN assigned_to INTEGER REFERENCES users(id)');
    console.log('[db] Migration: added appointments.assigned_to');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_appointments_assigned_to ON appointments(assigned_to)');

  const apptInfo = db.prepare("PRAGMA table_info(appointments)").all() as Array<{ name: string }>;
  const hasCounselorReport = apptInfo.some((c) => c.name === 'counselor_report');
  if (!hasCounselorReport) {
    db.exec('ALTER TABLE appointments ADD COLUMN counselor_report TEXT');
    console.log('[db] Migration: added appointments.counselor_report');
  }

  const userInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get() as { sql: string } | undefined;
  if (userInfo?.sql && !userInfo.sql.includes("'counselor'")) {
    db.pragma('foreign_keys = OFF');
    try {
      const hasUsersNew = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='users_new'").get();
      const hasUsers = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='users'").get();

      if (hasUsersNew) {
        if (hasUsers) {
          db.exec('DROP TABLE users_new');
          console.log('[db] Migration: dropped leftover users_new, re-running counselor migration');
        } else {
          db.exec('ALTER TABLE users_new RENAME TO users');
          db.exec('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
          db.exec('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)');
          console.log('[db] Migration: completed rename users_new -> users (counselor role now allowed)');
          return;
        }
      }

      db.exec(`
        CREATE TABLE users_new (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('student','admin','counselor')), created_at TEXT NOT NULL DEFAULT (datetime('now')));
        INSERT INTO users_new SELECT id, username, password_hash, role, created_at FROM users;
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      `);
      console.log('[db] Migration: users table now allows role counselor');
    } finally {
      db.pragma('foreign_keys = ON');
    }
  }

  const userCols = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  if (!userCols.some((c) => c.name === 'provider_type')) {
    db.exec("ALTER TABLE users ADD COLUMN provider_type TEXT DEFAULT 'counselor'");
    console.log('[db] Migration: added users.provider_type (counselor|doctor)');
  }

  const hasAvail = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='counselor_availability'").get();
  if (!hasAvail) {
    db.exec(`
      CREATE TABLE counselor_availability (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6),
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL
      );
      CREATE INDEX idx_counselor_availability_user_id ON counselor_availability(user_id);
    `);
    console.log('[db] Migration: added counselor_availability table');
  }
}

export type AppointmentType = 'counseling' | 'doctor' | 'follow_up';
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';

export interface AppointmentRow {
  id: number;
  student_id: number;
  assigned_to: number | null;
  scheduled_at: string;
  type: AppointmentType;
  status: AppointmentStatus;
  location: string | null;
  provider_or_notes: string | null;
  admin_notes: string | null;
  counselor_report: string | null;
  created_by: number;
  created_at: string;
  updated_at: string | null;
}

export interface NotificationRow {
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

function seedAdminIfNeeded() {
  const row = db.prepare("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").get();
  if (!row) {
    const hash = bcrypt.hashSync('password', 10);
    db.prepare("INSERT INTO users (username, password_hash, role) VALUES ('admin', ?, 'admin')").run(hash);
    console.log('[db] Seeded default admin (username: admin, password: password)');
  }
}

function seedCounselorIfNeeded() {
  const row = db.prepare("SELECT 1 FROM users WHERE role = 'counselor' LIMIT 1").get();
  if (!row) {
    const hash = bcrypt.hashSync('password', 10);
    db.prepare("INSERT INTO users (username, password_hash, role) VALUES ('counselor', ?, 'counselor')").run(hash);
    console.log('[db] Seeded default counselor (username: counselor, password: password)');
  }
}

export function initDb(): Database.Database {
  if (db) return db;
  ensureDirSync(path.dirname(DB_PATH));
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  initSchema();
  return db;
}

export function createStudent(username: string, password: string): { id: number; username: string; role: string } {
  const database = initDb();
  const hash = bcrypt.hashSync(password, 10);
  const result = database.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username.trim(), hash, 'student');
  const row = database.prepare('SELECT id, username, role FROM users WHERE id = ?').get(result.lastInsertRowid) as { id: number; username: string; role: string };
  return row;
}

export function findUserByUsername(username: string): User | undefined {
  const database = initDb();
  return database.prepare('SELECT * FROM users WHERE username = ?').get(username.trim()) as User | undefined;
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function listStudents(): Array<{ id: number; username: string; created_at: string }> {
  const database = initDb();
  const rows = database.prepare("SELECT id, username, created_at FROM users WHERE role = 'student' ORDER BY created_at DESC").all() as Array<{ id: number; username: string; created_at: string }>;
  return rows;
}

export function saveAssessment(
  userId: number,
  riskLevel: RiskLevel,
  riskScore: number,
  concerns: string[],
  aiRecommendation: string,
  keywords: string[],
  trend: Trend
): AssessmentRow {
  const database = initDb();
  const concernsJson = JSON.stringify(concerns);
  const keywordsJson = JSON.stringify(keywords);
  database
    .prepare(
      `INSERT INTO assessments (user_id, risk_level, risk_score, concerns, ai_recommendation, keywords, trend)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(userId, riskLevel, riskScore, concernsJson, aiRecommendation, keywordsJson, trend);
  const row = database.prepare('SELECT * FROM assessments WHERE id = last_insert_rowid()').get() as AssessmentRow;
  return row;
}

export function listStudentsWithLatestAssessment(): Array<{
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
}> {
  const database = initDb();
  const students = database
    .prepare("SELECT id, username, created_at FROM users WHERE role = 'student' ORDER BY created_at DESC")
    .all() as Array<{ id: number; username: string; created_at: string }>;
  const result = students.map((s) => {
    const latest = database
      .prepare(
        'SELECT risk_level, risk_score, concerns, ai_recommendation, keywords, trend, created_at FROM assessments WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
      )
      .get(s.id) as
      | {
          risk_level: RiskLevel;
          risk_score: number;
          concerns: string;
          ai_recommendation: string;
          keywords: string;
          trend: Trend;
          created_at: string;
        }
      | undefined;
    if (!latest) {
      return {
        ...s,
        risk_level: null,
        risk_score: null,
        concerns: [],
        ai_recommendation: null,
        keywords: [],
        trend: null,
        assessed_at: null,
      };
    }
    return {
      ...s,
      risk_level: latest.risk_level,
      risk_score: latest.risk_score,
      concerns: JSON.parse(latest.concerns) as string[],
      ai_recommendation: latest.ai_recommendation,
      keywords: JSON.parse(latest.keywords) as string[],
      trend: latest.trend,
      assessed_at: latest.created_at,
    };
  });
  return result;
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

/** Get counts by latest assessment risk level (students with at least one assessment). */
export function getDashboardStats(): DashboardStats {
  const database = initDb();

  // Latest assessment per student: use a subquery to get latest assessment per user_id, then count by risk_level
  const riskCounts = database
    .prepare(
      `
    SELECT a.risk_level, COUNT(*) AS cnt
    FROM assessments a
    INNER JOIN (
      SELECT user_id, MAX(created_at) AS max_at
      FROM assessments
      GROUP BY user_id
    ) latest ON a.user_id = latest.user_id AND a.created_at = latest.max_at
    GROUP BY a.risk_level
  `
    )
    .all() as Array<{ risk_level: RiskLevel; cnt: number }>;

  const lowRisk = riskCounts.find((r) => r.risk_level === 'Low')?.cnt ?? 0;
  const mediumRisk = riskCounts.find((r) => r.risk_level === 'Medium')?.cnt ?? 0;
  const highRisk = riskCounts.find((r) => r.risk_level === 'High')?.cnt ?? 0;
  const totalActive = lowRisk + mediumRisk + highRisk;

  // Assessments in last 7 days vs previous 7 days (for "this week" change)
  const thisWeek = database
    .prepare(
      `SELECT COUNT(*) AS cnt FROM assessments WHERE created_at >= datetime('now', '-7 days')`
    )
    .get() as { cnt: number };
  const lastWeek = database
    .prepare(
      `SELECT COUNT(*) AS cnt FROM assessments WHERE created_at >= datetime('now', '-14 days') AND created_at < datetime('now', '-7 days')`
    )
    .get() as { cnt: number };

  // Urgent: students whose latest assessment is High and that assessment is in last 48 hours
  const urgentCount = database
    .prepare(
      `
    SELECT COUNT(DISTINCT a.user_id) AS cnt
    FROM assessments a
    INNER JOIN (
      SELECT user_id, MAX(created_at) AS max_at
      FROM assessments
      GROUP BY user_id
    ) latest ON a.user_id = latest.user_id AND a.created_at = latest.max_at
    WHERE a.risk_level = 'High' AND a.created_at >= datetime('now', '-48 hours')
  `
    )
    .get() as { cnt: number };

  const trend = getTrendData(database, 7);
  const recentActivity = getRecentActivity(database, 5);

  return {
    lowRisk,
    mediumRisk,
    highRisk,
    totalActive,
    thisWeekCount: thisWeek.cnt,
    lastWeekCount: lastWeek.cnt,
    urgentCount: urgentCount.cnt,
    trend,
    recentActivity,
  };
}

/** Last N days: assessments per day and average risk score. */
function getTrendData(database: Database.Database, days: number): Array<{ day: string; count: number; avgScore: number }> {
  const rows = database
    .prepare(
      `
    SELECT date(created_at) AS d, COUNT(*) AS cnt, AVG(risk_score) AS avg_score
    FROM assessments
    WHERE created_at >= date('now', ?)
    GROUP BY date(created_at)
    ORDER BY d ASC
  `
    )
    .all(`-${days} days`) as Array<{ d: string; cnt: number; avg_score: number }>;

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const byDate: Record<string, { count: number; avgScore: number }> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const key = d.toISOString().slice(0, 10);
    byDate[key] = { count: 0, avgScore: 0 };
  }
  for (const r of rows) {
    if (byDate[r.d] !== undefined) byDate[r.d] = { count: r.cnt, avgScore: Math.round(Number(r.avg_score)) || 0 };
  }
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { count, avgScore }]) => {
      const dayName = dayLabels[new Date(date + 'T12:00:00').getDay()];
      return { day: dayName, count, avgScore };
    });
}

/** Last N assessments with username and risk for "Recent activity". */
function getRecentActivity(database: Database.Database, limit: number): Array<{ username: string; risk_level: RiskLevel; assessed_at: string }> {
  const rows = database
    .prepare(
      `
    SELECT u.username, a.risk_level, a.created_at AS assessed_at
    FROM assessments a
    JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC
    LIMIT ?
  `
    )
    .all(limit) as Array<{ username: string; risk_level: RiskLevel; assessed_at: string }>;
  return rows;
}

// --- Appointments ---

export function createAppointment(
  studentId: number,
  scheduledAt: string,
  adminUserId: number,
  opts: { type?: AppointmentType; location?: string; providerOrNotes?: string; adminNotes?: string; assignedTo?: number } = {}
): AppointmentRow {
  const database = initDb();
  const type = opts.type ?? 'counseling';
  const stmt = database.prepare(
    `INSERT INTO appointments (student_id, assigned_to, scheduled_at, type, status, location, provider_or_notes, admin_notes, created_by)
     VALUES (?, ?, ?, ?, 'scheduled', ?, ?, ?, ?)`
  );
  stmt.run(
    studentId,
    opts.assignedTo ?? null,
    scheduledAt,
    type,
    opts.location ?? null,
    opts.providerOrNotes ?? null,
    opts.adminNotes ?? null,
    adminUserId
  );
  const row = database.prepare('SELECT * FROM appointments WHERE id = last_insert_rowid()').get() as AppointmentRow;
  return row;
}

export function listAppointments(filters: {
  studentId?: number;
  assignedTo?: number;
  assignedToMeOrUnassigned?: number;
  status?: AppointmentStatus;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}): Array<AppointmentRow & { student_username: string; assigned_to_username?: string | null }> {
  const database = initDb();
  let sql = `
    SELECT a.*, u.username AS student_username,
           (SELECT username FROM users WHERE id = a.assigned_to) AS assigned_to_username
    FROM appointments a
    JOIN users u ON u.id = a.student_id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];
  if (filters.studentId != null) {
    sql += ' AND a.student_id = ?';
    params.push(filters.studentId);
  }
  if (filters.assignedTo != null) {
    sql += ' AND a.assigned_to = ?';
    params.push(filters.assignedTo);
  }
  if (filters.assignedToMeOrUnassigned != null) {
    sql += ' AND (a.assigned_to = ? OR a.assigned_to IS NULL)';
    params.push(filters.assignedToMeOrUnassigned);
  }
  if (filters.status != null) {
    sql += ' AND a.status = ?';
    params.push(filters.status);
  }
  if (filters.fromDate != null) {
    sql += ' AND a.scheduled_at >= ?';
    params.push(filters.fromDate);
  }
  if (filters.toDate != null) {
    sql += ' AND a.scheduled_at <= ?';
    params.push(filters.toDate);
  }
  sql += ' ORDER BY a.scheduled_at ASC';
  const limit = filters.limit ?? 200;
  sql += ' LIMIT ?';
  params.push(limit);
  const rows = database.prepare(sql).all(...params) as Array<AppointmentRow & { student_username: string; assigned_to_username?: string | null }>;
  return rows;
}

export function getAppointmentById(id: number): (AppointmentRow & { student_username: string; assigned_to_username?: string | null }) | undefined {
  const database = initDb();
  return database
    .prepare(
      `SELECT a.*, u.username AS student_username,
              (SELECT username FROM users WHERE id = a.assigned_to) AS assigned_to_username
       FROM appointments a JOIN users u ON u.id = a.student_id WHERE a.id = ?`
    )
    .get(id) as (AppointmentRow & { student_username: string; assigned_to_username?: string | null }) | undefined;
}

export function updateAppointment(
  id: number,
  updates: {
    status?: AppointmentStatus;
    scheduled_at?: string;
    location?: string;
    provider_or_notes?: string;
    admin_notes?: string;
    assigned_to?: number | null;
    counselor_report?: string | null;
  }
): AppointmentRow | undefined {
  const database = initDb();
  const existing = database.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as AppointmentRow | undefined;
  if (!existing) return undefined;
  const scheduled_at = updates.scheduled_at ?? existing.scheduled_at;
  const status = updates.status ?? existing.status;
  const location = updates.location !== undefined ? updates.location : existing.location;
  const provider_or_notes = updates.provider_or_notes !== undefined ? updates.provider_or_notes : existing.provider_or_notes;
  const admin_notes = updates.admin_notes !== undefined ? updates.admin_notes : existing.admin_notes;
  const assigned_to = updates.assigned_to !== undefined ? updates.assigned_to : existing.assigned_to;
  const counselor_report = updates.counselor_report !== undefined ? updates.counselor_report : (existing as AppointmentRow & { counselor_report?: string | null }).counselor_report ?? null;
  database
    .prepare(
      `UPDATE appointments SET scheduled_at = ?, status = ?, location = ?, provider_or_notes = ?, admin_notes = ?, assigned_to = ?, counselor_report = ?, updated_at = datetime('now') WHERE id = ?`
    )
    .run(scheduled_at, status, location, provider_or_notes, admin_notes, assigned_to, counselor_report, id);
  return database.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as AppointmentRow;
}

export function deleteAppointment(id: number): boolean {
  const database = initDb();
  const result = database.prepare('DELETE FROM appointments WHERE id = ?').run(id);
  return result.changes > 0;
}

export type ProviderType = 'counselor' | 'doctor';

export function listCounselors(): Array<{ id: number; username: string; created_at: string; provider_type: ProviderType }> {
  const database = initDb();
  const rows = database
    .prepare("SELECT id, username, created_at, COALESCE(provider_type, 'counselor') AS provider_type FROM users WHERE role = 'counselor' ORDER BY username ASC")
    .all() as Array<{ id: number; username: string; created_at: string; provider_type: string }>;
  return rows.map((r) => ({ ...r, provider_type: r.provider_type === 'doctor' ? 'doctor' : 'counselor' }));
}

/** Get all admin user IDs for sending notifications (e.g. appointment outcome). */
export function getAdminUserIds(): number[] {
  const database = initDb();
  const rows = database.prepare("SELECT id FROM users WHERE role = 'admin'").all() as Array<{ id: number }>;
  return rows.map((r) => r.id);
}

export function createCounselor(username: string, password: string, providerType: ProviderType = 'counselor'): { id: number; username: string; role: string; provider_type: ProviderType } {
  const database = initDb();
  const hash = bcrypt.hashSync(password, 10);
  const type = providerType === 'doctor' ? 'doctor' : 'counselor';
  const result = database.prepare('INSERT INTO users (username, password_hash, role, provider_type) VALUES (?, ?, ?, ?)').run(username.trim(), hash, 'counselor', type);
  const row = database.prepare('SELECT id, username, role, COALESCE(provider_type, \'counselor\') AS provider_type FROM users WHERE id = ?').get(result.lastInsertRowid) as { id: number; username: string; role: string; provider_type: string };
  return { ...row, provider_type: row.provider_type === 'doctor' ? 'doctor' : 'counselor' };
}

// --- Counselor availability & slots (30-min slots) ---

const SLOT_MINUTES = 30;

export interface AvailabilityWindow {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export function getCounselorAvailability(counselorId: number): AvailabilityWindow[] {
  const database = initDb();
  const rows = database
    .prepare('SELECT day_of_week, start_time, end_time FROM counselor_availability WHERE user_id = ? ORDER BY day_of_week, start_time')
    .all(counselorId) as AvailabilityWindow[];
  return rows;
}

export function setCounselorAvailability(counselorId: number, windows: AvailabilityWindow[]): void {
  const database = initDb();
  database.prepare('DELETE FROM counselor_availability WHERE user_id = ?').run(counselorId);
  const stmt = database.prepare('INSERT INTO counselor_availability (user_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)');
  for (const w of windows) {
    if (w.day_of_week >= 0 && w.day_of_week <= 6 && w.start_time && w.end_time) {
      stmt.run(counselorId, w.day_of_week, w.start_time, w.end_time);
    }
  }
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Generate 30-min slot start times between start_time and end_time (end exclusive). */
function slotTimesBetween(startTime: string, endTime: string): string[] {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  const out: string[] = [];
  for (let m = startMin; m + SLOT_MINUTES <= endMin; m += SLOT_MINUTES) {
    out.push(minutesToTime(m));
  }
  return out;
}

export interface SlotOption {
  start: string;
  end: string;
  counselor_id: number;
  counselor_username: string;
}

export function getAvailableSlots(opts: {
  date: string;
  counselorId?: number;
  type?: AppointmentType;
}): SlotOption[] {
  const database = initDb();
  const { date, counselorId, type } = opts;
  const dayOfWeek = new Date(date + 'T12:00:00').getDay();
  const dateStart = date + 'T00:00:00';
  const dateEnd = date + 'T23:59:59';

  const counselors: Array<{ id: number; username: string; provider_type: string }> = counselorId
    ? (database.prepare("SELECT id, username, COALESCE(provider_type, 'counselor') AS provider_type FROM users WHERE id = ? AND role = 'counselor'").all(counselorId) as Array<{ id: number; username: string; provider_type: string }>)
    : (database.prepare("SELECT id, username, COALESCE(provider_type, 'counselor') AS provider_type FROM users WHERE role = 'counselor'").all() as Array<{ id: number; username: string; provider_type: string }>);

  const filtered = type
    ? counselors.filter((c) => (type === 'doctor' ? c.provider_type === 'doctor' : type === 'counseling' ? c.provider_type !== 'doctor' : true))
    : counselors;

  const allSlots: SlotOption[] = [];

  for (const counselor of filtered) {
    const rows = database
      .prepare('SELECT start_time, end_time FROM counselor_availability WHERE user_id = ? AND day_of_week = ?')
      .all(counselor.id, dayOfWeek) as Array<{ start_time: string; end_time: string }>;

    const booked = database
      .prepare(
        `SELECT scheduled_at FROM appointments WHERE assigned_to = ? AND status = 'scheduled' AND scheduled_at >= ? AND scheduled_at <= ?`
      )
      .all(counselor.id, dateStart, dateEnd) as Array<{ scheduled_at: string }>;
    const bookedStarts = new Set(booked.map((a) => a.scheduled_at.slice(0, 16)));

    for (const row of rows) {
      const times = slotTimesBetween(row.start_time, row.end_time);
      for (const t of times) {
        const slotStart = date + 'T' + t + ':00';
        const slotKey = slotStart.slice(0, 16);
        if (bookedStarts.has(slotKey)) continue;
        allSlots.push({
          start: slotStart,
          end: date + 'T' + minutesToTime(timeToMinutes(t) + SLOT_MINUTES) + ':00',
          counselor_id: counselor.id,
          counselor_username: counselor.username,
        });
      }
    }
  }

  allSlots.sort((a, b) => a.start.localeCompare(b.start));
  return allSlots;
}

/** Return list of dates (YYYY-MM-DD) in the given month that have at least one available slot. */
export function getDatesWithSlots(opts: {
  month: string;
  counselorId?: number;
  type?: AppointmentType;
}): string[] {
  const { month, counselorId, type } = opts;
  const [y, m] = month.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return [];
  const lastDay = new Date(y, m, 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (getAvailableSlots({ date: dateStr, counselorId, type }).length > 0) {
      dates.push(dateStr);
    }
  }
  return dates;
}

// --- Notifications ---

export function createNotification(
  userId: number,
  type: string,
  title: string,
  body: string,
  relatedType?: string,
  relatedId?: number
): NotificationRow {
  const database = initDb();
  database
    .prepare(
      `INSERT INTO notifications (user_id, type, title, body, related_type, related_id) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(userId, type, title, body, relatedType ?? null, relatedId ?? null);
  return database.prepare('SELECT * FROM notifications WHERE id = last_insert_rowid()').get() as NotificationRow;
}

export function listNotificationsForUser(userId: number, unreadOnly?: boolean): NotificationRow[] {
  const database = initDb();
  let sql = 'SELECT * FROM notifications WHERE user_id = ?';
  const params: (number | boolean)[] = [userId];
  if (unreadOnly) {
    sql += ' AND read_at IS NULL';
  }
  sql += ' ORDER BY created_at DESC LIMIT 100';
  return database.prepare(sql).all(...params) as NotificationRow[];
}

export function markNotificationRead(id: number, userId: number): boolean {
  const database = initDb();
  const result = database.prepare('UPDATE notifications SET read_at = datetime(\'now\') WHERE id = ? AND user_id = ?').run(id, userId);
  return result.changes > 0;
}

export function getUnreadNotificationCount(userId: number): number {
  const database = initDb();
  const row = database.prepare('SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND read_at IS NULL').get(userId) as { cnt: number };
  return row.cnt;
}
