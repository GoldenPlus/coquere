import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sirvePara, recetasConLoQueTengo, conIngrediente } from '../js/tengo.js';

const I = (nombre, unidad = 'g', cantidad = 100) => ({ nombre, unidad, cantidad, detalle: '' });
const R = (id, titulo, ingredientes) => ({ id, titulo, ingredientes });

test('sirve: mismo ingrediente o palabras enteras', () => {
  assert.ok(sirvePara('tomates', 'tomate'));
  assert.ok(sirvePara('pollo', 'Pechuga de pollo'));
  assert.ok(!sirvePara('col', 'coliflor'));
  assert.ok(!sirvePara('', 'sal'));
});

test('ordena por cuántos de lo que tengo aprovecha; luego por lo que falta', () => {
  const recetas = [
    R('a', 'Pollo al curry', [I('pechuga de pollo'), I('nata'), I('curry', 'cdta', 1), I('sal', 'al gusto', null)]),
    R('b', 'Crema de calabacín', [I('calabacín'), I('nata'), I('cebolla', 'unidad', 1), I('sal', 'pizca', 1)]),
    R('c', 'Pollo con calabacín y nata', [I('pollo'), I('calabacines'), I('nata')]),
    R('d', 'Lentejas', [I('lentejas')]),
    R('e', 'Pollo asado', [I('pollo'), I('patata'), I('limón', 'unidad', 1)]),
  ];
  const r = recetasConLoQueTengo(recetas, ['pollo', 'calabacín', 'nata']);
  // a y b aprovechan dos y piden una cosa: por título.
  assert.deepEqual(r.map((x) => x.receta.id), ['c', 'b', 'a', 'e']);
  assert.deepEqual(r[0].faltan, []);
  assert.deepEqual(r[1].faltan, ['cebolla']);
  assert.deepEqual(r[2].usa, ['pollo', 'nata']);
  assert.deepEqual(r[2].faltan, ['curry']);
});

test('lo que siempre hay en casa no falta; sin nada que tengo, nada', () => {
  const recetas = [R('a', 'Tortilla', [I('huevos', 'unidad', 6), I('patata'), I('aceite de oliva', 'ml', 50)])];
  assert.deepEqual(recetasConLoQueTengo(recetas, ['huevo'], { siempreHay: ['aceite de oliva'] })[0].faltan, ['patata']);
  assert.deepEqual(recetasConLoQueTengo(recetas, []), []);
});

test('añadir lo que tengo sin repetir', () => {
  assert.deepEqual(conIngrediente(['tomate'], ' Tomates '), ['tomate']);
  assert.deepEqual(conIngrediente(['tomate'], ' nata  para cocinar'), ['tomate', 'nata para cocinar']);
  assert.deepEqual(conIngrediente([], '  '), []);
});
