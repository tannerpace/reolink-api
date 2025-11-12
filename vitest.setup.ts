/**
 * Vitest setup file - runs before all tests
 * Polyfills browser APIs for Node.js environment
 */

// Polyfill File for Node.js in Vitest
// This is required for undici's fetch implementation which expects File to exist
if (typeof File === 'undefined') {
  global.File = class File extends Blob {
    name: string;
    lastModified: number;

    constructor(parts: BlobPart[], filename: string, options: FilePropertyBag = {}) {
      super(parts, options);
      this.name = filename || '';
      this.lastModified = options.lastModified || Date.now();
    }
  } as any;
}
