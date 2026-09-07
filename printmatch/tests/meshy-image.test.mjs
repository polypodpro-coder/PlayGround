import test from 'node:test';
import assert from 'node:assert/strict';
import { validateImageFile, isImageDataUri, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '../src/lib/meshyImage.js';

test('validateImageFile accepts supported types within the size cap', () => {
  for (const type of ALLOWED_IMAGE_TYPES) {
    assert.equal(validateImageFile({ type, size: 1024, name: 'x' }), null);
  }
});

test('validateImageFile rejects wrong type, empty, oversized, and missing input', () => {
  assert.match(validateImageFile({ type: 'image/gif', size: 1024 }), /PNG, JPG, or WebP/);
  assert.match(validateImageFile({ type: 'image/png', size: 0 }), /empty/);
  assert.match(validateImageFile({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 }), /larger than/);
  assert.match(validateImageFile(null), /Choose an image/);
});

test('isImageDataUri recognizes only base64 image data URIs', () => {
  assert.equal(isImageDataUri('data:image/png;base64,AAAA'), true);
  assert.equal(isImageDataUri('data:image/jpeg;base64,/9j/4AAQ='), true);
  assert.equal(isImageDataUri('data:image/webp;base64,UklGR'), true);
  assert.equal(isImageDataUri('data:text/plain;base64,AAAA'), false);
  assert.equal(isImageDataUri('https://example.com/x.png'), false);
  assert.equal(isImageDataUri(''), false);
});
