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
  assert.equal(enlaceReceta('a b', '2026-11-10', 'cena'), '#receta/a%20b/2026-11-10/cena');
  assert.equal(enlaceReceta('a'), '#receta/a');
});

test('cocinar el doble: el primer día suma las raciones de los siguientes 3 días', async () => {
  const { cocinarDoble, textoCocinarDoble } = await import('../js/hoy.js');
  const E = (fecha, hueco, receta, raciones = 4) => ({ fecha, hueco, receta, raciones });
  // 2026-11-10 es martes.
  const menus = [E('2026-11-10', 'comida', 'a'), E('2026-11-12', 'comida', 'a'), E('2026-11-20', 'cena', 'a'), E('2026-11-11', 'cena', 'b', 2), E('2026-11-11', 'comida', 'b', 3)];
  const doble = cocinarDoble(menus, '2026-11-10', 'comida', 'a');
  assert.deepEqual(doble, { raciones: 8, propias: 4, otras: [{ fecha: '2026-11-12', hueco: 'comida', raciones: 4 }] });
  assert.equal(textoCocinarDoble(doble, '2026-11-10'), 'También para el jueves: cocina 8 raciones');
  // El segundo día no avisa; lo de dentro de 10 días tampoco cuenta.
  assert.equal(cocinarDoble(menus, '2026-11-12', 'comida', 'a'), null);
  assert.equal(cocinarDoble(menus, '2026-11-20', 'cena', 'a'), null);
  // Comida y cena del mismo día.
  const mismoDia = cocinarDoble(menus, '2026-11-11', 'comida', 'b');
  assert.equal(mismoDia.raciones, 5);
  assert.equal(textoCocinarDoble(mismoDia, '2026-11-11'), 'También para la cena: cocina 5 raciones');
  assert.equal(cocinarDoble(menus, '2026-11-10', 'cena', 'a'), null);
});

test('menú del día lleva el aviso de cocinar el doble', () => {
  const menus = [{ fecha: '2026-11-10', hueco: 'cena', receta: 'a', raciones: 4 }, { fecha: '2026-11-11', hueco: 'cena', receta: 'a', raciones: 2 }];
  assert.equal(menuDelDia(menus, recetas, '2026-11-10')[1].platos[0].doble.raciones, 6);
});
