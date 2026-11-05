import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claveIngrediente, indiceIngredientes, sugerirIngredientes } from '../js/ingredientes.js';

test('claveIngrediente reconoce singular y plural, tildes y mayúsculas', () => {
  const iguales = [['tomate', 'Tomates'], ['limón', 'limones'], ['nuez', 'nueces'], ['huevo', 'HUEVOS'], ['pan', 'panes'],
    ['diente de ajo', 'dientes de ajo'], ['pimiento rojo', 'pimientos rojos'], ['col', 'coles'], ['leche', 'leche']];
  for (const [a, b] of iguales) assert.equal(claveIngrediente(a), claveIngrediente(b), `${a} / ${b}`);
  const distintos = [['tomate', 'tomate frito'], ['arroz', 'harina'], ['sal', 'salsa'], ['pollo', 'polvo']];
  for (const [a, b] of distintos) assert.notEqual(claveIngrediente(a), claveIngrediente(b), `${a} / ${b}`);
});

const R = (id, ...nombres) => ({ id, ingredientes: nombres.map((nombre) => ({ nombre })) });
const recetas = [
  R('a', 'tomate', 'cebolla', 'aceite de oliva'),
  R('b', 'tomate', 'tomate frito', 'pollo'),
  R('c', 'Tomates', 'pimiento rojo', 'aceite de oliva'),
  R('d', 'tomate', 'tomates'), // Dos veces en la misma receta: cuenta una.
];

test('el índice junta formas del mismo ingrediente y se queda con la más usada', () => {
  const indice = indiceIngredientes(recetas);
  const tomate = indice.find((e) => e.clave === claveIngrediente('tomate'));
  assert.equal(tomate.nombre, 'tomate');
  assert.equal(tomate.usos, 4);
  assert.equal(indiceIngredientes(recetas, 'b').find((e) => e.nombre === 'pollo'), undefined);
});

test('sugiere primero el mismo ingrediente, luego lo que empieza igual, luego lo que lo contiene', () => {
  const indice = indiceIngredientes(recetas);
  assert.deepEqual(sugerirIngredientes(indice, 'tomates'), [{ nombre: 'tomate', mismo: true }, { nombre: 'tomate frito', mismo: false }]);
  assert.deepEqual(sugerirIngredientes(indice, 'tom').map((s) => s.nombre), ['tomate', 'tomate frito']);
  assert.deepEqual(sugerirIngredientes(indice, 'oliva').map((s) => s.nombre), ['aceite de oliva']);
  assert.deepEqual(sugerirIngredientes(indice, 'PIMIENTO').map((s) => s.nombre), ['pimiento rojo']);
  assert.deepEqual(sugerirIngredientes(indice, 'tomate').map((s) => s.nombre), ['tomate frito']);
  assert.deepEqual(sugerirIngredientes(indice, ''), []);
  assert.deepEqual(sugerirIngredientes(indice, 'xyz'), []);
});
