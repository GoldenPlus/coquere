// Operaciones sobre recetas.json: alta, cambios y borrado, con guardado seguro ante cambios simultáneos.

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

export class RecetaBorradaError extends Error {
  constructor(mensaje = 'Esta receta se ha borrado desde otro dispositivo mientras la editabas.') {
    super(mensaje);
    this.name = 'RecetaBorradaError';
  }
}

export class RecetaCambiadaError extends Error {
  constructor(actual) {
    super('Otra persona ha cambiado esta receta mientras la editabas.');
    this.name = 'RecetaCambiadaError';
    this.actual = actual;
  }
}

/**
 * Guarda los cambios de una receta existente. `base` es la fecha `modificada` de la versión que se
 * empezó a editar: si en GitHub ya hay otra (alguien la cambió entretanto) lanza RecetaCambiadaError,
 * salvo con `forzar`, que guarda encima. Si la receta ya no está, lanza RecetaBorradaError.
 */
export async function editarReceta(cliente, borrador, autor, { base, forzar = false } = {}, ahora = new Date()) {
  const receta = prepararReceta(borrador, ahora);
  const { datos } = await cliente.actualizar(
    FICHERO,
    (actual) => {
      const i = actual.items.findIndex((r) => r.id === receta.id);
      if (i < 0) throw new RecetaBorradaError();
      const enGitHub = actual.items[i];
      if (enGitHub.modificada === receta.modificada) return null; // Un reintento tras una escritura que sí entró.
      if (!forzar && enGitHub.modificada !== base) throw new RecetaCambiadaError(enGitHub);
      // Notas y puntuación no se editan en el formulario: se toman siempre de GitHub, así nunca se pierden.
      const items = [...actual.items];
      items[i] = { ...receta, notas: enGitHub.notas, puntuacion: enGitHub.puntuacion };
      return { ...actual, items };
    },
    `Cambios: ${receta.titulo} (por ${autor})`,
  );
  return { datos, receta: datos.items.find((r) => r.id === receta.id) };
}

/**
 * Cambia solo una parte de una receta sobre la versión más reciente de GitHub. `cambio(receta)` devuelve
 * la receta nueva, o null si no hay nada que hacer. No toca `modificada`: puntuar o anotar no es editar.
 */
async function cambiarReceta(cliente, id, cambio, mensaje) {
  const { datos } = await cliente.actualizar(
    FICHERO,
    (actual) => {
      const i = actual.items.findIndex((r) => r.id === id);
      if (i < 0) throw new RecetaBorradaError('Esta receta se ha borrado desde otro dispositivo.');
      const nueva = cambio(actual.items[i]);
      if (nueva === null) return null;
      const errores = validarReceta(nueva);
      if (errores.length) throw new RecetaInvalidaError(errores);
      const items = [...actual.items];
      items[i] = nueva;
      return { ...actual, items };
    },
    mensaje,
  );
  return { datos, receta: datos.items.find((r) => r.id === id) };
}

/** Puntuación de 1 a 5 (una por receta, compartida por la familia). */
export async function puntuarReceta(cliente, receta, puntuacion, autor) {
  return cambiarReceta(
    cliente,
    receta.id,
    (r) => (r.puntuacion === puntuacion ? null : { ...r, puntuacion }),
    `Puntuación ${puntuacion}/5: ${receta.titulo} (por ${autor})`,
  );
}

/** Añade una nota con fecha y autor. Las notas anteriores no se tocan nunca. */
export async function anadirNota(cliente, receta, texto, autor, ahora = new Date()) {
  const nota = { fecha: ahora.toISOString(), autor, texto: String(texto ?? '').trim() };
  if (!nota.texto) throw new RecetaInvalidaError(['La nota está vacía.']);
  return cambiarReceta(
    cliente,
    receta.id,
    // Si un reintento llega después de que la escritura sí entrara, no se duplica.
    (r) => (r.notas.some((n) => n.fecha === nota.fecha && n.autor === autor) ? null : { ...r, notas: [...r.notas, nota] }),
    `Nota: ${receta.titulo} (por ${autor})`,
  );
}

/** Quita una receta de recetas.json y después su foto, si tiene. Si ya no estaba, no hace nada. */
export async function borrarReceta(cliente, receta, autor) {
  const { datos } = await cliente.actualizar(
    FICHERO,
    (actual) => (actual.items.some((r) => r.id === receta.id) ? { ...actual, items: actual.items.filter((r) => r.id !== receta.id) } : null),
    `Borrada: ${receta.titulo} (por ${autor})`,
  );
  // La foto va después: si esto falla, solo queda un archivo suelto, nunca una receta sin su foto.
  if (receta.foto) {
    try {
      await cliente.borrarArchivo(receta.foto, `Foto borrada: ${receta.titulo} (por ${autor})`);
    } catch {
      // Se puede borrar a mano en el repo; la receta ya no está.
    }
  }
  return { datos };
}

