require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('./models/User');
const Customer = require('./models/Customer');
const ImportHistory = require('./models/ImportHistory');
const NoticeFile = require('./models/NoticeFile');
const auth = require('./middleware/auth');

const PORT = Number(process.env.PORT) || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lifebacktax_onprem';
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const ON_VERCEL = Boolean(process.env.VERCEL);
const UPLOAD_DIR = ON_VERCEL
  ? path.join('/tmp', 'lifebacktax-uploads')
  : path.join(__dirname, 'uploads');
const MAX_UPLOAD_BYTES = ON_VERCEL ? 4 * 1024 * 1024 : 15 * 1024 * 1024;
const CODE_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const CODE_LENGTH = 12;
const BULK_CHUNK = 500;

const FIELD_LIMITS = {
  dateSubmitted: 40,
  timeSubmitted: 40,
  ipAddress: 64,
  variant: 32,
  pageUuid: 80,
  pageUrl: 500,
  pageName: 200,
  firstName: 200,
  middleInitial: 8,
  lastName: 200,
  email: 320,
  phone: 40,
  amountOwed: 80,
  taxType: 40,
  stateName: 80,
  filingType: 40,
  situationDetails: 4000,
  runInvestigation: 300,
  ssn: 20,
  dob: 40,
  address: 500,
  isJoint: 80,
  spouseInfo: 300,
  businessEin: 200,
  noticeFileUrl: 2000,
};
const OPTIONAL_FIELDS = Object.keys(FIELD_LIMITS);

const HEADER_MAP = {
  code: 'code',
  customercode: 'code',
  datesubmitted: 'dateSubmitted',
  timesubmitted: 'timeSubmitted',
  ipaddress: 'ipAddress',
  variant: 'variant',
  pageuuid: 'pageUuid',
  pageurl: 'pageUrl',
  pagename: 'pageName',
  firstname: 'firstName',
  middleinitial: 'middleInitial',
  lastname: 'lastName',
  email: 'email',
  emailaddress: 'email',
  phone: 'phone',
  phonenumber: 'phone',
  mobile: 'phone',
  amountowed: 'amountOwed',
  debtamount: 'amountOwed',
  taxdebt: 'amountOwed',
  debt: 'amountOwed',
  taxtype: 'taxType',
  statename: 'stateName',
  state: 'stateName',
  filingtype: 'filingType',
  situationdetails: 'situationDetails',
  runinvestigation: 'runInvestigation',
  ssn: 'ssn',
  taxid: 'ssn',
  dob: 'dob',
  dateofbirth: 'dob',
  address: 'address',
  streetaddress: 'address',
  fullstreetaddress: 'address',
  isjoint: 'isJoint',
  jointfilingstatus: 'isJoint',
  spouseinfo: 'spouseInfo',
  spousename: 'spouseInfo',
  businessein: 'businessEin',
  businessnameein: 'businessEin',
  noticefileurl: 'noticeFileUrl',
  noticeurl: 'noticeFileUrl',
};

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const DUMMY_PASSWORD_HASH = bcrypt.hashSync('lifebacktax-timing-pad', 12);

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

function isAllowedOrigin(origin) {
  const extras = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (extras.includes(origin)) return true;

  let url;
  try {
    url = new URL(origin);
  } catch (_err) {
    return false;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return true;
  if (host === 'lbt-mailer-dashboard.vercel.app') return true;
  if (host.endsWith('.vercel.app') && host.includes('lbt-mailer-dashboard')) return true;
  if (host === 'lifebacktax.com' || host.endsWith('.lifebacktax.com')) return true;
  if (host === 'unbouncepages.com' || host.endsWith('.unbouncepages.com')) return true;
  return false;
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || isAllowedOrigin(origin)) return callback(null, true);
      return callback(null, false);
    },
  })
);

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use(express.json({ limit: '1mb' }));

function rateLimit(max, windowMs) {
  const hits = new Map();

  return function limit(req, res, next) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((stamp) => now - stamp < windowMs);

    if (recent.length >= max) {
      res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({ message: 'Too many requests. Try again shortly.' });
    }

    recent.push(now);
    hits.set(ip, recent);

    if (hits.size > 5000) {
      for (const [key, stamps] of hits) {
        if (stamps.every((stamp) => now - stamp >= windowMs)) hits.delete(key);
      }
    }

    return next();
  };
}

const limitAuth = rateLimit(10, 60 * 1000);
const limitLookup = rateLimit(60, 60 * 1000);

function canonicalizeHeader(header) {
  const key = String(header || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  return HEADER_MAP[key] || null;
}

function clip(value, max) {
  const text = value == null ? '' : String(value).trim();
  return text.length > max ? text.slice(0, max) : text;
}

function sanitizeCode(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
}

function safeNoticeUrl(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > 2000 || text.toLowerCase() === 'notice_file_url') return '';
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    return url.toString();
  } catch (_err) {
    return '';
  }
}

function noticeFileId(value) {
  const match = String(value || '').match(/\/api\/files\/([a-f0-9]{24})/i);
  return match ? match[1] : '';
}

async function realNoticeUrl(code, value) {
  const safe = safeNoticeUrl(value);
  if (!safe) return '';
  const fileId = noticeFileId(safe);
  if (!fileId) return safe;
  const file = await NoticeFile.findById(fileId).select('code').lean();
  if (!file || (code && file.code !== code)) return '';
  return safe;
}

function randomCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

async function generateUniqueCode(reserved) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomCode();
    if (reserved.has(code)) continue;
    const exists = await Customer.exists({ code });
    if (!exists) return code;
  }
  throw new Error('Could not generate a unique customer code');
}

function isEmptyRow(record) {
  return !record.code && OPTIONAL_FIELDS.every((field) => !record[field]);
}

function parseSubmittedAt(dateValue, timeValue) {
  const date = String(dateValue || '').trim();
  const time = String(timeValue || '').replace(/\s*utc\s*/i, ' ').trim();
  if (!date) return null;
  const parsed = new Date(time ? `${date} ${time}` : date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toStoredRecord(record) {
  const stored = {};
  for (const field of OPTIONAL_FIELDS) {
    stored[field] = record[field] || '';
  }
  stored.debtAmount = record.amountOwed || '';
  if (record.submittedAt) stored.submittedAt = record.submittedAt;
  return stored;
}

async function removeFile(filePath) {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('[lifebacktax] Failed to delete temporary upload:', err.message);
    }
  }
}

function parseCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    let recognized = false;
    let settled = false;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      error.status = error.status || 400;
      reject(error);
    };

    const succeed = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    fs.createReadStream(filePath)
      .on('error', () => fail(new Error('Unable to read the uploaded CSV')))
      .pipe(
        csv({
          mapHeaders: ({ header, index }) => {
            const canonical = canonicalizeHeader(header);
            if (canonical) recognized = true;
            return canonical || `__ignored_${index}`;
          },
        })
      )
      .on('data', (row) => rows.push(row))
      .on('error', () => fail(new Error('The CSV file could not be parsed')))
      .on('end', () => {
        if (!recognized) {
          fail(
            new Error(
              'CSV must include a header row. Recognized columns include code, first_name, last_name, email, phone_number, amount_owed, tax_type, state_name, and address'
            )
          );
          return;
        }
        succeed(rows);
      });
  });
}

async function importRows(rows) {
  const reserved = new Set();
  const normalized = [];
  let skippedEmpty = 0;
  let invalid = 0;
  let generatedCodes = 0;

  for (const row of rows) {
    const record = { code: sanitizeCode(row.code) };
    for (const field of OPTIONAL_FIELDS) {
      record[field] = clip(row[field], FIELD_LIMITS[field]);
    }

    if (isEmptyRow(record)) {
      skippedEmpty += 1;
      continue;
    }

    if (record.code.length > 128) {
      invalid += 1;
      continue;
    }

    if (!record.code) {
      record.code = await generateUniqueCode(reserved);
      record.generated = true;
      generatedCodes += 1;
    }

    record.submittedAt = parseSubmittedAt(record.dateSubmitted, record.timeSubmitted);
    reserved.add(record.code);
    normalized.push(record);
  }

  const byCode = new Map();
  let duplicateRows = 0;
  for (const record of normalized) {
    if (byCode.has(record.code)) duplicateRows += 1;
    byCode.set(record.code, record);
  }

  const records = Array.from(byCode.values());
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  const errors = [];

  for (let offset = 0; offset < records.length; offset += BULK_CHUNK) {
    const chunk = records.slice(offset, offset + BULK_CHUNK);
    const ops = chunk.map((record) => ({
      updateOne: {
        filter: { code: record.code },
        update: {
          $set: toStoredRecord(record),
          $setOnInsert: {
            code: record.code,
            created_at: new Date(),
          },
        },
        upsert: true,
      },
    }));

    try {
      const result = await Customer.bulkWrite(ops, { ordered: false });
      inserted += result.upsertedCount || 0;
      updated += result.modifiedCount || 0;
      unchanged += Math.max(0, (result.matchedCount || 0) - (result.modifiedCount || 0));
    } catch (err) {
      const result = err.result || {};
      inserted += result.upsertedCount || result.nUpserted || 0;
      updated += result.modifiedCount || result.nModified || 0;
      const writeErrors = err.writeErrors || [];
      if (!writeErrors.length) throw err;
      for (const writeError of writeErrors) {
        errors.push(
          writeError.errmsg ||
            writeError.message ||
            (writeError.err && (writeError.err.errmsg || writeError.err.message)) ||
            'A row failed to save'
        );
      }
    }
  }

  return {
    totalRows: rows.length,
    processed: records.length,
    inserted,
    updated,
    unchanged,
    skipped: skippedEmpty + invalid,
    skippedEmpty,
    invalid,
    generatedCodes,
    duplicateRows,
    codes: records.map((record) => record.code),
    errors: errors.slice(0, 20),
  };
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, UPLOAD_DIR),
    filename: (_req, _file, callback) => {
      callback(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.csv`);
    },
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    const name = (file.originalname || '').toLowerCase();
    const type = file.mimetype || '';
    const csvType =
      type === '' ||
      type === 'text/csv' ||
      type === 'application/vnd.ms-excel' ||
      type === 'application/csv' ||
      type === 'text/plain' ||
      type === 'application/octet-stream';
    if (name.endsWith('.csv') && csvType) return callback(null, true);
    return callback(new Error('Only CSV files are allowed'));
  },
});

const noticeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
});

function noticeKindOf(file) {
  const name = (file.originalname || '').toLowerCase();
  const type = (file.mimetype || '').toLowerCase();
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (type === 'image/jpeg' || type === 'image/png' || type === 'image/gif' || type === 'image/webp') return 'image';
  if (/\.(png|jpe?g|gif|webp)$/.test(name)) return 'image';
  return '';
}

function noticeMime(kind, file) {
  const type = (file.mimetype || '').toLowerCase();
  if (kind === 'pdf') return 'application/pdf';
  if (type.startsWith('image/')) return type;
  const name = (file.originalname || '').toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.gif')) return 'image/gif';
  if (name.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

function safeFileName(name, kind) {
  const base = String(name || 'notice')
    .replace(/[/\\]/g, '')
    .replace(/[^\w.\- ]+/g, '')
    .trim()
    .slice(0, 180);
  if (base) return base;
  return kind === 'pdf' ? 'notice.pdf' : 'notice.jpg';
}

function publicBase(req) {
  const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${proto}://${host}`;
}

function handleNoticeUpload(req, res, next) {
  noticeUpload.single('file')(req, res, (err) => {
    if (!err) return next();
    const message =
      err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
        ? 'Notice file exceeds the 4 MB limit'
        : err.message || 'Upload failed';
    return res.status(400).json({ message });
  });
}

function handleUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    const leftover = req.file && req.file.path;
    if (leftover) fs.unlink(leftover, () => {});
    const message =
      err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
        ? `CSV file exceeds the ${ON_VERCEL ? '4 MB' : '15 MB'} limit`
        : err.message || 'Upload failed';
    return res.status(400).json({ message });
  });
}

function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function assertRuntimeConfig() {
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set and be at least 32 characters.');
  }
}

let dbPromise = null;

function ensureDb() {
  assertRuntimeConfig();
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  if (!dbPromise) {
    dbPromise = mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 }).catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

app.get('/', (_req, res) => {
  res.json({ service: 'lifebacktax-api', health: '/api/health' });
});

app.use(async (_req, res, next) => {
  try {
    await ensureDb();
    return next();
  } catch (err) {
    console.error('[lifebacktax] Database connection failed:', err.message);
    return res.status(503).json({ message: 'Database unavailable' });
  }
});

app.get('/api/health', (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    ok: connected,
    service: 'lifebacktax-api',
  });
});

app.get('/api/lookup', limitLookup, async (req, res) => {
  try {
    if (typeof req.query.code !== 'string') {
      return res.status(400).json({ message: 'A code query parameter is required' });
    }

    const code = sanitizeCode(req.query.code);
    if (!code || code.length > 128) {
      return res.status(400).json({ message: 'A code query parameter is required' });
    }

    const customer = await Customer.findOne({ code })
      .select('firstName middleInitial lastName email phone amountOwed debtAmount taxType stateName filingType address situationDetails noticeFileUrl')
      .lean();

    res.set('Cache-Control', 'no-store');

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    return res.json({
      firstName: customer.firstName || '',
      middleInitial: customer.middleInitial || '',
      lastName: customer.lastName || '',
      email: customer.email || '',
      phone: customer.phone || '',
      debtAmount: customer.amountOwed || customer.debtAmount || '',
      taxType: customer.taxType || '',
      stateName: customer.stateName || '',
      filingType: customer.filingType || '',
      address: customer.address || '',
      situationDetails: customer.situationDetails || '',
      noticeFileUrl: await realNoticeUrl(code, customer.noticeFileUrl),
    });
  } catch (err) {
    console.error('[lifebacktax] Lookup failed:', err.message);
    return res.status(500).json({ message: 'Lookup failed' });
  }
});

app.post('/api/lookup/file', handleNoticeUpload, async (req, res) => {
  try {
    let code = sanitizeCode(req.body && req.body.code);
    if (code && code.length > 128) {
      return res.status(400).json({ message: 'A valid client code is required' });
    }
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'Choose a PDF or image' });
    }

    const kind = noticeKindOf(req.file);
    if (!kind) {
      return res.status(400).json({ message: 'Only PDF and image files are allowed' });
    }

    if (!code) code = await generateUniqueCode(new Set());
    const customer = await Customer.findOne({ code }).select('_id').lean();
    if (!customer) await Customer.create({ code });

    await NoticeFile.deleteMany({ code });
    const saved = await NoticeFile.create({
      code,
      originalName: safeFileName(req.file.originalname, kind),
      mimeType: noticeMime(kind, req.file),
      kind,
      size: req.file.size,
      data: req.file.buffer,
    });

    const extension = kind === 'pdf' ? 'pdf' : 'jpg';
    const noticeFileUrl = `${publicBase(req)}/api/files/${saved.id}.${extension}`;
    await Customer.updateOne({ code }, { noticeFileUrl });
    return res.status(201).json({ code, noticeFileUrl });
  } catch (err) {
    console.error('[lifebacktax] Notice upload failed:', err.message);
    return res.status(500).json({ message: 'Unable to save the notice file' });
  }
});

app.get('/api/files/:id', async (req, res) => {
  try {
    const fileId = String(req.params.id || '').replace(/\.(pdf|jpe?g|png|gif|webp)$/i, '');
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(404).json({ message: 'File not found' });
    }

    const file = await NoticeFile.findById(fileId);
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    const download = req.query.download === '1';
    res.set('Content-Type', file.mimeType);
    res.set('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${safeFileName(file.originalName, file.kind)}"`);
    res.set('Cache-Control', 'private, max-age=300');
    return res.send(file.data);
  } catch (err) {
    console.error('[lifebacktax] Notice read failed:', err.message);
    return res.status(500).json({ message: 'Unable to open the notice file' });
  }
});

app.post('/api/lookup/submit', async (req, res) => {
  try {
    const body = req.body || {};
    let code = sanitizeCode(body.code);
    if (code && code.length > 128) {
      return res.status(400).json({ message: 'A valid client code is required' });
    }
    if (!code) code = await generateUniqueCode(new Set());

    const noticeFileUrl = await realNoticeUrl(code, body.noticeFileUrl);
    const update = {
      firstName: clip(body.firstName, 200),
      middleInitial: clip(body.middleInitial, 8),
      lastName: clip(body.lastName, 200),
      email: clip(body.email, 320),
      phone: clip(body.phone, 40),
      amountOwed: clip(body.amountOwed, 80),
      debtAmount: clip(body.amountOwed, 80),
      taxType: clip(body.taxType, 40),
      stateName: clip(body.stateName, 80),
      filingType: clip(body.filingType, 40),
      situationDetails: clip(body.situationDetails, 4000),
      runInvestigation: clip(body.runInvestigation, 300),
      address: clip(body.address, 500),
      isJoint: clip(body.isJoint, 80),
    };

    const ssn = clip(body.ssn, 20);
    const dob = clip(body.dob, 40);
    const spouseInfo = clip(body.spouseInfo, 300);
    const businessEin = clip(body.businessEin, 200);
    if (ssn) update.ssn = ssn;
    if (dob) update.dob = dob;
    if (spouseInfo) update.spouseInfo = spouseInfo;
    if (businessEin) update.businessEin = businessEin;
    if (noticeFileUrl) update.noticeFileUrl = noticeFileUrl;

    const customer = await Customer.findOneAndUpdate(
      { code },
      { $set: update, $setOnInsert: { code, created_at: new Date() } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return res.json({
      code: customer.code,
      noticeFileUrl: await realNoticeUrl(customer.code, customer.noticeFileUrl),
    });
  } catch (err) {
    console.error('[lifebacktax] Form save failed:', err.message);
    return res.status(500).json({ message: 'Unable to save the form' });
  }
});

app.post('/api/lookup/notice', async (req, res) => {
  try {
    const code = sanitizeCode(req.body && req.body.code);
    const noticeFileUrl = safeNoticeUrl(req.body && req.body.noticeFileUrl);
    if (!code || code.length > 128) {
      return res.status(400).json({ message: 'A valid client code is required' });
    }
    if (!noticeFileUrl) {
      return res.status(400).json({ message: 'A valid https notice file URL is required' });
    }

    const updated = await Customer.findOneAndUpdate({ code }, { noticeFileUrl }, { new: true }).lean();
    if (!updated) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    return res.json({ noticeFileUrl: safeNoticeUrl(updated.noticeFileUrl) });
  } catch (err) {
    console.error('[lifebacktax] Notice save failed:', err.message);
    return res.status(500).json({ message: 'Unable to save the notice file' });
  }
});

app.get('/api/auth/setup', async (_req, res) => {
  try {
    const needsSetup = (await User.countDocuments()) === 0;
    return res.json({ needsSetup });
  } catch (err) {
    console.error('[lifebacktax] Setup check failed:', err.message);
    return res.status(500).json({ message: 'Unable to check setup' });
  }
});

async function requireAuthUnlessFirstAdmin(req, res, next) {
  try {
    const needsSetup = (await User.countDocuments()) === 0;
    if (needsSetup) return next();
    return auth(req, res, next);
  } catch (err) {
    console.error('[lifebacktax] Registration check failed:', err.message);
    return res.status(500).json({ message: 'Unable to create account' });
  }
}

app.post('/api/auth/register', limitAuth, requireAuthUnlessFirstAdmin, async (req, res) => {
  try {
    if (process.env.ALLOW_REGISTRATION === 'false') {
      return res.status(403).json({ message: 'Registration is disabled' });
    }

    const username = typeof req.body.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!/^[a-z0-9_]{3,32}$/.test(username)) {
      return res.status(400).json({
        message: 'Username must be 3–32 characters and use only letters, numbers, and underscores',
      });
    }

    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ message: 'Password must be between 8 and 128 characters' });
    }

    const existing = await User.findOne({ username }).lean();
    if (existing) {
      return res.status(409).json({ message: 'That username is already registered' });
    }

    const user = await User.create({ username, password });
    return res.status(201).json({
      message: 'Admin account created',
      username: user.username,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'That username is already registered' });
    }
    console.error('[lifebacktax] Registration failed:', err.message);
    return res.status(500).json({ message: 'Unable to create account' });
  }
});

app.post('/api/auth/login', limitAuth, async (req, res) => {
  try {
    const username = typeof req.body.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = await User.findOne({ username });
    const matches = await bcrypt.compare(password, user ? user.password : DUMMY_PASSWORD_HASH);

    if (!user || !matches) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    return res.json({
      token: signToken(user),
      expiresIn: JWT_EXPIRES_IN,
      username: user.username,
    });
  } catch (err) {
    console.error('[lifebacktax] Login failed:', err.message);
    return res.status(500).json({ message: 'Unable to sign in' });
  }
});

app.get('/api/customers', auth, async (_req, res) => {
  try {
    const customers = await Customer.find()
      .sort({ submittedAt: -1, created_at: -1, _id: -1 })
      .select('-__v')
      .lean();

    await Promise.all(customers.map(async (customer) => {
      customer.noticeFileUrl = await realNoticeUrl(customer.code, customer.noticeFileUrl);
    }));

    return res.json({ customers });
  } catch (err) {
    console.error('[lifebacktax] Customer list failed:', err.message);
    return res.status(500).json({ message: 'Unable to load customers' });
  }
});

app.delete('/api/customers/:code', auth, async (req, res) => {
  try {
    const code = sanitizeCode(req.params.code);
    if (!code || code.length > 128) {
      return res.status(400).json({ message: 'A valid client code is required' });
    }

    const deleted = await Customer.findOneAndDelete({ code });
    if (!deleted) {
      return res.status(404).json({ message: 'That client could not be found' });
    }

    await ImportHistory.updateMany({ codes: code }, { $pull: { codes: code } });
    return res.json({ message: 'Client removed', code });
  } catch (err) {
    console.error('[lifebacktax] Remove client failed:', err.message);
    return res.status(500).json({ message: 'Unable to remove that client' });
  }
});

app.post('/api/customers/upload', auth, handleUpload, async (req, res) => {
  const filePath = req.file && req.file.path;

  if (!req.file) {
    return res.status(400).json({ message: 'A CSV file is required (form field name: file)' });
  }

  try {
    const rows = await parseCsv(filePath);
    const summary = await importRows(rows);
    const filename = String(req.file.originalname || 'upload.csv').slice(0, 240);
    const { codes, ...publicSummary } = summary;
    await ImportHistory.create({
      filename,
      username: req.user.username || '',
      totalRows: summary.totalRows,
      processed: summary.processed,
      inserted: summary.inserted,
      updated: summary.updated,
      unchanged: summary.unchanged,
      skipped: summary.skipped,
      generatedCodes: summary.generatedCodes,
      duplicateRows: summary.duplicateRows,
      codes,
    });
    return res.json({ message: 'Import completed', ...publicSummary });
  } catch (err) {
    console.error('[lifebacktax] CSV import failed:', err.message);
    const status = err.status || 500;
    return res.status(status).json({ message: err.message || 'Failed to import CSV' });
  } finally {
    await removeFile(filePath);
  }
});

app.get('/api/imports', auth, async (_req, res) => {
  try {
    const imports = await ImportHistory.find()
      .sort({ created_at: -1, _id: -1 })
      .limit(200)
      .select('-codes')
      .lean();
    return res.json({ imports });
  } catch (err) {
    console.error('[lifebacktax] Import history failed:', err.message);
    return res.status(500).json({ message: 'Unable to load import history' });
  }
});

app.delete('/api/imports/:id', auth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'That sheet could not be found' });
    }

    const entry = await ImportHistory.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ message: 'That sheet could not be found' });
    }

    const codes = Array.isArray(entry.codes) ? entry.codes.filter(Boolean) : [];
    let removedCustomers = 0;

    if (codes.length) {
      const others = await ImportHistory.find({
        _id: { $ne: entry._id },
        codes: { $in: codes },
      })
        .select('codes')
        .lean();

      const shared = new Set();
      for (const other of others) {
        for (const code of other.codes || []) shared.add(code);
      }

      const removable = codes.filter((code) => !shared.has(code));
      if (removable.length) {
        const result = await Customer.deleteMany({ code: { $in: removable } });
        removedCustomers = result.deletedCount || 0;
      }
    }

    await entry.deleteOne();
    return res.json({ message: 'Sheet removed', removedCustomers });
  } catch (err) {
    console.error('[lifebacktax] Remove sheet failed:', err.message);
    return res.status(500).json({ message: 'Unable to remove that sheet' });
  }
});

app.use((_req, res) => {
  res.status(404).json({ message: 'Not found' });
});

app.use((err, _req, res, _next) => {
  console.error('[lifebacktax]', err);
  if (res.headersSent) return;
  res.status(500).json({ message: 'Internal server error' });
});

async function start() {
  try {
    await ensureDb();
    const dbName = mongoose.connection.name;
    console.log(`[lifebacktax] MongoDB connected (database: ${dbName})`);
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[lifebacktax] API listening on http://127.0.0.1:${PORT}`);
    });
  } catch (err) {
    console.error('[lifebacktax] Failed to start:', err.message);
    process.exit(1);
  }
}

function shutdown() {
  mongoose.connection.close(false).finally(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = app;

if (!ON_VERCEL) {
  start();
}
