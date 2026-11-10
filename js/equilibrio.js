// Marcador de equilibrio semanal (PL-05): raciones de cada proteína en una semana frente a lo
// recomendado (Guía Fácil de Nestlé). Solo avisa: no impide nada.
//
// Cada comida o cena que lleva esa proteína cuenta como una ración por persona, aunque el hueco
// tenga varios platos con ella. Los límites se cambian en Ajustes (ajustes.json → limitesProteinas).

import { esEspecial } from './menus.js';

/** Grupos del marcador: qué proteínas de la receta cuentan, y si el límite es un máximo o un mínimo. */
export const GRUPOS = [
  { id: 'carne', nombre: 'Carne', proteinas: ['carne blanca', 'carne roja'], tipo: 'max', defecto: 4 },
  { id: 'carneRoja', nombre: 'roja', dentroDe: 'carne', proteinas: ['carne roja'], tipo: 'max', defecto: 1 },
  { id: 'pescado', nombre: 'Pescado', proteinas: ['pescado blanco', 'pescado azul', 'marisco'], tipo: 'min', defecto: 3 },
  { id: 'pescadoAzul', nombre: 'azul', dentroDe: 'pescado', proteinas: ['pescado azul'], tipo: 'min', defecto: 1 },
  { id: 'legumbre', nombre: 'Legumbre', proteinas: ['legumbre'], tipo: 'min', defecto: 3 },
  { id: 'huevo', nombre: 'Huevo', proteinas: ['huevo'], tipo: 'max', defecto: 3 },
];
export const LIMITE_MAX = 14;

/** Límites de la familia, con los recomendados donde falten o no sean válidos. */
export function limitesProteinas(ajustes) {
  const guardados = ajustes?.limitesProteinas ?? {};
  return Object.fromEntries(GRUPOS.map((g) => {
    const n = guardados[g.id];
    return [g.id, Number.isInteger(n) && n >= 0 && n <= LIMITE_MAX ? n : g.defecto];
  }));
}

/**
 * Marcador de una semana: [{ id, nombre, dentroDe, tipo, limite, cuenta, cumple }] en el orden de GRUPOS.
 * `fechas`: los días de la semana (AAAA-MM-DD).
 */
export function equilibrioSemana(menus, recetas, fechas, ajustes) {
  const porId = new Map(recetas.map((r) => [r.id, r]));
  const dias = new Set(fechas);
  const huecos = new Map(); // «fecha|hueco» → proteínas de sus platos
  for (const e of menus) {
    if (!dias.has(e.fecha) || esEspecial(e) || !porId.has(e.receta)) continue;
    const clave = `${e.fecha}|${e.hueco}`;
    if (!huecos.has(clave)) huecos.set(clave, new Set());
    for (const p of porId.get(e.receta).proteinas ?? []) huecos.get(clave).add(p);
  }
  const limites = limitesProteinas(ajustes);
  return GRUPOS.map((g) => {
    const cuenta = [...huecos.values()].filter((ps) => g.proteinas.some((p) => ps.has(p))).length;
    const limite = limites[g.id];
    return { id: g.id, nombre: g.nombre, dentroDe: g.dentroDe ?? null, tipo: g.tipo, limite, cuenta, cumple: g.tipo === 'max' ? cuenta <= limite : cuenta >= limite };
  });
}

/** «3/≤4» */
export const textoMarcador = (m) => `${m.cuenta}/${m.tipo === 'max' ? '≤' : '≥'}${m.limite}`;
