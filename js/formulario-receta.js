// Formulario de receta nueva: campos básicos, filas de ingredientes y pasos que se pueden reordenar.

import { UNIDADES, nuevaReceta } from './receta.js';
import { crearReceta, textoALista, RecetaInvalidaError } from './recetas.js';
import { $, el, ocupado } from './dom.js';

const dialogo = () => $('#dlg-receta');
const formulario = () => $('#form-receta');
let borrador = null;
let alGuardar = () => {};

// ---------- Ingredientes

function opcionesUnidad(seleccionada) {
  return Object.entries(UNIDADES).map(([clave, u]) =>
    el('option', { value: clave, selected: clave === seleccionada }, u.nombre === clave ? clave : `${clave} (${u.nombre})`),
  );
}

function filaIngrediente(i = { cantidad: '', unidad: 'g', nombre: '', detalle: '' }) {
  const cantidad = el('input', { class: 'ing-cantidad', inputmode: 'decimal', placeholder: 'Cant.', 'aria-label': 'Cantidad', value: i.cantidad ?? '' });
  const unidad = el('select', { class: 'ing-unidad', 'aria-label': 'Unidad' }, opcionesUnidad(i.unidad));
  const sinCantidad = () => {
    const no = Boolean(UNIDADES[unidad.value]?.sinCantidad);
    cantidad.disabled = no;
    if (no) cantidad.value = '';
  };
  unidad.addEventListener('change', sinCantidad);
  sinCantidad();
  const fila = el(
    'li',
    { class: 'fila-ingrediente' },
    cantidad,
    unidad,
    el('input', { class: 'ing-nombre', placeholder: 'Ingrediente', 'aria-label': 'Ingrediente', value: i.nombre }),
    el('input', { class: 'ing-detalle', placeholder: 'Detalle (opcional)', 'aria-label': 'Detalle', value: i.detalle }),
    el('button', { type: 'button', class: 'icono quitar', title: 'Quitar ingrediente', 'aria-label': 'Quitar ingrediente', onclick: () => quitar(fila) }, '✕'),
  );
  return fila;
}

function leerIngredientes() {
  return [...$('#receta-ingredientes').children].map((fila) => ({
    cantidad: $('.ing-cantidad', fila).value,
    unidad: $('.ing-unidad', fila).value,
    nombre: $('.ing-nombre', fila).value,
    detalle: $('.ing-detalle', fila).value,
  }));
}

// ---------- Pasos

function filaPaso(texto = '') {
  const fila = el(
    'li',
    { class: 'fila-paso' },
    el('textarea', { rows: 2, 'aria-label': 'Paso', placeholder: 'Describe el paso' }, texto),
    el(
      'div',
      { class: 'mover' },
      el('button', { type: 'button', class: 'icono', title: 'Subir', 'aria-label': 'Subir paso', onclick: () => fila.previousElementSibling?.before(fila) }, '↑'),
      el('button', { type: 'button', class: 'icono', title: 'Bajar', 'aria-label': 'Bajar paso', onclick: () => fila.nextElementSibling?.after(fila) }, '↓'),
      el('button', { type: 'button', class: 'icono quitar', title: 'Quitar paso', 'aria-label': 'Quitar paso', onclick: () => quitar(fila) }, '✕'),
    ),
  );
  return fila;
}

const leerPasos = () => [...$('#receta-pasos').children].map((fila) => $('textarea', fila).value);

/** Quita una fila; si era la última, deja una vacía para no tener que pulsar «Añadir». */
function quitar(fila) {
  const lista = fila.parentElement;
  fila.remove();
  if (!lista.children.length) lista.append(lista.id === 'receta-pasos' ? filaPaso() : filaIngrediente());
}

function anadir(lista, fila) {
  lista.append(fila);
  $('input, textarea', fila).focus();
}

// ---------- Leer y guardar

function leerFormulario() {
  const f = formulario();
  return {
    ...borrador,
    titulo: f.titulo.value,
    categorias: textoALista(f.categorias.value),
    etiquetas: textoALista(f.etiquetas.value),
    raciones: f.raciones.value,
    tiempo: f.tiempo.value,
    dificultad: f.dificultad.value,
    ingredientes: leerIngredientes(),
    pasos: leerPasos(),
  };
}

/** ¿Hay algo escrito que se perdería al cerrar? */
function hayCambios() {
  const r = leerFormulario();
  return Boolean(
    r.titulo.trim() || r.categorias.length || r.etiquetas.length || r.tiempo || r.dificultad ||
      r.ingredientes.some((i) => i.nombre.trim() || i.cantidad.trim()) || r.pasos.some((p) => p.trim()),
  );
}

function mostrarErrores(errores) {
  const lista = $('#receta-errores');
  lista.replaceChildren(...errores.map((e) => el('li', {}, e)));
  if (errores.length) dialogo().scrollTo({ top: 0, behavior: 'smooth' });
}

async function guardar(evento, app) {
  evento.preventDefault();
  mostrarErrores([]);
  const listo = ocupado($('#receta-guardar'), 'Guardando…');
  try {
    const { datos, receta } = await crearReceta(app.cliente, leerFormulario(), app.config.nombre);
    borrador = null;
    dialogo().close();
    alGuardar(datos, receta);
  } catch (e) {
    mostrarErrores(e instanceof RecetaInvalidaError ? e.errores : [`${e.message} La receta sigue aquí; prueba a guardar de nuevo.`]);
  } finally {
    listo();
  }
}

function cerrar() {
  if (hayCambios() && !confirm('¿Descartar esta receta? Lo escrito se perderá.')) return;
  borrador = null;
  dialogo().close();
}

export function abrirNuevaReceta() {
  borrador = nuevaReceta();
  const f = formulario();
  f.reset();
  f.raciones.value = borrador.raciones;
  $('#receta-ingredientes').replaceChildren(filaIngrediente());
  $('#receta-pasos').replaceChildren(filaPaso());
  mostrarErrores([]);
  dialogo().showModal();
  f.titulo.focus();
}

/** Conecta el formulario una vez. `onGuardada(datos, receta)` recibe recetas.json tal como queda en GitHub. */
export function prepararFormularioReceta(app, onGuardada) {
  alGuardar = onGuardada;
  formulario().addEventListener('submit', (e) => guardar(e, app));
  $('#receta-cancelar').addEventListener('click', cerrar);
  $('#receta-anadir-ingrediente').addEventListener('click', () => anadir($('#receta-ingredientes'), filaIngrediente()));
  $('#receta-anadir-paso').addEventListener('click', () => anadir($('#receta-pasos'), filaPaso()));
  // Escape o el botón atrás de Android: pedir confirmación en vez de cerrar sin más.
  dialogo().addEventListener('cancel', (e) => {
    e.preventDefault();
    cerrar();
  });
}
