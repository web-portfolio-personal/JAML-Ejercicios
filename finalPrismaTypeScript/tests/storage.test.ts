/**
 * Storage service unit tests — branch coverage for uploadImage, uploadPdf, deleteResource.
 * Mocks cloudinary and sharp to avoid external dependencies.
 */

// ── Mocks (hoisted by jest before imports) ─────────────────────────────────────
const mockUploadStreamFn = jest.fn();
const mockDestroyFn      = jest.fn();
const mockSharpInstance  = {
  resize: jest.fn().mockReturnThis(),
  webp:   jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('optimized-image')),
};

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: mockUploadStreamFn,
      destroy:       mockDestroyFn,
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('sharp', () => jest.fn(() => mockSharpInstance));

// ── Imports (after mocks) ──────────────────────────────────────────────────────
import { describe, it, expect, beforeEach } from '@jest/globals';
import { uploadImage, uploadPdf, deleteResource } from '../src/services/storage.service';

// ── Helpers ────────────────────────────────────────────────────────────────────
const fakeBuffer = Buffer.from('fake-image-data');

const makeUploadStreamSuccess = (url: string) => {
  mockUploadStreamFn.mockImplementation(
    (_opts: unknown, cb: (err: null, result: { secure_url: string }) => void) => {
      cb(null, { secure_url: url });
      return { end: jest.fn() };
    }
  );
};

const makeUploadStreamError = (error: Error) => {
  mockUploadStreamFn.mockImplementation(
    (_opts: unknown, cb: (err: Error, result: null) => void) => {
      cb(error, null);
      return { end: jest.fn() };
    }
  );
};

const makeUploadStreamNoResult = () => {
  mockUploadStreamFn.mockImplementation(
    (_opts: unknown, cb: (err: null, result: null) => void) => {
      cb(null, null);
      return { end: jest.fn() };
    }
  );
};

// ── uploadImage ────────────────────────────────────────────────────────────────

describe('uploadImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset sharp mock
    mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from('optimized-image'));
  });

  it('resolves with secure_url on success', async () => {
    makeUploadStreamSuccess('https://res.cloudinary.com/test/image.webp');

    const url = await uploadImage(fakeBuffer, 'bildyapp', 'test-id');
    expect(url).toBe('https://res.cloudinary.com/test/image.webp');
    expect(mockUploadStreamFn).toHaveBeenCalled();
  });

  it('uses default folder when not provided', async () => {
    makeUploadStreamSuccess('https://res.cloudinary.com/test/default.webp');

    const url = await uploadImage(fakeBuffer);
    expect(url).toBe('https://res.cloudinary.com/test/default.webp');
  });

  it('rejects when cloudinary returns an error', async () => {
    makeUploadStreamError(new Error('Cloudinary upload failed'));

    await expect(uploadImage(fakeBuffer)).rejects.toThrow('Cloudinary upload failed');
  });

  it('rejects when cloudinary returns no result', async () => {
    makeUploadStreamNoResult();

    await expect(uploadImage(fakeBuffer)).rejects.toThrow('No result from Cloudinary');
  });
});

// ── uploadPdf ─────────────────────────────────────────────────────────────────

describe('uploadPdf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves with secure_url on success', async () => {
    makeUploadStreamSuccess('https://res.cloudinary.com/test/doc.pdf');

    const url = await uploadPdf(fakeBuffer, 'bildyapp/pdfs', 'pdf-id');
    expect(url).toBe('https://res.cloudinary.com/test/doc.pdf');
  });

  it('uses default folder when not provided', async () => {
    makeUploadStreamSuccess('https://res.cloudinary.com/test/default.pdf');

    const url = await uploadPdf(fakeBuffer);
    expect(url).toBe('https://res.cloudinary.com/test/default.pdf');
  });

  it('rejects when cloudinary returns an error', async () => {
    makeUploadStreamError(new Error('PDF upload failed'));

    await expect(uploadPdf(fakeBuffer)).rejects.toThrow('PDF upload failed');
  });

  it('rejects when cloudinary returns no result', async () => {
    makeUploadStreamNoResult();

    await expect(uploadPdf(fakeBuffer)).rejects.toThrow('No result from Cloudinary');
  });
});

// ── deleteResource ────────────────────────────────────────────────────────────

describe('deleteResource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls cloudinary.uploader.destroy with publicId and resourceType', async () => {
    mockDestroyFn.mockResolvedValue({ result: 'ok' });

    await deleteResource('bildyapp/logo-abc', 'image');
    expect(mockDestroyFn).toHaveBeenCalledWith('bildyapp/logo-abc', { resource_type: 'image' });
  });

  it('uses default resource type "image" when not provided', async () => {
    mockDestroyFn.mockResolvedValue({ result: 'ok' });

    await deleteResource('bildyapp/some-file');
    expect(mockDestroyFn).toHaveBeenCalledWith('bildyapp/some-file', { resource_type: 'image' });
  });

  it('logs error and does not throw when cloudinary destroy fails (Error instance)', async () => {
    mockDestroyFn.mockRejectedValue(new Error('Destroy failed'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(deleteResource('bildyapp/bad-id')).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error eliminando recurso en Cloudinary:',
      'Destroy failed'
    );
    consoleSpy.mockRestore();
  });

  it('logs error and does not throw when cloudinary destroy fails (non-Error)', async () => {
    mockDestroyFn.mockRejectedValue('string error');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(deleteResource('bildyapp/bad-id')).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error eliminando recurso en Cloudinary:',
      'string error'
    );
    consoleSpy.mockRestore();
  });
});
