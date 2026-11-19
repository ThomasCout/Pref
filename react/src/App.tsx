import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ACC_LIGHT, BY_ID, TOTAL, gradeOf, nextGrade, type Grade } from './lib/data';
import { count, getVisits, saveVisit, session, useStore, SETTINGS_EVENT } from './lib/store';
import { fr, longDate, today } from './lib/util';
import { NavCtx, type Draft, type Nav, type Route, type Tab, type Ui } from './lib/nav';
import { Ring } from './components/Ring';
import { Btn } from './components/ui';
import { IcBack, IcCam, IcCheck, IcEdit, IcPlus, IcSort, IcUsers, NAV_ICONS } from './components/Icons';
import { Registre } from './screens/Registre';
import { Detail } from './screens/Detail';
import { Carte } from './screens/Carte';
import { Dossier } from './screens/Dossier';
import { Reglages } from './screens/Reglages';
import { Album } from './screens/Album';
import { Amis, Ami, useFriendBadge } from './screens/Amis';
import { Flash } from './screens/Flash';
import { Form } from './screens/Form';
import { Retro } from './screens/Retro';

const TITLES: Record<Tab, string> = { registre: 'Registre', carte: 'Carte', dossier: 'Dossier', reglages: 'Réglages' };
const NEXT_SORT = { date: 'alpha', alpha: 'dept', dept: 'date' } as const;
type Overlay = { k: 'flash'; id: string } | { k: 'form'; id: string | null; pre?: Partial<Draft> } | null;
type Hit = { id: string; date: string; update: boolean } | null;

export default function App() {
  useStore();
  const n = count(), g = gradeOf(n);
  const [opened, setOpened] = useState(false);
  const [tab, setTabState] = useState<Tab>('registre');
  const [stack, setStack] = useState<Route[]>([]);
  const [ui, setUiState] = useState<Ui>({ filter: 'all', sort: 'date', q: '', pin: null, albumAsc: true });
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [hit, setHit] = useState<Hit>(null);
  const [promo, setPromo] = useState<Grade | null>(null);
  const [retro, setRetro] = useState(false);
  const [subTitle, setSubTitle] = useState('');
  const view = useRef<HTMLDivElement>(null), albumScroll = useRef(0);
  const top = stack[stack.length - 1] as Route | undefined;
  const badge = useFriendBadge(tab + (session ? '1' : '0') + (top ? top.k : ''));

  const setUi = useCallback((p: Partial<Ui>) => setUiState(o => ({ ...o, ...p })), []);
  const setTab = useCallback((t: Tab) => { setTabState(t); setStack([]); if (t !== 'carte') setUi({ pin: null }); setOpened(true); }, [setUi]);
  const push = useCallback((r: Route) => {
    if (r.k === 'detail' && view.current && top?.k === 'album') albumScroll.current = view.current.scrollTop;
    setSubTitle(''); setStack(s => [...s, r]);
  }, [top]);
  const pop = useCallback(() => { setSubTitle(''); setStack(s => s.slice(0, -1)); }, []);

  useEffect(() => { const f = () => setTab('reglages'); window.addEventListener(SETTINGS_EVENT, f); return () => window.removeEventListener(SETTINGS_EVENT, f); }, [setTab]);
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === 'Escape') setOverlay(o => o && o.k === 'form' ? null : o); };
    document.addEventListener('keydown', f); return () => document.removeEventListener('keydown', f); }, []);
  const topKey = top ? top.k + ('id' in top ? top.id : '') + ('uid' in top ? top.uid : '') : '';
  useLayoutEffect(() => { if (view.current) view.current.scrollTop = top?.k === 'album' ? albumScroll.current : 0; }, [tab, topKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = useCallback((d: Draft) => {
    if (!d.id || !d.date) return;
    const id = d.id, before = gradeOf(count()), prev = getVisits()[id];
    const res = saveVisit(id, { date: d.date, note: d.note, photo: d.photo });
    if (res === 'fail') { alert('Enregistrement impossible : le stockage du navigateur est plein ou inaccessible.'); return; }
    if (res === 'nophoto') alert("Espace de stockage insuffisant : la visite est enregistrée sans la photo.");
    const after = gradeOf(count());
    if (navigator.vibrate) navigator.vibrate(prev ? 35 : [30, 60, 45]);
    setHit({ id, date: d.date, update: !!prev });
    setTimeout(() => {
      setHit(null); setOverlay(null);
      setTab('registre');
      if (!before || (after && after[0] > before[0])) setPromo(after);
    }, prev ? 850 : 1500);
  }, [setTab]);

  const nav: Nav = useMemo(() => ({
    tab, setTab, push, pop, ui, setUi, commit, setSubTitle,
    openFlash: id => setOverlay({ k: 'flash', id }),
    openForm: (id, pre) => setOverlay({ k: 'form', id, pre }),
    startRetro: () => setRetro(true),
    openDetail: id => push({ k: 'detail', id }),
    showPromo: setPromo
  }), [tab, setTab, push, pop, ui, setUi, commit]);

  let brand = 'Préfectures de France', title: string = TITLES[tab], act: React.ReactNode = null;
  if (top) {
    if (top.k === 'detail') title = 'Fiche';
    else if (top.k === 'ami') { brand = "Carnet d'un ami"; title = subTitle || 'Ami'; }
    else { brand = 'Mon carnet de visites'; title = top.k === 'album' ? 'Album' : 'Amis'; }
    act = <button type="button" className="pill" id="h-act" onClick={pop}><IcBack /><span>Retour</span></button>;
  } else if (tab === 'registre') act = <button type="button" className="pill" id="h-act" onClick={() => setUi({ sort: NEXT_SORT[ui.sort] })}><IcSort /><span>Trier</span></button>;
  else if (tab === 'dossier') act = <button type="button" className="pill" id="h-act" onClick={() => push({ k: 'amis' })}><IcUsers /><span>Amis</span>
    <i className="dot" id="h-dot" hidden={!badge}>{badge || ''}</i></button>;

  const detailId = top?.k === 'detail' ? top.id : null, dv = detailId ? getVisits()[detailId] : null;
  const fabShown = !!detailId || (!top && tab === 'registre');
  const fabClick = () => { if (detailId && !dv) setOverlay({ k: 'flash', id: detailId }); else setOverlay({ k: 'form', id: detailId }); };

  let content: React.ReactNode;
  if (!top) content = tab === 'registre' ? <Registre /> : tab === 'carte' ? <Carte /> : tab === 'dossier' ? <Dossier /> : <Reglages />;
  else if (top.k === 'detail') content = <Detail id={top.id} />;
  else if (top.k === 'album') content = <Album scrollRef={albumScroll} />;
  else if (top.k === 'amis') content = <Amis />;
  else content = <Ami uid={top.uid} />;

  const hp = hit && getVisits()[hit.id]?.photo;
  const nx = nextGrade(count());
  return (
    <NavCtx.Provider value={nav}>
      <div id="app">
        <div className={'screen' + (opened ? ' hidden' : '')} id="cover" role="button" tabIndex={0} aria-label="Ouvrir mon carnet"
          onClick={() => setOpened(true)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpened(true); } }}>
          <div><div className="brand">Préfectures de France</div><h1>Mon carnet de visites</h1></div>
          <div className="cv-mid">
            <div className="cv-ring"><div id="cv-ring"><Ring pct={n / TOTAL} size={200} stroke={12} track="rgba(255,255,255,.14)" color={ACC_LIGHT} /></div>
              <div className="cv-center"><b id="cv-n">{n}</b><span id="cv-t">{n === 1 ? 'visite' : 'visites'} sur {TOTAL}</span></div></div>
            <div id="cv-g">{g ? g[1] : 'Carnet vierge'}</div>
          </div>
          <div><Btn kind="light" id="cv-open" onClick={() => setOpened(true)}>Ouvrir mon carnet</Btn>
            <div className="cv-foot">Application non officielle · v1.0</div></div>
        </div>

        <div className={'screen' + (opened ? '' : ' hidden')} id="main">
          <header><div><div className="brand" id="h-brand">{brand}</div><h1 id="h-title">{title}</h1></div>{act}</header>
          <div id="view" ref={view} className={!top && tab === 'carte' ? 'map-mode' : ''}>{content}</div>
          {fabShown && <button type="button" className="fab" id="fab" data-id={detailId || undefined}
            aria-label={detailId ? (dv ? 'Modifier la fiche de visite' : 'Déclarer une visite ici') : 'Déclarer une visite'} onClick={fabClick}>
            {detailId ? (dv ? <IcEdit /> : <IcCam />) : <IcPlus />}</button>}
          <nav aria-label="Navigation principale">
            {(['registre', 'carte', 'dossier', 'reglages'] as Tab[]).map(t =>
              <button key={t} type="button" data-tab={t} className={tab === t ? 'on' : ''} aria-current={tab === t ? 'page' : undefined} onClick={() => setTab(t)}>
                {NAV_ICONS[t]}{TITLES[t]}</button>)}
          </nav>
        </div>

        {overlay?.k === 'form' && <Form key="form" id={overlay.id} pre={overlay.pre} onClose={() => setOverlay(null)} />}
        {overlay?.k === 'flash' && <Flash key={overlay.id} id={overlay.id} onClose={() => setOverlay(null)} />}
        {hit && <div id="hit">{hit.update
          ? <div className="done"><span className="ic"><IcCheck w={40} /></span><b>Fiche mise à jour</b><span className="s">{longDate(hit.date)}</span></div>
          : <div className="done stampwrap"><div className="st-box">{hp && <img className="st-ph" src={hp} alt="" />}<div className={'st-mark' + (hp ? '' : ' flow')}>VISITÉ</div></div>
              <b>{BY_ID[hit.id].nom}</b><span className="s">{longDate(hit.date)}</span>
              {nx && <span className="s">Plus que {nx[2] - count()} avant {nx[1]}</span>}</div>}</div>}
        {retro && <Retro onClose={() => setRetro(false)} />}
        {promo && <div id="promo" role="dialog" aria-label="Promotion"><div className="brand">Décision de promotion</div><span className="ic"><IcCheck w={40} /></span>
          <div className="g">{promo[1]}</div>
          <p className="mut">Niveau {promo[0]} sur 11 · {count()} lieux visités sur {TOTAL}<br />Promu le {fr(today())}</p>
          <Btn kind="light" className="max-w-[220px] mt-2" onClick={() => setPromo(null)}>Prendre acte</Btn></div>}
      </div>
    </NavCtx.Provider>
  );
}
