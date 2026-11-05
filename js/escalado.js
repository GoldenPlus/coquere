// Escalar las cantidades de una receta a otras raciones, con redondeos de cocina.

import { UNIDADES } from './receta.js';

/** Unidades que no se escalan: «una pizca» sigue siendo una pizca para 2 o para 8. */
const NO_ESCALAN = new Set(['pizca', 'chorro', 'al gusto']);
/** Unidades de medir con cuchara o recipiente: se redondean a cuartos. */
const A_CUARTOS = new Set(['cda', 'cdta', 'taza', 'vaso']);

// Se quitan antes los restos de coma flotante (p. ej. 0,1 × 3 = 0,30000000000000004) para que los empates suban siempre.
const redondear = (n, paso) => Math.round(Math.round((n / paso) * 1e6) / 1e6) * paso;

/** Gramos o mililitros a una cifra redonda: 7,4 → 7, 47 → 45, 333 → 330, 1125 → 1150. */
function cifraRedonda(n) {
  if (n < 10) return Math.max(1, Math.round(n));
  if (n < 100) return redondear(n, 5);
  if (n < 1000) return redondear(n, 10);
  return redondear(n, 50);
}

/**
 * Cantidad de un ingrediente para otras raciones.
 * Devuelve { cantidad, exacta, redondeada }: `exacta` es el cálculo sin redondear y `redondeada` indica que
 * el redondeo de piezas que no se pueden partir cambia la cantidad un 10 % o más, para avisar.
 */
export function escalarIngrediente(ingrediente, factor) {
  const { cantidad, unidad } = ingrediente;
  if (cantidad === null || factor === 1 || NO_ESCALAN.has(unidad) || UNIDADES[unidad]?.sinCantidad) {
    return { cantidad, exacta: cantidad, redondeada: false };
  }
  const exacta = cantidad * factor;
  const u = UNIDADES[unidad];
  let final;
  if (u && (u.tipo === 'masa' || u.tipo === 'volumen') && !A_CUARTOS.has(unidad)) {
    // g, kg, ml, cl, l: se redondea en gramos o mililitros y se vuelve a la unidad de la receta.
    final = cifraRedonda(exacta * u.factor) / u.factor;
  } else if (A_CUARTOS.has(unidad)) {
    final = Math.max(0.25, redondear(exacta, 0.25));
  } else {
    // Piezas: enteras, o medias si la receta ya usaba medias («½ limón»).
    const paso = Number.isInteger(cantidad) ? 1 : 0.5;
    final = Math.max(paso, redondear(exacta, paso));
  }
  final = Math.round(final * 1000) / 1000; // Sin restos de coma flotante (1.1000000001).
  const piezas = !(u && (u.tipo === 'masa' || u.tipo === 'volumen'));
  // Solo se avisa si el redondeo se nota (un 10 % o más): 1,5 huevos → 2 sí, 3,75 → 4 no.
  return { cantidad: final, exacta, redondeada: piezas && Math.abs(final - exacta) / exacta >= 0.1 };
}

/** Todos los ingredientes de una receta para `raciones`. */
export function escalarReceta(receta, raciones) {
  const factor = raciones / receta.raciones;
  return receta.ingredientes.map((i) => ({ ...i, ...escalarIngrediente(i, factor) }));
}
