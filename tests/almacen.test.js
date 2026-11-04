import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearAlmacen } from '../js/almacen.js';

const memoria = () => {
  const datos = new Map();
  return { getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => datos.set(k, v) };
};

test('recargar descarga las recetas y se conservan en la copia local', async () => {
  const cliente = {
    comprobarRepo: async () => {},
    leer: async () => ({ datos: { version: 1, items: [{ id: 'receta:1', titulo: 'Tortilla' }] } }),
  };
  const almacenamiento = memoria();
  await crearAlmacen(almacenamiento).recargar(cliente);
  const copia = crearAlmacen(almacenamiento);
  assert.equal(copia.items('recetas')[0].titulo, 'Tortilla');
  assert.ok(copia.fecha);
});

test('si falla la descarga se conserva la copia anterior', async () => {
  const almacenamiento = memoria();
  const almacen = crearAlmacen(almacenamiento);
  almacen.fijar('recetas', { version: 1, items: [{ id: 'receta:1' }] });
  const roto = { comprobarRepo: async () => { throw new Error('sin red'); }, leer: async () => ({}) };
  await assert.rejects(almacen.recargar(roto));
  assert.equal(almacen.items('recetas').length, 1);
});
