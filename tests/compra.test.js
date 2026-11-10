import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { sumarCantidades, lineasDeMenu, textoCantidades, conListaGenerada, conManual, sinLinea, generarLista, anadirALista } from '../js/compra.js';

globalThis.crypto ??= webcrypto;

const I = (cantidad, unidad, nombre) => ({ cantidad, unidad, nombre, detalle: '' });
const R = (id, titulo, raciones, ingredientes) => ({ id, titulo, raciones, ingredientes, categorias: [], etiquetas: [] });
const E = (fecha, hueco, receta, raciones) => ({ fecha, hueco, receta, raciones, origen: 'manual' });

const recetas = [
  R('t', 'Tortilla', 4, [I(6, 'unidad', 'huevo'), I(750, 'g', 'patata'), I(null, 'al gusto', 'sal'), I(50, 'ml', 'aceite de oliva')]),
  R('l', 'Lentejas', 4, [I(300, 'g', 'lentejas'), I(2, 'unidad', 'patatas'), I(1, 'diente', 'ajo'), I(1, 'pizca', 'sal'), I(2, 'cda', 'aceite de oliva')]),
  R('p', 'Puré', 2, [I(0.5, 'kg', 'patata'), I(1, 'lata', 'tomate'), I(200, 'g', 'tomates')]),
];

test('sumar: misma unidad se queda; masa y volumen se convierten; recuento solo consigo mismo', () => {
  assert.deepEqual(sumarCantidades([{ cantidad: 200, unidad: 'g' }, { cantidad: 300, unidad: 'g' }]), [{ cantidad: 500, unidad: 'g' }]);
  assert.deepEqual(sumarCantidades([{ cantidad: 750, unidad: 'g' }, { cantidad: 0.5, unidad: 'kg' }]), [{ cantidad: 1.25, unidad: 'kg' }]);
  assert.deepEqual(sumarCantidades([{ cantidad: 2, unidad: 'cda' }, { cantidad: 100, unidad: 'ml' }]), [{ cantidad: 130, unidad: 'ml' }]);
  assert.deepEqual(sumarCantidades([{ cantidad: 2, unidad: 'cda' }, { cantidad: 1, unidad: 'cda' }]), [{ cantidad: 3, unidad: 'cda' }]);
  assert.deepEqual(sumarCantidades([{ cantidad: 880, unidad: 'g' }, { cantidad: 750, unidad: 'g' }]), [{ cantidad: 1.63, unidad: 'kg' }]);
  assert.deepEqual(sumarCantidades([{ cantidad: 1.5, unidad: 'l' }, { cantidad: 1, unidad: 'l' }]), [{ cantidad: 2.5, unidad: 'l' }]);
  assert.deepEqual(sumarCantidades([{ cantidad: 200, unidad: 'g' }, { cantidad: 1, unidad: 'lata' }]), [{ cantidad: 200, unidad: 'g' }, { cantidad: 1, unidad: 'lata' }]);
});

test('lista de una semana: escalada a las raciones de cada comida, sumada y sin duplicados', () => {
  const menus = [
    E('2026-11-09', 'comida', 't', 2),  // media tortilla: 3 huevos, 375 → 380 g patata, 25 ml aceite
    E('2026-11-09', 'cena', 'p', 4),    // puré doble: 1 kg patata, 2 latas, 400 g tomates
    E('2026-11-10', 'comida', 'l', 4),
    E('2026-11-10', 'comida', 't', 4),  // dos platos en el mismo hueco
    { fecha: '2026-11-11', hueco: 'comida', especial: 'fuera', nota: '', origen: 'manual' },
    E('2026-11-20', 'comida', 'l', 4),  // fuera del rango
  ];
  const lineas = lineasDeMenu({ recetas, menus, desde: '2026-11-09', hasta: '2026-11-15' });
  const ver = Object.fromEntries(lineas.map((l) => [l.nombre, textoCantidades(l) || (l.sinCantidad ? 'a ojo' : '')]));
  assert.deepEqual(ver, {
    'aceite de oliva': '105 ml', // 25 + 30 (2 cda) + 50
    ajo: '1 diente',
    huevo: '9',
    lentejas: '300 g',
    patata: '2,13 kg + 2', // 380 + 1000 + 750 g, y 2 «patatas» en unidades
    sal: 'a ojo',
    tomate: '2 latas + 400 g', // en el orden en que aparecen
  });
  assert.deepEqual(lineas.find((l) => l.nombre === 'patata').recetas, ['Tortilla', 'Puré', 'Lentejas']);
  assert.deepEqual(lineas.map((l) => l.nombre), ['aceite de oliva', 'ajo', 'huevo', 'lentejas', 'patata', 'sal', 'tomate']);
});

test('una receta borrada del recetario se ignora', () => {
  assert.deepEqual(lineasDeMenu({ recetas, menus: [E('2026-11-09', 'cena', 'nada', 4)], desde: '2026-11-09', hasta: '2026-11-09' }), []);
});

test('generar sustituye la lista pero conserva lo añadido a mano; añadir no repite', () => {
  let d = conListaGenerada(null, { recetas, menus: [E('2026-11-09', 'comida', 'l', 4)], desde: '2026-11-09', hasta: '2026-11-09' }, new Date('2026-11-09T10:00:00Z'));
  assert.equal(d.generada, '2026-11-09T10:00:00.000Z');
  d = conManual(d, ' pilas ', 'm:1');
  assert.equal(conManual(d, 'Pilas', 'm:2'), null);
  assert.equal(conManual(d, 'lenteja', 'm:3'), null); // ya viene del menú
  assert.throws(() => conManual(d, '   '), /Escribe/);
  d = conListaGenerada(d, { recetas, menus: [E('2026-11-09', 'comida', 't', 4)], desde: '2026-11-09', hasta: '2026-11-09' });
  assert.deepEqual(d.items.map((l) => l.nombre), ['aceite de oliva', 'huevo', 'patata', 'sal', 'pilas']);
  assert.deepEqual(sinLinea(d, 'm:1').items.map((l) => l.nombre), ['aceite de oliva', 'huevo', 'patata', 'sal']);
  assert.equal(sinLinea(d, 'nada'), null);
});

test('generar y añadir guardan en lista.json', async () => {
  let fichero = { version: 1, items: [] };
  const mensajes = [];
  const cliente = { async actualizar(nombre, mutar, mensaje) { assert.equal(nombre, 'lista.json'); const n = mutar(fichero); if (n) { fichero = n; mensajes.push(mensaje); } return { datos: fichero }; } };
  await generarLista(cliente, { recetas, menus: [E('2026-11-09', 'comida', 'l', 4)], desde: '2026-11-09', hasta: '2026-11-15' }, 'Ana');
  const datos = await anadirALista(cliente, 'papel de cocina', 'Ana');
  assert.equal(datos.items.at(-1).nombre, 'papel de cocina');
  assert.deepEqual(mensajes, ['Compra: lista del 2026-11-09 al 2026-11-15 (por Ana)', 'Compra: añade papel de cocina (por Ana)']);
});

test('periodos: desde hoy hasta el domingo, el domingo siguiente o fin de mes', async () => {
  const { rangoPeriodo } = await import('../js/compra.js');
  // 2026-11-10 es martes.
  assert.deepEqual(rangoPeriodo('2026-11-10', 'semana'), { desde: '2026-11-10', hasta: '2026-11-15' });
  assert.deepEqual(rangoPeriodo('2026-11-10', '2semanas'), { desde: '2026-11-10', hasta: '2026-11-22' });
  assert.deepEqual(rangoPeriodo('2026-11-10', 'mes'), { desde: '2026-11-10', hasta: '2026-11-30' });
  assert.deepEqual(rangoPeriodo('2026-11-15', 'semana'), { desde: '2026-11-15', hasta: '2026-11-15' });
  assert.deepEqual(rangoPeriodo('2026-02-03', 'mes'), { desde: '2026-02-03', hasta: '2026-02-28' });
  assert.deepEqual(rangoPeriodo('2026-12-29', '2semanas'), { desde: '2026-12-29', hasta: '2027-01-10' });
});
