import { useCallback, useEffect, useRef, useState } from 'react';
import { PLACES, PREFS, SOUS, TOTAL, BY_ID, gradeOf, typeLabel } from '../lib/data';
import { count, getVisits, isReal, session, sb } from '../lib/store';
import { fmtCode, friendMsg, rankOf, rpc, type Overview, type Profile, type Req } from '../lib/friends';
import { PHOTO_RE, plural, shortDate } from '../lib/util';
import { useNav } from '../lib/nav';
import { Hero } from '../components/Hero';
import { IcCheck } from '../components/Icons';
import { Kpi, Sec } from '../components/Fiche';
import { Btn, Empty, Field, Panel } from '../components/ui';

/* nombre de demandes reçues, pour la pastille du Dossier */
let badge = 0;
const badgeSubs = new Set<(n: number) => void>();
const setBadge = (n: number) => { badge = n; badgeSubs.forEach(f => f(n)); };
export function useFriendBadge(key: string) {
  const [n, setN] = useState(badge);
  useEffect(() => {
    badgeSubs.add(setN);
    if (sb && session) rpc<Req[]>('friend_requests').then(r => setBadge(r.filter(x => x.direction === 'in').length)).catch(() => {});
    else setBadge(0);
    return () => { badgeSubs.delete(setN); };
  }, [key]);
  return n;
}

type Data = { prof: Profile | null; over: Overview[]; reqs: Req[] };
export function Amis() {
  const { setTab, push } = useNav();
  const [data, setData] = useState<Data | null>(null), [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [reload, setReload] = useState(0);
  const reloadWith = (m: string) => { setFlash(m); setReload(x => x + 1); };
  useEffect(() => {
    if (!sb || !session) return;
    let alive = true; setData(null); setErr('');
    Promise.all([rpc<Profile | null>('my_profile'), rpc<Overview[]>('friends_overview'), rpc<Req[]>('friend_requests')])
      .then(([prof, over, reqs]) => { if (!alive) return; setBadge(reqs.filter(x => x.direction === 'in').length); setData({ prof, over, reqs }); })
      .catch(e => { if (alive) setErr(friendMsg(e)); });
    return () => { alive = false; };
  }, [reload]);

  if (!sb) return <Empty title="Amis indisponibles" text="La synchronisation n'est pas configurée : les amis ont besoin d'un compte." />;
  if (!session) return <Empty title="Connexion nécessaire" text="Pour ajouter des amis et comparer vos carnets, connectez-vous d'abord à votre compte.">
    <Btn id="am-login" onClick={() => setTab('reglages')}>Aller aux Réglages</Btn></Empty>;
  if (err) return <Empty title="Impossible de charger" text={err}><Btn id="am-retry" onClick={() => setReload(x => x + 1)}>Réessayer</Btn></Empty>;
  if (!data) return <p className="mut" style={{ marginTop: 12 }}>Chargement…</p>;
  if (!data.prof) return <PseudoForm onDone={() => setReload(x => x + 1)} />;
  return <Drawn prof={data.prof} over={data.over} reqs={data.reqs} flash={flash} setFlash={setFlash} reloadWith={reloadWith} open={uid => push({ k: 'ami', uid })} />;
}

function PseudoForm({ onDone }: { onDone: () => void }) {
  const [val, setVal] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  const submit = async () => {
    const v = val.trim().replace(/\s+/g, ' ');
    if (!/^[\p{L}\p{N} _.-]{2,20}$/u.test(v)) { setMsg(friendMsg({ message: 'pseudo_invalide' })); return; }
    setBusy(true);
    try { await rpc('set_profile', { p_pseudo: v }); onDone(); } catch (e) { setMsg(friendMsg(e)); setBusy(false); }
  };
  return (
    <Panel><b style={{ font: "700 18px 'Space Grotesk',sans-serif" }}>Choisissez votre pseudo</b>
      <p className="mut" style={{ margin: '6px 0 12px' }}>Il sera visible de vos amis, avec votre progression. Votre e-mail reste privé.</p>
      <form id="am-ps" noValidate onSubmit={e => { e.preventDefault(); void submit(); }}>
        <Field id="am-pseudo" maxLength={20} autoComplete="nickname" aria-label="Pseudo" placeholder="Pseudo (2 à 20 caractères)" value={val} onChange={e => setVal(e.target.value)} />
        <Btn type="submit" className="mt-2.5" isDisabled={busy}>Continuer</Btn>
      </form>
      <p className="mut" id="am-msg" style={{ marginTop: 8 }}>{msg}</p></Panel>
  );
}

function Drawn({ prof, over: over0, reqs, flash, setFlash, reloadWith, open }:
  { prof: Profile; over: Overview[]; reqs: Req[]; flash: string; setFlash: (s: string) => void; reloadWith: (m: string) => void; open: (uid: string) => void }) {
  const mine = Object.values(getVisits()).filter(isReal).length;       // ce que verront vos amis une fois synchronisé
  const over = over0.map(x => x.is_me ? { ...x, n: mine } : x)
    .sort((a, b) => b.n - a.n || (b.is_me ? 1 : 0) - (a.is_me ? 1 : 0) || a.pseudo.localeCompare(b.pseudo, 'fr'));
  const ranks = rankOf(over), inc = reqs.filter(x => x.direction === 'in'), out = reqs.filter(x => x.direction === 'out');
  const [code, setCode] = useState(''), [msg, setMsg] = useState(flash), [busy, setBusy] = useState(false), [copied, setCopied] = useState(false);
  useEffect(() => { setFlash(''); }, [setFlash]);
  const copyTxt = fmtCode(prof.code);

  const add = async () => {
    const raw = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (raw.length !== 8) { setMsg('Le code ami comporte 8 caractères (ex. K7M2-QX9P).'); return; }
    setBusy(true); setMsg('Envoi…');
    try {
      const r = await rpc<{ result: string; pseudo: string }>('request_friend', { p_code: raw });
      reloadWith(({ envoyee: 'Demande envoyée à ' + r.pseudo + " : elle apparaîtra dans votre classement dès qu'elle sera acceptée.",
        accepte: r.pseudo + ' est maintenant votre ami.', deja_ami: r.pseudo + ' est déjà votre ami.', deja_envoyee: 'Demande déjà envoyée à ' + r.pseudo + '.' } as Record<string, string>)[r.result] || 'Fait.');
    } catch (e) { setMsg(friendMsg(e)); setBusy(false); }
  };
  const respond = async (id: string, ok: boolean) => {
    try { await rpc('respond_friend', { p_id: id, p_accept: ok }); reloadWith(ok ? 'Ami ajouté.' : 'Demande refusée.'); } catch (e) { alert(friendMsg(e)); reloadWith(''); }
  };
  const cancel = async (uid: string) => {
    try { await rpc('remove_friend', { p_user: uid }); reloadWith('Demande annulée.'); } catch (e) { alert(friendMsg(e)); reloadWith(''); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(copyTxt); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { prompt('Copiez votre code ami :', copyTxt); }
  };
  const rename = async () => {
    const nv = (prompt('Nouveau pseudo (2 à 20 caractères) :', prof.pseudo) || '').trim().replace(/\s+/g, ' ');
    if (!nv || nv === prof.pseudo) return;
    try { await rpc('set_profile', { p_pseudo: nv }); reloadWith('Pseudo modifié.'); } catch (e) { alert(friendMsg(e)); }
  };
  return (
    <>
      <Panel className="codecard"><p className="mut" style={{ fontWeight: 600 }}>Mon code ami</p>
        <div className="code" id="am-mycode">{copyTxt}</div>
        <p className="mut" style={{ marginTop: 4 }}>Pseudo : <b>{prof.pseudo}</b>. Donnez ce code à vos amis pour qu'ils vous ajoutent.</p>
        <div className="am-row"><Btn kind="alt" id="am-copy" onClick={() => { void copy(); }}>{copied ? 'Copié ✓' : 'Copier'}</Btn>
          {!!navigator.share && <Btn kind="alt" id="am-share" onClick={() => { void navigator.share({ title: 'Mon code ami',
            text: 'Ajoute-moi sur le carnet des préfectures avec le code ' + copyTxt + ' (pseudo : ' + prof.pseudo + ')' + (/^https?:$/.test(location.protocol) ? ' ' + location.origin + location.pathname : '') }).catch(() => {}); }}>Partager</Btn>}
          <Btn kind="alt" id="am-rename" onClick={() => { void rename(); }}>Pseudo</Btn></div></Panel>
      {inc.length > 0 && <><Sec a="Demandes reçues" b={String(inc.length)} /><Panel>
        {inc.map(r => <div className="line am-req" key={r.id}><b>{r.pseudo}</b><span className="am-btns">
          <button type="button" className="achip on am-yes" onClick={() => { void respond(r.id, true); }}>Accepter</button>
          <button type="button" className="achip am-no" onClick={() => { void respond(r.id, false); }}>Refuser</button></span></div>)}</Panel></>}
      <Sec a="Classement" b={'sur ' + TOTAL + ' lieux'} />
      {over.map((x, i) => {
        const g = gradeOf(x.n);
        const body = <>
          <span className={'rk-n' + (ranks[i] <= 3 ? ' top' : '')}>{ranks[i]}</span>
          <span className="rk-b"><h3>{x.pseudo}{x.is_me && <> <span className="mut">(vous)</span></>}</h3><p className="mut">{g ? g[1] : 'Carnet vierge'}</p>
            <div className="bar"><i style={{ width: x.n ? Math.max(3, x.n / TOTAL * 100).toFixed(0) + '%' : 0 }} /></div></span>
          <span className="rk-c">{x.n}<small>/ {TOTAL}</small></span></>;
        return x.is_me ? <div className="rk me" key={x.user_id}>{body}</div>
          : <button type="button" className="rk" key={x.user_id} data-uid={x.user_id} data-n={x.n} onClick={() => open(x.user_id)}>{body}</button>;
      })}
      {over.length === 1 && <Empty title="Pas encore d'ami" text="Partagez votre code, ou saisissez celui d'un ami ci-dessous." />}
      <Sec a="Ajouter un ami" />
      <Panel><form id="am-add" noValidate onSubmit={e => { e.preventDefault(); void add(); }}>
        <Field id="am-code" maxLength={12} autoComplete="off" autoCapitalize="characters" spellCheck={false} aria-label="Code ami" placeholder="Code ami (ex. K7M2-QX9P)" value={code} onChange={e => setCode(e.target.value)} />
        <Btn type="submit" className="mt-2.5" isDisabled={busy}>Envoyer la demande</Btn>
        <p className="mut" id="am-msg" style={{ marginTop: 8 }}>{msg}</p></form></Panel>
      {out.length > 0 && <><Sec a="Demandes envoyées" b={String(out.length)} /><Panel>
        {out.map(r => <div className="line am-req" key={r.id}><span><b>{r.pseudo}</b> <span className="mut">· en attente</span></span>
          <button type="button" className="achip am-cancel" onClick={() => { void cancel(r.user_id); }}>Annuler</button></div>)}</Panel></>}
    </>
  );
}

/* photos d'un ami : chargées une à une, au fur et à mesure du défilement (elles sont lourdes) */
const queue: (() => Promise<void>)[] = []; let busy = 0;
function pump() { while (busy < 2 && queue.length) { const job = queue.shift()!; busy++; job().catch(() => {}).finally(() => { busy--; pump(); }); } }
function FriendPhoto({ uid, placeId, alt, dept, hasPhoto }: { uid: string; placeId: string; alt: string; dept: string; hasPhoto: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!hasPhoto || !box.current) return;
    let alive = true, io: IntersectionObserver | undefined;
    const load = () => { queue.push(async () => {
      if (!alive) return;
      const p = await rpc<unknown>('friend_photo', { p_friend: uid, p_place: placeId });
      if (alive && typeof p === 'string' && PHOTO_RE.test(p) && p.length <= 600000) setSrc(p);
    }); pump(); };
    if (!('IntersectionObserver' in window)) load();
    else { io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { io?.disconnect(); load(); } }, { root: document.getElementById('view'), rootMargin: '300px' }); io.observe(box.current); }
    return () => { alive = false; io?.disconnect(); };
  }, [uid, placeId, hasPhoto]);
  return <div ref={box} className={'alb-ph' + (src ? '' : ' none') + (hasPhoto && !src ? ' wait' : '')} data-alb={hasPhoto ? '1' : ''}>
    {src ? <img alt={alt} src={src} /> : <span className="alb-ph0">{dept}</span>}</div>;
}

export function Ami({ uid }: { uid: string }) {
  const { pop, setSubTitle } = useNav();
  const [d, setD] = useState<{ rows: { place_id: string; date: string; note: string | null; has_photo: boolean }[]; over: Overview[] } | null>(null), [err, setErr] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true; queue.length = 0; setD(null); setErr('');
    Promise.all([rpc('friend_visits', { p_friend: uid }), rpc<Overview[]>('friends_overview')])
      .then(([rows, over]) => { if (alive) setD({ rows, over }); }).catch(e => { if (alive) setErr(friendMsg(e)); });
    return () => { alive = false; queue.length = 0; };
  }, [uid, reload]);
  const pseudo = d && d.over.find(x => x.user_id === uid)?.pseudo;
  useEffect(() => { if (pseudo) setSubTitle(pseudo); }, [pseudo, setSubTitle]);
  const remove = useCallback(async (pseudo: string) => {
    if (!confirm('Retirer ' + pseudo + ' de vos amis ? Vous ne verrez plus son carnet et il ne verra plus le vôtre.')) return;
    try { await rpc('remove_friend', { p_user: uid }); pop(); } catch (e) { alert(friendMsg(e)); }
  }, [uid, pop]);
  if (err) return <Empty title="Impossible de charger" text={err}><Btn id="am-retry" onClick={() => setReload(x => x + 1)}>Réessayer</Btn></Empty>;
  if (!d) return <p className="mut" style={{ marginTop: 12 }}>Chargement…</p>;
  const who = d.over.find(x => x.user_id === uid);
  if (!who) return <Empty title="Ami introuvable" text="Cette personne n'est plus dans vos amis." />;
  const visits = getVisits();
  const fv = d.rows.map(r => ({ p: BY_ID[r.place_id], date: r.date, note: r.note || '', photo: !!r.has_photo })).filter(x => x.p && /^\d{4}-\d{2}-\d{2}$/.test(x.date));
  const n = fv.length, seen = new Set(fv.map(x => x.p.id)), vp = PREFS.filter(p => seen.has(p.id)).length, vs = SOUS.filter(p => seen.has(p.id)).length;
  const common = fv.filter(x => visits[x.p.id]).length, pct = (a: number, b: number) => b ? Math.round(a / b * 100) : 0;
  fv.sort((a, b) => b.date.localeCompare(a.date) || a.p.nom.localeCompare(b.p.nom, 'fr'));
  void PLACES;
  return (
    <>
      <Hero n={n} />
      <div className="kpis"><Kpi n={n} label="Visitées" accent /><Kpi n={TOTAL - n} label="Restantes" /></div>
      <Panel>
        <div className="row"><span>Préfectures</span><b>{vp}/{PREFS.length}</b></div><div className="bar"><i style={{ width: pct(vp, PREFS.length) + '%' }} /></div>
        <div className="row" style={{ marginTop: 14 }}><span>Sous-préfectures</span><b>{vs}/{SOUS.length}</b></div><div className="bar"><i style={{ width: pct(vs, SOUS.length) + '%' }} /></div>
        {count() > 0 && <p className="mut" style={{ marginTop: 12 }}>{plural(common, 'lieu', 'lieux')} en commun avec votre carnet.</p>}
      </Panel>
      <Sec a="Ses visites" b="du plus récent au plus ancien" />
      {!n && <Empty title="Carnet vide" text={who.pseudo + " n'a pas encore enregistré de visite."} />}
      {fv.map(x => (
        <div className="alb am-vis" key={x.p.id} data-id={x.p.id}>
          <FriendPhoto uid={uid} placeId={x.p.id} hasPhoto={x.photo} dept={x.p.dept} alt={'Photo de ' + who.pseudo + ' : ' + x.p.nom} />
          <div className="alb-b"><div className="alb-h"><h3>{x.p.nom}</h3><span className="achip on"><IcCheck />{shortDate(x.date)}</span></div>
            <p className="mut">{typeLabel(x.p)} · {x.p.deptNom}</p>
            {x.note && <p className="alb-n" style={{ WebkitLineClamp: 'unset' }}>{x.note}</p>}</div>
        </div>))}
      <Btn kind="warn" id="am-rm" className="mt-[18px]" onClick={() => { void remove(who.pseudo); }}>Retirer cet ami</Btn>
    </>
  );
}
