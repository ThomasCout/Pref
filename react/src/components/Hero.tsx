import { ACC_LIGHT, GRADES, TOTAL, gradeOf, nextGrade } from '../lib/data';
import { Ring } from './Ring';
void GRADES;
export function Hero({ n }: { n: number }) {
  const g = gradeOf(n), nx = nextGrade(n);
  const prog = nx ? (g ? (n - g[2]) / (nx[2] - g[2]) : n / nx[2]) : 1;
  return (
    <div className="hero">
      <div className="hero-ring"><Ring pct={n / TOTAL} size={76} stroke={7} track="rgba(255,255,255,.14)" color={ACC_LIGHT} /><b>{Math.round(n / TOTAL * 100)} %</b></div>
      <div className="hero-txt">
        <div className="eyebrow">Grade actuel</div>
        <div className="hero-g">{g ? g[1] : 'Sans grade'}</div>
        <div className="bar"><i style={{ width: Math.max(3, Math.min(100, prog * 100)).toFixed(0) + '%' }} /></div>
        <p>{n} sur {TOTAL} · {nx ? 'encore ' + (nx[2] - n) + ' avant ' + nx[1] : 'carnet complet'}</p>
      </div>
    </div>
  );
}
