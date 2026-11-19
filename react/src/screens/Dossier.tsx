import { GRADES, PLACES, PREFS, SOUS, TOTAL, gradeOf } from '../lib/data';
import { count, getVisits } from '../lib/store';
import { useNav } from '../lib/nav';
import { Hero } from '../components/Hero';
import { Kpi, Sec } from '../components/Fiche';
import { Panel } from '../components/ui';
import { IcAlbum, IcChevron } from '../components/Icons';

const pct = (a: number, b: number) => b ? Math.round(a / b * 100) : 0;
export function AlbumCta() {
  const { push } = useNav(); const n = count();
  return (
    <button type="button" className="cta" id="d-album" disabled={!n} onClick={() => push({ k: 'album' })}>
      <span className="ic"><IcAlbum /></span>
      <span style={{ flex: 1, minWidth: 0 }}><b>Mon album</b><span className="mut">{n ? n + ' visite' + (n > 1 ? 's' : '') + ' en images, par ordre chronologique' : 'Disponible dès votre première visite'}</span></span>
      {n ? <IcChevron /> : null}
    </button>
  );
}
export function Dossier() {
  const visits = getVisits(), n = count(), g = gradeOf(n);
  const vp = PREFS.filter(p => visits[p.id]).length, vs = SOUS.filter(p => visits[p.id]).length;
  const regs: Record<string, [number, number]> = {};
  PLACES.forEach(p => { regs[p.region] = regs[p.region] || [0, 0]; regs[p.region][1]++; if (visits[p.id]) regs[p.region][0]++; });
  return (
    <>
      <Hero n={n} /><AlbumCta />
      <div className="kpis"><Kpi n={n} label="Visitées" accent /><Kpi n={TOTAL - n} label="Restantes" /></div>
      <Sec a="Répartition" b={pct(n, TOTAL) + ' % du territoire'} />
      <Panel>
        <div className="row"><span>Préfectures</span><b>{vp}/{PREFS.length}</b></div><div className="bar"><i style={{ width: pct(vp, PREFS.length) + '%' }} /></div>
        <div className="row" style={{ marginTop: 14 }}><span>Sous-préfectures</span><b>{vs}/{SOUS.length}</b></div><div className="bar"><i style={{ width: pct(vs, SOUS.length) + '%' }} /></div>
      </Panel>
      <Sec a="Tableau des grades" b={'niveau ' + (g ? g[0] : 0) + ' sur 11'} />
      <Panel>{GRADES.map(x => { const ok = n >= x[2];
        return <div className="line" key={x[0]} style={ok ? undefined : { opacity: .55 }}><span>{ok ? '✓ ' : ''}{x[1]}</span>
          <b style={{ color: ok ? 'var(--accent)' : 'var(--ink2)' }}>{x[2]}</b></div>; })}</Panel>
      <Sec a="Couverture par région" />
      <Panel>{Object.entries(regs).sort((a, b) => b[1][0] / b[1][1] - a[1][0] / a[1][1]).map(([r, [a, b]]) =>
        <div key={r} style={{ marginBottom: 12 }}><div className="row" style={{ fontSize: 13 }}><span>{r}</span><b>{a}/{b}</b></div>
          <div className="bar" style={{ height: 5 }}><i style={{ width: pct(a, b) + '%' }} /></div></div>)}</Panel>
    </>
  );
}
