import { useSyncExternalStore } from 'react';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { BY_ID, PLACES } from './data';
import { hhmm, isoOf, PHOTO_RE } from './util';

/* Mêmes clés qu'avant : les données et comptes existants restent valables. */
export const KEY = 'carnet.visits';
const SUPABASE_URL = 'https://suwmxryihrilmvttjibs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8HkW8fCsnxZqQyM261d3Gg_hTM5zK_t';   // clé publique (publishable)

export interface Visit { date: string; note: string; photo: string | null; updatedAt?: number; demo?: boolean; local?: boolean }
export type Visits = Record<string, Visit>;

/* ----- abonnement React ----- */
let version = 0;
const subs = new Set<() => void>();
export const emit = () => { version++; subs.forEach(f => f()); };
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useStore = () => useSyncExternalStore(subscribe, () => version);

/* ----- stockage ----- */
const load = <T,>(k: string, d: T): T => { try { const r = localStorage.getItem(k); return r === null ? d : ((JSON.parse(r) as T) || d); } catch { return d; } };
export const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ } };

function seed(): Visits {
  let s = 42; const r = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const notes = ['Belle façade XVIIIe, guichet fermé le lundi.', 'Petit marché sur la place juste devant.',
    'Bâtiment en travaux, grue dans la cour.', 'Drapeau en berne ce jour-là.', "Escalier d'honneur magnifique.",
    'Fermée pour cause de pont. Revenir.', 'Un chat dormait sur le perron.', ''];
  const out: Visits = {}; let n = 0;
  const pool = PLACES.slice().sort(() => r() - .5);
  for (const p of pool) {
    if (n >= 47) break;
    const d = new Date(2025, 0, 1 + Math.floor(r() * 600));
    if (d > new Date()) continue;
    out[p.id] = { date: isoOf(d), note: notes[Math.floor(r() * notes.length)], photo: null, demo: true };
    n++;
  }
  return out;
}

let visits: Visits = (() => {
  try { const raw = localStorage.getItem(KEY); if (raw !== null) { const v = JSON.parse(raw); if (v && typeof v === 'object') return v as Visits; } } catch { /* ignore */ }
  return seed();
})();
export const getVisits = () => visits;
export const count = () => Object.keys(visits).length;
export const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(visits)); return true; } catch { return false; } };
export const isReal = (v?: Visit | null): v is Visit => !!v && !v.demo && !v.local;

let deleted = load<Record<string, number>>('carnet.deleted', {});
let dirty = load<Record<string, number>>('carnet.dirty', {});
let lastSync = load<string | null>('carnet.lastSync', null);
let lastOk = load<string | null>('carnet.lastOk', null);
const saveMeta = () => { save('carnet.deleted', deleted); save('carnet.dirty', dirty); };

export let sb: SupabaseClient | null = null;
export let session: Session | null = null;
export let syncStatus = '';
export const getLastOk = () => lastOk;
let syncing = false, syncAgain = false, syncTimer: ReturnType<typeof setTimeout> | undefined;
const setStatus = (t: string) => { syncStatus = t; emit(); };
export { setStatus };

/* ----- mutations ----- */
export function setVisits(next: Visits): boolean {
  const backup = visits; visits = next;
  if (!persist()) { visits = backup; return false; }
  emit(); return true;
}
export function reseed() { visits = seed(); persist(); emit(); }
export function clearAll() {
  Object.keys(visits).forEach(id => { if (isReal(visits[id])) track(id, true); });
  visits = {}; persist(); emit();
}
export type SaveResult = 'ok' | 'nophoto' | 'fail';
export function saveVisit(id: string, v: { date: string; note: string; photo: string | null }): SaveResult {
  const prev = visits[id];
  visits = { ...visits, [id]: { date: v.date, note: v.note.trim(), photo: v.photo, updatedAt: Date.now() } };
  const undo = () => { const n = { ...visits }; if (prev) n[id] = prev; else delete n[id]; visits = n; };
  let res: SaveResult = 'ok';
  if (!persist()) {
    if (visits[id].photo) {
      visits = { ...visits, [id]: { ...visits[id], photo: null } };
      if (persist()) res = 'nophoto'; else { undo(); return 'fail'; }
    } else { undo(); return 'fail'; }
  }
  track(id, false); emit(); return res;
}
export function removeVisit(id: string): boolean {
  const prev = visits[id]; const n = { ...visits }; delete n[id];
  const backup = visits; visits = n;
  if (!persist()) { visits = backup; return false; }
  if (isReal(prev)) track(id, true);
  emit(); return true;
}

/* données importées : data URL strictement validée (elle finit dans un attribut src) */
export function cleanVisit(x: unknown): Visit | null {
  const o = x as { date?: unknown; note?: unknown; photo?: unknown } | null;
  if (!o || typeof o !== 'object' || typeof o.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) return null;
  const photo = typeof o.photo === 'string' && o.photo.length <= 600000 && PHOTO_RE.test(o.photo) ? o.photo : null;
  return { date: o.date, note: typeof o.note === 'string' ? o.note.slice(0, 500) : '', photo, updatedAt: Date.now() };
}
export function importVisits(add: Visits): boolean {
  if (!setVisits({ ...visits, ...add })) return false;
  Object.keys(add).forEach(id => track(id, false));
  return true;
}

/* ----- synchronisation : local d'abord, dernier écrit gagne ----- */
export function track(id: string, gone: boolean) {
  if (!sb) return;
  const ts = Date.now();
  if (gone) { if (!session) return; deleted[id] = ts; } else delete deleted[id];
  dirty[id] = ts; saveMeta(); scheduleSync();
}
export function scheduleSync(delay?: number) {
  if (!sb || !session) return;
  clearTimeout(syncTimer); syncTimer = setTimeout(() => { void sync(); }, delay == null ? 1500 : delay);
}
function bindUser() {
  const known = (() => { try { return localStorage.getItem('carnet.uid'); } catch { return null; } })();
  if (known && session && known !== session.user.id) {
    lastSync = null; dirty = {}; deleted = {};
    Object.values(visits).forEach(v => { delete v.updatedAt; });
    save('carnet.lastSync', null); saveMeta();
  }
  try { if (session) localStorage.setItem('carnet.uid', session.user.id); } catch { /* ignore */ }
  let purged = false; const n = { ...visits };
  for (const id of Object.keys(n)) if (n[id].demo) { delete n[id]; purged = true; }
  if (purged) { visits = n; persist(); emit(); }
}
export async function sync() {
  if (!sb || !session) return;
  if (syncing) { syncAgain = true; return; }
  syncing = true; setStatus('Synchronisation…');
  let changed = 0;
  try {
    const uid = session.user.id;
    if (!lastSync) {
      const legacy = Object.keys(visits).filter(id => !visits[id].demo && !visits[id].local && !visits[id].updatedAt);
      if (legacy.length) {
        const ok = confirm('Cet appareil contient ' + legacy.length + ' visite' + (legacy.length > 1 ? 's' : '') +
          ' enregistrée' + (legacy.length > 1 ? 's' : '') + ' avant la synchronisation. Les envoyer vers votre compte ?\n\n' +
          'Annuler : elles restent sur cet appareil, sans être envoyées.');
        legacy.forEach(id => { if (ok) { visits[id].updatedAt = 1; dirty[id] = Date.now(); } else visits[id].local = true; });
        persist(); saveMeta();
      }
    }
    const since = lastSync ? new Date(new Date(lastSync).getTime() - 300000).toISOString() : null;
    let from = 0, maxTs = lastSync;
    for (;;) {
      let q = sb.from('visits').select('place_id,date,note,photo,deleted,client_ts,updated_at');
      if (since) q = q.gte('updated_at', since);
      const { data, error } = await q.order('updated_at', { ascending: true }).order('place_id', { ascending: true }).range(from, from + 24);
      if (error) throw error;
      for (const r of data) {
        if (!maxTs || r.updated_at > maxTs) maxTs = r.updated_at;
        const id = r.place_id as string, cur = visits[id], ts = Number(r.client_ts);
        if (!BY_ID[id] || !isFinite(ts)) continue;
        const localTs = cur ? (isReal(cur) ? (cur.updatedAt || 0) : 0) : (deleted[id] || 0);
        if (ts <= localTs) continue;
        if (r.deleted) { if (cur) { const n = { ...visits }; delete n[id]; visits = n; } deleted[id] = ts; }
        else { const c = cleanVisit({ date: r.date, note: r.note, photo: r.photo }); if (!c) continue; c.updatedAt = ts; visits = { ...visits, [id]: c }; delete deleted[id]; }
        delete dirty[id]; changed++;
      }
      if (data.length < 25) break;
      from += 25;
    }
    const rows: Record<string, unknown>[] = [], snap: Record<string, number> = {};
    for (const id of Object.keys(dirty)) {
      const v = visits[id];
      if (isReal(v)) rows.push({ user_id: uid, place_id: id, date: v.date, note: v.note || '', photo: v.photo || null, deleted: false, client_ts: v.updatedAt || dirty[id] });
      else if (!v && deleted[id]) rows.push({ user_id: uid, place_id: id, date: null, note: '', photo: null, deleted: true, client_ts: deleted[id] });
      else { delete dirty[id]; continue; }
      snap[id] = dirty[id];
    }
    for (let i = 0; i < rows.length; i += 20) {
      const part = rows.slice(i, i + 20);
      const { error } = await sb.from('visits').upsert(part, { onConflict: 'user_id,place_id' });
      if (error) throw error;
      part.forEach(r => { const k = r.place_id as string; if (dirty[k] === snap[k]) delete dirty[k]; });
    }
    if (maxTs) { lastSync = maxTs; save('carnet.lastSync', lastSync); }
    persist(); saveMeta();
    lastOk = new Date().toISOString(); save('carnet.lastOk', lastOk);
    syncStatus = 'Synchronisé à ' + hhmm(lastOk);
    emit();
    void changed;
  } catch (e) {
    persist(); saveMeta();
    setStatus('Échec de la synchronisation : ' + ((e as Error)?.message ? (e as Error).message : 'réseau indisponible') + '. Nouvel essai au prochain changement.');
  } finally {
    syncing = false;
    if (syncAgain) { syncAgain = false; scheduleSync(300); }
  }
}

const AUTH_ERR: [RegExp, string][] = [
  [/invalid login credentials|invalid_credentials/i, 'E-mail ou mot de passe incorrect.'],
  [/already registered|already been registered|user_already_exists/i, 'Un compte existe déjà avec cet e-mail : utilisez « Se connecter ».'],
  [/email not confirmed|email_not_confirmed/i, "E-mail non confirmé : ouvrez le message de confirmation reçu (ou désactivez la confirmation d'e-mail dans Supabase)."],
  [/rate limit|too many|over_.*_rate_limit/i, 'Trop de tentatives : patientez quelques minutes.'],
  [/password.*(short|least|weak|characters)|weak_password/i, 'Mot de passe trop court ou trop faible.'],
  [/failed to fetch|network/i, 'Réseau indisponible : réessayez.']
];
const authMsg = (e: unknown) => { const m = (e as Error)?.message || ''; const f = AUTH_ERR.find(x => x[0].test(m)); return f ? f[1] : (m || 'Erreur inconnue.'); };
export async function passwordAuth(mail: string, pw: string, create: boolean): Promise<void> {
  if (!sb) return;
  mail = mail.trim();
  if (!/^\S+@\S+\.\S+$/.test(mail)) { setStatus('Adresse e-mail invalide.'); return; }
  if (pw.length < 8) { setStatus('Le mot de passe doit faire au moins 8 caractères.'); return; }
  setStatus(create ? 'Création du compte…' : 'Connexion…');
  try {
    if (create) {
      const { data, error } = await sb.auth.signUp({ email: mail, password: pw,
        options: { emailRedirectTo: location.protocol === 'file:' ? undefined : location.origin + location.pathname } });
      if (error) throw error;
      if (!data.session) setStatus('Compte créé. Un e-mail de confirmation a été envoyé à ' + mail + ' : confirmez-le, puis connectez-vous.');
    } else {
      const { error } = await sb.auth.signInWithPassword({ email: mail, password: pw });
      if (error) throw error;
    }
  } catch (e) { setStatus(authMsg(e)); }
}
export async function signOut() {
  if (!sb) return;
  if (!confirm('Se déconnecter ? Le carnet reste sur cet appareil.')) return;
  await sync();
  await sb.auth.signOut();
}

/* demande à l'interface d'ouvrir les réglages (retour d'un lien de confirmation) */
export const SETTINGS_EVENT = 'apprefet:settings';
export function initSync() {
  if (!(SUPABASE_URL && SUPABASE_KEY)) return;
  let fromLink = /access_token=/.test(location.hash);
  if (/error_description=/.test(location.hash)) setTimeout(() => alert('Lien de connexion invalide ou expiré. Demandez-en un nouveau.'), 300);
  sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  sb.auth.onAuthStateChange((_ev, s) => {
    const prev = session; session = s;
    setTimeout(() => {
      if (s) {
        if (!prev || prev.user.id !== s.user.id) bindUser();
        if (fromLink) { fromLink = false; window.dispatchEvent(new Event(SETTINGS_EVENT)); }
        void sync();
      }
      emit();
    }, 0);
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleSync(500); });
  window.addEventListener('online', () => scheduleSync(500));
  emit();
}
