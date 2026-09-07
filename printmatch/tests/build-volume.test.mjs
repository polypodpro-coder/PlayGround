import test from 'node:test';
import assert from 'node:assert/strict';
import { fitsBuildVolume, buildPreviewQuotes, requireCurrentPreviewQuote } from '../src/lib/previewQuotes.js';

test('build envelope permits axis rotation but rejects one oversized axis',()=>{
  assert.equal(fitsBuildVolume({x:200,y:120,z:80},{x:130,y:90,z:210}),true);
  assert.equal(fitsBuildVolume({x:200,y:120,z:100},{x:130,y:90,z:210}),false);
});
test('invalid physical dimensions cannot pass size screening',()=>{
  for(const x of [0,-1,NaN,Infinity,'20']) assert.equal(fitsBuildVolume({x,y:20,z:20},{x:256,y:256,z:256}),false);
  assert.equal(fitsBuildVolume({x:20,y:20,z:20},null),false);
  assert.equal(fitsBuildVolume(null,null),true);
});
test('changed farm build capacity invalidates an accepted sample quote',()=>{
  const request={material:'PLA',quantity:1,estimatedGrams:40,dimensions:{x:200,y:40,z:30},selectedAddons:[]};
  const farm={id:'farm1',materials:['PLA'],status:'available',fulfillmentOptions:{pickup:{enabled:true,feeCents:0}},buildVolume:{x:256,y:256,z:256}};
  const args={request,farms:[farm],templates:[{id:'q1',printerId:'farm1',price:20}],materials:{PLA:{multiplier:1}},addons:[]};
  const before=buildPreviewQuotes(args);
  assert.equal(before.length,1);
  const after=buildPreviewQuotes({...args,farms:[{...farm,buildVolume:{x:100,y:100,z:100}}]});
  assert.equal(after.length,0);
  assert.throws(()=>requireCurrentPreviewQuote(before[0],after));
});

