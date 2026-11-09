import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fechaISO, sumarDias, inicioSemana, diasDeSemana, esFechaISO, entradasDe, usosDeReceta, racionesFamilia,
  conEntrada, sinEntrada, conRaciones, conOrden, sinReceta, conEspecial, sinEspecial, especialDe, usosDeReceta as usos, marcarEspecial, quitarEspecial, ponerReceta, quitarDeMenu, moverEnMenu, cambiarRaciones, quitarRecetaDeMenus, guardarRacionesFamilia,
} from '../js/menus.js';

test('fechas locales: semana de lunes a domingo, también al cruzar de año y con cambio de hora', () => {
  assert.equal(fechaISO(new Date(2026, 10, 5, 23, 59)), '2026-11-05');
  assert.equal(inicioSemana('2026-11-05'), '2026-11-02'); // jueves → lunes
  assert.equal(inicioSemana('2026-11-08'), '2026-11-02'); // domingo → lunes anterior
  assert.equal(inicioSemana('2026-11-09'), '2026-11-09');
  assert.deepEqual(diasDeSemana('2026-12-28'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
  assert.equal(sumarDias('2026-10-24', 2), '2026-10-26'); // cambio de hora del 25 de octubre
  assert.equal(sumarDias('2026-03-01', -1), '2026-02-28');
  assert.ok(esFechaISO('2026-02-28'));
  assert.ok(!esFechaISO('2026-02-30'));
  assert.ok(!esFechaISO('9/11/2026'));
});

const E = (fecha, hueco, receta, raciones = 4) => ({ fecha, hueco, receta, raciones, origen: 'manual' });

test('un hueco puede tener varias recetas, en orden y sin repetir', () => {
  let d = { version: 1, items: [] };
  d = conEntrada(d, E('2026-11-10', 'cena', 'r2'));
  d = conEntrada(d, E('2026-11-09', 'cena', 'r1'));
  d = conEntrada(d, E('2026-11-09', 'comida', 'r3'));
  d = conEntrada(d, E('2026-11-09', 'cena', 'r4'));
  assert.deepEqual(d.items.map((e) => `${e.fecha} ${e.hueco} ${e.receta}`), ['2026-11-09 comida r3', '2026-11-09 cena r1', '2026-11-09 cena r4', '2026-11-10 cena r2']);
  assert.deepEqual(entradasDe(d.items, '2026-11-09', 'cena').map((e) => e.receta), ['r1', 'r4']);
  assert.deepEqual(entradasDe(d.items, '2026-11-11', 'cena'), []);
  // La misma receta otra vez actualiza su entrada en el sitio, no la duplica.
  d = conEntrada(d, E('2026-11-09', 'cena', 'r1', 6));
  assert.deepEqual(entradasDe(d.items, '2026-11-09', 'cena').map((e) => `${e.receta}:${e.raciones}`), ['r1:6', 'r4:4']);
  assert.equal(conEntrada(d, E('2026-11-09', 'cena', 'r1', 6)), null);
  assert.deepEqual(usosDeReceta(d.items, 'r2').map((e) => e.fecha), ['2026-11-10']);
});

test('cambiar una receta por otra mantiene su sitio en el hueco', () => {
  let d = { version: 1, items: [E('2026-11-09', 'cena', 'r1'), E('2026-11-09', 'cena', 'r4')] };
  d = conEntrada(d, E('2026-11-09', 'cena', 'r9', 3), { sustituye: 'r1' });
  assert.deepEqual(d.items.map((e) => e.receta), ['r9', 'r4']);
  assert.throws(() => conEntrada(d, E('2026-11-09', 'cena', 'r4'), { sustituye: 'r9' }), /ya está en este hueco/);
  // Si la receta a sustituir ya no está (otro dispositivo la quitó), la nueva va al final.
  assert.deepEqual(conEntrada(d, E('2026-11-09', 'cena', 'r7'), { sustituye: 'r1' }).items.map((e) => e.receta), ['r9', 'r4', 'r7']);
});

test('quitar y reordenar platos de un hueco', () => {
  const d = { version: 1, items: [E('2026-11-09', 'comida', 'r0'), E('2026-11-09', 'cena', 'r1'), E('2026-11-09', 'cena', 'r2'), E('2026-11-09', 'cena', 'r3')] };
  assert.deepEqual(conOrden(d, '2026-11-09', 'cena', 'r3', -1).items.map((e) => e.receta), ['r0', 'r1', 'r3', 'r2']);
  assert.deepEqual(conOrden(d, '2026-11-09', 'cena', 'r1', +1).items.map((e) => e.receta), ['r0', 'r2', 'r1', 'r3']);
  assert.equal(conOrden(d, '2026-11-09', 'cena', 'r1', -1), null);
  assert.equal(conOrden(d, '2026-11-09', 'cena', 'r3', +1), null);
  assert.equal(conOrden(d, '2026-11-09', 'cena', 'nada', +1), null);
  assert.deepEqual(sinEntrada(d, '2026-11-09', 'cena', 'r2').items.map((e) => e.receta), ['r0', 'r1', 'r3']);
  assert.equal(sinEntrada(d, '2026-11-09', 'comida', 'r2'), null);
  assert.equal(sinReceta(d, 'r2').items.length, 3);
  assert.equal(sinReceta(d, 'nada'), null);
});

test('hueco especial: ocupa el hueco solo, admite nota y no se mezcla con recetas', () => {
  let d = { version: 1, items: [E('2026-11-09', 'comida', 'r1')] };
  d = conEspecial(d, { fecha: '2026-11-09', hueco: 'cena', especial: 'fuera', nota: '  en casa de la abuela ' });
  assert.deepEqual(especialDe(d.items, '2026-11-09', 'cena'), { fecha: '2026-11-09', hueco: 'cena', especial: 'fuera', nota: 'en casa de la abuela', origen: 'manual' });
  assert.equal(especialDe(d.items, '2026-11-09', 'comida'), null);
  // Cambiar tipo o nota sustituye la marca; repetir lo mismo no cambia nada.
  d = conEspecial(d, { fecha: '2026-11-09', hueco: 'cena', especial: 'libre', nota: '' });
  assert.equal(entradasDe(d.items, '2026-11-09', 'cena').length, 1);
  assert.equal(conEspecial(d, { fecha: '2026-11-09', hueco: 'cena', especial: 'libre' }), null);
  assert.throws(() => conEntrada(d, E('2026-11-09', 'cena', 'r2')), /Libre \/ improvisar/);
  assert.throws(() => conEspecial(d, { fecha: '2026-11-09', hueco: 'comida', especial: 'fuera' }), /ya tiene recetas/);
  assert.throws(() => conEspecial(d, { fecha: '2026-11-09', hueco: 'cena', especial: 'merienda' }), /desconocido/);
  assert.throws(() => conEspecial(d, { fecha: '2026-11-09', hueco: 'cena', especial: 'fuera', nota: 'x'.repeat(201) }), /200/);
  assert.deepEqual(usos(d.items, 'r1').length, 1);
  assert.equal(sinReceta(d, 'r1').items.length, 1);
  assert.equal(sinEspecial(d, '2026-11-09', 'comida'), null);
  assert.deepEqual(sinEspecial(d, '2026-11-09', 'cena').items, [E('2026-11-09', 'comida', 'r1')]);
});

test('las raciones solo cambian si la receta sigue en el hueco', () => {
  const d = { version: 1, items: [E('2026-11-09', 'cena', 'r1'), E('2026-11-09', 'cena', 'r2')] };
  assert.deepEqual(conRaciones(d, '2026-11-09', 'cena', 'r2', 6).items.map((e) => e.raciones), [4, 6]);
  assert.equal(conRaciones(d, '2026-11-09', 'cena', 'otra', 6), null);
  assert.equal(conRaciones(d, '2026-11-09', 'comida', 'r1', 6), null);
});

test('entradas no válidas se rechazan con un mensaje claro', () => {
  const d = { version: 1, items: [] };
  assert.throws(() => conEntrada(d, E('2026-13-01', 'cena', 'r1')), /fecha/);
  assert.throws(() => conEntrada(d, E('2026-11-09', 'merienda', 'r1')), /comida o cena/);
  assert.throws(() => conEntrada(d, E('2026-11-09', 'cena', 'r1', 0)), /raciones/);
});

test('raciones de la familia: 4 si no hay ajustes o no son válidas', () => {
  assert.equal(racionesFamilia(null), 4);
  assert.equal(racionesFamilia({ version: 1, items: [] }), 4);
  assert.equal(racionesFamilia({ racionesFamilia: 3 }), 3);
  assert.equal(racionesFamilia({ racionesFamilia: 'x' }), 4);
});

/** Cliente simulado: un fichero por nombre; `otro` se aplica una vez antes de la primera escritura. */
function cliente(ficheros = {}, otro = null) {
  const mensajes = [];
  return {
    mensajes,
    ficheros,
    async actualizar(nombre, mutar, mensaje, opciones = {}) {
      if (otro) { ficheros[nombre] = otro(ficheros[nombre] ?? { version: 1, items: [] }); otro = null; }
      const actual = ficheros[nombre] ?? { version: 1, items: [] };
      if (opciones.lista === false) assert.ok(nombre === 'ajustes.json');
      const nuevos = mutar(actual);
      if (nuevos === null) return { datos: actual };
      ficheros[nombre] = nuevos;
      mensajes.push(mensaje);
      return { datos: nuevos };
    },
  };
}

test('poner receta y cambiar raciones guardan en menus.json, respetando lo que otro cambió a la vez', async () => {
  const c = cliente({}, (d) => ({ ...d, items: [E('2026-11-10', 'comida', 'rOtro')] }));
  await ponerReceta(c, { fecha: '2026-11-09', hueco: 'cena', receta: { id: 'r1', titulo: 'Lentejas' }, raciones: 4 }, 'Ana');
  const datos = await cambiarRaciones(c, { fecha: '2026-11-09', hueco: 'cena', receta: 'r1', raciones: 6 }, 'Ana');
  assert.deepEqual(datos.items, [E('2026-11-09', 'cena', 'r1', 6), E('2026-11-10', 'comida', 'rOtro')]);
  assert.deepEqual(c.mensajes, ['Menú: Lentejas para la cena del 2026-11-09 (por Ana)', 'Menú: 6 raciones para la cena del 2026-11-09 (por Ana)']);
});

test('añadir, cambiar, mover y quitar platos guardan en menus.json', async () => {
  const c = cliente({ 'menus.json': { version: 1, items: [E('2026-11-09', 'cena', 'r1')] } });
  await ponerReceta(c, { fecha: '2026-11-09', hueco: 'cena', receta: { id: 'r2', titulo: 'Flan' }, raciones: 4 }, 'Ana');
  await moverEnMenu(c, { fecha: '2026-11-09', hueco: 'cena', receta: { id: 'r2', titulo: 'Flan' } }, -1, 'Ana');
  await ponerReceta(c, { fecha: '2026-11-09', hueco: 'cena', receta: { id: 'r3', titulo: 'Natillas' }, raciones: 4, sustituye: 'r2' }, 'Ana');
  const datos = await quitarDeMenu(c, { fecha: '2026-11-09', hueco: 'cena', receta: { id: 'r1', titulo: 'Lentejas' } }, 'Ana');
  assert.deepEqual(datos.items, [E('2026-11-09', 'cena', 'r3')]);
  assert.deepEqual(c.mensajes, [
    'Menú: Flan para la cena del 2026-11-09 (por Ana)',
    'Menú: reordena la cena del 2026-11-09 (por Ana)',
    'Menú: Natillas en lugar de otra receta en la cena del 2026-11-09 (por Ana)',
    'Menú: quita Lentejas de la cena del 2026-11-09 (por Ana)',
  ]);
});

test('marcar y quitar un hueco especial guarda en menus.json', async () => {
  const c = cliente({});
  await marcarEspecial(c, { fecha: '2026-11-14', hueco: 'comida', especial: 'fuera', nota: 'Boda' }, 'Ana');
  const datos = await quitarEspecial(c, { fecha: '2026-11-14', hueco: 'comida' }, 'Ana');
  assert.deepEqual(datos.items, []);
  assert.deepEqual(c.mensajes, ['Menú: Comemos fuera en la comida del 2026-11-14 (por Ana)', 'Menú: vacía la comida del 2026-11-14 (por Ana)']);
});

test('borrar una receta la quita de todos los menús; las raciones de la familia van a ajustes.json', async () => {
  const c = cliente({ 'menus.json': { version: 1, items: [E('2026-11-09', 'cena', 'r1'), E('2026-11-12', 'comida', 'r1'), E('2026-11-10', 'cena', 'r2')] } });
  const datos = await quitarRecetaDeMenus(c, { id: 'r1', titulo: 'Lentejas' }, 'Ana');
  assert.deepEqual(datos.items.map((e) => e.receta), ['r2']);
  const ajustes = await guardarRacionesFamilia(c, 5, 'Ana');
  assert.equal(ajustes.racionesFamilia, 5);
  await assert.rejects(guardarRacionesFamilia(c, 0, 'Ana'), /van de 1 a 50/);
});
