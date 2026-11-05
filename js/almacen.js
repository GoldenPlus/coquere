// Datos en memoria, con copia en localStorage para abrir sin esperar ni conexión.

const CLAVE = 'coquere.cache';
/** Ficheros del repo de datos que se descargan al conectar. `lista: false`: sin "items" (ajustes compartidos). */
export const FICHEROS = [
  { nombre: 'recetas' },
  { nombre: 'menus' },
  { nombre: 'ajustes', lista: false },
];

export function crearAlmacen(almacenamiento = globalThis.localStorage) {
  let estado = { colecciones: {}, fecha: null };
  try {
    const copia = JSON.parse(almacenamiento?.getItem(CLAVE));
    if (copia?.colecciones) estado = copia;
  } catch {
    // Sin copia local: se empieza vacío.
  }

  function persistir() {
    try {
      almacenamiento?.setItem(CLAVE, JSON.stringify(estado));
    } catch {
      // Si no cabe o no se puede guardar, la app sigue funcionando con conexión.
    }
  }

  return {
    get fecha() {
      return estado.fecha;
    },
    items(clave) {
      return estado.colecciones[clave]?.items ?? [];
    },
    /** Fichero completo (para los que no son listas, como ajustes). */
    datos(clave) {
      return estado.colecciones[clave] ?? null;
    },
    /** Comprueba el acceso y descarga los ficheros; solo sustituye la copia si todo ha ido bien. */
    async recargar(cliente) {
      await cliente.comprobarRepo();
      const leidos = await Promise.all(FICHEROS.map((f) => cliente.leer(`${f.nombre}.json`, { lista: f.lista ?? true })));
      const colecciones = Object.fromEntries(FICHEROS.map((f, i) => [f.nombre, leidos[i].datos]));
      estado = { colecciones, fecha: new Date().toISOString() };
      persistir();
    },
    fijar(clave, datos) {
      estado.colecciones[clave] = datos;
      persistir();
    },
  };
}
