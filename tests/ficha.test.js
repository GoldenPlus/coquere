import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatearCantidad, textoIngrediente } from '../js/ficha.js';

test('formatearCantidad usa fracciones de cocina y coma decimal', () => {
  assert.equal(formatearCantidad(6), '6');
  assert.equal(formatearCantidad(0.5), '½');
  assert.equal(formatearCantidad(1.5), '1 ½');
  assert.equal(formatearCantidad(2.25), '2 ¼');
  assert.equal(formatearCantidad(1 / 3), '⅓');
  assert.equal(formatearCantidad(0.3), '0,3');
  assert.equal(formatearCantidad(null), '');
});

test('textoIngrediente se lee como en un recetario', () => {
  const t = (cantidad, unidad, nombre, detalle = '') => {
    const r = textoIngrediente({ cantidad, unidad, nombre, detalle });
    return [r.cantidad, r.nombre].filter(Boolean).join(' ') + (r.detalle ? `, ${r.detalle}` : '');
  };
  assert.equal(t(750, 'g', 'patata', 'nueva'), '750 g de patata, nueva');
  assert.equal(t(6, 'unidad', 'huevos', 'grandes'), '6 huevos, grandes');
  assert.equal(t(2, 'diente', 'ajo'), '2 dientes de ajo');
  assert.equal(t(1, 'diente', 'ajo'), '1 diente de ajo');
  assert.equal(t(0.5, 'cdta', 'comino'), '½ cdta de comino');
  assert.equal(t(null, 'pizca', 'sal'), 'una pizca de sal');
  assert.equal(t(null, 'chorro', 'aceite'), 'un chorro de aceite');
  assert.equal(t(null, 'g', 'harina'), 'harina');
  assert.equal(t(null, 'al gusto', 'pimienta', 'negra'), 'pimienta, negra, al gusto');
  assert.equal(t(null, 'unidad', 'limón'), 'limón');
});
