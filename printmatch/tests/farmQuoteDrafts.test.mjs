import test from "node:test";
import assert from "node:assert/strict";
import {
  createFarmQuoteState, farmQuoteReducer, farmQuoteFields, farmQuoteMatchesRequest,
  hasUnsavedFarmQuoteChanges,
} from "../src/lib/farmQuoteDrafts.js";

const job = {
  id: "j1", fileName: "desk-tray.stl", fileType: "stl", material: "PETG", color: "Black",
  quantity: 4, dimensions: { x: 80, y: 60, z: 20 },
  buyerNotes: "Four decorative desk trays.", neededBy: "2026-09-15",
};
const fields = { price: "24.10", shipping: "3.20", turnaround: "3", notes: "Matte finish.", reviewed: true };
const firstTime = Date.parse("2026-09-07T14:00:00Z");
const save = (state, input = fields, request = job, savedAt = firstTime) =>
  farmQuoteReducer(state, { type: "save", job: request, input, savedAt });

test("saved draft reopens after navigation with exact whole-job cents and review", () => {
  const state = save(createFarmQuoteState());
  const reopened = farmQuoteFields(state.j1, job);
  assert.deepEqual(reopened, fields);
  assert.equal(state.j1.productionCents, 2410);
  assert.equal(state.j1.shippingCents, 320);
  assert.equal(state.j1.subtotalCents, 2730);
  assert.equal(state.j1.scope, "whole-job");
  assert.equal(state.j1.specification.quantity, 4);
  assert.equal(state.j1.revision, 1);
  assert.equal(state.j1.savedAt, firstTime);
  assert.equal(hasUnsavedFarmQuoteChanges(job, reopened, state.j1), false);
});

test("editing preserves the saved proposal until save, then advances revision", () => {
  const original = save(createFarmQuoteState());
  const edited = { ...farmQuoteFields(original.j1, job), price: "30.09", shipping: "0", notes: "Polished finish." };
  assert.equal(hasUnsavedFarmQuoteChanges(job, edited, original.j1), true);
  assert.equal(original.j1.subtotalCents, 2730);
  const revised = save(original, edited, job, firstTime + 60000);
  assert.equal(revised.j1.revision, 2);
  assert.equal(revised.j1.createdAt, firstTime);
  assert.equal(revised.j1.savedAt, firstTime + 60000);
  assert.equal(revised.j1.productionCents, 3009);
  assert.equal(revised.j1.subtotalCents, 3009);
  assert.equal(revised.j1.notes, "Polished finish.");
  assert.equal(original.j1.revision, 1);
  assert.equal(hasUnsavedFarmQuoteChanges(job, farmQuoteFields(revised.j1, job), revised.j1), false);
});

test("saving a second request and clearing one draft preserve the other", () => {
  const first = save(createFarmQuoteState());
  const second = save(first, { ...fields, price: "15" }, { ...job, id: "j2", quantity: 1 });
  assert.equal(second.j2.productionCents, 1500);
  assert.equal(second.j2.revision, 1);
  const cleared = farmQuoteReducer(second, { type: "clear", jobId: "j1" });
  assert.equal(cleared.j1, undefined);
  assert.deepEqual(cleared.j2, second.j2);
  assert.equal(second.j1.revision, 1);
  assert.deepEqual(farmQuoteFields(cleared.j1, job), { price: "", shipping: "0", turnaround: "3", notes: "", reviewed: false });
  assert.deepEqual(createFarmQuoteState(), {}); // A fresh provider has no persisted drafts.
});

test("invalid money never replaces a saved draft", () => {
  const state = save(createFarmQuoteState());
  for (const price of ["", " ", "0", "-1", "1.005", "1e2", "0x10", "1,000", "NaN", "Infinity", "10000.01", "9007199254740993", 24.1]) {
    assert.throws(() => save(state, { ...fields, price }), /price|amount|decimal/i, String(price));
  }
  for (const shipping of ["", "-0.01", "2.001", "1e2", "1000.01", Infinity]) {
    assert.throws(() => save(state, { ...fields, shipping }), /Shipping|amount|decimal/i, String(shipping));
  }
  assert.equal(state.j1.revision, 1);
  assert.equal(state.j1.subtotalCents, 2730);
});

test("invalid review, turnaround, and overlong scope cannot be saved", () => {
  const state = save(createFarmQuoteState());
  for (const patch of [{ reviewed: false }, { reviewed: "true" }, { turnaround: "0" }, { turnaround: "91" }, { turnaround: "1.5" }, { turnaround: "1e1" }, { notes: "x".repeat(1001) }]) {
    assert.throws(() => save(state, { ...fields, ...patch }));
    assert.equal(hasUnsavedFarmQuoteChanges(job, { ...fields, ...patch }, state.j1), true);
  }
  assert.equal(state.j1.revision, 1);
});

test("request specification changes require renewed review when reopening", () => {
  const state = save(createFarmQuoteState());
  const changed = { ...job, quantity: 5, dimensions: { ...job.dimensions, x: 90 } };
  assert.equal(farmQuoteMatchesRequest(state.j1, changed), false);
  const reopened = farmQuoteFields(state.j1, changed);
  assert.equal(reopened.reviewed, false);
  assert.throws(() => save(state, reopened, changed), /Confirm/);
  const revised = save(state, { ...reopened, reviewed: true }, changed, firstTime + 60000);
  assert.equal(revised.j1.specification.quantity, 5);
  assert.equal(revised.j1.specification.dimensions.x, 90);
  assert.equal(revised.j1.revision, 2);
  assert.equal(state.j1.specification.dimensions.x, 80);
});

test("equivalent currency formatting is clean while incomplete edits are unsaved", () => {
  const state = save(createFarmQuoteState(), { ...fields, price: "24", shipping: "0.10" });
  assert.equal(state.j1.subtotalCents, 2410);
  assert.equal(hasUnsavedFarmQuoteChanges(job, { ...fields, price: "24.00", shipping: "0.1" }, state.j1), false);
  assert.equal(hasUnsavedFarmQuoteChanges(job, { ...fields, price: "" }, state.j1), true);
  assert.throws(() => save(state, fields, job, NaN), /timestamp/);
});

