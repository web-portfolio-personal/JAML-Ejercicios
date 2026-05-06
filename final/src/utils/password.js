import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

/**
 * Longitud de la clave derivada en bytes.
 * 64 bytes = 512 bits — seguridad más que suficiente.
 */
const KEYLEN = 64;

/**
 * Hashea una contraseña con crypto.scrypt nativo de Node.js.
 *
 * Parámetros por defecto de scrypt (N=16384, r=8, p=1):
 *   - N = factor de coste de CPU/memoria (2^14 = 16.384 iteraciones)
 *   - r = tamaño de bloque (mezcla de datos)
 *   - p = paralelismo
 *
 * Devuelve una cadena con formato "<salt_hex>:<hash_hex>".
 * El salt (16 bytes aleatorios) va incluido para que comparePassword
 * pueda derivar la misma clave sin almacenarlo por separado.
 *
 * @param {string} plain - Contraseña en texto plano
 * @returns {Promise<string>} "<salt_hex>:<hash_hex>"
 */
export const hashPassword = async (plain) => {
  const salt = randomBytes(16).toString('hex');
  const hash = await scryptAsync(plain, salt, KEYLEN);
  return `${salt}:${hash.toString('hex')}`;
};

/**
 * Compara una contraseña en texto plano con el hash almacenado.
 *
 * Usa crypto.timingSafeEqual para comparar en tiempo constante
 * y evitar ataques de timing (el tiempo de comparación no varía
 * según cuántos bytes coincidan).
 *
 * @param {string} plain  - Contraseña en texto plano a verificar
 * @param {string} stored - Hash almacenado en formato "<salt_hex>:<hash_hex>"
 * @returns {Promise<boolean>}
 */
export const comparePassword = async (plain, stored) => {
  const [saltHex, hashHex] = stored.split(':');
  const storedHash = Buffer.from(hashHex, 'hex');
  const derived    = await scryptAsync(plain, saltHex, KEYLEN);
  return timingSafeEqual(storedHash, derived);
};
