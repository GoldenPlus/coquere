import { test } from 'node:test';
import assert from 'node:assert/strict';
import { equilibrioSemana, limitesProteinas, textoMarcador } from '../js/equilibrio.js';
import { diasDeSemana } from '../js/menus.js';

const R = (id, proteinas) => ({ id, titulo: id, proteinas });
const E = (fecha, hueco, receta) => ({ fecha, hueco, receta, raciones: 4, origen: 'manual' });
const recetas = [R('filete', ['carne roja']), R('pollo', ['carne blanca']), R('merluza', ['pescado blanco']), R('salmon', ['pescado azul']),
  R('lentejas', ['legumbre', 'carne roja']), R('tortilla', ['huevo']), R('ensalada', ['vegetal'])];
const semana = diasDeSemana('2026-11-09');
const porId = (m) => Object.fromEntries(m.map((x) => [x.id, x]));

test('cuenta comidas y cenas con cada proteína; subgrupos dentro de su grupo', () => {
  const menus = [
    E('2026-11-09', 'comida', 'lentejas'), E('2026-11-09', 'cena', 'tortilla'),
    E('2026-11-10', 'comida', 'pollo'), E('2026-11-10', 'cena', 'merluza'),
    E('2026-11-11', 'comida', 'filete'), E('2026-11-11', 'cena', 'salmon'),
    E('2026-11-16', 'comida', 'merluza'), // otra semana
  ];
  const m = porId(equilibrioSemana(menus, recetas, semana, {}));
  assert.equal(m.carne.cuenta, 3);
  assert.equal(m.carneRoja.cuenta, 2);
  assert.equal(m.carneRoja.cumple, false);
  assert.equal(m.carne.cumple, true);
  assert.equal(m.pescado.cuenta, 2);
  assert.equal(m.pescado.cumple, false);
  assert.equal(m.pescadoAzul.cumple, true);
  assert.equal(m.legumbre.cuenta, 1);
  assert.equal(m.huevo.cuenta, 1);
  assert.equal(textoMarcador(m.carne), '3/≤4');
  assert.equal(textoMarcador(m.pescado), '2/≥3');
});

test('al añadir pescado se pone en verde', () => {
  const menus = [E('2026-11-09', 'cena', 'merluza'), E('2026-11-10', 'cena', 'salmon')];
  assert.equal(porId(equilibrioSemana(menus, recetas, semana, {})).pescado.cumple, false);
  menus.push(E('2026-11-12', 'cena', 'merluza'));
  assert.equal(porId(equilibrioSemana(menus, recetas, semana, {})).pescado.cumple, true);
});

test('varios platos con la misma proteína en un hueco cuentan una vez; especiales y borradas no cuentan', () => {
  const menus = [E('2026-11-09', 'comida', 'merluza'), E('2026-11-09', 'comida', 'salmon'),
    { fecha: '2026-11-09', hueco: 'cena', especial: 'fuera' }, E('2026-11-10', 'cena', 'no-existe')];
  const m = porId(equilibrioSemana(menus, recetas, semana, {}));
  assert.equal(m.pescado.cuenta, 1);
  assert.equal(m.pescadoAzul.cuenta, 1);
});

test('límites de Ajustes; los no válidos vuelven al recomendado', () => {
  assert.deepEqual(limitesProteinas({}), { carne: 4, carneRoja: 1, pescado: 3, pescadoAzul: 1, legumbre: 3, huevo: 3 });
  assert.equal(limitesProteinas({ limitesProteinas: { huevo: 5, carne: -1, pescado: 'x' } }).huevo, 5);
  assert.equal(limitesProteinas({ limitesProteinas: { carne: -1 } }).carne, 4);
  const m = porId(equilibrioSemana([E('2026-11-09', 'cena', 'tortilla')], recetas, semana, { limitesProteinas: { huevo: 0 } }));
  assert.equal(m.huevo.cumple, false);
});
