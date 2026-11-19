const { chromium } = require('playwright');
let fails=0; const ok=(c,m)=>{ if(!c){fails++;console.log('ECHEC',m);} else console.log('ok',m); };
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const JWT=b64({alg:'HS256'})+'.'+b64({sub:'me',role:'authenticated',exp:4102444800})+'.sig';
const CORS={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','access-control-expose-headers':'*'};
const PHOTO='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({viewport:{width:390,height:800}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  const pushed=[], calls=[]; let accepted=false, removed=false;
  const remote=[{place_id:'33063-prefecture',date:'2026-05-01',note:'Depuis le serveur',photo:null,deleted:false,client_ts:4000000000000,updated_at:'2026-06-01T10:00:00Z'}];
  await p.route(/wikipedia|geo\.api|tile\.|geopf/, r=>r.abort());
  await p.route(/supabase\.co/, async r=>{
    const q=r.request(), u=new URL(q.url()), path=u.pathname;
    if(q.method()==='OPTIONS') return r.fulfill({status:204,headers:CORS});
    const j=(body,s=200)=>r.fulfill({status:s,headers:{...CORS,'content-type':'application/json'},body:JSON.stringify(body)});
    if(path.endsWith('/auth/v1/token')) return j({access_token:JWT,token_type:'bearer',expires_in:3600,expires_at:4102444800,refresh_token:'rt',user:{id:'me',email:'t@x.fr',aud:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}});
    if(path.endsWith('/auth/v1/user')) return j({id:'me',email:'t@x.fr',aud:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'});
    if(path.endsWith('/rest/v1/visits')){
      if(q.method()==='GET') return j(remote);
      pushed.push(...JSON.parse(q.postData()||'[]')); return j([],201);
    }
    if(path.includes('/rpc/')){
      const name=path.split('/rpc/')[1]; calls.push(name);
      if(name==='my_profile') return j({code:'K7M2QX9P',pseudo:'Thomas'});
      if(name==='friends_overview') return j([{user_id:'me',pseudo:'Thomas',n:1,is_me:true},{user_id:'u2',pseudo:'Zoé',n:60}].concat(accepted?[{user_id:'u3',pseudo:'Léo',n:5}]:[]));
      if(name==='friend_requests') return j(accepted?[]:[{id:'r1',user_id:'u3',pseudo:'Léo',direction:'in'}]);
      if(name==='respond_friend'){accepted=true;return j({});}
      if(name==='remove_friend'){removed=true;return j({});}
      if(name==='friend_visits') return j([{place_id:'33063-prefecture',date:'2026-03-02',note:'Super',has_photo:true},{place_id:'47001-prefecture',date:'2026-01-10',note:'',has_photo:false}]);
      if(name==='friend_photo') return j(PHOTO);
      return j(null);
    }
    return j({});
  });
  p.on('dialog', d=>d.accept());
  await p.goto('http://localhost:4173/'); await p.click('#cv-open');
  await p.click('nav [data-tab=reglages]');
  await p.fill('#s-mail','t@x.fr'); await p.fill('#s-pw','motdepasse1'); await p.click('#s-form button[type=submit]');
  await p.waitForSelector('#s-now',{timeout:8000}); ok(true,'compte : connexion');
  await p.waitForFunction(()=>/Synchronisé/.test(document.getElementById('sync-status')?.textContent||''),null,{timeout:8000}); ok(true,'synchro : « Synchronisé à… »');
  let v=await p.evaluate(()=>JSON.parse(localStorage.getItem('carnet.visits')));
  ok(v['33063-prefecture']&&v['33063-prefecture'].note==='Depuis le serveur','synchro : visite distante récupérée');
  ok(!Object.values(v).some(x=>x.demo),'connecté : démos retirées');
  /* envoi d'une nouvelle visite */
  await p.click('nav [data-tab=registre]'); await p.click('#fab'); await p.fill('#f-q','Agen'); await p.click('#f-sug button >> nth=0'); await p.click('#f-ok');
  await p.waitForSelector('#hit',{state:'detached',timeout:5000});
  await p.waitForFunction(()=>true); for(let i=0;i<40&&!pushed.some(r=>r.place_id.includes('47001')&&!r.deleted);i++) await p.waitForTimeout(250);
  ok(pushed.some(r=>r.place_id.includes('47001')&&r.deleted===false&&r.user_id==='me'),'synchro : nouvelle visite envoyée');
  /* suppression propagée */
  await p.fill('#q','agen'); await p.click('.fiche'); await p.click('#d-del'); await p.waitForSelector('#list');
  for(let i=0;i<40&&!pushed.some(r=>r.deleted===true);i++) await p.waitForTimeout(250);
  ok(pushed.some(r=>r.deleted===true&&r.place_id.includes('47001')),'synchro : suppression envoyée');
  /* amis */
  await p.click('nav [data-tab=dossier]'); await p.waitForFunction(()=>document.getElementById('h-dot')&&!document.getElementById('h-dot').hidden,null,{timeout:5000});
  ok((await p.textContent('#h-dot'))==='1','amis : pastille = 1 demande reçue');
  await p.click('#h-act'); await p.waitForSelector('#am-mycode');
  ok((await p.textContent('#am-mycode'))==='K7M2-QX9P','amis : code ami formaté');
  const names=await p.locator('.rk h3').allTextContents(); ok(names[0]==='Zoé'&&/Thomas/.test(names[1]),'amis : classement (Zoé 60 devant vous)');
  await p.click('.am-yes'); await p.waitForSelector('.rk[data-uid=u3]'); ok(true,'amis : demande acceptée, Léo au classement');
  await p.click('.rk[data-uid=u2]'); await p.waitForSelector('.am-vis');
  ok((await p.locator('.am-vis').count())===2,'ami : 2 visites en lecture seule');
  await p.waitForSelector('.am-vis .alb-ph img',{timeout:5000}); ok(true,'ami : photo chargée à la demande');
  ok((await p.textContent('#h-title'))==='Zoé','ami : titre = pseudo');
  await p.click('#am-rm'); await p.waitForSelector('#am-mycode'); ok(removed,'ami : retiré, retour au classement');
  /* déconnexion */
  await p.click('nav [data-tab=reglages]'); await p.click('#s-out'); await p.waitForSelector('#s-form',{timeout:5000}); ok(true,'compte : déconnexion');
  console.log('erreurs page:',errs.length?errs:'aucune'); console.log(fails?'ÉCHECS '+fails:'TOUT PASSE'); await b.close();
})().catch(e=>{console.log('EXCEPTION',e.message.split('\n')[0]);process.exit(1)});
