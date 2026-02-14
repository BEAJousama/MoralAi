/**
 * MoraLai – backend API (MiniMax chat + ElevenLabs TTS).
 * Uses VITE_API_BASE (e.g. http://localhost:4000) from .env.local.
 */

// When opened from another device (e.g. phone at http://192.168.x.x:3000), use that host for API.
function getApiBase(): string {
  if (typeof window !== 'undefined' && window.location?.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return `http://${window.location.hostname}:4000`;
  }
  return (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE !== undefined)
    ? (import.meta as any).env.VITE_API_BASE
    : 'http://localhost:4000';
}
const API_BASE = getApiBase();

export type ChatHistoryItem = { role: string; parts: { text: string }[] };

/** Get the AI's opening message to start the conversation (theme-based first question) */
export async function getChatOpening(): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/api/chat/opening`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.message || data?.error || res.statusText;
      throw new Error(msg || `Request failed (${res.status})`);
    }
    return data?.text ?? "Salam 👋 بغيت نسمع منك، كيفاش كتحس اليوم؟ أنا هنا باش نسمع ليك.";
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network or server error';
    throw new Error(message);
  }
}

export async function sendMessageToBackend(
  history: ChatHistoryItem[],
  newMessage: string
): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history, newMessage }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Don't expose backend/API details to users — throw so UI shows friendly message only
      throw new Error('CHAT_UNAVAILABLE');
    }
    return data?.text ?? "I'm having a little trouble connecting right now, but I'm listening.";
  } catch {
    throw new Error('CHAT_UNAVAILABLE');
  }
}

/** Get TTS audio URL for the given text (blob URL). Call revokeObjectURL when done. */
export async function getTtsAudioUrl(text: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data?.message || data?.error || res.statusText || 'TTS failed';
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  const blob = await res.blob();
  // Ensure blob has audio type (in case proxy strips Content-Type)
  const audioBlob = blob.type?.startsWith('audio/') ? blob : new Blob([await blob.arrayBuffer()], { type: 'audio/mpeg' });
  return URL.createObjectURL(audioBlob);
}

/** Speech-to-text: send recorded audio blob, get transcript (ElevenLabs Scribe). */
export async function sendAudioForStt(audioBlob: Blob): Promise<string> {
  const form = new FormData();
  form.append('audio', audioBlob, 'recording.webm');
  const res = await fetch(`${API_BASE}/api/stt`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || res.statusText || 'Speech recognition failed';
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return (data?.text ?? '').trim();
}

export async function healthCheck(): Promise<{ ok: boolean; gemini?: boolean; elevenlabs?: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, ...data };
  } catch {
    return { ok: false };
  }
}
