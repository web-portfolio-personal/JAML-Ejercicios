# EXAMEN — Defensa técnica F12

## Preguntas socráticas

### 1. `deliverynote.controller.js:175` devuelve 400 al re-firmar y `:233` devuelve 400 al borrar un firmado. ¿Cuál sería el código HTTP semánticamente correcto (409 vs 400)?

**RFC 7231 §6.5.1 — 400 Bad Request:** "el servidor no puede o no quiere procesar la solicitud debido a algo percibido como un error del *cliente*", es decir, la propia petición es malformada o sintácticamente incorrecta.  
**RFC 7231 §6.5.8 — 409 Conflict:** "la solicitud no puede completarse debido a un conflicto con el *estado actual del recurso de destino*"; presupone que la petición es válida en sintaxis pero choca con el estado del servidor.  
En ambos casos (re-firmar y borrar un firmado) la petición es sintácticamente correcta —incluye un ID válido y, en el caso de la firma, incluso adjunta el fichero—, por lo que el problema no es el cliente sino el estado del recurso: `signed: true`.  
**409 es semánticamente más correcto** porque el cuerpo de la respuesta puede comunicar "la transición de estado que solicitas es incompatible con el estado actual" sin implicar que el cliente envió basura.  
Se usó 400 por pragmatismo (muchas APIs lo hacen así para simplificar el cliente), pero es una inexactitud respecto al RFC que se debería corregir en una versión futura.

---

### 2. La guardia `req.user.role !== 'admin'` en `:122` y `:144`. Si se añade un rol `viewer` (solo lectura), ¿sigue funcionando o introduce un bug?

La condición actual aplica la restricción owner-or-guest a **cualquier usuario que no sea admin**, incluido el hipotético `viewer`.  
Si `viewer` debe poder leer todos los albaranes de la compañía (no solo los suyos), la condición actual le devolvería 403 en los albaranes ajenos, lo que es un **bug**: un usuario con permiso de lectura amplia sería bloqueado porque la guarda solo exime al rol `admin`.  
El problema es el **patrón de lista negativa** (`!== 'admin'`): funciona para dos roles (admin/guest) pero no escala; cada rol nuevo con permisos intermedios exige modificar la condición.  
La solución correcta es una **lista blanca de roles que tienen acceso completo**: `!['admin', 'viewer'].includes(req.user.role)`, o mejor aún, un sistema de permisos explícito (`canReadAllNotes`) desacoplado del nombre del rol, para que añadir roles no requiera tocar la lógica de cada controlador.

---

### 3. El índice `{ company: 1, deleted: 1 }` en `DeliveryNote.js:67`. ¿Por qué ese orden y qué pasaría con la cardinalidad si se invirtiera?

La consulta dominante es `{ company: X, deleted: false }` y MongoDB recorre el índice **de izquierda a derecha**.  
`company` tiene **alta cardinalidad** (tantos valores distintos como empresas registradas), mientras que `deleted` es un booleano con **cardinalidad 2** y distribución muy sesgada (≈99 % `false`).  
Con `{ company: 1, deleted: 1 }`: el índice primero salta directamente a todos los documentos de la empresa X (conjunto pequeño y muy selectivo), y luego filtra por `deleted: false` dentro de ese pequeño bucket → coste O(log N + k), donde k es el nº de albaranes de esa empresa.  
Con `{ deleted: 1, company: 1 }` invertido: el primer nivel del B-tree agrupa todos los documentos con `deleted: false` —la gran mayoría de la colección—, ofreciendo una selectividad mínima antes de llegar a `company`; el índice degeneraría en poco más que un full-collection scan del subconjunto `deleted: false`, multiplicando las lecturas de páginas de índice innecesariamente.

---

### 4. Si el `fetch` de `pdf.service.js:22` tarda 30 segundos, `signDeliveryNote` se queda colgado. ¿Cómo lo arreglarías y qué status code devuelves al cliente?

La solución canónica en Node.js ≥ 18 es `AbortController` combinado con `setTimeout`:

```js
const ac  = new AbortController();
const tid = setTimeout(() => ac.abort(), 5_000); // 5 s de margen
try {
  const response = await fetch(note.signatureUrl, { signal: ac.signal });
  if (response.ok) {
    signatureBuffer = Buffer.from(await response.arrayBuffer());
  }
} catch (err) {
  if (err.name !== 'AbortError') throw err;
  // timeout: continuar sin imagen de firma (texto de respaldo) o lanzar
} finally {
  clearTimeout(tid);
}
```

El caso feliz no se rompe porque si Cloudinary responde antes del timeout el flujo es idéntico al actual.  
Si el timeout se dispara y se decide **no** degradar silenciosamente (es decir, fallar explícitamente), el status code correcto hacia el cliente es **504 Gateway Timeout**: nuestro servidor actúa como gateway que solicitó un recurso a un servidor upstream (Cloudinary) y no recibió respuesta a tiempo; 408 sería para el timeout del cliente contra *nuestro* servidor, no el nuestro contra Cloudinary.

---

### 5. En `app.js:91-108`, sanitizas claves `$` después de `express.json({ limit:'10kb' })`. Si el atacante envía 9 kb con 5 000 claves anidadas con `$`, ¿qué se ejecuta primero, qué cuesta más CPU y por qué el orden actual es correcto?

**Orden de ejecución:** `express.json()` es el primer middleware de cuerpo; lee el stream, comprueba que el payload no supere 10 kb y llama a `JSON.parse()` → después, el sanitizador recorre recursivamente el objeto resultante borrando claves peligrosas.  
**Coste CPU comparado:** `JSON.parse` está implementado en C++ nativo dentro de V8 y es O(n) en el tamaño del texto; el sanitizador es una función JS que itera `Object.keys()` y llama a `delete` en cada clave —también O(n) pero con el overhead del intérprete JS—, por lo que **JSON.parse es más rápido** aunque ambas operaciones procesan el mismo número de tokens.  
**¿Por qué el orden actual es correcto?** Si el sanitizador estuviera *antes* de `express.json()`, `req.body` sería `undefined` y la función haría nada (`typeof undefined !== 'object'`), dejando pasar el payload completo sin filtrar: el middleware sería un no-op completo.  
Además, el límite `'10kb'` actúa como primera barrera: un body de 9 kb con 5 000 claves es el peor caso aceptado, pero un payload de 100 kb —con 50 000 claves— ni siquiera llega a `JSON.parse`, con lo que el límite de tamaño limita exponencialmente el daño de un ataque de complejidad recursiva.

---

## Cobertura de `deliverynote.controller.js` antes y después

| Métrica    | ANTES (bloque `c8 ignore` activo, ~43 líneas excluidas) | DESPUÉS (5 tests con mock) |
|------------|--------------------------------------------------------|---------------------------|
| Statements | ~100 % aparente (líneas del flujo de firma **no contaban**) | **95.69 %** real |
| Branches   | ~90 % aparente | **80.64 %** real |
| Functions  | ~100 % aparente | **100 %** |
| Lines      | ~100 % aparente | **100 %** real |

El bloque `/* c8 ignore start/stop */` excluía del denominador toda la ruta feliz de `signDeliveryNote` (upload de firma → save → populate → generación PDF → upload PDF → pdfUrl). Esto ocultaba que esas ~43 líneas no estaban ejercidas por ningún test. Al eliminar el bloque y añadir los 5 tests con `jest.unstable_mockModule`, las líneas entran en el cómputo y llegan al **100 % de cobertura de líneas** —la métrica más honesta—, mientras que el porcentaje de sentencias baja al valor real (95.69 %) por ramas de imports ESM que c8 marca como statements no ejecutables.

---

## Proceso

**Tiempo total estimado:** ~1 h, lo realizado en clase (análisis arquitectónico + implementación + validación + redacción)

**Herramientas:**

- **Hecho de forma manual:** Todo el desarrollo de las preguntas y revisión completa de los cambios realizados en el código y comprobación manual mediante testing.
- **Claude Code (claude-sonnet-4-5)** — asistente de IA: ayudó en la búsqueda de los ejercicios planteados en el reto y con el planteamiento inicial de las preguntas.
- **Node.js 22 `--experimental-vm-modules`** — entorno ESM nativo para los tests.
- **Jest 29** con `jest.unstable_mockModule` — framework de test y mocking ESM.
- **c8** — proveedor de cobertura V8 integrado en el script `test:coverage`.

**Prompts literales usados con la IA:**

> *"Tengo este reto de examen sobre mi API Node.js/Express con MongoDB y necesito que me ayudes a entender los conceptos para poder responder con mis propias palabras. Mis dudas son: primero, cuándo usar 409 en vez de 400 según el RFC porque en mi controlador devuelvo 400 al re-firmar y al borrar un albarán firmado; segundo, si la condición `role !== 'admin'` puede introducir un bug cuando añada nuevos roles como 'viewer'; tercero, por qué importa el orden de los campos en el índice compuesto `{ company, deleted }` de MongoDB; cuarto, cómo añadir un timeout a un `fetch` de Node.js sin romper el flujo normal y qué status code devolver; y quinto, por qué el middleware sanitizador de claves `$` debe ir obligatoriamente después de `express.json`. Guíame en el planteamiento de cada uno."*

**Pasos ejecutados:**

1. `git checkout examen` (rama ya existente)
2. Eliminar `/* c8 ignore start */` … `/* c8 ignore stop */` de `deliverynote.controller.js:181-224`
3. Reescribir `tests/deliverynote.test.js`: `import app` → `await import('../src/app.js')` situado después de `jest.unstable_mockModule`; añadir helpers `fullSetupWithCompany` y `setupGuest`
4. Añadir 5 describe-blocks de invariantes (INVARIANTE 1–5)
5. `npm test` → **173 tests, 0 fallos**
6. `npm run test:coverage -- --testPathPattern=deliverynote` → verificar 100 % de líneas
7. Reescribir `EXAMEN.md` con las 5 respuestas socráticas del enunciado real
8. `git add` + `git commit` + `git push -u origin examen`
