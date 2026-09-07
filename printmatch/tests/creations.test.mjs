import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { CreationService, decodeCreationModel, validateCreationSTL, MAX_CREATION_BYTES, MAX_CREATION_TRIANGLES } from '../server/creations.mjs';
import { CreationRepository } from '../server/creation-repository.mjs';

const owner = '11111111-1111-4111-8111-111111111111';
const staff = '22222222-2222-4222-8222-222222222222';
const stranger = '33333333-3333-4333-8333-333333333333';
const creationId = '44444444-4444-4444-8444-444444444444';
const sellerId = '55555555-5555-4555-8555-555555555555';
const shareId = '66666666-6666-4666-8666-666666666666';
function binarySTL() {
  const bytes = Buffer.alloc(134);
  bytes.writeUInt32LE(1,80);
  // One triangle with finite normal and vertices. This is structural validation,
  // not a test of watertightness, strength, scale accuracy or manufacturability.
  [0,0,1,0,0,0,1,0,0,0,1,0].forEach((value,index) => bytes.writeFloatLE(value,84+index*4));
  return bytes;
}
const bytes = binarySTL();
const hash = createHash('sha256').update(bytes).digest('hex');
const row = { id:creationId,owner_id:owner,title:'Desk model',file_name:'desk-model-44444444.stl',source:'meshy',
  source_units:'cm',sha256:hash,byte_length:bytes.length,triangle_count:1,created_at:'2026-09-07T00:00:00.000Z',
  model_bytes:bytes,notes:'Owner-only import annotation' };
const shared = { id:shareId,creation_id:creationId,seller_id:sellerId,seller_name:'Example Farm',
  notes:'Review wall thickness',target_height_mm:120,request_version:1,consent_at:'2026-09-07T00:00:00.000Z',created_at:'2026-09-07T00:00:00.000Z',
  offer:{productionCents:1000,fulfillmentCents:500,leadDays:3,notes:'Nonbinding estimate'} };
const createBody = { modelBase64:bytes.toString('base64'),title:'Desk model',source:'meshy',sourceUnits:'cm',consent:true };
const service = repository => new CreationService({repository,config:{creationSharingEnabled:true}});
const ascii = Buffer.from(`solid sample
facet normal 0 0 1
outer loop
vertex 0 0 0
vertex 1 0 0
vertex 0 1 0
endloop
endfacet
endsolid sample
`);
function poolFor(handler) {
  const calls=[];
  const client={async query(sql,params=[]){calls.push({sql,params});return handler(sql,params);},release(){}};
  return {calls,async connect(){return client;},query:client.query.bind(client)};
}

test('binary and complete ASCII models produce a hash without altering source bytes',()=>{
  for(const model of [bytes,ascii]) {
    const before=Buffer.from(model);
    const decoded=decodeCreationModel(model.toString('base64'));
    assert.equal(decoded.triangleCount,1);
    assert.equal(decoded.sha256,createHash('sha256').update(model).digest('hex'));
    assert.deepEqual(decoded.bytes,before);
  }
});
test('base64 imports reject external URLs, data URLs, padding tricks and oversized bodies',()=>{
  for(const value of ['https://assets.example/model.stl','data:model/stl;base64,'+bytes.toString('base64'),
    bytes.toString('base64')+' ', '%%%=', 'AB==']) assert.throws(()=>decodeCreationModel(value));
  assert.throws(()=>decodeCreationModel('A'.repeat(Math.ceil(MAX_CREATION_BYTES/3)*4+4)),error=>error.code==='model_too_large');
});
test('binary STL rejects incomplete lengths, excessive triangle counts and non-finite/extreme components',()=>{
  assert.throws(()=>validateCreationSTL(bytes.subarray(0,133)),/STL|STL/i);
  const excessive=Buffer.alloc(84+(MAX_CREATION_TRIANGLES+1)*50);excessive.writeUInt32LE(MAX_CREATION_TRIANGLES+1,80);
  assert.throws(()=>validateCreationSTL(excessive),/150,000/);
  for(const value of [NaN,Infinity,-Infinity,1000000,-1000000]) {
    const invalid=binarySTL();invalid.writeFloatLE(value,96);
    assert.throws(()=>validateCreationSTL(invalid),/coordinates/);
  }
  const empty=Buffer.alloc(84);assert.throws(()=>validateCreationSTL(empty),/triangles/);
});
test('ASCII STL rejects partial facets, invalid numbers, trailing data and unsafe coordinates',()=>{
  for(const source of [
    ascii.toString().replace('endfacet\n',''),
    ascii.toString().replace('vertex 1 0 0','vertex NaN 0 0'),
    ascii.toString().replace('vertex 1 0 0','vertex 1e999 0 0'),
    ascii.toString().replace('vertex 1 0 0','vertex 1000000 0 0'),
    ascii.toString().replace('outer loop','unexpected loop'),
    ascii.toString()+'unexpected trailing bytes',
  ]) assert.throws(()=>validateCreationSTL(Buffer.from(source)));
});
test('import validates explicit consent, source units and unknown fields before persistence',async()=>{
  let calls=0;const creations=service({create:async()=>{calls++;return row;}});
  for(const change of [{consent:false},{source:'other'},{sourceUnits:'m'},{sourceUnits:null},
    {title:''},{title:'x'.repeat(121)},{notes:'x'.repeat(2001)},{ownerId:stranger}]) {
    await assert.rejects(creations.create(owner,{...createBody,...change}));
  }
  assert.equal(calls,0);
});
test('import persists validated private bytes and emits only public creation metadata',async()=>{
  let saved;
  const creations=service({create:async(input,limit)=>{
    saved=input;assert.equal(limit,5);
    return {...row,id:input.id,file_name:input.fileName,model_bytes:input.bytes};
  }});
  const result=await creations.create(owner,{...createBody,title:'../Desk "model"\r\n'});
  assert.equal(saved.userId,owner);assert.equal(saved.sourceUnits,'cm');
  assert.deepEqual(saved.bytes,bytes);assert.equal(saved.sha256,hash);
  assert.match(result.fileName,/^[a-z0-9-]+\.stl$/);
  assert.equal(result.sourceUnits,'cm');assert.deepEqual(result.shares,[]);
  assert.equal(Object.hasOwn(result,'model_bytes'),false);
  assert.equal(Object.hasOwn(result,'modelBase64'),false);
  assert.equal(Object.hasOwn(result,'owner_id'),false);
});
test('new imports and shares stay disabled without an explicit switch',async()=>{
  const creations=new CreationService({repository:{},config:{}});
  await assert.rejects(creations.create(owner,createBody),error=>error.code==='creation_sharing_unavailable');
  await assert.rejects(creations.share(creationId,owner,{sellerId,consent:true}),error=>error.code==='creation_sharing_unavailable');
});
test('farm model metadata never includes the buyer’s other shares or offers',async()=>{
  let sharesRead=0;
  const creations=service({
    get:async(id,userId)=>[owner,staff].includes(userId) ? row : null,
    shares:async()=>{sharesRead++;return [shared];},
  });
  const own=await creations.get(creationId,owner);
  assert.equal(own.shares[0].sellerId,sellerId);assert.equal(own.shares[0].offer.productionCents,1000);
  const farm=await creations.get(creationId,staff);
  assert.deepEqual(farm.shares,[]);assert.equal(sharesRead,1);
  await assert.rejects(creations.get(creationId,stranger),error=>error.code==='creation_not_found');
});
test('downloads recheck repository access and stored-byte integrity; disabling new sharing preserves authorized reads',async()=>{
  let revoked=false;
  const repository={model:async(id,userId)=>(userId===owner || (userId===staff&&!revoked)) ? row : null};
  const creations=new CreationService({repository,config:{creationSharingEnabled:false}});
  const download=await creations.model(creationId,staff);
  assert.deepEqual(download.bytes,bytes);assert.equal(download.sha256,hash);
  revoked=true;
  await assert.rejects(creations.model(creationId,staff),error=>error.code==='creation_not_found');
  assert.equal((await creations.model(creationId,owner)).filename,row.file_name);
  repository.model=async()=>({...row,sha256:'0'.repeat(64)});
  await assert.rejects(creations.model(creationId,owner),error=>error.code==='model_integrity_failed');
});
test('sharing stores target height as review intent without modifying source bytes or units',async()=>{
  const before=Buffer.from(bytes);let input;
  const creations=service({share:async(value,cap)=>{input=value;assert.equal(cap,10);return {...shared,target_height_mm:value.targetHeightMm};}});
  const result=await creations.share(creationId,owner,{sellerId,notes:'Please review scaling',targetHeightMm:125.5,consent:true});
  assert.equal(result.targetHeightMm,125.5);assert.equal(input.userId,owner);
  assert.equal(Object.hasOwn(input,'bytes'),false);assert.deepEqual(bytes,before);
  assert.equal(row.source_units,'cm');
  for(const change of [{consent:false},{targetHeightMm:0},{targetHeightMm:'100'},{targetHeightMm:Infinity},
    {targetHeightMm:2001},{notes:'x'.repeat(2001)},{ownerId:stranger}]) {
    await assert.rejects(creations.share(creationId,owner,{sellerId,consent:true,...change}));
  }
});
test('private inbox contains only the assigned request and no other-farm share metadata',async()=>{
  const creations=service({inbox:async userId=>{assert.equal(userId,staff);return [{...shared,buyer_label:'Buyer A',creation:{...row,shares:[{seller_id:'other-farm'}]}}];}});
  const inbox=await creations.inbox(staff);
  assert.equal(inbox[0].buyerLabel,'Buyer A');assert.equal(inbox[0].creationId,creationId);
  assert.deepEqual(inbox[0].creation.shares,[]);assert.equal(Object.hasOwn(inbox[0].creation,'model_bytes'),false);
});
test('farm responses validate cents and lead time, identify the authenticated author and remain nonbinding',async()=>{
  let call;
  const creations=service({respond:async value=>{call=value;return {production_cents:value.productionCents,fulfillment_cents:value.fulfillmentCents,lead_days:value.leadDays,notes:value.notes};}});
  const body={productionCents:1200,fulfillmentCents:0,leadDays:3,notes:'Requires model inspection',requestVersion:1};
  const response=await creations.respond(shareId,staff,body);
  assert.equal(call.userId,staff);assert.equal(response.nonbinding,true);assert.equal(response.shareId,shareId);
  for(const change of [{productionCents:0},{productionCents:10000001},{fulfillmentCents:-1},{fulfillmentCents:100001},
    {leadDays:0},{leadDays:91},{leadDays:1.5},{productionCents:'1200'},{requestVersion:undefined},{requestVersion:0},{requestVersion:'1'},{sellerId},{notes:'x'.repeat(2001)}]) {
    await assert.rejects(creations.respond(shareId,staff,{...body,...change}));
  }
});
test('owners can revoke while new sharing is disabled; unrelated users cannot revoke',async()=>{
  const creations=new CreationService({repository:{revoke:async(id,userId)=>userId===owner},config:{creationSharingEnabled:false}});
  assert.deepEqual(await creations.revoke(shareId,owner),{id:shareId,revoked:true});
  await assert.rejects(creations.revoke(shareId,stranger),error=>error.code==='creation_share_not_found');
});
test('all record operations reject malformed IDs before querying',async()=>{
  const creations=service({});
  for(const run of [
    ()=>creations.get('../other',owner),()=>creations.model(creationId,'not-a-user'),
    ()=>creations.revoke('not-a-share',owner),()=>creations.farms('not-a-user'),
  ]) await assert.rejects(run,error=>error.code==='invalid_id');
});
test('repository binds read authorization to owner or an unrevoked share with approved US seller membership',async()=>{
  const pool=poolFor((sql,params)=>{
    assert.deepEqual(params,[creationId,staff]);
    for(const guard of ['c.owner_id=$2','access_share.revoked_at IS NULL',"access_seller.status='approved'",
      "access_seller.country='US'",'access_member.user_id=$2']) assert.ok(sql.includes(guard),guard);
    return {rows:[]};
  });
  const repository=new CreationRepository(pool);
  assert.equal(await repository.get(creationId,staff),null);
  assert.equal(await repository.model(creationId,staff),null);
});
test('repository import quota is checked under a per-user transaction lock before any insert',async()=>{
  const pool=poolFor((sql,params)=>{
    if(sql.startsWith('SELECT pg_advisory')) {assert.deepEqual(params,['creation-import:'+owner]);return {rows:[]};}
    if(sql.includes('count(*)')) {
      assert.deepEqual(params,[owner]);
      if(sql.includes('created_at >=')) {assert.match(sql,/AT TIME ZONE 'UTC'/);return {rows:[{count:5}]};}
      return {rows:[{count:0}]};
    }
    if(sql.startsWith('INSERT')) assert.fail('quota must prevent insertion');
    return {rows:[]};
  });
  await assert.rejects(new CreationRepository(pool).create({userId:owner},5),error=>error.code==='creation_daily_limit');
  assert.ok(pool.calls.findIndex(({sql})=>sql.startsWith('SELECT pg_advisory')) < pool.calls.findIndex(({sql})=>sql.includes('count(*)')));
  assert.equal(pool.calls.at(-1).sql,'ROLLBACK');
});
test('repository sharing rejects nonowners before querying sellers or disclosing existing shares',async()=>{
  const pool=poolFor((sql,params)=>{
    if(sql.startsWith('SELECT')) {assert.match(sql,/owner_id=\$2 FOR UPDATE/);assert.deepEqual(params,[creationId,stranger]);return {rows:[]};}
    return {rows:[]};
  });
  await assert.rejects(new CreationRepository(pool).share({creationId,userId:stranger,sellerId},10),error=>error.code==='creation_not_found');
  assert.equal(pool.calls.filter(({sql})=>sql.startsWith('SELECT')).length,1);
});
test('repository active-share limit prevents an eleventh private recipient',async()=>{
  const pool=poolFor(sql=>{
    if(sql.startsWith('SELECT id FROM creations') || sql.startsWith('SELECT id FROM sellers')) return {rows:[{id:'exists'}]};
    if(sql.startsWith('SELECT * FROM creation_shares')) return {rows:[]};
    if(sql.includes('count(*)')) return {rows:[{count:10}]};
    if(sql.startsWith('INSERT')) assert.fail('share cap must prevent insertion');
    return {rows:[]};
  });
  await assert.rejects(new CreationRepository(pool).share({creationId,userId:owner,sellerId,notes:'',targetHeightMm:null},10),
    error=>error.code==='creation_share_limit');
  assert.equal(pool.calls.at(-1).sql,'ROLLBACK');
});
test('repository offer authorization locks the active request and current approved seller membership before mutation',async()=>{
  const pool=poolFor((sql,params)=>{
    if(sql.startsWith('SELECT')) {
      for(const guard of ['m.user_id=$2','sh.revoked_at IS NULL',"s.status='approved'","s.country='US'",'FOR UPDATE OF sh','FOR SHARE OF s,m']) assert.ok(sql.includes(guard),guard);
      assert.deepEqual(params,[shareId,stranger]);return {rows:[]};
    }
    if(sql.startsWith('INSERT')) assert.fail('unauthorized offer must not be written');
    return {rows:[]};
  });
  await assert.rejects(new CreationRepository(pool).respond({shareId,userId:stranger}),error=>error.code==='creation_share_not_found');
});
test('repository revoke is owner-scoped and invalidates old request offers without deleting source bytes',async()=>{
  const pool=poolFor((sql,params)=>{
    assert.match(sql,/c.owner_id=\$2/);assert.match(sql,/request_version/);assert.match(sql,/revoked_at=COALESCE/);
    assert.deepEqual(params,[shareId,owner]);assert.doesNotMatch(sql,/DELETE|model_bytes/);return {rowCount:1};
  });
  assert.equal(await new CreationRepository(pool).revoke(shareId,owner),true);
});
test('repository farm directory and private inbox are restricted to approved US sellers',async()=>{
  const pool=poolFor((sql,params)=>{
    assert.match(sql,/status='approved'/);assert.match(sql,/country='US'/);
    if(sql.includes('buyer_label')) {
      assert.match(sql,/m.user_id=\$1/);assert.match(sql,/sh.revoked_at IS NULL/);
      assert.deepEqual(params,[staff]);
    }
    return {rows:[]};
  });
  const repository=new CreationRepository(pool);
  assert.deepEqual(await repository.farms(),[]);
  assert.deepEqual(await repository.inbox(staff),[]);
});


test('a stale farm estimate cannot attach to changed instructions or a revoked-and-regranted request',async()=>{
  for(const currentVersion of [2,3]) {
    const pool=poolFor(sql=>{
      if(sql.startsWith('SELECT')) return {rows:[{id:shareId,request_version:currentVersion}]};
      if(sql.startsWith('INSERT')) assert.fail('stale request must not create an offer');
      return {rows:[]};
    });
    await assert.rejects(new CreationRepository(pool).respond({shareId,userId:staff,requestVersion:1}),
      error=>error.code==='creation_request_changed');
    assert.equal(pool.calls.at(-1).sql,'ROLLBACK');
  }
});
test('current request revision is bound to the stored nonbinding farm estimate',async()=>{
  const pool=poolFor((sql,params)=>{
    if(sql.startsWith('SELECT')) return {rows:[{id:shareId,request_version:2}]};
    if(sql.startsWith('INSERT')) {
      assert.equal(params[0],shareId);assert.equal(params[1],2);assert.equal(params[2],staff);
      return {rows:[{production_cents:1200,fulfillment_cents:100,lead_days:3,notes:'Inspect before printing'}]};
    }
    return {rows:[]};
  });
  const result=await new CreationRepository(pool).respond({shareId,userId:staff,requestVersion:2,
    productionCents:1200,fulfillmentCents:100,leadDays:3,notes:'Inspect before printing'});
  assert.equal(result.production_cents,1200);assert.equal(pool.calls.at(-1).sql,'COMMIT');
});

test('the total-library cap is checked under the import lock so the 100-item library list cannot hide older imports',async()=>{
  const pool=poolFor((sql,params)=>{
    if(sql.includes('count(*)')) {
      assert.deepEqual(params,[owner]);assert.doesNotMatch(sql,/created_at/);
      return {rows:[{count:100}]};
    }
    if(sql.startsWith('INSERT')) assert.fail('full library must not accept another model');
    return {rows:[]};
  });
  await assert.rejects(new CreationRepository(pool).create({userId:owner},5),error=>error.code==='creation_library_limit');
  assert.ok(pool.calls.findIndex(({sql})=>sql.startsWith('SELECT pg_advisory')) < pool.calls.findIndex(({sql})=>sql.includes('count(*)')));
  assert.equal(pool.calls.at(-1).sql,'ROLLBACK');
});
test('the farm inbox does not silently truncate pending private requests',async()=>{
  const pool=poolFor(sql=>{assert.doesNotMatch(sql,/LIMIT 100\b/);return {rows:[]};});
  assert.deepEqual(await new CreationRepository(pool).inbox(staff),[]);
});
