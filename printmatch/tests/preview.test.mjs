import test from 'node:test';
import assert from 'node:assert/strict';
import { previewPrice } from '../src/lib/previewPricing.js';
test('sample quantity scales integer unit prices exactly',()=>{const one=previewPrice({unitPrice:18.5,grams:40,multiplier:1.33,addons:8});const many=previewPrice({unitPrice:18.5,grams:40,multiplier:1.33,addons:8,quantity:7});assert.equal(Math.round(many.price*100),Math.round(one.price*100)*7)});
for(const quantity of [0,-1,1.5,101,NaN])test(`reject invalid preview quantity ${quantity}`,()=>assert.throws(()=>previewPrice({unitPrice:18.5,quantity})));
test('invalid weights fail rather than create a free order',()=>{assert.throws(()=>previewPrice({unitPrice:18.5,grams:0}));assert.throws(()=>previewPrice({unitPrice:18.5,grams:Infinity}));});
