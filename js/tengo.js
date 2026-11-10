// «Tengo…» (RC-12): recetas ordenadas por cuántos de los ingredientes que tienes llevan, con lo que falta.

import { claveIngrediente } from './ingredientes.js';
import { SIN_CANTIDAD } from './compra.js';
import { compararTitulos } from './texto.js';

/**
 * ¿Lo que tengo sirve para este ingrediente? Mismo ingrediente (tomate/tomates) o contenido como
 * palabras enteras: «pollo» sirve para «pechuga de pollo», pero «col» no sirve para «coliflor».
 */
export function sirvePara(tengo, ingrediente) {
  const a = claveIngrediente(tengo);
  const b = claveIngrediente(ingrediente);
  return Boolean(a) && ` ${b} `.includes(` ${a} `);
}

/**
 * Recetas que llevan alguno de los ingredientes que tengo: [{ receta, usa: [lo que tengo que lleva], faltan: [nombres] }].
 * Primero las que aprovechan más de lo que tengo; a igualdad, las que menos piden comprar.
 * «Al gusto», pizca y chorro no cuentan como faltantes; `siempreHay` (nombres) tampoco.
 */
export function recetasConLoQueTengo(recetas, tengo, { siempreHay = [] } = {}) {
  const lista = tengo.filter((t) => claveIngrediente(t));
  if (!lista.length) return [];
  const resultado = [];
  for (const receta of recetas) {
    const usa = lista.filter((t) => (receta.ingredientes ?? []).some((i) => sirvePara(t, i.nombre)));
    if (!usa.length) continue;
    const vistos = new Set();
    const faltan = [];
    for (const i of receta.ingredientes ?? []) {
      const clave = claveIngrediente(i.nombre);
      if (!clave || vistos.has(clave)) continue;
      vistos.add(clave);
      if (SIN_CANTIDAD.has(i.unidad)) continue;
      if ([...lista, ...siempreHay].some((t) => sirvePara(t, i.nombre))) continue;
      faltan.push(i.nombre);
    }
    resultado.push({ receta, usa, faltan });
  }
  return resultado.sort((x, y) => y.usa.length - x.usa.length || x.faltan.length - y.faltan.length || compararTitulos(x.receta.titulo, y.receta.titulo));
}

/** Añade un ingrediente a lo que tengo si no está ya (tomate/tomates cuentan como el mismo). */
export function conIngrediente(tengo, nombre) {
  const limpio = nombre.trim().replace(/\s+/g, ' ');
  const clave = claveIngrediente(limpio);
  if (!clave || tengo.some((t) => claveIngrediente(t) === clave)) return tengo;
  return [...tengo, limpio];
}
