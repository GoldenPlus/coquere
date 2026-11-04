import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerConfig, guardarConfig, borrarConfig, configCompleta, normalizarRepo } from '../js/config.js';

const memoria = () => {
  const datos = new Map();
  return { getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => datos.set(k, v), removeItem: (k) => datos.delete(k), datos };
};

test('normalizarRepo acepta usuario/repo y la URL de GitHub', () => {
  assert.equal(normalizarRepo('GoldenPlus/coquere-datos'), 'GoldenPlus/coquere-datos');
  assert.equal(normalizarRepo(' https://github.com/GoldenPlus/coquere-datos.git/ '), 'GoldenPlus/coquere-datos');
  assert.equal(normalizarRepo('coquere-datos'), null);
  assert.equal(normalizarRepo('a/b/c'), null);
});

test('la configuración se guarda, se lee y se olvida junto con la copia local', () => {
  const m = memoria();
  assert.equal(configCompleta(leerConfig(m)), false);
  guardarConfig({ nombre: 'Ana', repo: 'a/b', token: 't' }, m);
  m.setItem('coquere.cache', '{}');
  assert.equal(configCompleta(leerConfig(m)), true);
  borrarConfig(m);
  assert.equal(m.datos.size, 0);
});
