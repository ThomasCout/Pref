const { chromium } = require('playwright');
let fails=0; const ok=(c,m)=>{ if(!c){fails++;console.log('ECHEC',m);} else console.log('ok',m); };
const vis=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('carnet.visits')));
(async () => {
  const b = await chromium.launch({ args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'] });
  const ctx = await b.newContext({ viewport:{width:390,height:800}, permissions:['camera'] });
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.route(/supabase|wikipedia|geo\.api|tile\.|geopf/, r=>r.abort());
  p.on('dialog', d=>d.accept());
  await p.addInitScript(()=>{ window.__RETRO_MS=250; window.__RETRO_NOTE_MS=100; });
  await p.goto('http://localhost:4173/'); await p.click('#cv-open');
  /* caméra : photo */
  await p.fill('#q','agen'); await p.click('.fiche'); await p.click('#fab');
  await p.waitForSelector('#flash.cam'); ok(true,'caméra : écran Flash ouvert');
  await p.waitForFunction(()=>{const v=document.getElementById('fl-video');return v&&v.videoWidth>0;},null,{timeout:8000});
  ok(true,'caméra : flux vidéo actif');
  await p.click('#fl-shot'); await p.waitForSelector('#flash.rev'); ok(!!(await p.$('.fl-card img')),'caméra : aperçu de la photo');
  const live=await p.evaluate(()=>!!document.getElementById('fl-video')); ok(!live,'caméra : flux coupé après la prise');
  await p.fill('#fl-note','Vu sur place'); await p.click('#fl-ok');
  await p.waitForSelector('#hit .st-ph'); ok(true,'cachet VISITÉ avec la photo');
  await p.waitForSelector('#hit',{state:'detached',timeout:4000});
  let v=await vis(p); const id=Object.keys(v).find(k=>v[k].note==='Vu sur place');
  ok(id && /^data:image\/jpeg;base64,/.test(v[id].photo),'photo JPEG enregistrée');
  /* sans photo */
  await p.fill('#q','lyon'); await p.click('.fiche'); await p.click('#fab'); await p.waitForSelector('#flash.cam');
  await p.click('#fl-skip'); await p.waitForSelector('#flash.rev .nop'); ok(true,'caméra : « Sans photo »');
  await p.click('#fl-fiche'); await p.waitForSelector('#modal'); ok((await p.inputValue('#f-q')).length>0,'« Fiche » : formulaire prérempli');
  await p.click('#f-close');
  /* albums */
  await p.click('nav [data-tab=dossier]'); await p.click('#d-album'); await p.waitForSelector('.alb');
  const n1=await p.locator('.alb').count(); ok(n1===48,'album : 48 visites ('+n1+')');
  const first=await p.textContent('.alb h3'); await p.click('.seg [data-o=desc]');
  ok((await p.textContent('.alb h3'))!==first,'album : ordre inversé');
  await p.click('.alb >> nth=0'); await p.waitForSelector('.dstat'); await p.click('#h-act'); await p.waitForSelector('.alb');
  ok(true,'album : retour depuis une fiche');
  /* rétrospective */
  await p.click('#d-retro'); await p.waitForSelector('#retro'); ok(true,'rétrospective : lancée');
  await p.click('#rt-pp'); ok((await p.getAttribute('#rt-pp','aria-label'))==='Reprendre','rétrospective : pause');
  await p.click('#rt-pp'); await p.waitForSelector('.rs-outro',{timeout:30000}); ok(true,'rétrospective : arrive au bilan');
  await p.click('#rt-again'); await p.waitForSelector('.rs-intro'); ok(true,'rétrospective : revoir');
  await p.keyboard.press('Escape'); await p.waitForSelector('#retro',{state:'detached'}); ok(true,'rétrospective : fermée (Échap)');
  console.log('erreurs page:',errs.length?errs:'aucune'); console.log(fails?'ÉCHECS '+fails:'TOUT PASSE'); await b.close();
})().catch(e=>{console.log('EXCEPTION',e.message.split('\n')[0]);process.exit(1)});
