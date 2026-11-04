// Configuración de cada dispositivo, guardada en localStorage: nombre, repo de datos y token propio.

const CLAVE = 'coquere.config';
const VACIA = { nombre: '', repo: '', token: '' };

export function leerConfig(almacenamiento = globalThis.localStorage) {
  try {
    return { ...VACIA, ...JSON.parse(almacenamiento.getItem(CLAVE)) };
  } catch {
    return { ...VACIA };
  }
}

export function guardarConfig(config, almacenamiento = globalThis.localStorage) {
  try {
    almacenamiento.setItem(CLAVE, JSON.stringify(config));
  } catch {
    throw new Error('Este navegador no deja guardar la configuración (¿modo privado?).');
  }
}

/** Olvida la configuración y la copia local: para un dispositivo que se presta o se deja de usar. */
export function borrarConfig(almacenamiento = globalThis.localStorage) {
  for (const clave of [CLAVE, 'coquere.cache']) {
    try {
      almacenamiento.removeItem(clave);
    } catch {
      // Nada que borrar.
    }
  }
}

export function configCompleta(config) {
  return Boolean(config.nombre && config.repo && config.token);
}

/** Acepta «usuario/repo» o la URL del repo; devuelve «usuario/repo» o null. */
export function normalizarRepo(texto) {
  const limpio = String(texto ?? '')
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '');
  return /^[\w.-]+\/[\w.-]+$/.test(limpio) ? limpio : null;
}
