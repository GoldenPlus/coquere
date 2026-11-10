// Lista de la compra (lista.json): ingredientes del menú de unas fechas, escalados y sumados, más lo añadido a mano.
//
// lista.json: { version: 1, desde: '2026-11-09', hasta: '2026-11-15', generada: ISO, items: [
//   { id: 'r:patata', nombre: 'patata', cantidades: [{ cantidad: 1.5, unidad: 'kg' }], sinCantidad: false, recetas: ['Tortilla'], manual: false },
//   { id: 'm:…', nombre: 'pilas', cantidades: [], sinCantidad: true, recetas: [], manual: true } ] }

import { UNIDADES } from './receta.js';
import { HUECOS, esEspecial, sumarDias, inicioSemana, leerFecha, fechaISO } from './menus.js';
import { escalarReceta } from './escalado.js';
import { claveIngrediente, indiceIngredientes } from './ingredientes.js';
import { textoIngrediente } from './ficha.js';
import { limpiar } from './texto.js';

export const FICHERO_LISTA = 'lista.json';
/** Sin cantidad en la lista: se compran «a ojo». */
const SIN_CANTIDAD = new Set(['al gusto', 'pizca', 'chorro']);
/** Se muestran con decimales, no con fracciones. */
const METRICAS = new Set(['g', 'kg', 'ml', 'cl', 'l']);

/** Entradas del menú con receta entre dos fechas (los huecos especiales no cuentan). */
export const entradasEntre = (menus, desde, hasta) =>
  menus.filter((e) => !esEspecial(e) && e.receta && e.fecha >= desde && e.fecha <= hasta)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || HUECOS.indexOf(a.hueco) - HUECOS.indexOf(b.hueco));

/** Periodos para generar la lista, siempre desde hoy. */
export const PERIODOS = { semana: 'Semana actual', '2semanas': '2 semanas', mes: 'Mes completo' };

/** Fechas que cubre un periodo desde `hoy`: hasta el domingo, el domingo siguiente o el último día del mes. */
export function rangoPeriodo(hoy, periodo) {
  if (periodo === 'mes') {
    const d = leerFecha(hoy);
    return { desde: hoy, hasta: fechaISO(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12)) };
  }
  const domingo = sumarDias(inicioSemana(hoy), 6);
  return { desde: hoy, hasta: periodo === '2semanas' ? sumarDias(domingo, 7) : domingo };
}

const redondo = (n) => Math.round(n * 100) / 100;

/**
 * Suma cantidades de un mismo ingrediente. Si todas usan la misma unidad, se queda en ella (3 cda);
 * si no, masa y volumen se convierten (200 g + 1 kg → 1,2 kg; 2 cda + 100 ml → 130 ml) y las
 * unidades de recuento solo se suman consigo mismas. Devuelve [{ cantidad, unidad }] en orden estable.
 */
export function sumarCantidades(cantidades) {
  const porTipo = new Map();
  for (const c of cantidades) {
    const tipo = UNIDADES[c.unidad]?.tipo ?? c.unidad;
    if (!porTipo.has(tipo)) porTipo.set(tipo, []);
    porTipo.get(tipo).push(c);
  }
  const salida = [];
  for (const [tipo, lista] of porTipo) {
    const unidades = new Set(lista.map((c) => c.unidad));
    const unidad = lista[0].unidad;
    if (unidades.size === 1 && !(unidad === 'g' || unidad === 'ml')) {
      salida.push({ cantidad: redondo(lista.reduce((s, c) => s + c.cantidad, 0)), unidad });
      continue;
    }
    // Varias unidades del mismo tipo, o g/ml: a la base (g o ml) y, desde 1000, a kg o l.
    const base = lista.reduce((s, c) => s + c.cantidad * UNIDADES[c.unidad].factor, 0);
    const [pequena, grande] = tipo === 'masa' ? ['g', 'kg'] : ['ml', 'l'];
    salida.push(base >= 1000 ? { cantidad: redondo(base / 1000), unidad: grande } : { cantidad: Math.round(base), unidad: pequena });
  }
  return salida;
}

/**
 * Líneas de la lista para las entradas del menú de unas fechas. Ingredientes juntados por
 * `claveIngrediente` (tomate/tomates) con el nombre más usado en las recetas, por orden alfabético.
 */
export function lineasDeMenu({ recetas, menus, desde, hasta }) {
  const porId = new Map(recetas.map((r) => [r.id, r]));
  const nombres = new Map(indiceIngredientes(recetas).map((e) => [e.clave, e.nombre]));
  const lineas = new Map();
  for (const entrada of entradasEntre(menus, desde, hasta)) {
    const receta = porId.get(entrada.receta);
    if (!receta) continue;
    for (const i of escalarReceta(receta, entrada.raciones)) {
      const clave = claveIngrediente(i.nombre);
      if (!clave) continue;
      const linea = lineas.get(clave) ?? { id: `r:${clave}`, nombre: nombres.get(clave) ?? i.nombre, cantidades: [], sinCantidad: false, recetas: [], manual: false };
      if (i.cantidad === null || SIN_CANTIDAD.has(i.unidad) || UNIDADES[i.unidad]?.sinCantidad) linea.sinCantidad = true;
      else linea.cantidades.push({ cantidad: i.cantidad, unidad: i.unidad });
      if (!linea.recetas.includes(receta.titulo)) linea.recetas.push(receta.titulo);
      lineas.set(clave, linea);
    }
  }
  return [...lineas.values()]
    .map((l) => ({ ...l, cantidades: sumarCantidades(l.cantidades), sinCantidad: l.sinCantidad && !l.cantidades.length }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
}

/** «1,5 kg», «3 dientes», «400 g + 2 latas», «6» (piezas) o '' (sin cantidad). */
export function textoCantidades(linea) {
  return linea.cantidades
    .map((c) => (METRICAS.has(c.unidad)
      ? `${c.cantidad.toLocaleString('es-ES', { maximumFractionDigits: 2 })} ${c.unidad}` // 2,13 kg mejor que 2 ⅛ kg
      : textoIngrediente({ cantidad: c.cantidad, unidad: c.unidad, nombre: '', detalle: '' }).cantidad.replace(/ de$/, '')))
    .join(' + ');
}

// ---------- Cambios (puros)

/** Lista nueva para unas fechas; conserva lo añadido a mano. */
export function conListaGenerada(datos, { recetas, menus, desde, hasta }, ahora = new Date()) {
  const manuales = (datos?.items ?? []).filter((l) => l.manual);
  return { version: 1, desde, hasta, generada: ahora.toISOString(), items: [...lineasDeMenu({ recetas, menus, desde, hasta }), ...manuales] };
}

const nuevoIdManual = () => `m:${globalThis.crypto.randomUUID().slice(0, 8)}`;

/** Añade algo a mano. Si ya está en la lista (mismo ingrediente), no lo repite y devuelve null. */
export function conManual(datos, texto, id = nuevoIdManual()) {
  const nombre = limpiar(texto);
  if (!nombre) throw new Error('Escribe qué quieres añadir.');
  if (nombre.length > 80) throw new Error('Como mucho 80 caracteres.');
  if (datos.items.some((l) => claveIngrediente(l.nombre) === claveIngrediente(nombre))) return null;
  return { ...datos, items: [...datos.items, { id, nombre, cantidades: [], sinCantidad: true, recetas: [], manual: true }] };
}

export function sinLinea(datos, id) {
  if (!datos.items.some((l) => l.id === id)) return null;
  return { ...datos, items: datos.items.filter((l) => l.id !== id) };
}

// ---------- Guardar en GitHub

export async function generarLista(cliente, opciones, autor) {
  const { datos } = await cliente.actualizar(FICHERO_LISTA, (d) => conListaGenerada(d, opciones), `Compra: lista del ${opciones.desde} al ${opciones.hasta} (por ${autor})`);
  return datos;
}

export async function anadirALista(cliente, texto, autor) {
  const id = nuevoIdManual(); // El mismo en los reintentos.
  const { datos } = await cliente.actualizar(FICHERO_LISTA, (d) => conManual(d, texto, id), `Compra: añade ${limpiar(texto)} (por ${autor})`);
  return datos;
}

export async function quitarDeLista(cliente, linea, autor) {
  const { datos } = await cliente.actualizar(FICHERO_LISTA, (d) => sinLinea(d, linea.id), `Compra: quita ${linea.nombre} (por ${autor})`);
  return datos;
}
