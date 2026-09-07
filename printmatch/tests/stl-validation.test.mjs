import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferGeometry, Float32BufferAttribute, BoxGeometry, Mesh } from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { MAX_STL_BYTES, MAX_STL_TRIANGLES, validateSTLBuffer, validateSTLGeometry } from '../src/lib/stlValidation.js';

const ascii = `solid triangle
facet normal 0 0 1
outer loop
vertex 0 0 0
vertex 10 0 0
vertex 0 20 0
endloop
endfacet
endsolid triangle`;
const encoded = (source) => new TextEncoder().encode(source).buffer;

test('complete ASCII STL loads its actual vertices and dimensions', () => {
  const buffer = encoded(ascii);
  assert.equal(validateSTLBuffer(buffer), 1);
  const geometry = new STLLoader().parse(buffer);
  assert.equal(validateSTLGeometry(geometry, 1).count, 3);
  geometry.computeBoundingBox();
  assert.equal(geometry.boundingBox.max.x, 10);
  assert.equal(geometry.boundingBox.max.y, 20);
  geometry.dispose();
});

test('binary STL export preserves original geometry in a parse/export/parse round trip', () => {
  const original = new BoxGeometry(40, 20, 10);
  const binary = new STLExporter().parse(new Mesh(original), { binary: true });
  assert.equal(validateSTLBuffer(binary.buffer), 12);
  const loaded = new STLLoader().parse(binary.buffer);
  assert.equal(validateSTLGeometry(loaded, 12).count, 36);
  const roundTrip = new STLExporter().parse(new Mesh(loaded), { binary: true });
  const parsed = new STLLoader().parse(roundTrip.buffer);
  validateSTLGeometry(parsed, validateSTLBuffer(roundTrip.buffer));
  parsed.computeBoundingBox();
  assert.deepEqual(parsed.boundingBox.min.toArray(), [-20, -10, -5]);
  assert.deepEqual(parsed.boundingBox.max.toArray(), [20, 10, 5]);
  original.dispose(); loaded.dispose(); parsed.dispose();
});

test('binary STL headers beginning with solid are detected by exact triangle length', () => {
  const binary = new ArrayBuffer(134);
  new Uint8Array(binary).set(new TextEncoder().encode('solid binary fixture'));
  new DataView(binary).setUint32(80, 1, true);
  assert.equal(validateSTLBuffer(binary), 1);
});

test('truncated binary and incomplete ASCII files are rejected', () => {
  const binary = new ArrayBuffer(100);
  new DataView(binary).setUint32(80, 1, true);
  assert.throws(() => validateSTLBuffer(binary), /incomplete|length/);
  assert.throws(() => validateSTLBuffer(encoded(ascii.replace('endfacet', ''))), /incomplete/);
  assert.throws(() => validateSTLBuffer(encoded(ascii.replace('vertex 0 20 0', ''))), /incomplete/);
  assert.throws(() => validateSTLBuffer(encoded('not an STL')), /incomplete|length/);
});

test('empty, oversized, and excessive triangle files are rejected before parsing', () => {
  assert.throws(() => validateSTLBuffer(new ArrayBuffer(0)), /non-empty/);
  assert.throws(() => validateSTLBuffer(new ArrayBuffer(MAX_STL_BYTES + 1)), /10 MB/);
  const binary = new ArrayBuffer(84 + 50 * (MAX_STL_TRIANGLES + 1));
  new DataView(binary).setUint32(80, MAX_STL_TRIANGLES + 1, true);
  assert.throws(() => validateSTLBuffer(binary), /150,000/);
});

test('non-finite, extreme, and missing geometry coordinates are rejected', () => {
  for (const coordinate of [NaN, Infinity, -Infinity, 1000001, -1000001]) {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute([coordinate, 0, 0, 10, 0, 0, 0, 20, 0], 3));
    assert.throws(() => validateSTLGeometry(geometry, 1), /invalid|extreme/);
    geometry.dispose();
  }
  assert.throws(() => validateSTLGeometry(new BufferGeometry(), 1), /missing/);
  const partial = new BufferGeometry();
  partial.setAttribute('position', new Float32BufferAttribute([0, 0, 0], 3));
  assert.throws(() => validateSTLGeometry(partial, 1), /missing/);
  partial.dispose();
});
