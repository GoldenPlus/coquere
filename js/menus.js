// Menús planificados (menus.json) y ajustes compartidos de la familia (ajustes.json).
//
// menus.json: { version: 1, items: [{ fecha: '2026-11-09', hueco: 'comida' | 'cena', receta: '<id>', raciones: 4, origen: 'manual' | 'auto' }] }
// Un hueco (fecha + comida/cena) puede tener varias entradas, una por receta (sin repetir receta en el mismo hueco).
// El orden de las entradas de un hueco en el fichero es el orden en que se muestran.
// `origen`: 'manual' si la eligió alguien a mano (PL-02 no la cambia).

export const FICHERO_MENUS = 'menus.json';
export const FICHERO_AJUSTES = 'ajustes.json';
export const HUECOS = ['comida', 'cena'];
export const RACIONES_POR_DEFECTO = 4;
export const RACIONES_MAX = 50;

// ---------- Fechas (siempre en hora local: «hoy» es el día del dispositivo)

/** Date → '2026-11-09'. */
export function fechaISO(d) {
  const dos = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** '2026-11-09' → Date a mediodía local (a mediodía, los cambios de hora no mueven el día). */
export function leerFecha(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d, 12);
}

export function sumarDias(iso, n) {
  const d = leerFecha(iso);
  d.setDate(d.getDate() + n);
  return fechaISO(d);
}

/** Lunes de la semana de esa fecha. */
export function inicioSemana(iso) {
  const dia = (leerFecha(iso).getDay() + 6) % 7; // Lunes = 0
  return sumarDias(iso, -dia);
}

export const diasDeSemana = (lunes) => Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));

export const esFechaISO = (t) => typeof t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t) && fechaISO(leerFecha(t)) === t;

// ---------- Consultas

const delHueco = (fecha, hueco) => (e) => e.fecha === fecha && e.hueco === hueco;

/** Entradas de un hueco, en su orden. */
export const entradasDe = (menus, fecha, hueco) => menus.filter(delHueco(fecha, hueco));

const mismaEntrada = (fecha, hueco, receta) => (e) => e.fecha === fecha && e.hueco === hueco && e.receta === receta;
const ordenar = (items) => items.sort((a, b) => a.fecha.localeCompare(b.fecha) || HUECOS.indexOf(a.hueco) - HUECOS.indexOf(b.hueco)); // estable: respeta el orden dentro del hueco

/** Huecos en los que aparece una receta, por fecha. */
export const usosDeReceta = (menus, idReceta) =>
  menus.filter((e) => e.receta === idReceta).sort((a, b) => a.fecha.localeCompare(b.fecha) || HUECOS.indexOf(a.hueco) - HUECOS.indexOf(b.hueco));

export function racionesFamilia(ajustes) {
  const n = ajustes?.racionesFamilia;
  return Number.isInteger(n) && n >= 1 && n <= RACIONES_MAX ? n : RACIONES_POR_DEFECTO;
}

export function validarEntrada(e) {
  const errores = [];
  if (!esFechaISO(e.fecha)) errores.push('La fecha del menú no es válida.');
  if (!HUECOS.includes(e.hueco)) errores.push('El hueco debe ser comida o cena.');
  if (!e.receta) errores.push('Falta la receta.');
  if (!Number.isInteger(e.raciones) || e.raciones < 1 || e.raciones > RACIONES_MAX) errores.push(`Las raciones van de 1 a ${RACIONES_MAX}.`);
  if (!['manual', 'auto'].includes(e.origen)) errores.push('Falta el origen de la entrada.');
  return errores;
}

// ---------- Cambios (puros: devuelven el fichero nuevo, o null si no cambia nada)

/**
 * Pone una receta en un hueco. Si ya estaba, actualiza su entrada en el mismo sitio; si no, va al final del hueco.
 * Con `sustituye` (id de receta), ocupa el lugar de esa otra receta del hueco (o va al final si ya no está).
 */
export function conEntrada(datos, entrada, { sustituye = null } = {}) {
  const errores = validarEntrada(entrada);
  if (errores.length) throw new Error(errores.join(' '));
  const { fecha, hueco, receta } = entrada;
  const items = [...datos.items];
  const i = items.findIndex(mismaEntrada(fecha, hueco, receta));
  const j = sustituye && sustituye !== receta ? items.findIndex(mismaEntrada(fecha, hueco, sustituye)) : -1;
  if (j >= 0) {
    if (i >= 0) throw new Error('Esa receta ya está en este hueco.');
    items[j] = entrada;
  } else if (i >= 0) {
    if (JSON.stringify(items[i]) === JSON.stringify(entrada)) return null;
    items[i] = entrada;
  } else {
    items.push(entrada);
  }
  return { ...datos, items: ordenar(items) };
}

export function sinEntrada(datos, fecha, hueco, receta) {
  if (!datos.items.some(mismaEntrada(fecha, hueco, receta))) return null;
  return { ...datos, items: datos.items.filter((e) => !mismaEntrada(fecha, hueco, receta)(e)) };
}

/** Cambia las raciones de una receta de un hueco, si sigue ahí (otro dispositivo pudo quitarla). */
export function conRaciones(datos, fecha, hueco, receta, raciones) {
  const actual = datos.items.find(mismaEntrada(fecha, hueco, receta));
  if (!actual) return null;
  return conEntrada(datos, { ...actual, raciones });
}

/** Sube (−1) o baja (+1) una receta dentro de su hueco. */
export function conOrden(datos, fecha, hueco, receta, delta) {
  const items = [...datos.items];
  const posiciones = items.map((e, i) => (delHueco(fecha, hueco)(e) ? i : -1)).filter((i) => i >= 0);
  const k = posiciones.findIndex((i) => items[i].receta === receta);
  const otro = posiciones[k + delta];
  if (k < 0 || otro === undefined) return null;
  [items[posiciones[k]], items[otro]] = [items[otro], items[posiciones[k]]];
  return { ...datos, items };
}

export function sinReceta(datos, idReceta) {
  if (!datos.items.some((e) => e.receta === idReceta)) return null;
  return { ...datos, items: datos.items.filter((e) => e.receta !== idReceta) };
}

// ---------- Guardar en GitHub

const nombreHueco = (fecha, hueco) => `${hueco} del ${fecha}`;

/** Añade una receta a un hueco, o la pone en lugar de `sustituye` (id de otra receta del hueco). */
export async function ponerReceta(cliente, { fecha, hueco, receta, raciones, sustituye = null }, autor) {
  const entrada = { fecha, hueco, receta: receta.id, raciones, origen: 'manual' };
  const accion = sustituye ? `${receta.titulo} en lugar de otra receta en la` : `${receta.titulo} para la`;
  const { datos } = await cliente.actualizar(FICHERO_MENUS, (d) => conEntrada(d, entrada, { sustituye }), `Menú: ${accion} ${nombreHueco(fecha, hueco)} (por ${autor})`);
  return datos;
}

export async function quitarDeMenu(cliente, { fecha, hueco, receta }, autor) {
  const { datos } = await cliente.actualizar(FICHERO_MENUS, (d) => sinEntrada(d, fecha, hueco, receta.id), `Menú: quita ${receta.titulo} de la ${nombreHueco(fecha, hueco)} (por ${autor})`);
  return datos;
}

export async function moverEnMenu(cliente, { fecha, hueco, receta }, delta, autor) {
  const { datos } = await cliente.actualizar(FICHERO_MENUS, (d) => conOrden(d, fecha, hueco, receta.id, delta), `Menú: reordena la ${nombreHueco(fecha, hueco)} (por ${autor})`);
  return datos;
}

export async function cambiarRaciones(cliente, { fecha, hueco, receta, raciones }, autor) {
  const { datos } = await cliente.actualizar(
    FICHERO_MENUS,
    (d) => conRaciones(d, fecha, hueco, receta, raciones),
    `Menú: ${raciones} raciones para la ${nombreHueco(fecha, hueco)} (por ${autor})`,
  );
  return datos;
}

/** Quita una receta de todos los menús (al borrarla). */
export async function quitarRecetaDeMenus(cliente, receta, autor) {
  const { datos } = await cliente.actualizar(FICHERO_MENUS, (d) => sinReceta(d, receta.id), `Menú: quita ${receta.titulo}, borrada (por ${autor})`);
  return datos;
}

export async function guardarRacionesFamilia(cliente, raciones, autor) {
  if (!Number.isInteger(raciones) || raciones < 1 || raciones > RACIONES_MAX) throw new Error(`Las raciones de la familia van de 1 a ${RACIONES_MAX}.`);
  const { datos } = await cliente.actualizar(
    FICHERO_AJUSTES,
    (d) => (d.racionesFamilia === raciones ? null : { ...d, version: d.version ?? 1, racionesFamilia: raciones }),
    `Ajustes: ${raciones} raciones para la familia (por ${autor})`,
    { lista: false },
  );
  return datos;
}
