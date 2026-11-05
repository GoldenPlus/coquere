import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rutaMini, nuevaRutaFoto, medidas, subirFoto, borrarFoto } from '../js/fotos.js';
import { validarReceta, nuevaReceta } from '../js/receta.js';
import { webcrypto } from 'node:crypto';

globalThis.crypto ??= webcrypto;

test('cada foto nueva tiene un nombre distinto, válido para la receta, y su miniatura al lado', () => {
  const a = nuevaRutaFoto('r1a2b', new Date('2026-11-05T10:00:00Z'));
  const b = nuevaRutaFoto('r1a2b', new Date('2026-11-05T10:00:01Z'));
  assert.notEqual(a, b);
  assert.match(a, /^fotos\/r1a2b-[a-z0-9]+\.jpg$/);
  assert.equal(rutaMini('fotos/r1-abc.jpg'), 'fotos/r1-abc.mini.jpg');
  assert.deepEqual(validarReceta({ ...nuevaReceta(), titulo: 'X', foto: a }), []);
});

test('medidas reduce el lado mayor sin agrandar nunca', () => {
  assert.deepEqual(medidas(4000, 3000, 1600), { ancho: 1600, alto: 1200 });
  assert.deepEqual(medidas(3000, 4000, 240), { ancho: 180, alto: 240 });
  assert.deepEqual(medidas(800, 600, 1600), { ancho: 800, alto: 600 });
});

test('subirFoto sube miniatura y foto al repo privado; borrarFoto quita las dos aunque una falle', async () => {
  const subidos = [];
  const borrados = [];
  const cliente = {
    subirArchivo: async (ruta, bytes) => subidos.push([ruta, bytes.length]),
    borrarArchivo: async (ruta) => {
      borrados.push(ruta);
      if (ruta.endsWith('.mini.jpg')) throw new Error('sin red');
    },
  };
  const foto = { grande: new Blob([new Uint8Array(500)]), mini: new Blob([new Uint8Array(50)]) };
  const ruta = await subirFoto(cliente, { id: 'r1', titulo: 'Lentejas' }, foto, 'Ana', new Date('2026-11-05T10:00:00Z'));
  assert.deepEqual(subidos, [[rutaMini(ruta), 50], [ruta, 500]]);
  await borrarFoto(cliente, ruta, 'Lentejas', 'Ana');
  assert.deepEqual(borrados, [ruta, rutaMini(ruta)]);
  await borrarFoto(cliente, null, 'Lentejas', 'Ana');
  assert.equal(borrados.length, 2);
});
