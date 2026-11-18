import { useEffect, useMemo, useRef, useState } from 'react';
import { PLACES, TOTAL, gradeOf, typeLabel, type Place } from '../lib/data';
import { count, getVisits } from '../lib/store';
import { longDate, plural } from '../lib/util';
import { Btn } from '../components/ui';
import { IcPause, IcPlay, IcX } from '../components/Icons';

type Slide = { kind: 'intro' } | { kind: 'outro' } | { kind: 'visit'; p: Place };
const RETRO_GRAD = ['linear-gradient(160deg,#1B3FD6,#0E1726)', 'linear-gradient(160deg,#0F766E,#0E1726)', 'linear-gradient(160deg,#7C3AED,#0E1726)'];
/* durées : 3 s par diapo, +1 s quand elle a une note ; réglables pour les tests */
const ms = () => (window as unknown as { __RETRO_MS?: number }).__RETRO_MS ?? 3000;
const msNote = () => (window as unknown as { __RETRO_NOTE_MS?: number }).__RETRO_NOTE_MS ?? 1000;

export function Retro({ onClose }: { onClose: () => void }) {
  const visits = getVisits();
  const list = useMemo(() => PLACES.filter(p => visits[p.id]).sort((a, b) => visits[a.id].date.localeCompare(visits[b.id].date) || a.nom.localeCompare(b.nom, 'fr')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []);
  const slides: Slide[] = useMemo(() => [{ kind: 'intro' }, ...list.map(p => ({ kind: 'visit' as const, p })), { kind: 'outro' }], [list]);
  const dur = (s: Slide) => s.kind === 'outro' ? Infinity : s.kind === 'intro' ? ms() + 600 : ms() + (visits[s.p.id].note ? msNote() : 0);
  const [i, setI] = useState(0), [paused, setPaused] = useState(false);
  const [leaving, setLeaving] = useState<{ key: number; i: number }[]>([]);
  const r = useRef({ i: 0, t: 0, dur: dur(slides[0]), paused: false, uid: 0, gen: 0 });
  const bar = useRef<HTMLElement>(null), root = useRef<HTMLDivElement>(null), opener = useRef<Element | null>(document.activeElement);
  const [gen, setGen] = useState(0);

  const go = (n: number) => {
    n = Math.max(0, Math.min(slides.length - 1, n));
    if (n === r.current.i) return;
    const key = ++r.current.uid, old = r.current.i;
    setLeaving(l => [...l, { key, i: old }]);
    setTimeout(() => setLeaving(l => l.filter(x => x.key !== key)), 800);
    r.current.i = n; r.current.t = 0; r.current.dur = dur(slides[n]); r.current.gen++;
    setI(n); setGen(r.current.gen);
  };
  const pause = (p: boolean) => { r.current.paused = p; setPaused(p); };
  const goRef = useRef(go); goRef.current = go;

  useEffect(() => {
    let raf = 0, last = performance.now();
    const tick = (ts: number) => {
      const s = r.current, dt = Math.min(100, ts - last); last = ts;     // dt plafonné : onglet en arrière-plan = pas de saut
      if (!s.paused && isFinite(s.dur)) { s.t += dt; if (s.t >= s.dur) goRef.current(s.i + 1); }
      if (bar.current) bar.current.style.width = (isFinite(s.dur) ? (s.i + Math.min(1, s.t / s.dur)) / slides.length * 100 : 100) + '%';
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') goRef.current(r.current.i + 1);
      else if (e.key === 'ArrowLeft') goRef.current(r.current.i - 1);
      else if (e.key === ' ' && !(e.target instanceof Element && e.target.closest('button'))) { e.preventDefault(); pause(!r.current.paused); }
    };
    document.addEventListener('keydown', key);
    const op = opener.current;
    return () => { cancelAnimationFrame(raf); document.removeEventListener('keydown', key); if (op instanceof HTMLElement && op.isConnected) op.focus(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const n = list.length, dates = list.map(p => visits[p.id].date), f = dates[0], l = dates[n - 1];
  const renderSlide = (s: Slide, k: number, out: boolean) => {
    const cls = 'rs rs-' + s.kind + (out ? ' out' : '');
    if (s.kind === 'intro') return (
      <div className={cls} key={'i' + k + out}><div className="rs-bg0" /><div className="rs-txt mid"><div className="rs-eyebrow">Rétrospective</div>
        <h2>{plural(n, 'lieu visité', 'lieux visités')}</h2><p>{f === l ? 'Le ' + longDate(f) : 'Du ' + longDate(f) + ' au ' + longDate(l)}</p></div></div>);
    if (s.kind === 'outro') {
      const depts = new Set(list.map(p => p.dept)).size, photos = list.filter(p => visits[p.id].photo).length, g = gradeOf(count());
      return (
        <div className={cls} key={'o' + k + out}><div className="rs-bg0" /><div className="rs-txt mid"><div className="rs-eyebrow">Grade atteint</div>
          <h2>{g ? g[1] : 'Carnet en cours'}</h2>
          <div className="rs-stats"><div className="rs-stat"><b>{n}</b><span>lieux</span></div><div className="rs-stat"><b>{depts}</b><span>départements</span></div><div className="rs-stat"><b>{photos}</b><span>photos</span></div></div>
          <p>Il reste {plural(TOTAL - n, 'lieu', 'lieux')} à découvrir.</p>
          <div className="rs-actions"><Btn kind="light" id="rt-again" autoFocus onClick={() => { pause(false); go(0); }}>Revoir la rétrospective</Btn>
            <Btn kind="ghost" id="rt-end" onClick={onClose}>Fermer</Btn></div></div></div>);
    }
    const p = s.p, v = visits[p.id];
    return (
      <div className={cls} key={'v' + k + out}>
        {v.photo ? <img className={'kb' + (k % 2)} alt={'Photo de la visite : ' + p.nom} src={v.photo} />
          : <div className="rs-bg" style={{ background: RETRO_GRAD[k % 3] }}><span>{p.dept}</span></div>}
        <div className="rs-txt"><div className="rs-eyebrow">{longDate(v.date)}</div><h2>{p.nom}</h2>
          <p>{typeLabel(p)} · {p.deptNom}</p>{v.note && <p className="rs-note">{v.note}</p>}</div>
      </div>);
  };
  const s = slides[i];
  return (
    <div id="retro" ref={root} role="dialog" aria-modal="true" aria-label="Rétrospective" className={s.kind === 'outro' ? 'end' : ''}>
      <div className="rt-stage">
        {leaving.map(x => renderSlide(slides[x.i], x.i, true))}
        <span key={gen} style={{ display: 'contents' }}>{renderSlide(s, i, false)}</span>
      </div>
      <button type="button" className="rt-zone rt-prev" aria-label="Diapositive précédente" onClick={() => go(r.current.i - 1)} />
      <button type="button" className="rt-zone rt-next" aria-label="Diapositive suivante" onClick={() => go(r.current.i + 1)} />
      <div className="rt-top"><div className="rt-bar"><i ref={bar} /></div>
        <div className="rt-row"><span className="rt-count">{s.kind === 'visit' ? i + ' / ' + n : ''}</span>
          <span className="rt-btns">
            <button type="button" id="rt-pp" aria-label={paused ? 'Reprendre' : 'Pause'} onClick={() => pause(!r.current.paused)}>{paused ? <IcPlay /> : <IcPause />}</button>
            <button type="button" id="rt-x" aria-label="Fermer la rétrospective" onClick={onClose}><IcX w={22} /></button></span></div></div>
    </div>
  );
}
