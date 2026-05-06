/**
 * Unit tests — storage.service.js
 *
 * Uses jest.unstable_mockModule (ESM-safe) to mock cloudinary and sharp.
 * Covers: uploadImage (success, error), uploadPdf (success, error),
 *         deleteResource (success, Error catch, non-Error catch).
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ── Mock factories ────────────────────────────────────────────────────────────

const mockDestroyFn = jest.fn();

// upload_stream mock: each test overrides this implementation so
// the callback is invoked inside end() — after upload_stream is called.
const mockUploadStreamFn = jest.fn();

const mockSharpInstance = {
  resize: jest.fn().mockReturnThis(),
  webp:   jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('optimized-image')),
};

// ── Register mocks BEFORE importing the module ────────────────────────────────

jest.unstable_mockModule('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: mockUploadStreamFn,
      destroy:       mockDestroyFn,
    },
  },
}));

jest.unstable_mockModule('sharp', () => ({
  default: jest.fn(() => mockSharpInstance),
}));

// ── Dynamic import AFTER mocks are registered ─────────────────────────────────

const { uploadImage, uploadPdf, deleteResource } = await import('../src/services/storage.service.js');

// ── Shared test data ──────────────────────────────────────────────────────────

const fakeBuffer = Buffer.from('fake-image-data');

// ── uploadImage ───────────────────────────────────────────────────────────────

describe('uploadImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSharpInstance.resize.mockReturnThis();
    mockSharpInstance.webp.mockReturnThis();
    mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from('optimized'));
  });

  it('resolves with secure_url on success', async () => {
    // Callback invoked inside end() — ensures it runs after upload_stream is called
    mockUploadStreamFn.mockImplementation((opts, cb) => ({
      end: jest.fn(() => cb(null, { secure_url: 'https://res.cloudinary.com/test/img.webp' })),
    }));

    const url = await uploadImage(fakeBuffer, 'bildyapp', 'pub-id-1');
    expect(url).toBe('https://res.cloudinary.com/test/img.webp');
  });

  it('rejects when Cloudinary returns an error', async () => {
    mockUploadStreamFn.mockImplementation((opts, cb) => ({
      end: jest.fn(() => cb(new Error('Cloudinary upload failed'), null)),
    }));

    await expect(uploadImage(fakeBuffer, 'bildyapp', 'pub-id-2'))
      .rejects.toThrow('Cloudinary upload failed');
  });

  it('uses default folder "bildyapp" when not specified', async () => {
    mockUploadStreamFn.mockImplementation((opts, cb) => ({
      end: jest.fn(() => cb(null, { secure_url: 'https://res.cloudinary.com/default.webp' })),
    }));

    const url = await uploadImage(fakeBuffer, undefined, 'pub-id-3');
    expect(url).toBe('https://res.cloudinary.com/default.webp');
  });
});

// ── uploadPdf ─────────────────────────────────────────────────────────────────

describe('uploadPdf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves with secure_url on success', async () => {
    mockUploadStreamFn.mockImplementation((opts, cb) => ({
      end: jest.fn(() => cb(null, { secure_url: 'https://res.cloudinary.com/test/albaran.pdf' })),
    }));

    const pdfBuffer = Buffer.from('%PDF-1.4 fake');
    const url = await uploadPdf(pdfBuffer, 'bildyapp/pdfs', 'albaran-123');
    expect(url).toBe('https://res.cloudinary.com/test/albaran.pdf');
  });

  it('rejects when Cloudinary returns an error', async () => {
    mockUploadStreamFn.mockImplementation((opts, cb) => ({
      end: jest.fn(() => cb(new Error('PDF upload failed'), null)),
    }));

    const pdfBuffer = Buffer.from('%PDF-1.4 fake');
    await expect(uploadPdf(pdfBuffer, 'bildyapp/pdfs', 'albaran-456'))
      .rejects.toThrow('PDF upload failed');
  });

  it('uses default folder "bildyapp/pdfs" when not specified', async () => {
    mockUploadStreamFn.mockImplementation((opts, cb) => ({
      end: jest.fn(() => cb(null, { secure_url: 'https://res.cloudinary.com/default.pdf' })),
    }));

    const url = await uploadPdf(fakeBuffer, undefined, 'pdf-default');
    expect(url).toBe('https://res.cloudinary.com/default.pdf');
  });
});

// ── deleteResource ────────────────────────────────────────────────────────────

describe('deleteResource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls cloudinary.uploader.destroy with correct args', async () => {
    mockDestroyFn.mockResolvedValue({ result: 'ok' });

    await deleteResource('bildyapp/signatures/sig-abc', 'image');

    expect(mockDestroyFn).toHaveBeenCalledWith(
      'bildyapp/signatures/sig-abc',
      { resource_type: 'image' }
    );
  });

  it('catches and logs when destroy throws an Error instance', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockDestroyFn.mockRejectedValue(new Error('destroy failed'));

    await deleteResource('bildyapp/signatures/sig-xyz');

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('uses default resourceType "image" when not specified', async () => {
    mockDestroyFn.mockResolvedValue({ result: 'ok' });

    await deleteResource('bildyapp/pdfs/pdf-001');

    expect(mockDestroyFn).toHaveBeenCalledWith(
      'bildyapp/pdfs/pdf-001',
      { resource_type: 'image' }
    );
  });
});
