import { useMemo, useState } from 'react';
import { BY_ID, PLACES, typeLabel } from '../lib/data';
import { count, getVisits } from '../lib/store';
import { norm, today } from '../lib/util';
import { shrink } from '../lib/photo';
import { useNav, type Draft } from '../lib/nav';
import { Btn, Field, FileBtn, Note, Panel } from '../components/ui';
import { Sec } from '../components/Fiche';

/* fiche de visite (formulaire complet) */
export function Form({ id, pre, onClose }: { id: string | null; pre?: Partial<Draft>; onClose: () => void }) {
  const { commit } = useNav();
  const visits = getVisits(), v = id ? visits[id] : undefined;
  const [d, setD] = useState<Draft>({ id, date: v ? v.date : today(), note: v ? v.note : '', photo: v ? v.photo : null, ...pre });
  const [q, setQ] = useState(id ? BY_ID[id].nom : ''), [open, setOpen] = useState(false);
  const p = d.id ? BY_ID[d.id] : null, cur = p && visits[p.id];
  const nq = norm(q);
  const sugg = useMemo(() => !nq || d.id ? [] : PLACES.filter(x => x.recherche.includes(nq)).sort((a, b) =>
    (a.recherche.startsWith(nq) ? 0 : 1) - (b.recherche.startsWith(nq) ? 0 : 1) || a.nom.localeCompare(b.nom, 'fr')).slice(0, 30), [nq, d.id]);
  const set = (x: Partial<Draft>) => setD(o => ({ ...o, ...x }));
  const onPhoto = async (f: File | undefined) => { const u = await shrink(f); if (u) set({ photo: u }); };
  return (
    <div id="modal" role="dialog" aria-label="Fiche de visite">
      <header><div><div className="brand">Préfectures de France</div><h1>Fiche de visite</h1></div>
        <button type="button" className="pill" id="f-close" onClick={onClose}>Annuler</button></header>
      <div className="mbody">
        <div className="sec"><span>1. Lieu</span><span id="f-req">{p ? 'verrouillé' : 'obligatoire'}</span></div>
        <Field id="f-q" aria-label="Lieu" placeholder="Rechercher une préfecture ou sous-préfecture" autoComplete="off" value={q}
          onFocus={() => setOpen(true)} onChange={e => { setQ(e.target.value); set({ id: null }); setOpen(true); }} />
        {open && !d.id && nq && (
          <div className="sug" id="f-sug">
            {!sugg.length && <div className="none">Aucun lieu du référentiel ne correspond</div>}
            {sugg.map(x => <button type="button" key={x.id} data-id={x.id} className={visits[x.id] ? 'seen' : ''}
              onClick={() => { set({ id: x.id }); setQ(x.nom); setOpen(false); }}>{x.nom}{visits[x.id] ? ' · déjà vu' : ''}
              <small>{typeLabel(x)} · {x.deptNom} ({x.dept})</small></button>)}
          </div>)}
        <div id="f-sel">{p && <Panel className="mt-2"><b style={{ font: "700 16px 'Space Grotesk',sans-serif" }}>{p.nom}</b>
          <div className="mut">{typeLabel(p)} · {p.deptNom} ({p.dept})</div></Panel>}</div>
        <Sec a="2. Date de la visite" />
        <Field id="f-date" type="date" aria-label="Date" value={d.date} max={today()} onChange={e => set({ date: e.target.value })} />
        <Sec a="3. Observations" b={d.note.length > 400 ? d.note.length + '/500' : ''} />
        <Note id="f-note" aria-label="Observations" rows={3} maxLength={500} placeholder="Facultatif" value={d.note} onChange={e => set({ note: e.target.value })} />
        <Sec a="4. Photo" />
        <div id="f-photo">{d.photo
          ? <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <img src={d.photo} alt="Aperçu" style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 14, border: '1px solid var(--line)' }} />
              <Btn kind="alt" id="f-rm" fullWidth={false} onClick={() => set({ photo: null })}>Retirer</Btn></div>
          : <div className="vstack"><FileBtn id="f-file" capture="environment" onFile={onPhoto}>Prendre une photo</FileBtn>
              <FileBtn id="f-file2" onFile={onPhoto}>Choisir dans la galerie</FileBtn></div>}</div>
        <p className="mut" id="f-num" style={{ textAlign: 'center', marginTop: 16 }}>{p ? 'Enregistrement ' + p.dept + '-' + p.codeInsee + '-' + String(cur ? count() : count() + 1).padStart(3, '0') : ''}</p>
      </div>
      <div className="mfoot"><Btn id="f-ok" isDisabled={!(d.id && d.date)} onClick={() => commit(d)}>{cur ? 'Mettre à jour la fiche' : 'Enregistrer la visite'}</Btn></div>
    </div>
  );
}
