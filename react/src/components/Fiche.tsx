import { type Place, typeLabel } from '../lib/data';
import { getVisits } from '../lib/store';
import { shortDate } from '../lib/util';
import { IcCheck } from './Icons';

export function Fiche({ p, onOpen }: { p: Place; onOpen: (id: string) => void }) {
  const v = getVisits()[p.id];
  return (
    <button type="button" className="fiche" data-id={p.id} onClick={() => onOpen(p.id)}>
      <span className={'pbadge ' + (v ? '' : 'todo')}>{v && v.photo ? <img src={v.photo} alt="" /> : p.dept}</span>
      <span className="ft"><h3>{p.nom}</h3><p>{typeLabel(p)} · {p.deptNom}{p.arrondissement ? ' · arr. ' + p.arrondissement : ''}</p></span>
      {v ? <span className="achip on"><IcCheck />{shortDate(v.date)}</span> : <span className="achip">À voir</span>}
    </button>
  );
}
export const Kpi = ({ n, label, accent }: { n: string | number; label: string; accent?: boolean }) => (
  <div className="kpi"><b style={accent ? { color: 'var(--accent)' } : undefined}>{n}</b><span>{label}</span></div>
);
export const Sec = ({ a, b }: { a: string; b?: string }) => <div className="sec"><span>{a}</span>{b !== undefined && <span>{b}</span>}</div>;
