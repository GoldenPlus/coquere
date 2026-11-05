import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { UNIDADES, nuevaReceta, leerCantidad, normalizarReceta, validarReceta, validarRecetas } from '../js/receta.js';

globalThis.crypto ??= webcrypto; // Node 18 no lo trae global; el navegador sí.

const ejemplo = () => ({
  ...nuevaReceta(new Date('2026-11-05T10:00:00Z')),
  titulo: 'Tortilla de patatas',
  categorias: ['Segundos'],
  etiquetas: ['vegetariana'],
  raciones: 4,
  tiempo: 40,
  dificultad: 2,
  ingredientes: [
    { cantidad: 6, unidad: 'unidad', nombre: 'huevo', detalle: 'grande' },
    { cantidad: 750, unidad: 'g', nombre: 'patata', detalle: '' },
    { cantidad: null, unidad: 'al gusto', nombre: 'sal', detalle: '' },
  ],
  pasos: ['Pelar y cortar las patatas.', 'Freírlas a fuego medio.'],
  notas: [{ fecha: '2026-11-05T10:00:00.000Z', autor: 'Ana', texto: 'Mejor con cebolla.' }],
  puntuacion: 5,
  foto: 'fotos/r123.jpg',
});

test('una receta nueva rellenada es válida y no cambia al normalizarla', () => {
  const r = ejemplo();
  assert.deepEqual(validarReceta(r), []);
  assert.deepEqual(normalizarReceta(r), r);
});

test('una receta nueva sin título no es válida', () => {
  assert.deepEqual(validarReceta(nuevaReceta()), ['Falta el título.']);
});

test('los ids de recetas nuevas no se repiten', () => {
  const ids = new Set(Array.from({ length: 200 }, () => nuevaReceta().id));
  assert.equal(ids.size, 200);
});

test('leerCantidad entiende coma decimal y fracciones', () => {
  assert.equal(leerCantidad('1,5'), 1.5);
  assert.equal(leerCantidad('1/2'), 0.5);
  assert.equal(leerCantidad('1 1/2'), 1.5);
  assert.equal(leerCantidad(' 200 '), 200);
  assert.equal(leerCantidad(''), null);
  assert.ok(Number.isNaN(leerCantidad('un poco')));
});

test('normalizar limpia textos, quita vacíos y repetidos y convierte números', () => {
  const r = normalizarReceta({
    ...ejemplo(),
    titulo: '  Tortilla   de patatas ',
    etiquetas: ['Rápida', 'rapida', ' ', 'Fácil'],
    raciones: '4',
    tiempo: '',
    ingredientes: [
      { cantidad: '1,5', unidad: ' KG ', nombre: ' patata ', detalle: ' nueva ' },
      { cantidad: '', unidad: '', nombre: '', detalle: '' },
      { cantidad: '3', unidad: 'al gusto', nombre: 'sal' },
      { cantidad: '2', nombre: 'cebolla' },
    ],
    pasos: ['Uno', '   ', 'Dos'],
    notas: [{ fecha: '2026-11-05T10:00:00Z', autor: 'Ana', texto: '  ' }],
    foto: '',
  });
  assert.equal(r.titulo, 'Tortilla de patatas');
  assert.deepEqual(r.etiquetas, ['Rápida', 'Fácil']);
  assert.equal(r.raciones, 4);
  assert.equal(r.tiempo, null);
  assert.deepEqual(r.ingredientes, [
    { cantidad: 1.5, unidad: 'kg', nombre: 'patata', detalle: 'nueva' },
    { cantidad: null, unidad: 'al gusto', nombre: 'sal', detalle: '' },
    { cantidad: 2, unidad: 'unidad', nombre: 'cebolla', detalle: '' },
  ]);
  assert.deepEqual(r.pasos, ['Uno', 'Dos']);
  assert.deepEqual(r.notas, []);
  assert.equal(r.foto, null);
  assert.deepEqual(validarReceta(r), []);
});

test('validar señala cada campo fuera de rango con un mensaje claro', () => {
  const r = {
    ...ejemplo(),
    raciones: 0,
    tiempo: -5,
    dificultad: 6,
    puntuacion: 3.5,
    ingredientes: [
      { cantidad: 2, unidad: 'puñado', nombre: 'nueces', detalle: '' },
      { cantidad: 1, unidad: 'al gusto', nombre: 'pimienta', detalle: '' },
      { cantidad: NaN, unidad: 'g', nombre: '', detalle: '' },
    ],
    notas: [{ fecha: 'ayer', autor: '', texto: 'hola' }],
    foto: 'https://otro.sitio/foto.jpg',
  };
  assert.deepEqual(validarReceta(r), [
    'Las raciones deben ser un número entero mayor que cero.',
    'El tiempo debe ser un número entero de minutos.',
    'La dificultad va de 1 a 5.',
    'La puntuación va de 1 a 5.',
    'Ingrediente 1 (nueces): la unidad «puñado» no está en la lista.',
    'Ingrediente 2 (pimienta): «al gusto» no lleva cantidad.',
    'Ingrediente 3: falta el nombre.',
    'Ingrediente 3: la cantidad debe ser un número mayor que cero (vale 1,5 o 1/2).',
    'Nota 1: falta la fecha.',
    'Nota 1: falta el autor.',
    'La foto debe estar en la carpeta fotos/ del repo de datos.',
  ]);
});

test('validarRecetas detecta ids repetidos en recetas.json', () => {
  const a = ejemplo();
  const errores = validarRecetas({ version: 1, items: [a, { ...a, titulo: 'Copia' }] });
  assert.deepEqual(errores, [`Copia: el identificador ${a.id} está repetido.`]);
});

test('las unidades sumables tienen tipo y factor; solo «al gusto» va sin cantidad', () => {
  for (const [clave, u] of Object.entries(UNIDADES)) {
    assert.ok(u.tipo && u.factor > 0, clave);
    assert.equal(Boolean(u.sinCantidad), clave === 'al gusto', clave);
  }
  assert.equal(UNIDADES.kg.factor * 1, 1000 * UNIDADES.g.factor);
  assert.equal(UNIDADES.cda.tipo, UNIDADES.ml.tipo);
});
