import { sb } from './store';
const FRIEND_ERR: [RegExp, string][] = [
  [/non_connecte/, 'Connectez-vous pour utiliser les amis.'],
  [/pseudo_invalide/, 'Pseudo invalide : 2 à 20 caractères (lettres, chiffres, espaces, - _ .).'],
  [/pseudo_pris/, 'Ce pseudo est déjà pris : choisissez-en un autre.'],
  [/profil_requis/, "Choisissez d'abord un pseudo."],
  [/code_inconnu/, 'Aucun ami ne correspond à ce code.'],
  [/soi_meme/, "C'est votre propre code !"],
  [/non_ami/, "Cette personne n'est pas (ou plus) dans vos amis."],
  [/could not find the function|PGRST202|schema cache|does not exist/i, "La base n'est pas encore prête pour les amis : exécutez le fichier supabase/amis.sql dans Supabase (SQL Editor)."],
  [/failed to fetch|network|load failed|abort/i, 'Réseau indisponible : réessayez.']
];
export const friendMsg = (e: unknown) => {
  const x = e as { message?: string; details?: string } | null; const m = (x && (x.message || x.details)) || '';
  const f = FRIEND_ERR.find(r => r[0].test(m)); return f ? f[1] : (m || 'Erreur inconnue.');
};
export async function rpc<T = any>(name: string, args?: Record<string, unknown>): Promise<T> {
  if (!sb) throw new Error('non_connecte');
  const r = await sb.rpc(name, args || {}); if (r.error) throw r.error; return r.data as T;
}
export const fmtCode = (c: string) => c ? c.slice(0, 4) + '-' + c.slice(4) : '';
/* rang « à égalité » */
export function rankOf(list: { n: number }[]) { let r = 0; return list.map((x, i) => { if (i === 0 || x.n !== list[i - 1].n) r = i + 1; return r; }); }
export interface Overview { user_id: string; pseudo: string; n: number; is_me?: boolean }
export interface Req { id: string; user_id: string; pseudo: string; direction: 'in' | 'out' }
export interface Profile { code: string; pseudo: string }
