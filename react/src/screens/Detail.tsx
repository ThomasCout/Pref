import { useEffect, useState } from 'react';
import { BY_ID, typeLabel } from '../lib/data';
import { getVisits, removeVisit } from '../lib/store';
import { loadInfo, forgetInfo, type Info } from '../lib/info';
import { longDate } from '../lib/util';
import { useNav } from '../lib/nav';
import { Btn, Panel } from '../components/ui';
import { IcCheck, IcCircle } from '../components/Icons';
import { Kpi, Sec } from '../components/Fiche';

const fmt = (n: number, d?: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: d || 0 });

export function Detail({ id }: { id: string }) {
  const { pop } = useNav();
  const p = BY_ID[id], v = getVisits()[id];
  const [info, setInfo] = useState<Info | null>(null);
  const [heroOk, setHeroOk] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true; setInfo(null); setHeroOk(false);
    loadInfo(p).catch(() => ({ t: 0 } as Info)).then(c => {
      if (!alive) return; setInfo(c);
      const ph = c.wiki && c.wiki.photo;
      if (ph) { const img = new Image(); img.onload = () => { if (alive) setHeroOk(true); }; img.src = ph.src; }
    });
    return () => { alive = false; };
  }, [p, tick]);

  const g = info && info.geo, w = info && info.wiki, ph = w && w.photo;
  const del = () => {
    if (!confirm('Cette fiche sera retirée du registre. Confirmer ?')) return;
    if (!removeVisit(id)) { alert('Suppression impossible : le stockage du navigateur est inaccessible.'); return; }
    pop();
  };
  return (
    <>
      {heroOk && ph && <div className="phero" id="phero" data-id={id}>
        <img src={ph.src} alt={ph.kind === 'prefecture' ? 'Hôtel de préfecture, ' + p.nom : 'Vue de ' + p.nom} />
        {ph.page && <a className="cap" href={ph.page} target="_blank" rel="noopener noreferrer">Photo : Wikipédia</a>}
      </div>}
      <div className="dhead"><h2>{p.nom}</h2>
        <p className="mut">{typeLabel(p)} · {p.deptNom} ({p.dept}) · {p.region}{p.arrondissement && <><br />Arrondissement de {p.arrondissement}</>}</p></div>
      <div className={'dstat ' + (v ? '' : 'todo')}>
        <span className="ic">{v ? <IcCheck w={22} /> : <IcCircle />}</span>
        <div><b>{v ? 'Vue le ' + longDate(v.date) : 'Pas encore visitée'}</b>
          <span className="mut">{v ? 'Enregistrée dans votre carnet' : 'Touchez le bouton + pour la déclarer'}</span></div>
      </div>
      {v && v.photo && <img className="dphoto" src={v.photo} alt="Photo de la visite" />}
      {v && v.note && <><Sec a="Observations" /><p className="note">{v.note}</p></>}
      <div id="info-slot" data-id={id}>
        {!info && <p className="mut" style={{ marginTop: 16 }}>Chargement des informations…</p>}
        {info && <>
          {g && <><Sec a="La ville en chiffres" b="INSEE" />
            <div className="kpis" style={{ marginTop: 0 }}>
              <Kpi n={fmt(g.pop)} label="Habitants" />
              {g.km2 && <><Kpi n={fmt(g.km2, 1)} label="km² de superficie" /><Kpi n={fmt(g.pop / g.km2)} label="habitants par km²" /></>}
              <Kpi n={p.dept} label={p.deptNom} />
            </div></>}
          {w && w.text && <><Sec a="À propos" /><p className="about">{w.text}</p>
            {w.page && <p className="about-credit"><a href={w.page} target="_blank" rel="noopener noreferrer">Lire la suite sur Wikipédia</a></p>}</>}
          {!g && !(w && w.text) && <><p className="mut" style={{ marginTop: 16 }}>Informations indisponibles pour le moment{navigator.onLine === false ? ' (hors connexion)' : ''}.</p>
            <Btn kind="alt" id="i-retry" onClick={() => { forgetInfo(id); setTick(t => t + 1); }}>Réessayer</Btn></>}
        </>}
      </div>
      <Sec a="Adresse officielle" />
      <Panel><p style={{ fontSize: 15 }}>{p.adresse || <span className="mut">non renseignée</span>}<br />{p.codePostal} {p.nom}</p>
        <p className="mut" style={{ marginTop: 8 }}>Coordonnées {p.lat}, {p.lng} · INSEE {p.codeInsee}</p></Panel>
      <div className="vstack" style={{ margin: '16px 0 72px' }}>
        <a className="btn alt" target="_blank" rel="noopener noreferrer" href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`}>Ouvrir dans un plan</a>
        {v && <Btn kind="warn" id="d-del" onClick={del}>Retirer du registre</Btn>}
      </div>
    </>
  );
}
