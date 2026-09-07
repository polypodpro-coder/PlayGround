export const MAX_STL_BYTES = 10 * 1024 * 1024;
export const MAX_STL_TRIANGLES = 150000;

export function validateSTLBuffer(buffer) {
  if (!(buffer instanceof ArrayBuffer) || !buffer.byteLength || buffer.byteLength > MAX_STL_BYTES) throw new Error("Choose a non-empty STL file no larger than 10 MB.");
  if (buffer.byteLength >= 84) {
    const count = new DataView(buffer).getUint32(80, true);
    if (84 + count * 50 === buffer.byteLength) {
      if (!count || count > MAX_STL_TRIANGLES) throw new Error("The viewer supports 1–150,000 triangles. Simplify this mesh and try again.");
      return count;
    }
  }
  const source = new TextDecoder().decode(buffer).trim();
  if (!/^solid(?:\s|$)/i.test(source) || !/endsolid[^\r\n]*$/i.test(source)) throw new Error("This STL is incomplete or has an invalid binary length. Export it again from your CAD tool.");
  const count = (source.match(/\bfacet\s+normal\b/gi) || []).length;
  const ends = (source.match(/\bendfacet\b/gi) || []).length;
  const vertices = (source.match(/\bvertex\s+/gi) || []).length;
  if (!count || count !== ends || vertices !== count * 3) throw new Error("The STL contains incomplete triangles. Export a complete STL and try again.");
  if (count > MAX_STL_TRIANGLES) throw new Error("The viewer supports up to 150,000 triangles. Simplify this mesh and try again.");
  return count;
}

export function validateSTLGeometry(geometry, expectedCount = null) {
  const positions = geometry.getAttribute("position");
  if (!positions || (expectedCount && positions.count !== expectedCount * 3)) throw new Error("The STL has missing or invalid vertex data.");
  for (const coordinate of positions.array) {
    if (!Number.isFinite(coordinate) || Math.abs(coordinate) > 1000000) throw new Error("The STL contains invalid or extreme coordinates. Check its units and export it again.");
  }
  return positions;
}
