const { chromium } = require('playwright');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
let fails=0; const ok=(c,m)=>{ if(!c){fails++;console.log('ECHEC',m);} else console.log('ok',m); };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:390,height:800} });
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let wikiMode='bordeaux', tileHits={osm:0,ign:0};
  await p.route(/supabase/, r=>r.abort());
  await p.route(/geo\.api\.gouv\.fr/, r=>r.fulfill({json:{nom:'X',population:260000,surface:4936}}));
  await p.route(/fr\.wikipedia\.org/, r=>{
    if(wikiMode==='fail') return r.abort();
    const u=decodeURIComponent(r.request().url());
    const bdx=/Bordeaux/.test(u);
    if(/generator=search/.test(u)) return r.fulfill({json:{}});
    const pg = bdx ? {title:'Bordeaux',description:'Commune de la Gironde',extract:'Bordeaux est une commune.',fullurl:'https://fr.wikipedia.org/wiki/Bordeaux',thumbnail:{source:'https://thumb.wikimedia.org/x/Bordeaux.jpg'}}
                   : {title:'Agen',description:'Commune de Lot-et-Garonne',extract:'Agen est une commune.',fullurl:'https://fr.wikipedia.org/wiki/Agen'};
    r.fulfill({json:{query:{pages:{1:pg}}}});
  });
  await p.route(/thumb\.wikimedia\.org/, r=>r.fulfill({body:PNG,contentType:'image/png'}));
  await p.route(/tile\.openstreetmap\.org/, r=>{tileHits.osm++; r.abort();});
  await p.route(/data\.geopf\.fr/, r=>{tileHits.ign++; r.fulfill({body:PNG,contentType:'image/png'});});
  p.on('dialog', d=>d.accept());
  await p.goto('http://localhost:4173/');
  ok((await p.textContent('#cv-n'))==='47','couverture : 47 visites');
  await p.click('#cv-open');
  ok((await p.textContent('#l-count')).startsWith('335'),'registre : 335 fiches');
  await p.click('.seg [data-f=seen]'); ok((await p.textContent('#l-count')).startsWith('47'),'filtre Vues : 47');
  await p.click('.seg [data-f=todo]'); ok((await p.textContent('#l-count')).startsWith('288'),'filtre Restantes : 288');
  await p.click('.seg [data-f=all]');
  await p.fill('#q','bordeaux'); ok((await p.textContent('#l-count')).startsWith('1 fiche'),'recherche bordeaux');
  await p.click('#h-act'); ok((await p.textContent('.listhead')).includes('alphabétique'),'tri : alphabétique');
  /* fiche avec photo */
  await p.click('.fiche'); await p.waitForSelector('#phero',{timeout:5000}).catch(()=>{});
  ok(!!(await p.$('#phero img')),'fiche Bordeaux : photo thumb.wikimedia.org affichée');
  ok((await p.textContent('#info-slot')).includes('260'),'fiche : habitants INSEE');
  ok((await p.textContent('#info-slot')).includes('Bordeaux est une commune'),'fiche : texte Wikipédia');
  ok(!!(await p.$('#fab')),'fiche : bouton rond présent');
  await p.click('#h-act'); await p.waitForSelector('#list');
  /* fiche sans photo */
  await p.fill('#q','agen'); await p.click('.fiche'); await p.waitForTimeout(1200);
  ok(!(await p.$('#phero')),'fiche Agen : aucun encart photo');
  /* échec réseau + réessayer */
  wikiMode='fail'; await p.click('#h-act'); await p.fill('#q','lyon'); await p.click('.fiche');
  await p.waitForTimeout(1200);
  ok(!!(await p.$('#i-retry')) || (await p.textContent('#info-slot')).includes('Habitants'),'fiche : repli si Wikipédia échoue');
  await p.click('#h-act');
  /* ajout via formulaire */
  await p.fill('#q',''); await p.click('#fab'); await p.fill('#f-q','Agen'); await p.waitForSelector('#f-sug button');
  await p.click('#f-sug button >> nth=0');
  await p.fill('#f-note','Test note'); await p.click('#f-ok');
  await p.waitForSelector('#hit .st-mark',{timeout:3000});
  ok(true,'cachet VISITÉ affiché');
  await p.waitForSelector('#hit',{state:'detached',timeout:4000});
  ok((await p.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('carnet.visits'))).length))===48,'stockage : 48 visites');
  const keys=await p.evaluate(()=>Object.keys(localStorage)); ok(keys.includes('carnet.visits'),'clé carnet.visits conservée');
  /* retrait */
  await p.fill('#q','agen'); await p.click('.fiche'); await p.click('#d-del'); await p.waitForSelector('#list');
  ok((await p.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('carnet.visits'))).length))===47,'retrait : 47 visites');
  /* carte */
  await p.click('nav [data-tab=carte]'); await p.waitForSelector('#map canvas');
  ok(true,'carte : canvas Leaflet'); await p.waitForTimeout(1500);
  ok(tileHits.osm>0 && tileHits.ign>0,'carte : bascule OSM → IGN ('+tileHits.osm+'/'+tileHits.ign+')');
  await p.click('#m-filters [data-f=seen]'); ok((await p.getAttribute('#m-filters [data-f=seen]','class'))==='on','carte : filtre Vues');
  const box=await p.locator('#map').boundingBox();
  /* dossier */
  await p.click('nav [data-tab=dossier]'); ok((await p.textContent('.kpis')).includes('47'),'dossier : 47 visitées');
  ok(!(await p.getAttribute('#d-album','disabled')),'dossier : album actif');
  console.log('erreurs page:',errs.length?errs:'aucune'); console.log(fails?'ÉCHECS '+fails:'TOUT PASSE');
  await b.close();
})();
