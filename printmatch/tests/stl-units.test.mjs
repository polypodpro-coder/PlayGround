import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Mesh } from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { normalizeSTLToMillimeters, isCurrentModelInfo } from '../src/lib/stlUnits.js';
import { validateSTLBuffer } from '../src/lib/stlValidation.js';

function sourceFixture() {
  const box = new BoxGeometry(2, 1, 0.5);
  const bytes = new STLExporter().parse(new Mesh(box), { binary: true });
  box.dispose();
  return new STLLoader().parse(bytes.buffer);
}
function dimensions(geometry) {
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  return [max.x - min.x, max.y - min.y, max.z - min.z];
}
function near(actual, expected) {
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 0.00001, `${value} differs from ${expected[index]}`));
}

for (const [units, expected] of [['mm', [2, 1, 0.5]], ['cm', [20, 10, 5]], ['in', [50.8, 25.4, 12.7]]]) {
  test(`${units} source geometry and binary export have correct physical mm dimensions`, () => {
    const raw = sourceFixture();
    const originalCoordinates = Array.from(raw.getAttribute('position').array);
    const normalized = normalizeSTLToMillimeters(raw, units);
    near(dimensions(normalized), expected);
    const exported = new STLExporter().parse(new Mesh(normalized), { binary: true });
    assert.equal(validateSTLBuffer(exported.buffer), 12);
    const reopened = new STLLoader().parse(exported.buffer);
    near(dimensions(reopened), expected);
    const reopenedAsMM = normalizeSTLToMillimeters(reopened, 'mm');
    near(dimensions(reopenedAsMM), expected);
    assert.deepEqual(Array.from(raw.getAttribute('position').array), originalCoordinates);
    raw.dispose(); normalized.dispose(); reopened.dispose(); reopenedAsMM.dispose();
  });
}

test('repeated unit switches normalize fresh copies without accumulating scaling', () => {
  const raw = sourceFixture();
  for (const units of ['in', 'cm', 'in', 'mm', 'cm', 'mm']) {
    const converted = normalizeSTLToMillimeters(raw, units);
    near(dimensions(converted), units === 'in' ? [50.8, 25.4, 12.7] : units === 'cm' ? [20, 10, 5] : [2, 1, 0.5]);
    assert.notEqual(converted.getAttribute('position').array, raw.getAttribute('position').array);
    converted.dispose();
  }
  near(dimensions(raw), [2, 1, 0.5]); raw.dispose();
});

test('unknown units and coordinates made extreme by conversion are rejected', () => {
  const raw = sourceFixture();
  for (const units of ['m', '', '__proto__', null]) assert.throws(() => normalizeSTLToMillimeters(raw, units), /Choose millimeters/);
  raw.dispose();
  const oversized = new BoxGeometry(100000, 1, 1);
  assert.throws(() => normalizeSTLToMillimeters(oversized, 'in'), /extreme/);
  near(dimensions(oversized), [100000, 1, 1]); oversized.dispose();
});

test('readiness rejects stale units and a replaced file even when filenames match', () => {
  const file = { name: 'part.stl' };
  const info = { sourceFile: file, sourceUnits: 'cm', units: 'mm', isSample: false };
  assert.equal(isCurrentModelInfo(info, { file, sourceUnits: 'cm' }), true);
  assert.equal(isCurrentModelInfo(info, { file, sourceUnits: 'in' }), false);
  assert.equal(isCurrentModelInfo(info, { file: { name: 'part.stl' }, sourceUnits: 'cm' }), false);
  assert.equal(isCurrentModelInfo({ ...info, units: 'cm' }, { file, sourceUnits: 'cm' }), false);
  assert.equal(isCurrentModelInfo(null, { file, sourceUnits: 'cm' }), false);
});

test('procedural sample readiness is tied to its model and remains mm', () => {
  const info = { sourceFile: null, sourceUnits: 'mm', units: 'mm', isSample: true, modelType: 'planter' };
  assert.equal(isCurrentModelInfo(info, { modelType: 'planter', sourceUnits: 'in' }), true);
  assert.equal(isCurrentModelInfo(info, { modelType: 'tile' }), false);
  assert.equal(isCurrentModelInfo({ ...info, sourceUnits: 'in' }, { modelType: 'planter' }), false);
});
