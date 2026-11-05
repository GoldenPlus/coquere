import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escalarIngrediente, escalarReceta } from '../js/escalado.js';

const I = (cantidad, unidad) => ({ cantidad, unidad, nombre: 'x', detalle: '' });
const a = (cantidad, unidad, factor) => escalarIngrediente(I(cantidad, unidad), factor);

test('gramos y mililitros a cifras redondas', () => {
  assert.equal(a(250, 'g', 4 / 3).cantidad, 330); // 333,3 g → 330 g
  assert.equal(a(200, 'g', 1.5).cantidad, 300);
  assert.equal(a(75, 'ml', 1.5).cantidad, 110); // 112,5 → 110 (de 100 a 1000, a decenas)
  assert.equal(a(30, 'ml', 1.5).cantidad, 45);
  assert.equal(a(0.7, 'l', 1 / 0.7 * 0.1).cantidad, 0.1); // 100 ml, sin restos de coma flotante
  assert.equal(a(5, 'g', 1.5).cantidad, 8); // 7,5 → 8
  assert.equal(a(750, 'g', 1.5).cantidad, 1150); // 1125 → 1150
  assert.equal(a(700, 'g', 1.5).cantidad, 1050);
  assert.equal(a(250, 'g', 1.5).redondeada, false);
});

test('kg y l se redondean pasando por g y ml', () => {
  assert.equal(a(0.75, 'kg', 1.5).cantidad, 1.15);
  assert.equal(a(0.4, 'kg', 4 / 3).cantidad, 0.53); // 533 g → 530 g
  assert.equal(a(1, 'l', 0.5).cantidad, 0.5);
});

test('cucharadas y tazas a cuartos', () => {
  assert.equal(a(1, 'cda', 1.5).cantidad, 1.5);
  assert.equal(a(1, 'cdta', 4 / 3).cantidad, 1.25);
  assert.equal(a(1, 'taza', 0.25).cantidad, 0.25);
  assert.equal(a(1, 'cda', 0.1).cantidad, 0.25);
});

test('piezas enteras con aviso; medias si la receta ya usaba medias', () => {
  assert.deepEqual(a(1, 'unidad', 1.5), { cantidad: 2, exacta: 1.5, redondeada: true }); // 1,5 huevos → 2
  assert.equal(a(3, 'unidad', 4 / 3).cantidad, 4);
  assert.equal(a(3, 'unidad', 4 / 3).redondeada, false);
  assert.equal(a(5, 'unidad', 0.75).cantidad, 4); // 3,75 → 4
  assert.equal(a(5, 'unidad', 0.75).redondeada, false); // diferencia pequeña: sin aviso
  assert.equal(a(2, 'diente', 0.25).cantidad, 1); // nunca 0
  assert.equal(a(0.5, 'unidad', 1.5).cantidad, 1); // ½ limón × 1,5 = ¾ → 1
  assert.equal(a(0.5, 'unidad', 3).cantidad, 1.5);
  assert.equal(a(1, 'lata', 2).cantidad, 2);
});

test('«al gusto», «pizca» y «chorro» no cambian, ni lo que no tiene cantidad', () => {
  assert.equal(a(null, 'al gusto', 2).cantidad, null);
  assert.equal(a(1, 'pizca', 3).cantidad, 1);
  assert.equal(a(1, 'chorro', 3).cantidad, 1);
  assert.equal(a(null, 'g', 2).cantidad, null);
});

test('escalarReceta: de 4 a 6 raciones, y sin tocar la receta original', () => {
  const receta = { raciones: 4, ingredientes: [I(6, 'unidad'), I(750, 'g'), I(null, 'al gusto'), I(1, 'pizca'), I(2, 'cda')] };
  const copia = structuredClone(receta);
  assert.deepEqual(escalarReceta(receta, 6).map((i) => i.cantidad), [9, 1150, null, 1, 3]);
  assert.deepEqual(escalarReceta(receta, 4).map((i) => i.cantidad), [6, 750, null, 1, 2]);
  assert.deepEqual(receta, copia);
});
