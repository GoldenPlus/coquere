import { test } from 'node:test';
import assert from 'node:assert/strict';
import { menuDelDia, enlaceReceta } from '../js/hoy.js';

const recetas = [{ id: 'a', titulo: 'Lentejas' }, { id: 'b', titulo: 'Ensalada' }];

test('menú del día: platos con raciones del hueco, especiales y huecos vacíos', () => {
  const menus = [
    { fecha: '2026-11-10', hueco: 'comida', receta: 'a', raciones: 6 },
    { fecha: '2026-11-10', hueco: 'comida', receta: 'b', raciones: 2 },
    { fecha: '2026-11-10', hueco: 'cena', especial: 'fuera', nota: 'Cumple de Ana' },
    { fecha: '2026-11-11', hueco: 'comida', receta: 'b', raciones: 4 },
  ];
  const [comida, cena] = menuDelDia(menus, recetas, '2026-11-10');
  assert.equal(comida.hueco, 'comida');
  assert.deepEqual(comida.platos.map((p) => [p.receta.titulo, p.raciones]), [['Lentejas', 6], ['Ensalada', 2]]);
  assert.equal(comida.especial, null);
  assert.deepEqual(cena.especial, { especial: 'fuera', nota: 'Cumple de Ana' });
  assert.deepEqual(cena.platos, []);
  assert.ok(menuDelDia(menus, recetas, '2026-11-12').every((h) => !h.especial && !h.platos.length));
});

test('menú del día: las recetas borradas no salen', () => {
  const dia = menuDelDia([{ fecha: '2026-11-10', hueco: 'cena', receta: 'zz', raciones: 4 }], recetas, '2026-11-10');
  assert.deepEqual(dia[1].platos, []);
});

test('enlace a la ficha con raciones', () => {
  assert.equal(enlaceReceta('a b', 6), '#receta/a%20b/6');
  assert.equal(enlaceReceta('a'), '#receta/a');
});
