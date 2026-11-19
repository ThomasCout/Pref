import { useMemo } from 'react';
import { Input } from '@heroui/react';
import { BY_DEPT, PLACES, type Place } from '../lib/data';
import { getVisits, count } from '../lib/store';
import { norm } from '../lib/util';
import { useNav } from '../lib/nav';
import { Fiche } from '../components/Fiche';
import { Btn, Panel } from '../components/ui';
import { IcSearch } from '../components/Icons';

export const SORTL = { date: 'date de visite', alpha: 'ordre alphabétique', dept: 'département' };
export const keepFn = (filter: string) => (p: Place) => filter === 'all' ? true : filter === 'seen' ? !!getVisits()[p.id] : !getVisits()[p.id];

export function Registre() {
  const { ui, setUi, openForm, openDetail } = useNav();
  const visits = getVisits(), n = count();
  const list = useMemo(() => {
    let L = PLACES.filter(keepFn(ui.filter));
    if (ui.q) { const q = norm(ui.q); L = L.filter(p => p.recherche.includes(q) || norm(p.deptNom).includes(q) || p.dept === q); }
    if (ui.sort === 'alpha') L.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    else if (ui.sort === 'dept') L.sort((a, b) => a.dept.padStart(3, '0').localeCompare(b.dept.padStart(3, '0')) || a.nom.localeCompare(b.nom, 'fr'));
    else L.sort((a, b) => { const x = visits[a.id], y = visits[b.id];
      if (x && y) return y.date.localeCompare(x.date); if (x) return -1; if (y) return 1;
      return a.nom.localeCompare(b.nom, 'fr'); });
    return L;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.filter, ui.q, ui.sort, visits]);
  let cur: string | null = null;
  return (
    <>
      {!n && <Panel className="empty"><b>Registre vierge</b><p className="mut">Aucune visite déclarée pour le moment.</p>
        <Btn id="e-add" onClick={() => openForm(null)}>Déclarer une première visite</Btn></Panel>}
      <label className="search"><IcSearch />
        <Input id="q" type="search" aria-label="Rechercher une commune ou un département" placeholder="Rechercher une commune, un département"
          autoComplete="off" value={ui.q} onChange={e => setUi({ q: e.target.value })} className="flex-1 min-w-0 border-0 bg-transparent px-0 shadow-none h-auto text-[14px]" /></label>
      <div className="seg" role="group" aria-label="Filtrer">
        {([['all', 'Toutes'], ['seen', 'Vues'], ['todo', 'Restantes']] as const).map(x =>
          <button key={x[0]} type="button" data-f={x[0]} className={ui.filter === x[0] ? 'on' : ''} onClick={() => setUi({ filter: x[0] })}>{x[1]}</button>)}
      </div>
      <div className="listhead"><span id="l-count">{list.length} fiche{list.length > 1 ? 's' : ''}</span><span>tri : {SORTL[ui.sort]}</span></div>
      <div id="list">
        {!list.length && <p className="mut" style={{ margin: '8px 2px' }}>Aucune fiche ne correspond.</p>}
        {list.map(p => {
          let head = null;
          if (ui.sort === 'dept' && p.dept !== cur) {
            cur = p.dept; const all = BY_DEPT[cur], vu = all.filter(x => visits[x.id]).length;
            head = <div className="sec" key={'h' + cur}><span>{p.deptNom} ({cur})</span><span>{vu}/{all.length}</span></div>;
          }
          return <span key={p.id} style={{ display: 'contents' }}>{head}<Fiche p={p} onOpen={openDetail} /></span>;
        })}
      </div>
    </>
  );
}
