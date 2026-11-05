// Formulario de receta, nueva o para editar: campos básicos, filas de ingredientes y pasos que se pueden reordenar.

import { UNIDADES, nuevaReceta } from './receta.js';
import { crearReceta, editarReceta, textoALista, RecetaInvalidaError, RecetaCambiadaError } from './recetas.js';
import { $, el, ocupado, fechaLegible } from './dom.js';

const dialogo = () => $('#dlg-receta');
const formulario = () => $('#form-receta');
let borrador = null;
/** Al editar: `modificada` de la versión de partida, para detectar cambios de otros. null en una receta nueva. */
let base = null;
/** Lo que había al abrir, para saber si hay cambios que se perderían. */
let inicial = '';
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
const hayCambios = () => JSON.stringify(leerFormulario()) !== inicial;

function mostrarErrores(errores) {
  const lista = $('#receta-errores');
  lista.replaceChildren(...errores.map((e) => el('li', {}, e)));
  if (errores.length) dialogo().scrollTo({ top: 0, behavior: 'smooth' });
}

async function guardar(evento, app) {
  evento.preventDefault();
  mostrarErrores([]);
  const listo = ocupado($('#receta-guardar'), 'Guardando…');
  const datosForm = leerFormulario();
  const autor = app.config.nombre;
  try {
    let resultado;
    if (base === null) {
      resultado = await crearReceta(app.cliente, datosForm, autor);
    } else {
      try {
        resultado = await editarReceta(app.cliente, datosForm, autor, { base });
      } catch (e) {
        if (!(e instanceof RecetaCambiadaError)) throw e;
        const cuando = fechaLegible(e.actual.modificada);
        if (!confirm(`Otra persona ha cambiado esta receta (${cuando}) mientras la editabas.\n\nAceptar: guardar tus cambios encima de los suyos.\nCancelar: seguir editando sin guardar.`)) {
          mostrarErrores(['No se ha guardado: otra persona cambió la receta. Puedes guardar encima o cancelar y abrirla de nuevo para ver sus cambios.']);
          return;
        }
        resultado = await editarReceta(app.cliente, datosForm, autor, { base, forzar: true });
      }
    }
    borrador = null;
    dialogo().close();
    alGuardar(resultado.datos, resultado.receta);
  } catch (e) {
    mostrarErrores(e instanceof RecetaInvalidaError ? e.errores : [`${e.message} Lo escrito sigue aquí; prueba a guardar de nuevo.`]);
  } finally {
    listo();
  }
}

function cerrar() {
  if (hayCambios() && !confirm(base === null ? '¿Descartar esta receta? Lo escrito se perderá.' : '¿Descartar los cambios?')) return;
  borrador = null;
  dialogo().close();
}

function abrir(receta, esNueva) {
  borrador = receta;
  base = esNueva ? null : receta.modificada;
  const f = formulario();
  f.reset();
  $('#receta-titulo-dialogo').textContent = esNueva ? 'Nueva receta' : 'Editar receta';
  f.titulo.value = receta.titulo;
  f.categorias.value = receta.categorias.join(', ');
  f.etiquetas.value = receta.etiquetas.join(', ');
  f.raciones.value = receta.raciones;
  f.tiempo.value = receta.tiempo ?? '';
  f.dificultad.value = receta.dificultad ?? '';
  const ingredientes = receta.ingredientes.map((i) => ({ ...i, cantidad: i.cantidad === null ? '' : String(i.cantidad).replace('.', ',') }));
  $('#receta-ingredientes').replaceChildren(...(ingredientes.length ? ingredientes.map(filaIngrediente) : [filaIngrediente()]));
  $('#receta-pasos').replaceChildren(...(receta.pasos.length ? receta.pasos.map(filaPaso) : [filaPaso()]));
  mostrarErrores([]);
  inicial = JSON.stringify(leerFormulario());
  dialogo().showModal();
  dialogo().scrollTo(0, 0);
  if (esNueva) f.titulo.focus();
}

export const abrirNuevaReceta = () => abrir(nuevaReceta(), true);

/** Abre el formulario con una receta existente; se guarda con detección de cambios de otros. */
export const abrirEditarReceta = (receta) => abrir(structuredClone(receta), false);

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
