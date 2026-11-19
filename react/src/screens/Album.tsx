import { PLACES, typeLabel } from '../lib/data';
import { getVisits } from '../lib/store';
import { longDate, shortDate } from '../lib/util';
import { useNav } from '../lib/nav';
import { Empty } from '../components/ui';
import { IcCheck, IcPlay } from '../components/Icons';
import { Hero } from '../components/Hero';
void Hero;

export function Album({ scrollRef }: { scrollRef: React.MutableRefObject<number> }) {
  const { ui, setUi, startRetro, openDetail } = useNav();
  const visits = getVisits(), asc = ui.albumAsc;
  const list = PLACES.filter(p => visits[p.id]).sort((a, b) => {
    const d = visits[a.id].date.localeCompare(visits[b.id].date) || a.nom.localeCompare(b.nom, 'fr');
    return asc ? d : -d; });
  if (!list.length) return <Empty title="Album vide" text="Vos visites apparaîtront ici, avec leurs photos." />;
  const dates = list.map(p => visits[p.id].date).sort(), n = list.length;
  const depts = new Set(list.map(p => p.dept)).size, photos = list.filter(p => visits[p.id].photo).length;
  let month: string | null = null;
  return (
    <>
      <div className="hero"><div className="hero-txt"><div className="eyebrow">Récapitulatif</div>
        <div className="hero-g">{n} lieu{n > 1 ? 'x' : ''} visité{n > 1 ? 's' : ''}</div>
        <p>{dates[0] === dates[n - 1] ? 'Le ' + longDate(dates[0]) : 'Du ' + longDate(dates[0]) + ' au ' + longDate(dates[n - 1])}</p>
        <p style={{ marginTop: 3 }}>{depts} département{depts > 1 ? 's' : ''} · {photos} photo{photos > 1 ? 's' : ''}</p></div></div>
      <button type="button" className="cta play" id="d-retro" style={{ margin: '12px 0 0' }} onClick={startRetro}>
        <span className="ic"><IcPlay w={24} /></span>
        <span style={{ flex: 1, minWidth: 0 }}><b>Lancer la rétrospective</b><span className="mut">Diaporama automatique de vos visites</span></span></button>
      <div className="seg" role="group" aria-label="Ordre de l'album">
        <button type="button" data-o="asc" className={asc ? 'on' : ''} onClick={() => { scrollRef.current = 0; setUi({ albumAsc: true }); }}>Plus anciennes</button>
        <button type="button" data-o="desc" className={asc ? '' : 'on'} onClick={() => { scrollRef.current = 0; setUi({ albumAsc: false }); }}>Plus récentes</button>
      </div>
      {list.map(p => {
        const vis = visits[p.id], m = vis.date.slice(0, 7); let head = null;
        if (m !== month) { month = m; const [y, mo] = m.split('-').map(Number);
          head = <div className="sec"><span>{new Date(y, mo - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span></div>; }
        return (
          <span key={p.id} style={{ display: 'contents' }}>{head}
            <button type="button" className="alb" data-id={p.id} onClick={() => openDetail(p.id)}>
              <div className={'alb-ph' + (vis.photo ? '' : ' none')}>
                {vis.photo ? <img loading="lazy" decoding="async" src={vis.photo} alt={'Photo de la visite : ' + p.nom} /> : <span className="alb-ph0">{p.dept}</span>}
              </div>
              <div className="alb-b"><div className="alb-h"><h3>{p.nom}</h3><span className="achip on"><IcCheck />{shortDate(vis.date)}</span></div>
                <p className="mut">{typeLabel(p)} · {p.deptNom}</p>
                {vis.note && <p className="alb-n">{vis.note}</p>}</div>
            </button>
          </span>
        );
      })}
    </>
  );
}
