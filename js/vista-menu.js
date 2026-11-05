// Vista del menú: una semana de lunes a domingo, con comida y cena cada día.

import { HUECOS, RACIONES_MAX, fechaISO, sumarDias, inicioSemana, diasDeSemana, leerFecha, entradaDe, racionesFamilia, ponerReceta, quitarDeMenu, cambiarRaciones } from './menus.js';
import { filtrarRecetas, filtrosVacios } from './filtros.js';
import { compararTitulos } from './texto.js';
import { $, el, aviso, ocupado } from './dom.js';

let app = null;
let alCambiar = () => {};
let lunesActual = null;
/** Hueco que se está eligiendo: { fecha, hueco }. */
let eligiendo = null;
/** Raciones tocadas con −/+ que aún no se han guardado, por «fecha|hueco» (se guardan al dejar de tocar). */
const racionesPendientes = new Map();
const temporizadores = new Map();

const NOMBRE_HUECO = { comida: 'Comida', cena: 'Cena' };

export const hoyISO = () => fechaISO(new Date());

/** «lunes, 9 nov» */
const nombreDia = (iso) => leerFecha(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
const conMayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/** «9 – 15 nov. 2026» o «28 dic. – 3 ene. 2027». */
function nombreSemana(lunes) {
  const a = leerFecha(lunes);
  const b = leerFecha(sumarDias(lunes, 6));
  const mismoMes = a.getMonth() === b.getMonth();
  const ini = a.toLocaleDateString('es-ES', mismoMes ? { day: 'numeric' } : { day: 'numeric', month: 'short' });
  return `${ini} – ${b.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

async function guardar(boton, accion, textoOk) {
  const listo = boton ? ocupado(boton) : () => {};
  try {
    const datos = await accion();
    app.almacen.fijar('menus', datos);
    alCambiar();
    if (textoOk) aviso(textoOk);
  } catch (e) {
    aviso(`No se ha guardado. ${e.message}`);
    alCambiar();
  } finally {
    listo();
  }
}

// ---------- Raciones con −/+

function tocarRaciones(entrada, delta) {
  const clave = `${entrada.fecha}|${entrada.hueco}`;
  const ahora = racionesPendientes.get(clave) ?? entrada.raciones;
  const nuevas = Math.min(RACIONES_MAX, Math.max(1, ahora + delta));
  racionesPendientes.set(clave, nuevas);
  pintarMenu(lunesActual);
  clearTimeout(temporizadores.get(clave));
  // Se guarda cuando se deja de tocar, para no hacer un guardado por toque.
  temporizadores.set(clave, setTimeout(async () => {
    temporizadores.delete(clave);
    const raciones = racionesPendientes.get(clave);
    await guardar(null, () => cambiarRaciones(app.cliente, { ...entrada, raciones }, app.config.nombre));
    racionesPendientes.delete(clave);
    pintarMenu(lunesActual);
  }, 900));
}

// ---------- Pintar la semana

function hueco(fecha, h, recetas) {
  const entrada = entradaDe(app.almacen.items('menus'), fecha, h);
  const etiqueta = el('span', { class: 'hueco-nombre' }, NOMBRE_HUECO[h]);
  if (!entrada) {
    return el('div', { class: 'hueco libre' }, etiqueta,
      el('button', { type: 'button', class: 'secundario elegir', onclick: () => abrirElegir(fecha, h) }, '＋ Elegir receta'));
  }
  const receta = recetas.get(entrada.receta);
  const raciones = racionesPendientes.get(`${fecha}|${h}`) ?? entrada.raciones;
  const quitar = el('button', {
    type: 'button', class: 'icono quitar', title: 'Vaciar este hueco', 'aria-label': `Vaciar ${NOMBRE_HUECO[h].toLowerCase()} del ${nombreDia(fecha)}`,
    onclick: (e) => guardar(e.currentTarget, () => quitarDeMenu(app.cliente, fecha, h, app.config.nombre)),
  }, '✕');
  if (!receta) {
    return el('div', { class: 'hueco' }, etiqueta, el('span', { class: 'hueco-receta borrada' }, 'Receta borrada'), el('div', { class: 'hueco-acciones' }, quitar));
  }
  return el(
    'div',
    { class: 'hueco' },
    etiqueta,
    el('a', { class: 'hueco-receta', href: `#receta/${encodeURIComponent(receta.id)}` }, receta.titulo),
    el(
      'div',
      { class: 'hueco-acciones' },
      el('div', { class: 'raciones', role: 'group', 'aria-label': 'Raciones' },
        el('button', { type: 'button', class: 'icono', 'aria-label': 'Una ración menos', disabled: raciones <= 1, onclick: () => tocarRaciones(entrada, -1) }, '−'),
        el('span', {}, raciones === 1 ? '1 ración' : `${raciones} raciones`),
        el('button', { type: 'button', class: 'icono', 'aria-label': 'Una ración más', disabled: raciones >= RACIONES_MAX, onclick: () => tocarRaciones(entrada, +1) }, '+'),
      ),
      el('span', { class: 'hueco-espacio' }),
      el('button', { type: 'button', class: 'icono', title: 'Cambiar por otra receta', 'aria-label': 'Cambiar receta', onclick: () => abrirElegir(fecha, h) }, '⇄'),
      quitar,
    ),
  );
}

export function pintarMenu(lunes) {
  lunesActual = lunes;
  const hoy = hoyISO();
  const recetas = new Map(app.almacen.items('recetas').map((r) => [r.id, r]));
  $('#semana-nombre').textContent = nombreSemana(lunes);
  $('#semana-hoy').hidden = lunes === inicioSemana(hoy);
  $('#semana').replaceChildren(
    ...diasDeSemana(lunes).map((fecha) =>
      el(
        'section',
        { class: `dia${fecha === hoy ? ' hoy' : ''}${fecha < hoy ? ' pasado' : ''}` },
        el('h3', {}, conMayuscula(nombreDia(fecha)), fecha === hoy && el('span', { class: 'marca-hoy' }, 'hoy')),
        HUECOS.map((h) => hueco(fecha, h, recetas)),
      ),
    ),
  );
}

// ---------- Elegir receta para un hueco

function pintarOpciones() {
  const texto = $('#elegir-buscar').value;
  const recetas = filtrarRecetas(app.almacen.items('recetas'), { ...filtrosVacios(), texto }).sort((a, b) => compararTitulos(a.titulo, b.titulo));
  $('#elegir-lista').replaceChildren(
    ...(recetas.length
      ? recetas.map((r) =>
          el('li', {}, el('button', { type: 'button', class: 'opcion-receta', onclick: (e) => elegir(r, e.currentTarget) },
            el('span', { class: 'titulo' }, r.titulo),
            r.categorias.length > 0 && el('span', { class: 'ayuda' }, r.categorias.join(', ')),
          )))
      : [el('li', { class: 'ayuda' }, app.almacen.items('recetas').length ? 'Ninguna receta coincide.' : 'Aún no hay recetas: crea alguna primero.')]),
  );
}

function abrirElegir(fecha, h) {
  eligiendo = { fecha, hueco: h };
  $('#elegir-titulo').textContent = `${NOMBRE_HUECO[h]} · ${nombreDia(fecha)}`;
  $('#elegir-buscar').value = '';
  pintarOpciones();
  $('#dlg-elegir').showModal();
}

async function elegir(receta, boton) {
  const { fecha, hueco: h } = eligiendo;
  const anterior = entradaDe(app.almacen.items('menus'), fecha, h);
  // Al cambiar de receta se mantienen las raciones elegidas; en un hueco nuevo, las de la familia.
  const raciones = anterior?.raciones ?? racionesFamilia(app.almacen.datos('ajustes'));
  for (const b of $('#elegir-lista').querySelectorAll('button')) b.disabled = true;
  await guardar(boton, () => ponerReceta(app.cliente, { fecha, hueco: h, receta, raciones }, app.config.nombre), `${receta.titulo}: ${NOMBRE_HUECO[h].toLowerCase()} del ${nombreDia(fecha)}`);
  $('#dlg-elegir').close();
}

/** Conecta la vista una vez. `onCambio()` se llama tras cada guardado para repintar. */
export function prepararMenu(estadoApp, onCambio) {
  app = estadoApp;
  alCambiar = onCambio;
  $('#elegir-buscar').addEventListener('input', pintarOpciones);
  $('#elegir-cancelar').addEventListener('click', () => $('#dlg-elegir').close());
  $('#semana-anterior').addEventListener('click', () => location.replace(`#menu/${sumarDias(lunesActual, -7)}`));
  $('#semana-siguiente').addEventListener('click', () => location.replace(`#menu/${sumarDias(lunesActual, 7)}`));
  $('#semana-hoy').addEventListener('click', () => location.replace('#menu'));
}
