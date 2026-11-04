// Utilidades de texto.

/** Minúsculas, sin tildes y con cualquier signo convertido en un espacio. */
export function normalizar(texto = '') {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();
}

/** Quita espacios sobrantes al principio, al final y entre palabras. */
export function limpiar(texto = '') {
  return String(texto ?? '').trim().replace(/\s+/g, ' ');
}

export function compararTitulos(a, b) {
  return String(a).localeCompare(String(b), 'es', { sensitivity: 'base', numeric: true });
}
