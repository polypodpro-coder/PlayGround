// Local image handling for Image-to-3D. The reference image is read entirely in
// the browser and turned into a Base64 data URI, so nothing is uploaded to any
// host except Meshy (via the proxy) as the image_url payload field.

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB — keeps the JSON payload sane.
export const ALLOWED_IMAGE_TYPES = Object.freeze(['image/png', 'image/jpeg', 'image/webp']);

// Validate a chosen image before reading it. Accepts anything with `type` and
// `size` (a real File in the browser, or a plain object in tests). Returns an
// error string, or null when the file is acceptable.
export function validateImageFile(file, maxBytes = MAX_IMAGE_BYTES) {
  if (!file || typeof file !== 'object') return 'Choose an image file.';
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return 'Use a PNG, JPG, or WebP image.';
  if (!file.size) return 'That image file is empty.';
  if (file.size > maxBytes) return `Choose an image no larger than ${(maxBytes / (1024 * 1024)).toFixed(0)} MB.`;
  return null;
}

// A base64 image data URI: data:image/<type>;base64,<payload>
export function isImageDataUri(value) {
  return typeof value === 'string' && /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/]+=*$/.test(value);
}

// Read a File/Blob as a Base64 data URI. Browser-only (uses FileReader).
export function readImageAsDataUri(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The image could not be read. Try another file.'));
    reader.onload = () => {
      const result = reader.result;
      if (isImageDataUri(result)) resolve(result);
      else reject(new Error('Only PNG, JPG, or WebP images are supported.'));
    };
    reader.readAsDataURL(file);
  });
}
