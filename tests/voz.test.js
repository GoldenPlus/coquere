import { test } from 'node:test';
import assert from 'node:assert/strict';
import { admiteDictado, insertarDictado } from '../js/voz.js';

test('dictar en un campo vacío pone mayúscula', () => {
  assert.deepEqual(insertarDictado('', 0, 0, 'freír la cebolla'), { valor: 'Freír la cebolla', cursor: 16 });
  assert.equal(insertarDictado('', 0, 0, 'pollo', { mayusculas: false }).valor, 'pollo');
});

test('añade espacios alrededor y mayúscula tras un punto', () => {
  assert.equal(insertarDictado('Pelar.', 6, 6, 'cortar en dados').valor, 'Pelar. Cortar en dados');
  assert.equal(insertarDictado('pollo', 5, 5, 'y calabacín').valor, 'pollo y calabacín');
  const r = insertarDictado('Freír  a fuego lento', 6, 6, 'la cebolla');
  assert.equal(r.valor, 'Freír la cebolla a fuego lento');
  assert.equal(r.cursor, 16);
  assert.equal(insertarDictado('pollo.', 5, 5, 'asado').valor, 'pollo asado.');
});

test('sustituye lo seleccionado y respeta el máximo', () => {
  assert.equal(insertarDictado('tomate', 0, 6, 'pimiento rojo').valor, 'Pimiento rojo');
  assert.equal(insertarDictado('abc', 3, 3, 'defgh', { max: 6 }).valor, 'abc de');
  assert.deepEqual(insertarDictado('abc', 1, 2, '   '), { valor: 'abc', cursor: 2 });
});

test('solo se dicta en campos de texto libre', () => {
  const campo = (tagName, type, atributos = {}) => ({ tagName, type, dataset: {}, getAttribute: (a) => atributos[a] ?? null });
  assert.ok(admiteDictado(campo('INPUT', 'text')));
  assert.ok(admiteDictado(campo('INPUT', 'search')));
  assert.ok(admiteDictado(campo('TEXTAREA', 'textarea')));
  assert.ok(!admiteDictado(campo('INPUT', 'number')));
  assert.ok(!admiteDictado(campo('INPUT', 'password')));
  assert.ok(!admiteDictado(campo('INPUT', 'text', { inputmode: 'decimal' })));
  assert.ok(!admiteDictado(campo('INPUT', 'text', { spellcheck: 'false' })));
  assert.ok(!admiteDictado(campo('SELECT', 'select-one')));
  assert.ok(!admiteDictado(null));
});
