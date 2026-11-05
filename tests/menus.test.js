import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fechaISO, sumarDias, inicioSemana, diasDeSemana, esFechaISO, entradaDe, usosDeReceta, racionesFamilia,
  conEntrada, sinEntrada, conRaciones, sinReceta, ponerReceta, cambiarRaciones, quitarRecetaDeMenus, guardarRacionesFamilia,
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

test('poner, cambiar y quitar entradas: una por fecha y hueco, en orden', () => {
  let d = { version: 1, items: [] };
  d = conEntrada(d, E('2026-11-10', 'cena', 'r2'));
  d = conEntrada(d, E('2026-11-09', 'cena', 'r1'));
  d = conEntrada(d, E('2026-11-09', 'comida', 'r3'));
  assert.deepEqual(d.items.map((e) => `${e.fecha} ${e.hueco}`), ['2026-11-09 comida', '2026-11-09 cena', '2026-11-10 cena']);
  d = conEntrada(d, E('2026-11-09', 'cena', 'r2', 6));
  assert.equal(d.items.length, 3);
  assert.deepEqual(entradaDe(d.items, '2026-11-09', 'cena'), E('2026-11-09', 'cena', 'r2', 6));
  assert.equal(conEntrada(d, E('2026-11-09', 'cena', 'r2', 6)), null);
  assert.deepEqual(usosDeReceta(d.items, 'r2').map((e) => e.fecha), ['2026-11-09', '2026-11-10']);
  assert.equal(sinEntrada(d, '2026-11-11', 'cena'), null);
  assert.equal(sinEntrada(d, '2026-11-09', 'cena').items.length, 2);
  assert.equal(sinReceta(d, 'r2').items.length, 1);
  assert.equal(sinReceta(d, 'nada'), null);
});

test('las raciones solo cambian si el hueco sigue teniendo la misma receta', () => {
  const d = { version: 1, items: [E('2026-11-09', 'cena', 'r1')] };
  assert.equal(conRaciones(d, '2026-11-09', 'cena', 'r1', 6).items[0].raciones, 6);
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

test('borrar una receta la quita de todos los menús; las raciones de la familia van a ajustes.json', async () => {
  const c = cliente({ 'menus.json': { version: 1, items: [E('2026-11-09', 'cena', 'r1'), E('2026-11-12', 'comida', 'r1'), E('2026-11-10', 'cena', 'r2')] } });
  const datos = await quitarRecetaDeMenus(c, { id: 'r1', titulo: 'Lentejas' }, 'Ana');
  assert.deepEqual(datos.items.map((e) => e.receta), ['r2']);
  const ajustes = await guardarRacionesFamilia(c, 5, 'Ana');
  assert.equal(ajustes.racionesFamilia, 5);
  await assert.rejects(guardarRacionesFamilia(c, 0, 'Ana'), /van de 1 a 50/);
});
