const { chromium } = require('playwright');
let fails=0; const ok=(c,m)=>{ if(!c){fails++;console.log('ECHEC',m);} else console.log('ok',m); };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({viewport:{width:390,height:800}}); const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.route(/supabase|wikipedia|geo\.api|tile\.|geopf|fonts\.g/, r=>r.abort());
  await p.goto('http://localhost:4173/');
  await p.evaluate(()=>navigator.serviceWorker.ready); ok(true,'service worker actif');
  await p.waitForTimeout(1500);
  const names=await p.evaluate(async()=>{const k=await caches.keys();const c=await caches.open(k[0]);return {k,n:(await c.keys()).length};});
  ok(names.n>=8,'cache de l\'app rempli ('+names.n+' fichiers, '+names.k[0]+')');
  const man=await p.evaluate(async()=>{const l=document.querySelector('link[rel=manifest]').href;const m=await (await fetch(l)).json();
    const ic=await Promise.all(m.icons.map(i=>fetch(new URL(i.src,l)).then(r=>r.ok)));return {name:m.name,short:m.short_name,display:m.display,icons:ic};});
  ok(man.name==="L'apPréfet"&&man.icons.every(Boolean)&&man.display==='standalone','manifeste valide : '+man.name+', icônes OK');
  await ctx.setOffline(true); await p.reload(); await p.waitForSelector('#cv-open',{timeout:8000}); ok(true,'hors ligne : l\'app se recharge');
  await p.click('#cv-open'); ok((await p.locator('.fiche').count())>0,'hors ligne : registre affiché');
  await p.click('nav [data-tab=dossier]'); ok((await p.textContent('.kpis')).includes('47'),'hors ligne : carnet disponible');
  console.log('erreurs page:',errs.length?errs:'aucune'); console.log(fails?'ÉCHECS '+fails:'TOUT PASSE'); await b.close();
})().catch(e=>{console.log('EXCEPTION',e.message.split('\n')[0]);process.exit(1)});
