// Sample quote drafts only. This module performs no I/O or real quote acceptance.
const MAX_PRODUCTION_CENTS = 1_000_000;
const MAX_SHIPPING_CENTS = 100_000;

export function parseFarmQuoteMoney(value, { label = "Amount", minimum = 0, maximum = MAX_PRODUCTION_CENTS } = {}) {
  if (typeof value !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(value.trim())) {
    throw new Error(`${label} must be a dollar amount with no more than two decimal places.`);
  }
  const [whole, fraction = ""] = value.trim().split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents < minimum || cents > maximum) {
    throw new Error(`${label} must be between $${(minimum / 100).toFixed(2)} and $${(maximum / 100).toFixed(2)}.`);
  }
  return cents;
}

function snapshotSpecification(job) {
  if (!job || typeof job.id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(job.id) ||
      !Number.isInteger(job.quantity) || job.quantity < 1 || job.quantity > 100) {
    throw new Error("Choose a valid sample request with a quantity of 1–100 parts.");
  }
  const dimensions = job.dimensions;
  if (!dimensions || !["x", "y", "z"].every((axis) => Number.isFinite(dimensions[axis]) && dimensions[axis] > 0)) {
    throw new Error("The sample request needs valid dimensions before saving a quote.");
  }
  for (const field of ["fileName", "material", "color", "buyerNotes"]) {
    if (typeof job[field] !== "string" || !job[field].trim()) throw new Error("The sample request is missing a required specification.");
  }
  return {
    jobId: job.id,
    fileName: job.fileName,
    fileType: job.fileType ?? "",
    material: job.material,
    color: job.color,
    quantity: job.quantity,
    dimensions: { x: dimensions.x, y: dimensions.y, z: dimensions.z },
    buyerNotes: job.buyerNotes,
    intendedUse: job.intendedUse ?? "",
    neededBy: job.neededBy ?? "",
  };
}

export function farmQuoteMatchesRequest(draft, job) {
  if (!draft) return false;
  try {
    return JSON.stringify(draft.specification) === JSON.stringify(snapshotSpecification(job));
  } catch {
    return false;
  }
}

export function validateFarmQuoteInput(job, input) {
  const specification = snapshotSpecification(job);
  if (!input || input.reviewed !== true) throw new Error("Confirm that you reviewed the sample intended use, material, quantity, and dimensions.");
  const productionCents = parseFarmQuoteMoney(input.price, { label: "Whole-job production price", minimum: 1 });
  const shippingCents = parseFarmQuoteMoney(input.shipping, { label: "Shipping", maximum: MAX_SHIPPING_CENTS });
  if (typeof input.turnaround !== "string" || !/^\d+$/.test(input.turnaround.trim())) throw new Error("Production time must be 1–90 whole business days.");
  const turnaroundDays = Number(input.turnaround.trim());
  if (!Number.isInteger(turnaroundDays) || turnaroundDays < 1 || turnaroundDays > 90) throw new Error("Production time must be 1–90 whole business days.");
  if (typeof input.notes !== "string" || input.notes.length > 1000) throw new Error("Keep the scope and finishing notes within 1,000 characters.");
  return {
    jobId: job.id, currency: "USD", scope: "whole-job", productionCents, shippingCents,
    subtotalCents: productionCents + shippingCents, turnaroundDays, notes: input.notes.trim(),
    reviewed: true, specification,
  };
}

export function farmQuoteFields(draft = null, job = null) {
  if (!draft) return { price: "", shipping: "0", turnaround: "3", notes: "", reviewed: false };
  return {
    price: (draft.productionCents / 100).toFixed(2),
    shipping: (draft.shippingCents / 100).toFixed(2),
    turnaround: String(draft.turnaroundDays),
    notes: draft.notes,
    reviewed: job ? farmQuoteMatchesRequest(draft, job) : false,
  };
}

export function hasUnsavedFarmQuoteChanges(job, input, draft) {
  if (!draft) return true;
  try {
    const value = validateFarmQuoteInput(job, input);
    return !farmQuoteMatchesRequest(draft, job) ||
      ["productionCents", "shippingCents", "turnaroundDays", "notes"].some((field) => value[field] !== draft[field]);
  } catch {
    return true;
  }
}

export function createFarmQuoteState() {
  return {};
}

export function farmQuoteReducer(state, action) {
  if (action.type === "clear") {
    if (!Object.hasOwn(state, action.jobId)) return state;
    const next = { ...state };
    delete next[action.jobId];
    return next;
  }
  if (action.type !== "save") return state;
  const value = validateFarmQuoteInput(action.job, action.input);
  if (!Number.isSafeInteger(action.savedAt) || action.savedAt < 0 || Number.isNaN(new Date(action.savedAt).getTime())) {
    throw new Error("A valid saved timestamp is required.");
  }
  const previous = Object.hasOwn(state, value.jobId) ? state[value.jobId] : null;
  return {
    ...state,
    [value.jobId]: {
      ...value, revision: (previous?.revision ?? 0) + 1,
      createdAt: previous?.createdAt ?? action.savedAt, savedAt: action.savedAt,
    },
  };
}

