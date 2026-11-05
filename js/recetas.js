// Operaciones sobre recetas.json: alta de recetas con guardado seguro ante cambios simultáneos.

import { normalizarReceta, validarReceta } from './receta.js';
import { limpiar } from './texto.js';

export const FICHERO = 'recetas.json';

export class RecetaInvalidaError extends Error {
  constructor(errores) {
    super(errores.join('\n'));
    this.name = 'RecetaInvalidaError';
    this.errores = errores;
  }
}

/** «Postres, rápida ,, Fácil» → ['Postres', 'rápida', 'Fácil'] (los repetidos los quita normalizarReceta). */
export function textoALista(texto) {
  return String(texto ?? '').split(',').map(limpiar).filter(Boolean);
}

/** Normaliza y valida; lanza RecetaInvalidaError con todos los problemas a la vez. */
export function prepararReceta(borrador, ahora = new Date()) {
  const receta = normalizarReceta({ ...borrador, modificada: ahora.toISOString() });
  const errores = validarReceta(receta);
  if (errores.length) throw new RecetaInvalidaError(errores);
  return receta;
}

/**
 * Añade una receta a recetas.json. Si otro dispositivo guarda a la vez, `actualizar` relee el fichero
 * y vuelve a añadirla sobre la versión nueva, así no se pierde ninguna de las dos.
 * Devuelve { datos, receta } con el fichero tal como queda en GitHub.
 */
export async function crearReceta(cliente, borrador, autor, ahora = new Date()) {
  const receta = prepararReceta(borrador, ahora);
  const { datos } = await cliente.actualizar(
    FICHERO,
    (actual) => {
      // Si un reintento llega después de que la escritura sí entrara, no se duplica.
      if (actual.items.some((r) => r.id === receta.id)) return null;
      return { ...actual, items: [...actual.items, receta] };
    },
    `Alta: ${receta.titulo} (por ${autor})`,
  );
  return { datos, receta };
}
