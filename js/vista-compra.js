// Vista de la lista de la compra: generarla a partir del menú, añadir cosas a mano y quitar líneas.

import { generarLista, anadirALista, quitarDeLista, textoCantidades, entradasEntre } from './compra.js';
import { sumarDias, inicioSemana, leerFecha } from './menus.js';
import { hoyISO } from './vista-menu.js';
import { $, el, aviso, ocupado } from './dom.js';

let app = null;
let alCambiar = () => {};

const fechaCorta = (iso) => leerFecha(iso).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });

async function guardar(boton, accion, textoOk) {
  const listo = boton ? ocupado(boton) : () => {};
  try {
    app.almacen.fijar('lista', await accion());
    alCambiar();
    if (textoOk) aviso(textoOk);
    return true;
  } catch (e) {
    aviso(`No se ha guardado. ${e.message}`);
    return false;
  } finally {
    listo();
  }
}

function linea(l) {
  const cantidad = textoCantidades(l);
  return el(
    'li',
    { class: 'linea-compra' },
    el('span', { class: 'nombre' }, l.nombre),
    el('span', { class: 'cantidad' }, cantidad || (l.manual ? '' : 'a ojo')),
    el('button', {
      type: 'button', class: 'icono', title: 'Quitar de la lista', 'aria-label': `Quitar ${l.nombre} de la lista`,
      onclick: (e) => guardar(e.currentTarget, () => quitarDeLista(app.cliente, l, app.config.nombre)),
    }, '✕'),
    (l.recetas.length > 0 || l.manual) && el('span', { class: 'para' }, l.manual ? 'Añadido a mano' : `Para ${l.recetas.join(', ')}`),
  );
}

export function pintarCompra() {
  const datos = app.almacen.datos('lista');
  const items = datos?.items ?? [];
  $('#compra-rango').textContent = datos?.desde
    ? `Menú del ${fechaCorta(datos.desde)} al ${fechaCorta(datos.hasta)} · ${items.length === 1 ? '1 cosa' : `${items.length} cosas`}`
    : '';
  $('#compra-lista').replaceChildren(...items.map(linea));
  if (!items.length) {
    $('#compra-lista').replaceChildren();
    $('#compra-rango').replaceChildren(el('span', { class: 'compra-vacia' }, datos?.desde ? 'La lista está vacía.' : 'Aún no hay lista. Genérala a partir del menú.'));
  }
}

// ---------- Generar

function contarRecetas() {
  const f = $('#form-compra');
  const n = f.desde.value && f.hasta.value && f.desde.value <= f.hasta.value
    ? entradasEntre(app.almacen.items('menus'), f.desde.value, f.hasta.value).length
    : 0;
  $('#compra-cuantas').textContent = n ? `${n === 1 ? '1 receta' : `${n} recetas`} del menú en esas fechas.` : 'No hay recetas en el menú en esas fechas.';
}

function abrirGenerar() {
  const f = $('#form-compra');
  const hoy = hoyISO();
  f.desde.value = hoy;
  f.hasta.value = sumarDias(inicioSemana(hoy), 6);
  $('#compra-error').textContent = '';
  contarRecetas();
  $('#dlg-compra').showModal();
}

async function generar(evento) {
  evento.preventDefault();
  const f = evento.target;
  const desde = f.desde.value;
  const hasta = f.hasta.value;
  const error = $('#compra-error');
  if (!desde || !hasta || hasta < desde) return void (error.textContent = 'Elige un rango de fechas: «hasta» no puede ser antes que «desde».');
  if (sumarDias(desde, 62) < hasta) return void (error.textContent = 'Como mucho, dos meses de una vez.');
  error.textContent = '';
  const ok = await guardar($('#compra-ok'), () => generarLista(app.cliente, { recetas: app.almacen.items('recetas'), menus: app.almacen.items('menus'), desde, hasta }, app.config.nombre));
  if (!ok) return;
  $('#dlg-compra').close();
  const n = app.almacen.items('lista').filter((l) => !l.manual).length;
  aviso(n ? `Lista generada: ${n === 1 ? '1 ingrediente' : `${n} ingredientes`}.` : 'No hay recetas en el menú en esas fechas.');
}

async function anadir(evento) {
  evento.preventDefault();
  const campo = evento.target.texto;
  const texto = campo.value;
  if (!texto.trim()) return campo.focus();
  const antes = app.almacen.items('lista').length;
  const ok = await guardar(evento.target.querySelector('button'), () => anadirALista(app.cliente, texto, app.config.nombre));
  if (!ok) return;
  if (app.almacen.items('lista').length === antes) aviso(`«${texto.trim()}» ya está en la lista.`);
  campo.value = '';
  campo.focus();
}

/** Conecta la vista una vez. `onCambio()` se llama tras cada guardado para repintar. */
export function prepararCompra(estadoApp, onCambio) {
  app = estadoApp;
  alCambiar = onCambio;
  $('#compra-generar').addEventListener('click', abrirGenerar);
  $('#form-compra').addEventListener('submit', generar);
  $('#form-compra').addEventListener('input', contarRecetas);
  $('#compra-cancelar').addEventListener('click', () => $('#dlg-compra').close());
  $('#compra-anadir').addEventListener('submit', anadir);
}
