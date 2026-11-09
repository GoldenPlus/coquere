// Modelo de datos de una receta (recetas.json). El esquema está documentado en Esquema_de_datos.md.

import { limpiar, normalizar } from './texto.js';

/**
 * Unidades permitidas. `tipo` dice con qué se puede sumar o convertir (masa con masa, volumen con
 * volumen) y `factor` cuántas unidades base (g o ml) son. Las de tipo propio solo se suman entre sí.
 * `sinCantidad`: la unidad no lleva número («al gusto»).
 */
export const UNIDADES = {
  g: { nombre: 'g', tipo: 'masa', factor: 1 },
  kg: { nombre: 'kg', tipo: 'masa', factor: 1000 },
  ml: { nombre: 'ml', tipo: 'volumen', factor: 1 },
  cl: { nombre: 'cl', tipo: 'volumen', factor: 10 },
  l: { nombre: 'l', tipo: 'volumen', factor: 1000 },
  cdta: { nombre: 'cucharadita', tipo: 'volumen', factor: 5 },
  cda: { nombre: 'cucharada', tipo: 'volumen', factor: 15 },
  taza: { nombre: 'taza', tipo: 'volumen', factor: 240 },
  vaso: { nombre: 'vaso', tipo: 'volumen', factor: 200 },
  unidad: { nombre: 'unidad', tipo: 'unidad', factor: 1 },
  diente: { nombre: 'diente', tipo: 'diente', factor: 1 },
  rodaja: { nombre: 'rodaja', tipo: 'rodaja', factor: 1 },
  loncha: { nombre: 'loncha', tipo: 'loncha', factor: 1 },
  lata: { nombre: 'lata', tipo: 'lata', factor: 1 },
  sobre: { nombre: 'sobre', tipo: 'sobre', factor: 1 },
  manojo: { nombre: 'manojo', tipo: 'manojo', factor: 1 },
  ramita: { nombre: 'ramita', tipo: 'ramita', factor: 1 },
  pizca: { nombre: 'pizca', tipo: 'pizca', factor: 1 },
  chorro: { nombre: 'chorro', tipo: 'chorro', factor: 1 },
  'al gusto': { nombre: 'al gusto', tipo: 'al gusto', factor: 1, sinCantidad: true },
};

/**
 * Proteínas que puede llevar una receta, en el orden en que se muestran. Sirven para equilibrar el menú
 * semanal. «vegetal»: sin carne, pescado, huevo ni legumbre; no se combina con las demás.
 */
export const PROTEINAS = {
  'carne blanca': { nombre: 'Carne blanca', icono: '🍗' },
  'carne roja': { nombre: 'Carne roja', icono: '🥩' },
  'pescado blanco': { nombre: 'Pescado blanco', icono: '🐟' },
  'pescado azul': { nombre: 'Pescado azul', icono: '🐟' },
  marisco: { nombre: 'Marisco', icono: '🦐' },
  huevo: { nombre: 'Huevo', icono: '🥚' },
  legumbre: { nombre: 'Legumbre', icono: '🫘' },
  vegetal: { nombre: 'Vegetal', icono: '🥦' },
};

/** Lista de proteínas válidas, sin repetir y en el orden de PROTEINAS. «vegetal» solo si no hay otra. */
export function normalizarProteinas(valor) {
  const elegidas = new Set((Array.isArray(valor) ? valor : []).map((p) => limpiar(p).toLowerCase()));
  const lista = Object.keys(PROTEINAS).filter((p) => elegidas.has(p));
  return lista.length > 1 ? lista.filter((p) => p !== 'vegetal') : lista;
}

export const PUNTUACION = { min: 1, max: 5 };
export const DIFICULTAD = { min: 1, max: 5 };

/** Id corto y único: no hace falta que sea legible, solo estable. */
export function nuevoId() {
  return 'r' + globalThis.crypto.randomUUID().replaceAll('-', '').slice(0, 12);
}

export function nuevaReceta(ahora = new Date()) {
  const fecha = ahora.toISOString();
  return {
    id: nuevoId(),
    titulo: '',
    categorias: [],
    etiquetas: [],
    proteinas: [],
    raciones: 4,
    tiempo: null,
    dificultad: null,
    ingredientes: [],
    pasos: [],
    notas: [],
    puntuacion: null,
    foto: null,
    creada: fecha,
    modificada: fecha,
  };
}

/** Número o null. Acepta coma decimal y fracciones simples («1,5», «1/2», «1 1/2»). */
export function leerCantidad(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : NaN;
  const texto = limpiar(valor).replace(',', '.');
  if (!texto) return null;
  const mixta = texto.match(/^(\d+) (\d+)\/(\d+)$/);
  if (mixta) return Number(mixta[1]) + Number(mixta[2]) / Number(mixta[3]);
  const fraccion = texto.match(/^(\d+)\/(\d+)$/);
  if (fraccion) return Number(fraccion[1]) / Number(fraccion[2]);
  return /^\d+(\.\d+)?$/.test(texto) ? Number(texto) : NaN;
}

function entero(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : NaN;
}

/** Lista de textos limpios, sin vacíos ni repetidos (sin distinguir tildes ni mayúsculas). */
function listaDeTextos(valor) {
  const vistos = new Set();
  const salida = [];
  for (const t of Array.isArray(valor) ? valor : []) {
    const limpio = limpiar(t);
    const clave = normalizar(limpio);
    if (!clave || vistos.has(clave)) continue;
    vistos.add(clave);
    salida.push(limpio);
  }
  return salida;
}

function normalizarIngrediente(i = {}) {
  const unidad = limpiar(i.unidad).toLowerCase() || 'unidad';
  const sinCantidad = UNIDADES[unidad]?.sinCantidad;
  return {
    cantidad: sinCantidad ? null : leerCantidad(i.cantidad),
    unidad,
    nombre: limpiar(i.nombre),
    detalle: limpiar(i.detalle),
  };
}

const ingredienteVacio = (i) => !i.nombre && !i.detalle && i.cantidad === null;

/**
 * Deja una receta en la forma guardada: textos sin espacios sobrantes, listas sin huecos, números
 * convertidos. No inventa datos que falten: eso lo señala `validarReceta`.
 */
export function normalizarReceta(r = {}) {
  return {
    id: limpiar(r.id),
    titulo: limpiar(r.titulo),
    categorias: listaDeTextos(r.categorias),
    etiquetas: listaDeTextos(r.etiquetas),
    proteinas: normalizarProteinas(r.proteinas),
    raciones: entero(r.raciones),
    tiempo: entero(r.tiempo),
    dificultad: entero(r.dificultad),
    ingredientes: (Array.isArray(r.ingredientes) ? r.ingredientes : []).map(normalizarIngrediente).filter((i) => !ingredienteVacio(i)),
    pasos: (Array.isArray(r.pasos) ? r.pasos : []).map((p) => String(p ?? '').trim()).filter(Boolean),
    notas: (Array.isArray(r.notas) ? r.notas : [])
      .map((n) => ({ fecha: limpiar(n?.fecha), autor: limpiar(n?.autor), texto: String(n?.texto ?? '').trim() }))
      .filter((n) => n.texto),
    puntuacion: entero(r.puntuacion),
    foto: limpiar(r.foto) || null,
    creada: limpiar(r.creada),
    modificada: limpiar(r.modificada),
  };
}

const esFecha = (t) => typeof t === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(t) && !Number.isNaN(Date.parse(t));
const enRango = (n, { min, max }) => Number.isInteger(n) && n >= min && n <= max;

/** Devuelve la lista de problemas, en frases para mostrar al usuario. Vacía si la receta es válida. */
export function validarReceta(r) {
  const errores = [];
  if (!r || typeof r !== 'object') return ['La receta está vacía.'];
  if (!r.id) errores.push('Falta el identificador de la receta.');
  if (!r.titulo) errores.push('Falta el título.');
  if (!Number.isInteger(r.raciones) || r.raciones < 1) errores.push('Las raciones deben ser un número entero mayor que cero.');
  if (r.tiempo !== null && !(Number.isInteger(r.tiempo) && r.tiempo >= 0)) errores.push('El tiempo debe ser un número entero de minutos.');
  if (r.dificultad !== null && !enRango(r.dificultad, DIFICULTAD)) errores.push('La dificultad va de 1 a 5.');
  if (r.puntuacion !== null && !enRango(r.puntuacion, PUNTUACION)) errores.push('La puntuación va de 1 a 5.');
  for (const campo of ['categorias', 'etiquetas', 'ingredientes', 'pasos', 'notas']) {
    if (!Array.isArray(r[campo])) errores.push(`Falta la lista «${campo}».`);
  }
  // Opcional: las recetas guardadas antes de existir el campo no lo tienen.
  if (r.proteinas !== undefined) {
    if (!Array.isArray(r.proteinas)) errores.push('Las proteínas deben ser una lista.');
    else for (const p of r.proteinas) if (!(p in PROTEINAS)) errores.push(`La proteína «${p}» no está en la lista.`);
  }
  (r.ingredientes ?? []).forEach((i, n) => {
    const cual = `Ingrediente ${n + 1}${i.nombre ? ` (${i.nombre})` : ''}`;
    const unidad = UNIDADES[i.unidad];
    if (!i.nombre) errores.push(`${cual}: falta el nombre.`);
    if (!unidad) errores.push(`${cual}: la unidad «${i.unidad}» no está en la lista.`);
    else if (unidad.sinCantidad && i.cantidad !== null) errores.push(`${cual}: «${i.unidad}» no lleva cantidad.`);
    if (i.cantidad !== null && !(typeof i.cantidad === 'number' && Number.isFinite(i.cantidad) && i.cantidad > 0)) {
      errores.push(`${cual}: la cantidad debe ser un número mayor que cero (vale 1,5 o 1/2).`);
    }
  });
  (r.notas ?? []).forEach((nota, n) => {
    if (!esFecha(nota.fecha)) errores.push(`Nota ${n + 1}: falta la fecha.`);
    if (!nota.autor) errores.push(`Nota ${n + 1}: falta el autor.`);
  });
  if (r.foto !== null && !/^fotos\/[\w.-]+\.(jpe?g|png|webp)$/i.test(r.foto)) errores.push('La foto debe estar en la carpeta fotos/ del repo de datos.');
  if (!esFecha(r.creada) || !esFecha(r.modificada)) errores.push('Faltan las fechas de creación o modificación.');
  return errores;
}

/** Problemas de recetas.json completo: cada receta y que no se repitan ids. */
export function validarRecetas(datos) {
  const errores = [];
  const ids = new Set();
  for (const r of datos?.items ?? []) {
    const nombre = r?.titulo || r?.id || '(sin título)';
    for (const e of validarReceta(r)) errores.push(`${nombre}: ${e}`);
    if (r?.id && ids.has(r.id)) errores.push(`${nombre}: el identificador ${r.id} está repetido.`);
    ids.add(r?.id);
  }
  return errores;
}
