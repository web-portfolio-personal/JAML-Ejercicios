/**
 * Unit tests — branch coverage targets
 *
 * Covers:
 *  - generateDeliveryNotePdf  (pdf.service.js)     — all format/sign/description branches
 *  - AppError                 (utils/AppError.js)   — status ternary (4xx vs 5xx)
 *  - errorHandler             (middleware/…)         — CastError, 11000, ValidationError,
 *                                                      LIMIT_FILE_SIZE, LIMIT_FILE_TYPE,
 *                                                      statusCode >= 500, isDev stack
 *  - notFoundHandler          (middleware/…)         — basic path
 */

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import mongoose from 'mongoose';
import zlib from 'node:zlib';
import checkRole from '../src/middleware/role.middleware.js';

// ── Minimal valid PNG generator ───────────────────────────────────────────────
// Builds a 1×1 white RGB PNG using proper zlib compression and CRC32.
function createMinimalPng() {
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const t = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crc]);
  };
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.from([0,0,0,1, 0,0,0,1, 8, 2, 0, 0, 0]); // 1×1 RGB
  const raw  = Buffer.from([0, 255, 255, 255]); // filter=none, white pixel
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
import { generateDeliveryNotePdf } from '../src/services/pdf.service.js';
import AppError from '../src/utils/AppError.js';
import { notFoundHandler, errorHandler } from '../src/middleware/error-handler.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

const mockRes = () => {
  const res = { _status: 200, _body: null };
  res.status = (code) => { res._status = code; return res; };
  res.json   = (body) => { res._body = body; return res; };
  return res;
};

const mockReq = (overrides = {}) => ({
  method: 'GET',
  originalUrl: '/test',
  ...overrides,
});

const BASE_NOTE = {
  _id:      'note123',
  workDate: new Date('2024-06-01'),
  format:   'hours',
};

const BASE_USER    = { name: 'Juan', lastName: 'García', email: 'juan@test.com', nif: '12345678A' };
const BASE_CLIENT  = { name: 'ClienteCo', cif: 'B12345678', email: 'client@test.com' };
const BASE_PROJECT = { name: 'Obra Norte', projectCode: 'PRJ-001' };

// ── checkRole middleware ───────────────────────────────────────────────────────

describe('checkRole', () => {
  it('calls next(AppError 401) when req.user is not set', () => {
    const next = jest.fn();
    checkRole('admin')({}, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('calls next(AppError 403) when user has a different role', () => {
    const next = jest.fn();
    checkRole('admin')({ user: { role: 'user' } }, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('calls next() with no args when role is permitted', () => {
    const next = jest.fn();
    checkRole('admin')({ user: { role: 'admin' } }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });
});

// ── AppError ───────────────────────────────────────────────────────────────────

describe('AppError', () => {
  it('sets status to "fail" for 4xx codes', () => {
    const err = new AppError('Bad', 400);
    expect(err.status).toBe('fail');
    expect(err.isOperational).toBe(true);
  });

  it('sets status to "error" for 5xx codes', () => {
    const err = new AppError('Internal', 500);
    expect(err.status).toBe('error');
  });

  it('factory methods produce correct status codes', () => {
    expect(AppError.badRequest().statusCode).toBe(400);
    expect(AppError.unauthorized().statusCode).toBe(401);
    expect(AppError.forbidden().statusCode).toBe(403);
    expect(AppError.notFound().statusCode).toBe(404);
    expect(AppError.conflict().statusCode).toBe(409);
    expect(AppError.tooManyRequests().statusCode).toBe(429);
    expect(AppError.internal().statusCode).toBe(500);
  });
});

// ── notFoundHandler ────────────────────────────────────────────────────────────

describe('notFoundHandler', () => {
  it('returns 404 with the correct message', () => {
    const req = mockReq({ method: 'GET', originalUrl: '/nonexistent' });
    const res = mockRes();
    notFoundHandler(req, res, () => {});
    expect(res._status).toBe(404);
    expect(res._body.error).toBe(true);
    expect(res._body.message).toContain('GET');
    expect(res._body.message).toContain('/nonexistent');
  });
});

// ── errorHandler ──────────────────────────────────────────────────────────────

describe('errorHandler', () => {
  const req  = mockReq();

  it('converts mongoose CastError to 400', () => {
    const castErr = new mongoose.Error.CastError('ObjectId', 'bad-id', '_id');
    const res = mockRes();
    errorHandler(castErr, req, res, () => {});
    expect(res._status).toBe(400);
    expect(res._body.message).toContain('ID inválido');
  });

  it('converts duplicate-key error (code 11000) to 409', () => {
    const dupErr = { code: 11000, keyValue: { email: 'x@x.com' } };
    const res = mockRes();
    errorHandler(dupErr, req, res, () => {});
    expect(res._status).toBe(409);
    expect(res._body.message).toContain('email');
  });

  it('converts duplicate-key error without keyValue to 409 with generic field', () => {
    const dupErr = { code: 11000 }; // keyValue undefined
    const res = mockRes();
    errorHandler(dupErr, req, res, () => {});
    expect(res._status).toBe(409);
    expect(res._body.message).toContain('campo');
  });

  it('converts mongoose ValidationError to 400 with details', () => {
    const valErr = new mongoose.Error.ValidationError();
    valErr.errors.name = { message: 'Name is required' };
    const res = mockRes();
    errorHandler(valErr, req, res, () => {});
    expect(res._status).toBe(400);
    expect(res._body.details).toContain('Name is required');
  });

  it('converts LIMIT_FILE_SIZE multer error to 400', () => {
    const multerErr = { code: 'LIMIT_FILE_SIZE', message: 'File too large' };
    const res = mockRes();
    errorHandler(multerErr, req, res, () => {});
    expect(res._status).toBe(400);
    expect(res._body.message).toContain('5 MB');
  });

  it('converts LIMIT_FILE_TYPE multer error to 400', () => {
    const multerErr = { code: 'LIMIT_FILE_TYPE', message: 'Only images allowed', statusCode: 400 };
    const res = mockRes();
    errorHandler(multerErr, req, res, () => {});
    expect(res._status).toBe(400);
    expect(res._body.message).toBe('Only images allowed');
  });

  it('handles generic 500 errors (statusCode >= 500 branch)', () => {
    const internalErr = AppError.internal('Something blew up');
    const res = mockRes();
    errorHandler(internalErr, req, res, () => {});
    expect(res._status).toBe(500);
    expect(res._body.error).toBe(true);
  });

  it('includes stack in development mode for non-operational errors', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const nonOpErr = new Error('raw error');
    nonOpErr.statusCode = 500;
    // isOperational is undefined/falsy for plain Error
    const res = mockRes();
    errorHandler(nonOpErr, req, res, () => {});
    expect(res._body.stack).toBeDefined();
    process.env.NODE_ENV = originalEnv;
  });

  it('does NOT include stack in test mode', () => {
    // NODE_ENV is 'test' here (set by jest.setup.js)
    const nonOpErr = new Error('raw error in test');
    nonOpErr.statusCode = 500;
    const res = mockRes();
    errorHandler(nonOpErr, req, res, () => {});
    expect(res._body.stack).toBeUndefined();
  });

  it('uses err.details in response when present', () => {
    const err = Object.assign(AppError.badRequest('Validation'), {
      details: ['Field A is required'],
    });
    const res = mockRes();
    errorHandler(err, req, res, () => {});
    expect(res._body.details).toEqual(['Field A is required']);
  });

  it('falls back to 500 when no statusCode on error', () => {
    const plainErr = new Error('oops');
    const res = mockRes();
    errorHandler(plainErr, req, res, () => {});
    expect(res._status).toBe(500);
  });
});

// ── generateDeliveryNotePdf ────────────────────────────────────────────────────

describe('generateDeliveryNotePdf', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('embeds signature image when fetch succeeds (response.ok = true)', async () => {
    // Build a proper 1×1 white PNG so pdfkit can embed it
    const validPng = createMinimalPng();
    global.fetch = async () => ({
      ok: true,
      arrayBuffer: async () => validPng,
    });

    const note = {
      ...BASE_NOTE,
      format:       'hours',
      hours:        4,
      signed:       true,
      signedAt:     new Date('2024-06-02'),
      signatureUrl: 'https://res.cloudinary.com/test/sign.webp',
    };

    const buf = await generateDeliveryNotePdf({ note, user: BASE_USER, client: BASE_CLIENT, project: BASE_PROJECT });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(500);
  });

  it('falls back to URL text when fetch returns response.ok = false', async () => {
    global.fetch = async () => ({ ok: false });

    const note = {
      ...BASE_NOTE,
      format:       'material',
      material:     'Cemento',
      quantity:     10,
      unit:         'sacos',
      signed:       true,
      signedAt:     new Date('2024-06-02'),
      signatureUrl: 'https://res.cloudinary.com/test/sign.webp',
    };

    const buf = await generateDeliveryNotePdf({ note, user: BASE_USER, client: BASE_CLIENT, project: BASE_PROJECT });
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  it('falls back to URL text when fetch throws (network error)', async () => {
    global.fetch = async () => { throw new Error('Network error'); };

    const note = {
      ...BASE_NOTE,
      format:       'material',
      description:  'Materiales de construcción',
      material:     'Cemento',
      quantity:     10,
      unit:         'sacos',
      signed:       true,
      signedAt:     new Date('2024-06-02'),
      signatureUrl: 'https://res.cloudinary.com/test/sign.webp',
    };

    const buf = await generateDeliveryNotePdf({ note, user: BASE_USER, client: BASE_CLIENT, project: BASE_PROJECT });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(500);
  });

  it('generates a PDF buffer for an unsigned "hours" note with workers and hours', async () => {
    const note = {
      ...BASE_NOTE,
      format:  'hours',
      hours:   8,
      workers: [
        { name: 'Operario A', hours: 4 },
        { name: 'Operario B', hours: 4 },
      ],
      signed: false,
    };

    const buf = await generateDeliveryNotePdf({ note, user: BASE_USER, client: BASE_CLIENT, project: BASE_PROJECT });
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  it('generates a PDF for "hours" note without hours and without workers', async () => {
    // Covers: note.hours == null (false branch) AND note.workers empty (false branch)
    const note = {
      ...BASE_NOTE,
      format:  'hours',
      hours:   null,
      workers: [],
      signed:  false,
    };

    const buf = await generateDeliveryNotePdf({ note, user: BASE_USER, client: BASE_CLIENT, project: BASE_PROJECT });
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  it('generates a PDF for a signed note WITHOUT signatureUrl', async () => {
    // Covers: note.signed = true AND note.signatureUrl falsy
    const note = {
      ...BASE_NOTE,
      format:  'hours',
      hours:   4,
      signed:  true,
      signedAt: new Date('2024-06-02'),
      // signatureUrl omitted
    };

    const buf = await generateDeliveryNotePdf({ note, user: BASE_USER, client: BASE_CLIENT, project: BASE_PROJECT });
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  it('generates a PDF for "material" note without description', async () => {
    // Covers: note.description falsy (false branch)
    const note = {
      ...BASE_NOTE,
      format:   'material',
      material: 'Arena',
      quantity: 5,
      unit:     'm3',
      signed:   false,
      // description omitted
    };

    const buf = await generateDeliveryNotePdf({ note, user: BASE_USER, client: BASE_CLIENT, project: BASE_PROJECT });
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  it('generates a PDF when user has no nif (falsy branch)', async () => {
    const userNoNif = { name: 'Ana', lastName: 'López', email: 'ana@test.com' };
    const note = { ...BASE_NOTE, format: 'hours', signed: false };

    const buf = await generateDeliveryNotePdf({ note, user: userNoNif, client: BASE_CLIENT, project: BASE_PROJECT });
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  it('generates a PDF when workers is undefined (falsy branch)', async () => {
    const note = {
      ...BASE_NOTE,
      format:  'hours',
      hours:   3,
      workers: undefined,
      signed:  false,
    };

    const buf = await generateDeliveryNotePdf({ note, user: BASE_USER, client: BASE_CLIENT, project: BASE_PROJECT });
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  it('generates a PDF with all optional fields null/undefined (covers || and ?? false sides)', async () => {
    // user with no name, lastName, nif  → user.name || '' and user.lastName || '' use right side
    const minimalUser = { email: undefined };           // even email undefined
    // client with no name, cif, email  → all || and ?: false sides
    const minimalClient = { name: null, cif: null, email: null };
    // project with no name or code     → || and ?: false sides
    const minimalProject = { name: null, projectCode: null };
    // material note with null material, quantity, unit → || and ?? false sides
    const note = {
      ...BASE_NOTE,
      format:   'material',
      material: null,
      quantity: null,
      unit:     null,
      signed:   false,
    };

    const buf = await generateDeliveryNotePdf({
      note,
      user:    minimalUser,
      client:  minimalClient,
      project: minimalProject,
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
  });
});
