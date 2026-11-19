import { norm } from './util';
import { type Place } from './data';

const INFO_KEY = 'carnet.info3', INFO_TTL = 30 * 864e5, INFO_MAX = 150;
export interface Geo { pop: number; km2: number | null }
export interface Photo { src: string; page: string | null; kind: 'prefecture' | 'ville' }
export interface Wiki { text: string; page: string | null; photo: Photo | null }
export interface Info { t: number; geo?: Geo | false; wiki?: Wiki | false }
let cache: Record<string, Info> = (() => { try { return JSON.parse(localStorage.getItem(INFO_KEY) || '{}') || {}; } catch { return {}; } })();
function infoSave() {
  const ids = Object.keys(cache);
  if (ids.length > INFO_MAX) ids.sort((a, b) => (cache[a].t || 0) - (cache[b].t || 0)).slice(0, ids.length - INFO_MAX).forEach(i => { delete cache[i]; });
  try { localStorage.setItem(INFO_KEY, JSON.stringify(cache)); } catch { /* ignore */ }
}
export const forgetInfo = (id: string) => { delete cache[id]; };

async function getJSON(url: string): Promise<any> {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);   // jamais de chargement sans fin
  let r: Response; try { r = await fetch(url, { signal: ctl.signal }); } finally { clearTimeout(timer); }
  if (r.status === 404) return false;               // réponse définitive : on ne réessaie pas
  if (!r.ok) throw new Error('HTTP ' + r.status);   // erreur passagère : on réessaiera
  return r.json();
}
async function geoInfo(p: Place): Promise<Geo | false> {
  const d = await getJSON('https://geo.api.gouv.fr/communes/' + encodeURIComponent(p.codeInsee) + '?fields=nom,population,surface');
  if (!d || typeof d.population !== 'number') return false;
  return { pop: d.population, km2: typeof d.surface === 'number' && d.surface > 0 ? d.surface / 100 : null };   // surface en hectares
}
const WIKI = 'https://fr.wikipedia.org/w/api.php?format=json&origin=*&action=query&redirects=1&inprop=url&prop=pageimages%7Cextracts%7Cdescription%7Cinfo%7Cpageprops&ppprop=disambiguation&piprop=thumbnail&pithumbsize=900&exintro=1&explaintext=1&exchars=600&exlimit=5';
const wikiPages = (d: any): any[] => d && d.query && d.query.pages ? Object.values(d.query.pages).filter((x: any) => x && !x.missing && typeof x.title === 'string') : [];
/* Wikipédia sert ses vignettes depuis thumb.wikimedia.org (ou upload.wikimedia.org) */
const imgOk = (u: unknown) => typeof u === 'string' && /^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(u);
const pageOf = (x: any) => ({
  title: x.title as string, desc: typeof x.description === 'string' ? x.description : '', text: typeof x.extract === 'string' ? x.extract.trim() : '',
  url: typeof x.fullurl === 'string' && /^https:\/\/fr\.wikipedia\.org\//.test(x.fullurl) ? x.fullurl as string : null,
  img: x.thumbnail && imgOk(x.thumbnail.source) ? x.thumbnail.source as string : null });
function resolveTitle(d: any, t: string): string {
  const m = (arr: any[] | undefined, s: string) => { const f = (arr || []).find(x => x.from === s); return f ? f.to : s; };
  return m(d.query && d.query.redirects, m(d.query && d.query.normalized, t));
}
async function wikiInfo(p: Place): Promise<Wiki | false> {
  const titles = [p.nom, p.nom + ' (' + p.deptNom + ')', p.nom + ' (commune)'];
  const q = p.type === 'prefecture' ? 'hôtel de préfecture ' + p.deptNom : 'sous-préfecture ' + p.nom;
  const [r1, r2] = await Promise.allSettled([
    getJSON(WIKI + '&titles=' + encodeURIComponent(titles.join('|'))),
    getJSON(WIKI + '&generator=search&gsrlimit=5&gsrnamespace=0&gsrsearch=' + encodeURIComponent(q))
  ]);
  if (r1.status === 'rejected' && r2.status === 'rejected') throw r1.reason;
  const d1 = r1.status === 'fulfilled' ? r1.value : null, d2 = r2.status === 'fulfilled' ? r2.value : null;
  const pages = wikiPages(d1);
  const isDisamb = (x: any) => (x.pageprops && 'disambiguation' in x.pageprops) || /homonymie/i.test(x.description || '') || /^[^\n]{0,80}(peut désigner|peut faire référence|peut renvoyer)/i.test(x.extract || '');
  const townRaw = d1 ? titles.map(t => pages.find(x => x.title === resolveTitle(d1, t)))
    .find(x => x && x.extract && !isDisamb(x) && (!x.description || /commune|ville|capitale|chef-lieu|préfecture|communauté|municipalité/i.test(x.description))) : null;
  const nn = norm(p.nom), nd = norm(p.deptNom);
  const bldRaw = d2 ? wikiPages(d2).sort((a, b) => (a.index || 0) - (b.index || 0)).find(x => {
    const t = norm(x.title); return x.thumbnail && imgOk(x.thumbnail.source) && t.includes('prefecture') && (t.includes(nd) || t.includes(nn)); }) : null;
  const T = townRaw ? pageOf(townRaw) : null, B = bldRaw ? pageOf(bldRaw) : null;
  const photo: Photo | null = B && B.img ? { src: B.img, page: B.url, kind: 'prefecture' } : T && T.img ? { src: T.img, page: T.url, kind: 'ville' } : null;
  return T || photo ? { text: T ? T.text : '', page: T ? T.url : null, photo } : false;
}
export async function loadInfo(p: Place): Promise<Info> {
  const c = cache[p.id] || (cache[p.id] = { t: 0 });
  const stale = !c.t || c.t < Date.now() - INFO_TTL, jobs: Promise<void>[] = [];
  if (c.geo === undefined || stale) jobs.push(geoInfo(p).then(v => { c.geo = v; }, () => {}));
  if (c.wiki === undefined || stale) jobs.push(wikiInfo(p).then(v => { c.wiki = v; }, () => {}));
  if (jobs.length) { await Promise.all(jobs); c.t = Date.now(); infoSave(); }
  return c;
}
