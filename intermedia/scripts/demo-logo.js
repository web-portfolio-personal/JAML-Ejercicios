/**
 * demo-logo.js — Flujo completo de onboarding con subida de logo real
 *
 * Uso:
 *   node --env-file=.env --env-file=.env.test scripts/demo-logo.js
 *
 * Requiere el servidor corriendo: npm run test:server
 */

import mongoose from 'mongoose';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE    = 'http://localhost:3000/api/user';
const IMAGES  = join(import.meta.dirname, '../test-images');

// ── helpers ───────────────────────────────────────────────────────────────────

const req = async (method, path, body, token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
};

const uploadLogo = async (filename, mimeType, token) => {
  const buf  = await readFile(join(IMAGES, filename));
  const form = new FormData();
  form.append('logo', new Blob([buf], { type: mimeType }), filename);
  const res = await fetch(`${BASE}/logo`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return res.json();
};

const log = (label, data) => {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${'─'.repeat(60)}`);
  console.log(JSON.stringify(data, null, 2));
};

// ── flujo principal ───────────────────────────────────────────────────────────

const seed  = Date.now();
const EMAIL = `demo.${seed}@bildyapp.com`;
const PASS  = 'DemoPass123!';

console.log('\n🚀  BildyApp — Demo de subida de logo con imágenes reales');
console.log(`   Usuario: ${EMAIL}\n`);

// Conexión a MongoDB (para leer el código de verificación)
await mongoose.connect(process.env.MONGODB_URI);
const col = mongoose.connection.db.collection('users');

// 1. Registro
const reg = await req('POST', '/register', { email: EMAIL, password: PASS });
log('1. POST /register', { status: reg.user?.status, role: reg.user?.role });
const { accessToken } = reg;

// 2. Leer código directamente de la BD (simulando llegada por email)
const doc  = await col.findOne({ email: EMAIL }, { projection: { verificationCode: 1 } });
const code = doc.verificationCode;
console.log(`\n   📨  Código de verificación: ${code}`);

// 3. Verificar email
const val = await req('PUT', '/validation', { code }, accessToken);
log('2. PUT /validation', val);

// 4. Login (obtener tokens frescos)
const login = await req('POST', '/login', { email: EMAIL, password: PASS });
log('3. POST /login', { status: login.user?.status });
const token = login.accessToken;

// 5. Datos personales
const personal = await req('PUT', '/register', {
  name: 'Demo', lastName: 'Usuario', nif: '99887766X',
}, token);
log('4. PUT /register (personal)', { fullName: personal.user?.fullName });

// 6. Crear empresa
const company = await req('PATCH', '/company', {
  isFreelance: false,
  name: 'BildyApp Demo SL',
  cif: `B${seed.toString().slice(-7)}`,
  address: { street: 'Calle Gran Vía', number: '28', city: 'Madrid', postal: '28013', province: 'Madrid' },
}, token);
log('5. PATCH /company', { company: company.user?.company?.name, role: company.user?.role });

// 7. Subir logo JPG
const jpg = await uploadLogo('Intel_logo.jpg', 'image/jpeg', token);
log('6. PATCH /logo  →  Intel_logo.jpg (image/jpeg)', { logo: jpg.company?.logo });

// 8. Subir logo PNG (sobreescribe el anterior)
const png = await uploadLogo('img.png', 'image/png', token);
log('7. PATCH /logo  →  img.png (image/png)', { logo: png.company?.logo });

// 9. GET /user — resultado final
const user = await req('GET', '/', undefined, token);
log('8. GET /api/user — estado final', {
  email:    user.user?.email,
  fullName: user.user?.fullName,
  role:     user.user?.role,
  status:   user.user?.status,
  company:  user.user?.company?.name,
  logo:     user.user?.company?.logo,
});

// Limpieza: eliminar usuario de demo (hard delete)
await req('DELETE', '/', undefined, token);
await mongoose.connection.db.collection('companies')
  .deleteOne({ cif: `B${seed.toString().slice(-7)}` });
await mongoose.disconnect();

console.log('\n\n✅  Demo completado. Abre uploads/ para ver los logos guardados.');
console.log(`   Accede al último logo en: ${png.company?.logo}\n`);
