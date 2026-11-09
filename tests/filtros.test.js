import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filtrosVacios, filtrosActivos, filtrarRecetas, opcionesFiltro } from '../js/filtros.js';

const R = (titulo, extra = {}) => ({ titulo, categorias: [], etiquetas: [], tiempo: null, dificultad: null, puntuacion: null, ingredientes: [], ...extra });
const ing = (...nombres) => nombres.map((nombre) => ({ cantidad: 1, unidad: 'unidad', nombre, detalle: '' }));
const recetas = [
  R('Pollo al ajillo', { proteinas: ['carne blanca'], categorias: ['Segundos'], etiquetas: ['rápida'], tiempo: 25, dificultad: 2, puntuacion: 5, ingredientes: ing('pollo', 'ajo') }),
  R('Arroz con pollo', { categorias: ['Arroces'], tiempo: 50, dificultad: 3, puntuacion: 4, ingredientes: ing('arroz', 'muslos de pollo') }),
  R('Ensalada César', { categorias: ['Primeros', 'Cenas'], etiquetas: ['Rápida', 'fría'], tiempo: 15, dificultad: 1, ingredientes: ing('lechuga', 'Pollo asado') }),
  R('Tortilla de patatas', { proteinas: ['huevo'], categorias: ['Segundos'], etiquetas: ['vegetariana'], tiempo: 40, dificultad: 2, puntuacion: 3, ingredientes: ing('huevos', 'patatas') }),
  R('Lentejas', { ingredientes: ing('lentejas') }),
];
const titulos = (f) => filtrarRecetas(recetas, { ...filtrosVacios(), ...f }).map((r) => r.titulo);

test('sin filtros salen todas', () => {
  assert.equal(titulos({}).length, 5);
  assert.equal(filtrosActivos(filtrosVacios()), 0);
});

test('buscar mira título e ingredientes, sin tildes ni mayúsculas, y exige cada palabra', () => {
  assert.deepEqual(titulos({ texto: 'POLLO' }), ['Pollo al ajillo', 'Arroz con pollo', 'Ensalada César']);
  assert.deepEqual(titulos({ texto: 'cesar' }), ['Ensalada César']);
  assert.deepEqual(titulos({ texto: 'huevo' }), ['Tortilla de patatas']);
  assert.deepEqual(titulos({ texto: 'pollo arroz' }), ['Arroz con pollo']);
  assert.deepEqual(titulos({ texto: '  ' }).length, 5);
});

test('«recetas fáciles con pollo de menos de 30 min»', () => {
  assert.deepEqual(titulos({ texto: 'pollo', dificultadMax: 2, tiempoMax: 30 }), ['Pollo al ajillo', 'Ensalada César']);
});

test('categoría, etiquetas, puntuación, dificultad y tiempo', () => {
  assert.deepEqual(titulos({ categoria: 'segundos' }), ['Pollo al ajillo', 'Tortilla de patatas']);
  assert.deepEqual(titulos({ etiquetas: ['rapida'] }), ['Pollo al ajillo', 'Ensalada César']);
  assert.deepEqual(titulos({ etiquetas: ['rápida', 'fría'] }), ['Ensalada César']);
  assert.deepEqual(titulos({ puntuacionMin: 4 }), ['Pollo al ajillo', 'Arroz con pollo']);
  assert.deepEqual(titulos({ dificultadMax: 1 }), ['Ensalada César']);
  assert.deepEqual(titulos({ tiempoMax: 45 }), ['Pollo al ajillo', 'Ensalada César', 'Tortilla de patatas']);
  // Lentejas no tiene tiempo, dificultad ni puntuación: no pasa esos filtros.
  assert.ok(!titulos({ tiempoMax: 90 }).includes('Lentejas'));
  assert.equal(filtrosActivos({ ...filtrosVacios(), categoria: 'x', etiquetas: ['a', 'b'], tiempoMax: 30 }), 4);
});

test('las opciones salen de las recetas, sin repetidos y en orden', () => {
  const { categorias, etiquetas } = opcionesFiltro(recetas);
  assert.deepEqual(categorias, ['Arroces', 'Cenas', 'Primeros', 'Segundos']);
  assert.deepEqual(etiquetas, ['fría', 'rápida', 'vegetariana']);
});

test('filtro por proteína: solo las recetas que la llevan (las que no tienen proteínas no salen)', () => {
  assert.deepEqual(titulos({ proteina: 'huevo' }), ['Tortilla de patatas']);
  assert.deepEqual(titulos({ proteina: 'carne blanca', texto: 'ajo' }), ['Pollo al ajillo']);
  assert.deepEqual(titulos({ proteina: 'marisco' }), []);
  assert.equal(filtrosActivos({ ...filtrosVacios(), proteina: 'huevo' }), 1);
});
