// Vista del menú: una semana de lunes a domingo, con comida y cena cada día.

import { HUECOS, RACIONES_MAX, fechaISO, sumarDias, inicioSemana, diasDeSemana, leerFecha, entradasDe, especialDe, esEspecial, ESPECIALES, racionesFamilia, ponerReceta, quitarDeMenu, moverEnMenu, cambiarRaciones, marcarEspecial, quitarEspecial } from './menus.js';
import { filtrarRecetas, filtrosVacios } from './filtros.js';
import { compararTitulos } from './texto.js';
import { $, el, aviso, ocupado } from './dom.js';

let app = null;
let alCambiar = () => {};
let lunesActual = null;
/**
 * Hueco que se está eligiendo: { fecha, hueco, sustituye, modo }.
 * sustituye: id de la receta que se cambia, o null para añadir. modo: 'receta' (solo recetas), 'vacio' (recetas o especial), 'especial' (cambiar el especial).
 */
let eligiendo = null;
/** Raciones tocadas con −/+ que aún no se han guardado, por «fecha|hueco|receta» (se guardan al dejar de tocar). */
const racionesPendientes = new Map();
const temporizadores = new Map();

const NOMBRE_HUECO = { comida: 'Comida', cena: 'Cena' };
const ICONO_ESPECIAL = { fuera: '🍴', libre: '🎲' };

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

const claveEntrada = (e) => `${e.fecha}|${e.hueco}|${e.receta}`;

function tocarRaciones(entrada, delta) {
  const clave = claveEntrada(entrada);
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

/** Una receta dentro de un hueco, con sus raciones y acciones. */
function plato(entrada, recetas, posicion, total) {
  const { fecha, hueco: h } = entrada;
  const receta = recetas.get(entrada.receta);
  const titulo = receta?.titulo ?? 'Receta borrada';
  const raciones = racionesPendientes.get(claveEntrada(entrada)) ?? entrada.raciones;
  const objetivo = { fecha, hueco: h, receta: receta ?? { id: entrada.receta, titulo } };
  const quitar = el('button', {
    type: 'button', class: 'icono quitar', title: 'Quitar del menú', 'aria-label': `Quitar ${titulo} de la ${NOMBRE_HUECO[h].toLowerCase()} del ${nombreDia(fecha)}`,
    onclick: (e) => guardar(e.currentTarget, () => quitarDeMenu(app.cliente, objetivo, app.config.nombre)),
  }, '✕');
  const mover = (delta, simbolo, texto) =>
    total > 1 && el('button', {
      type: 'button', class: 'icono', title: texto, 'aria-label': `${texto}: ${titulo}`, disabled: posicion + delta < 0 || posicion + delta >= total,
      onclick: (e) => guardar(e.currentTarget, () => moverEnMenu(app.cliente, objetivo, delta, app.config.nombre)),
    }, simbolo);
  if (!receta) {
    return el('div', { class: 'plato' }, el('span', { class: 'hueco-receta borrada' }, titulo), el('div', { class: 'hueco-acciones' }, el('span', { class: 'hueco-espacio' }), quitar));
  }
  return el(
    'div',
    { class: 'plato' },
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
      mover(-1, '↑', 'Subir'),
      mover(+1, '↓', 'Bajar'),
      el('button', { type: 'button', class: 'icono', title: 'Cambiar por otra receta', 'aria-label': `Cambiar ${receta.titulo} por otra receta`, onclick: () => abrirElegir(fecha, h, receta.id) }, '⇄'),
      quitar,
    ),
  );
}

/** Hueco marcado como «Comemos fuera» o «Libre»: sin recetas. */
function huecoEspecial(fecha, h, especial, etiqueta) {
  const nombre = ESPECIALES[especial.especial] ?? especial.especial;
  return el(
    'div',
    { class: 'hueco especial' },
    etiqueta,
    el('div', { class: 'platos' }, el('div', { class: 'plato plato-especial' },
      el('div', { class: 'especial-texto' },
        el('span', { class: 'hueco-especial' }, `${ICONO_ESPECIAL[especial.especial] ?? ''} ${nombre}`.trim()),
        especial.nota && el('span', { class: 'hueco-nota' }, especial.nota),
      ),
      el('div', { class: 'hueco-acciones' },
        el('button', { type: 'button', class: 'icono', title: 'Cambiar o añadir nota', 'aria-label': `Cambiar «${nombre}» o su nota`, onclick: () => abrirElegir(fecha, h, null, 'especial') }, '✎'),
        el('button', {
          type: 'button', class: 'icono quitar', title: 'Vaciar este hueco', 'aria-label': `Vaciar ${NOMBRE_HUECO[h].toLowerCase()} del ${nombreDia(fecha)}`,
          onclick: (e) => guardar(e.currentTarget, () => quitarEspecial(app.cliente, { fecha, hueco: h }, app.config.nombre)),
        }, '✕'),
      ),
    )),
  );
}

function hueco(fecha, h, recetas) {
  const todas = entradasDe(app.almacen.items('menus'), fecha, h);
  const etiqueta = el('span', { class: 'hueco-nombre' }, NOMBRE_HUECO[h]);
  const especial = todas.find(esEspecial);
  if (especial) return huecoEspecial(fecha, h, especial, etiqueta);
  const entradas = todas;
  const anadir = el('button', { type: 'button', class: 'secundario elegir', onclick: () => abrirElegir(fecha, h) }, entradas.length ? '＋ Añadir plato' : '＋ Elegir receta');
  return el(
    'div',
    { class: `hueco${entradas.length ? '' : ' libre'}` },
    etiqueta,
    el('div', { class: 'platos' }, entradas.map((e, i) => plato(e, recetas, i, entradas.length)), anadir),
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
  const { fecha, hueco: h, sustituye } = eligiendo;
  const yaEstan = new Set(entradasDe(app.almacen.items('menus'), fecha, h).map((e) => e.receta).filter((id) => id !== sustituye));
  const recetas = filtrarRecetas(app.almacen.items('recetas'), { ...filtrosVacios(), texto }).sort((a, b) => compararTitulos(a.titulo, b.titulo));
  $('#elegir-lista').replaceChildren(
    ...(recetas.length
      ? recetas.map((r) =>
          el('li', {}, el('button', { type: 'button', class: 'opcion-receta', disabled: yaEstan.has(r.id) || r.id === sustituye, onclick: (e) => elegir(r, e.currentTarget) },
            el('span', { class: 'titulo' }, r.titulo),
            (yaEstan.has(r.id) || r.id === sustituye)
              ? el('span', { class: 'ayuda' }, 'Ya está en este hueco')
              : r.categorias.length > 0 && el('span', { class: 'ayuda' }, r.categorias.join(', ')),
          )))
      : [el('li', { class: 'ayuda' }, app.almacen.items('recetas').length ? 'Ninguna receta coincide.' : 'Aún no hay recetas: crea alguna primero.')]),
  );
}

function abrirElegir(fecha, h, sustituye = null, modo = null) {
  const menus = app.almacen.items('menus');
  modo ??= sustituye || entradasDe(menus, fecha, h).length ? 'receta' : 'vacio';
  eligiendo = { fecha, hueco: h, sustituye, modo };
  const accion = sustituye ? 'cambiar receta' : modo === 'receta' ? 'añadir plato' : '';
  $('#elegir-titulo').textContent = `${NOMBRE_HUECO[h]} · ${nombreDia(fecha)}${accion ? ` · ${accion}` : ''}`;
  // Hueco vacío: recetas o especial. Hueco especial: solo cambiar el tipo o la nota (para poner recetas, se vacía con ✕).
  const actual = especialDe(menus, fecha, h);
  $('#elegir-especial').hidden = modo === 'receta';
  $('#elegir-especial-ayuda').textContent = modo === 'especial' ? 'Elige el tipo y, si quieres, una nota. Para poner recetas, vacía el hueco con ✕.' : 'O deja el hueco sin receta:';
  $('#elegir-nota').value = actual?.nota ?? '';
  for (const b of $('#elegir-especial').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.especial === actual?.especial));
  $('#elegir-buscar').hidden = $('#elegir-lista').hidden = modo === 'especial';
  $('#elegir-buscar').value = '';
  pintarOpciones();
  $('#dlg-elegir').showModal();
}

async function elegirEspecial(boton) {
  const { fecha, hueco: h } = eligiendo;
  const especial = boton.dataset.especial;
  for (const b of $('#dlg-elegir').querySelectorAll('button')) b.disabled = true;
  await guardar(boton, () => marcarEspecial(app.cliente, { fecha, hueco: h, especial, nota: $('#elegir-nota').value }, app.config.nombre), `${ESPECIALES[especial]}: ${NOMBRE_HUECO[h].toLowerCase()} del ${nombreDia(fecha)}`);
  for (const b of $('#dlg-elegir').querySelectorAll('button')) b.disabled = false;
  $('#dlg-elegir').close();
}

async function elegir(receta, boton) {
  const { fecha, hueco: h, sustituye } = eligiendo;
  const anterior = sustituye && entradasDe(app.almacen.items('menus'), fecha, h).find((e) => e.receta === sustituye);
  // Al cambiar de receta se mantienen las raciones elegidas; en un plato nuevo, las de la familia.
  const raciones = anterior?.raciones ?? racionesFamilia(app.almacen.datos('ajustes'));
  for (const b of $('#elegir-lista').querySelectorAll('button')) b.disabled = true;
  await guardar(boton, () => ponerReceta(app.cliente, { fecha, hueco: h, receta, raciones, sustituye }, app.config.nombre), `${receta.titulo}: ${NOMBRE_HUECO[h].toLowerCase()} del ${nombreDia(fecha)}`);
  $('#dlg-elegir').close();
}

/** Conecta la vista una vez. `onCambio()` se llama tras cada guardado para repintar. */
export function prepararMenu(estadoApp, onCambio) {
  app = estadoApp;
  alCambiar = onCambio;
  $('#elegir-buscar').addEventListener('input', pintarOpciones);
  for (const b of $('#elegir-especial').querySelectorAll('button')) b.addEventListener('click', () => elegirEspecial(b));
  $('#elegir-cancelar').addEventListener('click', () => $('#dlg-elegir').close());
  $('#semana-anterior').addEventListener('click', () => location.replace(`#menu/${sumarDias(lunesActual, -7)}`));
  $('#semana-siguiente').addEventListener('click', () => location.replace(`#menu/${sumarDias(lunesActual, 7)}`));
  $('#semana-hoy').addEventListener('click', () => location.replace('#menu'));
}
