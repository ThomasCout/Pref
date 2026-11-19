import { useCallback, useEffect, useRef, useState } from 'react';
import { BY_ID, typeLabel } from '../lib/data';
import { longDate, today } from '../lib/util';
import { shrink } from '../lib/photo';
import { useNav } from '../lib/nav';
import { Btn, FileBtn, Note } from '../components/ui';
import { IcFlip, IcGal, IcX } from '../components/Icons';

/* « Flash » : écran caméra pour déclarer une visite sur place */
export function Flash({ id, onClose }: { id: string; onClose: () => void }) {
  const { openForm, commit } = useNav();
  const p = BY_ID[id];
  const [step, setStep] = useState<'cam' | 'rev'>('cam');
  const [photo, setPhoto] = useState<string | null>(null), [note, setNote] = useState(''), [date, setDate] = useState(today());
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [msg, setMsg] = useState<string | null>(null), [multi, setMulti] = useState(false), [white, setWhite] = useState(0);
  const video = useRef<HTMLVideoElement>(null), stream = useRef<MediaStream | null>(null), tok = useRef(0);

  const stop = useCallback(() => { stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; }, []);
  const start = useCallback(async () => {
    const my = ++tok.current; stop(); setMsg(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setMsg('Caméra indisponible ici'); return; }
    try {
      const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1600 }, height: { ideal: 1600 } }, audio: false });
      if (my !== tok.current || !video.current) { st.getTracks().forEach(t => t.stop()); return; }
      stream.current = st; video.current.srcObject = st; video.current.play().catch(() => {});
    } catch (e) {
      if (my !== tok.current) return;
      setMsg((e as Error)?.name === 'NotAllowedError' ? 'Accès à la caméra refusé' : 'Caméra indisponible');
    }
  }, [facing, stop]);

  useEffect(() => {
    if (step !== 'cam') { stop(); return; }
    void start();
    navigator.mediaDevices?.enumerateDevices?.().then(d => setMulti(d.filter(x => x.kind === 'videoinput').length > 1)).catch(() => {});
    return stop;
  }, [step, start, stop]);
  useEffect(() => {                         // la caméra ne reste jamais allumée en arrière-plan
    const f = () => { if (document.hidden) stop(); else if (step === 'cam') void start(); };
    document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f);
  }, [step, start, stop]);
  useEffect(() => () => { tok.current++; stop(); }, [stop]);

  const gotPhoto = (url: string | null) => { if (!url) return; setPhoto(url); setStep('rev'); };
  const shoot = () => {
    const v = video.current; if (!stream.current || !v || !v.videoWidth) return;
    const s = Math.min(1, 1000 / Math.max(v.videoWidth, v.videoHeight)), c = document.createElement('canvas');
    c.width = Math.round(v.videoWidth * s); c.height = Math.round(v.videoHeight * s);
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/jpeg', .7);
    setWhite(w => w + 1);                    // l'éclair
    navigator.vibrate?.(20); stop(); setTimeout(() => gotPhoto(url), 280);
  };
  const toForm = () => { onClose(); openForm(id, { photo, note, date }); };

  const top = (left: React.ReactNode) => (
    <div className="fl-top">{left}<div className="fl-t"><b>{p.nom}</b><span>{typeLabel(p)} · {p.deptNom}</span></div>
      <button type="button" className="fl-btn txt" id="fl-fiche" onClick={toForm}>Fiche</button></div>);

  return (
    <div id="flash" className={step === 'cam' ? 'cam' : 'rev'} role="dialog" aria-label="Photo de la visite">
      {step === 'cam' ? <>
        {top(<button type="button" className="fl-btn" id="fl-x" aria-label="Fermer" onClick={onClose}><IcX /></button>)}
        <div className="fl-vf"><video id="fl-video" ref={video} autoPlay playsInline muted /><i className="cn tl" /><i className="cn tr" /><i className="cn bl" /><i className="cn br" />
          {msg && <div className="fl-msg" id="fl-msg"><b>{msg}</b><span>Vous pouvez quand même prendre la photo avec l'appareil de votre téléphone, ou la choisir dans la galerie.</span>
            <FileBtn kind="light" id="fl-nat" capture="environment" className="max-w-[260px] mt-2" onFile={async f => gotPhoto(await shrink(f))}>Ouvrir l'appareil photo</FileBtn></div>}
          <div className={'fl-white' + (white ? ' go' : '')} id="fl-white" key={white} /></div>
        <div className="fl-bar">
          <label className="fl-side" aria-label="Choisir dans la galerie"><IcGal /><input id="fl-gal" type="file" accept="image/*" hidden
            onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; gotPhoto(await shrink(f)); }} /></label>
          <button type="button" className="fl-shutter" id="fl-shot" aria-label="Prendre la photo" onClick={shoot} />
          <button type="button" className="fl-side" id="fl-flip" aria-label="Changer de caméra" hidden={!multi}
            onClick={() => setFacing(f => f === 'environment' ? 'user' : 'environment')}><IcFlip /></button>
        </div>
        <button type="button" className="fl-skip" id="fl-skip" onClick={() => { setPhoto(null); setStep('rev'); }}>Sans photo</button>
      </> : <>
        {top(<button type="button" className="fl-btn txt" id="fl-back" onClick={() => setStep('cam')}>‹ {photo ? 'Reprendre' : 'Photo'}</button>)}
        <div className="fl-rb">
          {photo ? <figure className="fl-card"><img src={photo} alt="Aperçu de la photo" /><figcaption><b>{p.nom}</b><span id="fl-cap">{longDate(date)}</span></figcaption></figure>
            : <div className="fl-card nop"><b>{p.nom}</b><span id="fl-cap">{longDate(date)}</span><span>Sans photo</span></div>}
          <Note id="fl-note" rows={3} maxLength={500} aria-label="Observations" placeholder="Une note ? (facultatif)" value={note} onChange={e => setNote(e.target.value)} />
          <label className="fl-date"><span>Date de la visite</span>
            <input type="date" id="fl-date" value={date} max={today()} onChange={e => { if (e.target.value) setDate(e.target.value); }} /></label>
        </div>
        <div className="fl-foot"><Btn id="fl-ok" onClick={() => commit({ id, date, note, photo })}>Valider la visite</Btn></div>
      </>}
    </div>
  );
}
