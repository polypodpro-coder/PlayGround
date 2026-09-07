import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readConfig } from '../server/config.mjs';
import { createRequestHandler } from '../server/app.mjs';
import { newCsrfToken, fail } from '../server/security.mjs';
import { safeMeshyReferral, MESHY_PORTAL } from '../src/config/meshyPortal.js';

const creationId='11111111-1111-4111-8111-111111111111', userId='22222222-2222-4222-8222-222222222222';
const shareId='33333333-3333-4333-8333-333333333333';
const config={...readConfig({}),identityConfigured:true,creationSharingEnabled:true};
const token=newCsrfToken(), session={principal:{id:userId,emailVerified:true},csrfToken:token};
async function withApi(options,run) {
  const server=createServer(createRequestHandler({config,repository:{},resolveSession:async()=>session,logger:{error(){}},...options}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try { await run((path,options)=>fetch(`http://127.0.0.1:${server.address().port}${path}`,options)); }
  finally { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); }
}
const mutation=(body,method='POST',headers={})=>({method,headers:{Origin:config.baseURL,'X-CSRF-Token':token,'Content-Type':'application/json',...headers},...(body ? {body:JSON.stringify(body)}:{})});

test('Meshy referral preserves supplied associate link and rejects credential/phishing/protocol URLs',()=>{
  assert.equal(MESHY_PORTAL.referralUrl,'https://www.meshy.ai/?via=PolyPodPro');
  for (const value of ['javascript:alert(1)','http://www.meshy.ai/?via=x','https://www.meshy.ai.evil.example','https://name:secret@meshy.ai/','https://meshy.ai:444/']) assert.equal(safeMeshyReferral(value),null);
  assert.equal(safeMeshyReferral('https://meshy.ai/?via=test'),'https://meshy.ai/?via=test');
});
test('private sharing defaults disabled and requires complete identity configuration',()=>{
  assert.equal(readConfig({}).creationSharingEnabled,false);
  assert.throws(()=>readConfig({CREATION_SHARING_ENABLED:'true'}),/identity and database/);
});
test('public creation status cannot claim availability without schema-backed service',async()=>{
  await withApi({},async request=>{
    assert.deepEqual(await (await request('/api/creation-status')).json(),{configured:false,enabled:false});
    assert.equal((await request('/api/creations')).status,503);
  });
});
test('creation routes reject unauthenticated and restricted sessions before accessing records',async()=>{
  for (const principal of [null,{id:userId,emailVerified:false},{id:userId,emailVerified:true,blockedAt:new Date()}]) {
    await withApi({creations:{list(){throw new Error('must not execute');}},resolveSession:async()=>principal ? {...session,principal}:null},async request=>{
      const response=await request('/api/creations',{headers:{'X-User-Id':userId,'X-Role':'owner'}});
      assert.equal(response.status,principal ? 403:401);
    });
  }
});
test('all creation mutations require same-origin CSRF protection',async()=>{
  const paths=['/api/creations',`/api/creations/${creationId}/shares`,`/api/creation-shares/${shareId}/quote`,`/api/creation-shares/${shareId}`];
  await withApi({creations:{}},async request=>{
    for (const [index,path] of paths.entries()) {
      const method=index===3?'DELETE':'POST';
      assert.equal((await request(path,mutation({},method,{Origin:'https://foreign.example'}))).status,403);
      assert.equal((await request(path,mutation({},method,{'X-CSRF-Token':'wrong'}))).status,403);
    }
  });
});
test('creation routes use session identity and explicit response envelopes',async()=>{
  const calls=[];
  await withApi({creations:{
    list:async user=>{calls.push(user);return [{id:creationId}];},
    farms:async user=>{calls.push(user);return [{id:shareId,name:'Farm'}];},
    inbox:async user=>{calls.push(user);return [];},
    create:async(user,body)=>{calls.push(user);assert.equal(body.title,'Part');return {id:creationId};},
    share:async(id,user)=>{assert.equal(id,creationId);calls.push(user);return {id:shareId};},
    respond:async(id,user)=>{assert.equal(id,shareId);calls.push(user);return {nonbinding:true};},
    revoke:async(id,user)=>{assert.equal(id,shareId);calls.push(user);return {id,revoked:true};},
  }},async request=>{
    assert.deepEqual(await (await request('/api/creations')).json(),{creations:[{id:creationId}]});
    assert.ok((await (await request('/api/creation-farms')).json()).farms);
    assert.deepEqual(await (await request('/api/creation-inbox')).json(),{inbox:[]});
    const created=await request('/api/creations',mutation({title:'Part'})); assert.equal(created.status,201);assert.equal((await created.json()).creation.id,creationId);
    assert.equal((await (await request(`/api/creations/${creationId}/shares`,mutation({}))).json()).share.id,shareId);
    assert.equal((await (await request(`/api/creation-shares/${shareId}/quote`,mutation({}))).json()).offer.nonbinding,true);
    assert.equal((await (await request(`/api/creation-shares/${shareId}`,mutation(null,'DELETE'))).json()).revoked,true);
    assert.deepEqual(calls,Array(7).fill(userId));
  });
});
test('model downloads require authorized lookup and prohibit public caching',async()=>{
  const bytes=Buffer.from('private STL');
  await withApi({creations:{model:async(id,user)=>{assert.equal(user,userId);if(id!==creationId)fail(404,'creation_not_found','Model not found.');return {bytes};}}},async request=>{
    const response=await request(`/api/creations/${creationId}/model`);
    assert.equal(response.status,200); assert.equal(response.headers.get('content-type'),'model/stl');
    assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(response.headers.get('x-content-type-options'),'nosniff');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
    assert.equal((await request(`/api/creations/${shareId}/model`)).status,404);
    assert.equal((await request('/api/creations/not-a-uuid/model')).status,400);
  });
});
test('upload JSON rejects invalid content and over-limit announced requests before parsing',async()=>{
  await withApi({creations:{create(){throw new Error('must not execute');}}},async request=>{
    assert.equal((await request('/api/creations',mutation({},'POST',{'Content-Type':'text/plain'}))).status,415);
    assert.equal((await request('/api/creations',{...mutation({}),body:'{'})).status,400);
    assert.equal((await request('/api/creations',mutation({modelBase64:'A'.repeat(14*1024*1024)}))).status,413);
  });
});
