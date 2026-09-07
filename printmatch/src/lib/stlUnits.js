import { validateSTLGeometry } from './stlValidation.js';

export const STL_UNIT_TO_MM = Object.freeze({ mm: 1, cm: 10, in: 25.4 });

// Always pass untouched source geometry. Unit changes create a fresh mm copy.
export function normalizeSTLToMillimeters(sourceGeometry, sourceUnits = 'mm') {
  if (!Object.hasOwn(STL_UNIT_TO_MM, sourceUnits)) throw new Error('Choose millimeters, centimeters, or inches for the STL source.');
  validateSTLGeometry(sourceGeometry);
  const normalized = sourceGeometry.clone();
  try {
    const factor = STL_UNIT_TO_MM[sourceUnits];
    normalized.scale(factor, factor, factor);
    validateSTLGeometry(normalized);
    normalized.computeVertexNormals();
    normalized.computeBoundingBox();
    return normalized;
  } catch (error) {
    normalized.dispose();
    throw error;
  }
}

export function isCurrentModelInfo(info, { file = null, sourceUnits = 'mm', modelType = null }) {
  if (!info || info.units !== 'mm' || info.sourceFile !== file) return false;
  return file ? info.sourceUnits === sourceUnits : info.isSample && info.sourceUnits === 'mm' && info.modelType === modelType;
}
