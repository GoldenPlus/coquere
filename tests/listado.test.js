import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatearTiempo, estrellas, filasListado } from '../js/listado.js';

test('formatearTiempo en minutos y horas', () => {
  assert.equal(formatearTiempo(40), '40 min');
  assert.equal(formatearTiempo(60), '1 h');
  assert.equal(formatearTiempo(75), '1 h 15 min');
  assert.equal(formatearTiempo(null), '');
  assert.equal(formatearTiempo(0), '');
});

test('estrellas solo para puntuaciones de 1 a 5', () => {
  assert.equal(estrellas(4), '★★★★☆');
  assert.equal(estrellas(null), '');
  assert.equal(estrellas(7), '');
});

test('filasListado ordena por título sin distinguir tildes ni mayúsculas y resume los datos', () => {
  const filas = filasListado([
    { id: '1', titulo: 'tortilla', categorias: ['Segundos', 'Cenas'], tiempo: 40, dificultad: 2, puntuacion: 5 },
    { id: '2', titulo: 'Ánimas de cordero', categorias: [], tiempo: null, dificultad: null, puntuacion: null },
    { id: '3', titulo: 'Bizcocho', categorias: ['Postres'], tiempo: 90, dificultad: 3, puntuacion: 3 },
  ]);
  assert.deepEqual(filas.map((f) => f.titulo), ['Ánimas de cordero', 'Bizcocho', 'tortilla']);
  assert.deepEqual(filas[2], { id: '1', titulo: 'tortilla', categoria: 'Segundos, Cenas', tiempo: '40 min', dificultad: 'Fácil', estrellas: '★★★★★', puntuacion: 5, foto: null });
  assert.deepEqual(filas[0], { id: '2', titulo: 'Ánimas de cordero', categoria: '', tiempo: '', dificultad: '', estrellas: '', puntuacion: null, foto: null });
});
