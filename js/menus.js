// Menús planificados (menus.json) y ajustes compartidos de la familia (ajustes.json).
//
// menus.json: { version: 1, items: [{ fecha: '2026-11-09', hueco: 'comida' | 'cena', receta: '<id>', raciones: 4, origen: 'manual' | 'auto' }] }
// Como mucho una entrada por fecha y hueco. `origen`: 'manual' si la eligió alguien a mano (PL-02 no la cambia).

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

export const entradaDe = (menus, fecha, hueco) => menus.find((e) => e.fecha === fecha && e.hueco === hueco) ?? null;

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

/** Pone (o sustituye) la entrada de un hueco. */
export function conEntrada(datos, entrada) {
  const errores = validarEntrada(entrada);
  if (errores.length) throw new Error(errores.join(' '));
  const actual = entradaDe(datos.items, entrada.fecha, entrada.hueco);
  if (actual && JSON.stringify(actual) === JSON.stringify(entrada)) return null;
  const items = datos.items.filter((e) => !(e.fecha === entrada.fecha && e.hueco === entrada.hueco));
  items.push(entrada);
  items.sort((a, b) => a.fecha.localeCompare(b.fecha) || HUECOS.indexOf(a.hueco) - HUECOS.indexOf(b.hueco));
  return { ...datos, items };
}

export function sinEntrada(datos, fecha, hueco) {
  if (!entradaDe(datos.items, fecha, hueco)) return null;
  return { ...datos, items: datos.items.filter((e) => !(e.fecha === fecha && e.hueco === hueco)) };
}

/** Cambia las raciones de un hueco, si sigue teniendo la misma receta (otro dispositivo pudo cambiarla). */
export function conRaciones(datos, fecha, hueco, receta, raciones) {
  const actual = entradaDe(datos.items, fecha, hueco);
  if (!actual || actual.receta !== receta) return null;
  return conEntrada(datos, { ...actual, raciones });
}

export function sinReceta(datos, idReceta) {
  if (!datos.items.some((e) => e.receta === idReceta)) return null;
  return { ...datos, items: datos.items.filter((e) => e.receta !== idReceta) };
}

// ---------- Guardar en GitHub

const nombreHueco = (fecha, hueco) => `${hueco} del ${fecha}`;

export async function ponerReceta(cliente, { fecha, hueco, receta, raciones }, autor) {
  const entrada = { fecha, hueco, receta: receta.id, raciones, origen: 'manual' };
  const { datos } = await cliente.actualizar(FICHERO_MENUS, (d) => conEntrada(d, entrada), `Menú: ${receta.titulo} para la ${nombreHueco(fecha, hueco)} (por ${autor})`);
  return datos;
}

export async function quitarDeMenu(cliente, fecha, hueco, autor) {
  const { datos } = await cliente.actualizar(FICHERO_MENUS, (d) => sinEntrada(d, fecha, hueco), `Menú: vacía la ${nombreHueco(fecha, hueco)} (por ${autor})`);
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
