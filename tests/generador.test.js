import { test } from 'node:test';
import assert from 'node:assert/strict';
import { admitida, elegirReceta, rellenarMenu, fechasEntre, rellenarYGuardar } from '../js/generador.js';
import { entradasDe } from '../js/menus.js';

const R = (id, extra = {}) => ({ id, titulo: id, categorias: [], etiquetas: [], puntuacion: null, ...extra });
const E = (fecha, hueco, receta, origen = 'manual') => ({ fecha, hueco, receta, raciones: 4, origen });
/** Azar repetible: recorre una lista de valores. */
const secuencia = (...v) => { let i = 0; return () => v[i++ % v.length]; };

test('comida/cena por etiqueta; sin ninguna de las dos vale para ambas; categorías fuera del menú', () => {
  const ajustes = { categoriasFueraDelMenu: ['Postres'] };
  assert.ok(admitida(R('a', { etiquetas: ['Comida'] }), 'comida', ajustes));
  assert.ok(!admitida(R('a', { etiquetas: ['comida'] }), 'cena', ajustes));
  assert.ok(admitida(R('b', { etiquetas: ['comida', 'cena'] }), 'cena', ajustes));
  assert.ok(admitida(R('c', { etiquetas: ['rápida'] }), 'cena', ajustes));
  assert.ok(!admitida(R('d', { categorias: ['postres'] }), 'comida', ajustes));
  assert.ok(admitida(R('d', { categorias: ['Postres'] }), 'comida', {}));
});

test('no repite una receta usada en los 7 días de alrededor, salvo que no quede otra', () => {
  const recetas = [R('a'), R('b')];
  const menus = [E('2026-11-05', 'cena', 'a')];
  for (const x of [0, 0.5, 0.99]) assert.equal(elegirReceta({ recetas, menus, fecha: '2026-11-09', hueco: 'comida', azar: () => x }).id, 'b');
  // 8 días después ya puede volver a salir.
  assert.equal(elegirReceta({ recetas: [R('a')], menus, fecha: '2026-11-13', hueco: 'comida' }).id, 'a');
  // Las dos usadas hace poco: sale la que lleva más tiempo sin salir.
  const usadas = [E('2026-11-08', 'cena', 'a'), E('2026-11-05', 'cena', 'b')];
  assert.equal(elegirReceta({ recetas, menus: usadas, fecha: '2026-11-09', hueco: 'comida' }).id, 'b');
  assert.equal(elegirReceta({ recetas, menus: [], fecha: '2026-11-09', hueco: 'comida', excluir: ['a', 'b'] }), null);
});

test('las mejor puntuadas salen más a menudo', () => {
  const recetas = [R('mala', { puntuacion: 1 }), R('buena', { puntuacion: 5 })];
  let semilla = 7;
  const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
  const veces = { mala: 0, buena: 0 };
  for (let i = 0; i < 900; i++) veces[elegirReceta({ recetas, menus: [], fecha: '2026-11-09', hueco: 'cena', azar }).id]++;
  assert.ok(veces.buena > veces.mala * 5, JSON.stringify(veces)); // pesos 8 a 1
});

test('rellenar: solo los huecos vacíos; lo manual y los especiales no se tocan', () => {
  const recetas = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => R(id));
  const datos = { version: 1, items: [
    E('2026-11-09', 'comida', 'a'),
    { fecha: '2026-11-09', hueco: 'cena', especial: 'fuera', nota: '', origen: 'manual' },
  ] };
  const { datos: nuevos, puestas, sinReceta } = rellenarMenu(datos, { recetas, ajustes: { racionesFamilia: 3 }, desde: '2026-11-09', hasta: '2026-11-11', azar: secuencia(0.1, 0.6, 0.3) });
  assert.equal(puestas, 4);
  assert.equal(sinReceta, 0);
  assert.deepEqual(entradasDe(nuevos.items, '2026-11-09', 'comida'), [E('2026-11-09', 'comida', 'a')]);
  assert.equal(entradasDe(nuevos.items, '2026-11-09', 'cena')[0].especial, 'fuera');
  const autos = nuevos.items.filter((e) => e.origen === 'auto');
  assert.equal(autos.length, 4);
  assert.ok(autos.every((e) => e.raciones === 3));
  // Sin repetir dentro del rango (hay 6 recetas para 5 huecos con «a» ya puesta).
  const usadas = nuevos.items.filter((e) => e.receta).map((e) => e.receta);
  assert.equal(new Set(usadas).size, usadas.length);
  // Nada que rellenar: null.
  assert.equal(rellenarMenu(nuevos, { recetas, desde: '2026-11-09', hasta: '2026-11-11' }).datos, null);
});

test('regenerar cambia solo las recetas que puso la app', () => {
  const recetas = ['a', 'b', 'c', 'd'].map((id) => R(id));
  const datos = { version: 1, items: [E('2026-11-09', 'comida', 'a'), E('2026-11-09', 'cena', 'b', 'auto')] };
  const sin = rellenarMenu(datos, { recetas, desde: '2026-11-09', hasta: '2026-11-09' });
  assert.equal(sin.datos, null);
  const con = rellenarMenu(datos, { recetas, desde: '2026-11-09', hasta: '2026-11-09', reemplazarAuto: true, azar: () => 0 });
  assert.equal(con.puestas, 1);
  assert.equal(entradasDe(con.datos.items, '2026-11-09', 'comida')[0].receta, 'a');
  const cena = entradasDe(con.datos.items, '2026-11-09', 'cena');
  assert.equal(cena.length, 1);
  assert.notEqual(cena[0].receta, 'b');
});

test('un hueco sin recetas admitidas se cuenta y se deja vacío', () => {
  const recetas = [R('a', { etiquetas: ['comida'] })];
  const r = rellenarMenu({ version: 1, items: [] }, { recetas, desde: '2026-11-09', hasta: '2026-11-09' });
  assert.equal(r.puestas, 1);
  assert.equal(r.sinReceta, 1);
  assert.deepEqual(r.datos.items.map((e) => e.hueco), ['comida']);
});

test('fechas de un rango, también al cambiar de mes', () => {
  assert.deepEqual(fechasEntre('2026-11-29', '2026-12-02'), ['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02']);
  assert.deepEqual(fechasEntre('2026-11-10', '2026-11-09'), []);
});

test('rellenar y guardar trabaja sobre la versión más reciente de menus.json', async () => {
  let fichero = { version: 1, items: [E('2026-11-09', 'comida', 'x')] }; // otro dispositivo ya puso la comida
  const mensajes = [];
  const cliente = { async actualizar(_n, mutar, mensaje) { const nuevos = mutar(fichero); if (nuevos) { fichero = nuevos; mensajes.push(mensaje); } return { datos: fichero }; } };
  const r = await rellenarYGuardar(cliente, { recetas: [R('a'), R('b')], desde: '2026-11-09', hasta: '2026-11-09' }, 'Ana');
  assert.equal(r.puestas, 1);
  assert.deepEqual(r.datos.items.map((e) => `${e.hueco}:${e.origen}`), ['comida:manual', 'cena:auto']);
  assert.deepEqual(mensajes, ['Menú: rellena del 2026-11-09 al 2026-11-09 (por Ana)']);
});
