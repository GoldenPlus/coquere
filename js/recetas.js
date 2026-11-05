// Operaciones sobre recetas.json: alta, cambios y borrado, con guardado seguro ante cambios simultáneos.

import { normalizarReceta, validarReceta } from './receta.js';
import { limpiar } from './texto.js';
import { borrarFoto } from './fotos.js';

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
 * La foto solo se toma del borrador con `fotoCambiada`; si no, se deja la que haya en GitHub.
 * Devuelve también `fotoAnterior`: la foto que había y que ya no se usa (para borrarla), o null.
 */
export async function editarReceta(cliente, borrador, autor, { base, forzar = false, fotoCambiada = false } = {}, ahora = new Date()) {
  const receta = prepararReceta(borrador, ahora);
  let fotoAnterior = null;
  const { datos } = await cliente.actualizar(
    FICHERO,
    (actual) => {
      const i = actual.items.findIndex((r) => r.id === receta.id);
      if (i < 0) throw new RecetaBorradaError();
      const enGitHub = actual.items[i];
      // Notas y puntuación no se editan en el formulario: se toman siempre de GitHub, así nunca se pierden.
      const foto = fotoCambiada ? receta.foto : enGitHub.foto;
      const nueva = { ...receta, notas: enGitHub.notas, puntuacion: enGitHub.puntuacion, foto };
      // Un reintento tras una escritura que sí entró: ya está tal cual.
      if (JSON.stringify(enGitHub) === JSON.stringify(nueva)) return null;
      if (!forzar && enGitHub.modificada !== base) throw new RecetaCambiadaError(enGitHub);
      fotoAnterior = enGitHub.foto && enGitHub.foto !== foto ? enGitHub.foto : null;
      const items = [...actual.items];
      items[i] = nueva;
      return { ...actual, items };
    },
    `Cambios: ${receta.titulo} (por ${autor})`,
  );
  return { datos, receta: datos.items.find((r) => r.id === receta.id), fotoAnterior };
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

/** Quita una receta de recetas.json y después su foto y miniatura, si tiene. Si ya no estaba, no hace nada. */
export async function borrarReceta(cliente, receta, autor) {
  let foto = null; // La de GitHub, por si otro dispositivo la cambió.
  const { datos } = await cliente.actualizar(
    FICHERO,
    (actual) => {
      const enGitHub = actual.items.find((r) => r.id === receta.id);
      if (!enGitHub) return null;
      foto = enGitHub.foto;
      return { ...actual, items: actual.items.filter((r) => r.id !== receta.id) };
    },
    `Borrada: ${receta.titulo} (por ${autor})`,
  );
  // La foto va después: si esto falla, solo queda un archivo suelto, nunca una receta sin su foto.
  await borrarFoto(cliente, foto, receta.titulo, autor);
  return { datos };
}

