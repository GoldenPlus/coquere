// Generador de menús: elige recetas para los huecos según unas reglas, con algo de azar.
//
// Reglas (PL-02):
// - Hueco: para la comida, recetas con la etiqueta «comida»; para la cena, «cena». Una receta sin
//   ninguna de las dos vale para ambas (así no hace falta etiquetarlo todo para empezar).
// - Categorías: las que la familia ha sacado del menú en Ajustes no salen (p. ej. «Postres»).
// - No repetir: una receta que ya está en el menú hasta DIAS_SIN_REPETIR días antes o después se evita
//   (si no queda otra, se acepta la que lleve más tiempo sin salir).
// - Puntuación: sorteo con más peso para las mejor puntuadas; sin puntuar cuenta como un 3.
// Las reglas futuras (equilibrio, temporada…) se suman como pesos en `pesoDe`.

import { HUECOS, FICHERO_MENUS, entradasDe, esEspecial, sumarDias, leerFecha, racionesFamilia, conEntrada } from './menus.js';
import { normalizar } from './texto.js';

export const DIAS_SIN_REPETIR = 7;
const PESO_PUNTUACION = { 1: 1, 2: 2, 3: 3, 4: 5, 5: 8 };

/** Categorías que la familia ha sacado del menú (ajustes.json). */
export const categoriasFuera = (ajustes) => (Array.isArray(ajustes?.categoriasFueraDelMenu) ? ajustes.categoriasFueraDelMenu : []);

/** ¿Puede salir esta receta en este hueco (comida/cena y categorías)? */
export function admitida(receta, hueco, ajustes) {
  const etiquetas = receta.etiquetas.map(normalizar);
  const marcadas = HUECOS.filter((h) => etiquetas.includes(h));
  if (marcadas.length && !marcadas.includes(hueco)) return false;
  const fuera = new Set(categoriasFuera(ajustes).map(normalizar));
  return !receta.categorias.some((c) => fuera.has(normalizar(c)));
}

/** Días hasta el uso más cercano de la receta en el menú (Infinity si no está). */
function distanciaAlUsoMasCercano(menus, idReceta, fecha) {
  const t = leerFecha(fecha).getTime();
  let min = Infinity;
  for (const e of menus) {
    if (e.receta !== idReceta) continue;
    min = Math.min(min, Math.round(Math.abs(leerFecha(e.fecha).getTime() - t) / 86400000));
  }
  return min;
}

const pesoDe = (receta) => PESO_PUNTUACION[receta.puntuacion] ?? PESO_PUNTUACION[3];

/** Sorteo ponderado. `azar()` devuelve un número en [0, 1). */
function sortear(opciones, peso, azar) {
  const total = opciones.reduce((s, o) => s + peso(o), 0);
  let x = azar() * total;
  for (const o of opciones) {
    x -= peso(o);
    if (x < 0) return o;
  }
  return opciones.at(-1) ?? null;
}

/**
 * Elige una receta para un hueco, o null si no hay ninguna admitida.
 * `excluir`: ids que no pueden salir (p. ej. las que ya están en ese hueco).
 */
export function elegirReceta({ recetas, menus, ajustes, fecha, hueco, excluir = [], azar = Math.random }) {
  const fuera = new Set(excluir);
  const admitidas = recetas.filter((r) => !fuera.has(r.id) && admitida(r, hueco, ajustes));
  if (!admitidas.length) return null;
  const distancia = new Map(admitidas.map((r) => [r.id, distanciaAlUsoMasCercano(menus, r.id, fecha)]));
  const nuevas = admitidas.filter((r) => distancia.get(r.id) > DIAS_SIN_REPETIR);
  if (nuevas.length) return sortear(nuevas, pesoDe, azar);
  // Todas se han usado hace poco: la que más lejos quede (y, a igualdad, por sorteo).
  const lejos = Math.max(...distancia.values());
  return sortear(admitidas.filter((r) => distancia.get(r.id) === lejos), pesoDe, azar);
}

/** Fechas de `desde` a `hasta`, ambas incluidas. */
export function fechasEntre(desde, hasta) {
  const fechas = [];
  for (let f = desde; f <= hasta && fechas.length < 366; f = sumarDias(f, 1)) fechas.push(f);
  return fechas;
}

/**
 * Rellena los huecos de un rango: los vacíos y, con `reemplazarAuto`, también los que solo tienen
 * recetas puestas por la app. Nunca toca lo elegido a mano ni los huecos especiales.
 * Devuelve { datos, puestas, sinReceta } (datos null si no cambia nada).
 */
export function rellenarMenu(datosMenus, { recetas, ajustes, desde, hasta, reemplazarAuto = false, azar = Math.random }) {
  let items = datosMenus.items;
  let puestas = 0;
  let sinReceta = 0;
  const raciones = racionesFamilia(ajustes);
  for (const fecha of fechasEntre(desde, hasta)) {
    for (const hueco of HUECOS) {
      const actuales = entradasDe(items, fecha, hueco);
      const soloAuto = actuales.length > 0 && actuales.every((e) => !esEspecial(e) && e.origen === 'auto');
      if (actuales.length && !(reemplazarAuto && soloAuto)) continue;
      // Al regenerar, las recetas que había no cuentan para «no repetir» (se van a quitar).
      const resto = items.filter((e) => !(e.fecha === fecha && e.hueco === hueco));
      const receta = elegirReceta({ recetas, menus: resto, ajustes, fecha, hueco, excluir: actuales.map((e) => e.receta), azar });
      if (!receta) {
        sinReceta++;
        continue;
      }
      items = conEntrada({ items: resto }, { fecha, hueco, receta: receta.id, raciones, origen: 'auto' }).items;
      puestas++;
    }
  }
  return { datos: puestas ? { ...datosMenus, items } : null, puestas, sinReceta };
}

/** Rellena en GitHub sobre la versión más reciente de menus.json. Devuelve { datos, puestas, sinReceta }. */
export async function rellenarYGuardar(cliente, opciones, autor) {
  let resultado = { puestas: 0, sinReceta: 0 };
  const { datos } = await cliente.actualizar(
    FICHERO_MENUS,
    (d) => {
      resultado = rellenarMenu(d, opciones);
      return resultado.datos;
    },
    `Menú: rellena del ${opciones.desde} al ${opciones.hasta}${opciones.reemplazarAuto ? ' (y cambia lo que puso la app)' : ''} (por ${autor})`,
  );
  return { datos, puestas: resultado.puestas, sinReceta: resultado.sinReceta };
}
