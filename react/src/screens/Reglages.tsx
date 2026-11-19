import { useEffect, useRef, useState } from 'react';
import { BY_ID, PREFS, SOUS, TOTAL } from '../lib/data';
import { cleanVisit, clearAll, count, getLastOk, getVisits, importVisits, passwordAuth, reseed, session, sb, signOut, sync, syncStatus, type Visits } from '../lib/store';
import { hhmm, today } from '../lib/util';
import { Btn, Field, FileBtn, Panel } from '../components/ui';
import { Sec } from '../components/Fiche';

interface InstallEvt extends Event { prompt: () => Promise<void>; userChoice: Promise<unknown> }
let installEvt: InstallEvt | null = null;
const listeners = new Set<() => void>();
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e as InstallEvt; listeners.forEach(f => f()); });
window.addEventListener('appinstalled', () => { installEvt = null; listeners.forEach(f => f()); });
const isStandalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (navigator as unknown as { standalone?: boolean }).standalone === true;

function exportCarnet() {
  const data = { app: 'prefectures-carnet', version: 1, exportedAt: new Date().toISOString(), visits: getVisits() };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'carnet-' + today() + '.carnet';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function importCarnet(file: File | undefined) {
  if (!file) return;
  const rd = new FileReader();
  rd.onerror = () => alert('Impossible de lire ce fichier.');
  rd.onload = () => {
    let data: { visits?: Record<string, unknown> } | null;
    try { data = JSON.parse(rd.result as string); } catch { alert("Ce fichier n'est pas un carnet valide."); return; }
    const src = data && data.visits && typeof data.visits === 'object' ? data.visits : null;
    if (!src) { alert("Ce fichier n'est pas un carnet valide."); return; }
    const add: Visits = {};
    for (const id of Object.keys(src)) { const c = BY_ID[id] && cleanVisit(src[id]); if (c) add[id] = c; }
    const k = Object.keys(add).length;
    if (!k) { alert('Aucune visite exploitable dans ce fichier.'); return; }
    if (!confirm('Importer ' + k + ' visite' + (k > 1 ? 's' : '') + ' ? Les fiches déjà présentes seront remplacées par celles du fichier.')) return;
    if (!importVisits(add)) alert("Import impossible : espace de stockage insuffisant.");
  };
  rd.readAsText(file);
}

function SyncCard() {
  const [mail, setMail] = useState(''), [pw, setPw] = useState(''), [busy, setBusy] = useState(false);
  const lastOk = getLastOk();
  if (!sb) return <Panel><p className="mut">Synchronisation non configurée. En attendant, le carnet reste sur cet appareil.</p></Panel>;
  if (!session) {
    const go = async (create: boolean) => { setBusy(true); await passwordAuth(mail, pw, create); setBusy(false); };
    return (
      <Panel>
        <p className="mut" style={{ marginBottom: 12 }}>Retrouvez votre carnet sur tous vos appareils : connectez-vous, ou créez un compte avec un e-mail et un mot de passe.</p>
        <form id="s-form" noValidate onSubmit={e => { e.preventDefault(); void go(false); }}>
          <Field id="s-mail" type="email" inputMode="email" autoComplete="username" aria-label="Adresse e-mail" placeholder="vous@exemple.fr" value={mail} onChange={e => setMail(e.target.value)} />
          <Field id="s-pw" type="password" autoComplete="current-password" aria-label="Mot de passe" placeholder="Mot de passe (8 caractères minimum)" value={pw} onChange={e => setPw(e.target.value)} className="mt-2" />
          <div className="vstack" style={{ marginTop: 12 }}>
            <Btn type="submit" isDisabled={busy}>Se connecter</Btn>
            <Btn kind="alt" id="s-up" isDisabled={busy} onClick={() => { void go(true); }}>Créer un compte</Btn>
          </div>
        </form>
        <p className="mut" id="sync-status" style={{ marginTop: 10 }}>{syncStatus}</p>
      </Panel>
    );
  }
  return (
    <Panel>
      <p style={{ fontSize: 15 }}>Connecté : <b>{session.user.email || ''}</b></p>
      <p className="mut" id="sync-status" style={{ margin: '6px 0 12px' }}>{syncStatus || (lastOk ? 'Dernière synchro à ' + hhmm(lastOk) : '')}</p>
      <div className="vstack"><Btn id="s-now" onClick={() => { void sync(); }}>Synchroniser maintenant</Btn>
        <Btn kind="alt" id="s-out" onClick={() => { void signOut(); }}>Se déconnecter</Btn></div>
    </Panel>
  );
}
function AppCard() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force(x => x + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  if (!/^https?:$/.test(location.protocol)) return null;
  return (
    <>
      <Sec a="Application" />
      <Panel>
        {isStandalone() ? <p className="mut">Le carnet est installé sur cet appareil et fonctionne en plein écran.</p>
          : installEvt ? <><p className="mut" style={{ marginBottom: 12 }}>Installez le carnet sur votre écran d'accueil : icône dédiée, plein écran, et accès même sans connexion.</p>
            <Btn id="a-install" onClick={() => { const ev = installEvt; if (!ev) return; installEvt = null; force(x => x + 1);
              Promise.resolve(ev.prompt()).then(() => ev.userChoice).catch(() => {}); }}>Installer l'application</Btn></>
          : <p className="mut">Pour installer le carnet comme une application : sur Android, menu ⋮ de Chrome puis « Installer l'application » ; sur iPhone, bouton Partager de Safari puis « Sur l'écran d'accueil ».</p>}
      </Panel>
    </>
  );
}

export function Reglages() {
  const n = count(), ph = Object.values(getVisits()).filter(x => x.photo).length;
  const impRef = useRef<HTMLInputElement>(null); void impRef;
  return (
    <>
      <div className="sec" style={{ marginTop: 4 }}><span>Synchronisation</span></div>
      <SyncCard />
      <AppCard />
      <Sec a="Sauvegarde" />
      <Panel>
        <p className="mut" style={{ marginBottom: 12 }}>Archive <b>.carnet</b> contenant vos visites et leurs photos. {n} visite{n > 1 ? 's' : ''}, {ph} photo{ph > 1 ? 's' : ''}.</p>
        <div className="vstack"><Btn kind="alt" id="r-exp" onClick={exportCarnet}>Exporter le carnet</Btn>
          <FileBtn id="r-imp" accept=".carnet,.json,application/json" onFile={importCarnet}>Importer un carnet</FileBtn></div>
      </Panel>
      <Sec a="Référentiel" />
      <Panel><p className="mut">{TOTAL} lieux embarqués : {PREFS.length} préfectures et {SOUS.length} sous-préfectures, sur 102 départements. Source : annuaire de l'administration, Etalab, licence ouverte.</p></Panel>
      <Sec a="Données de démonstration" />
      <Panel>
        <p className="mut" style={{ marginBottom: 12 }}>Les visites affichées au premier lancement sont des données de démonstration. Les lieux, adresses et coordonnées sont authentiques.</p>
        <div className="vstack"><Btn kind="warn" id="r-reset" onClick={() => { if (confirm('Vider entièrement le carnet ?' + (session ? ' Il sera aussi vidé sur votre compte.' : ''))) clearAll(); }}>Vider le carnet</Btn>
          {!session && <Btn kind="alt" id="r-seed" onClick={() => { if (confirm('Remplacer le carnet actuel par les visites de démonstration ?')) reseed(); }}>Recharger les visites de démonstration</Btn>}</div>
      </Panel>
      <Sec a="À propos" />
      <Panel><p className="mut">L'apPréfet, v1.0 (React · HeroUI). Application non officielle, sans lien avec le ministère de l'Intérieur. Vos données restent sur cet appareil, sauf si vous activez la synchronisation : elles sont alors stockées sur votre compte Supabase, visibles de vous seul. Les tuiles de la carte sont chargées depuis OpenStreetMap / IGN.</p></Panel>
    </>
  );
}
