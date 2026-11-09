// Formulario de receta, nueva o para editar: campos básicos, filas de ingredientes y pasos que se pueden reordenar.

import { UNIDADES, PROTEINAS, nuevaReceta } from './receta.js';
import { crearReceta, editarReceta, prepararReceta, textoALista, RecetaInvalidaError, RecetaCambiadaError } from './recetas.js';
import { reducirFoto, subirFoto, borrarFoto, mostrarFoto } from './fotos.js';
import { indiceIngredientes, sugerirIngredientes } from './ingredientes.js';
import { $, el, ocupado, fechaLegible } from './dom.js';

const dialogo = () => $('#dlg-receta');
const formulario = () => $('#form-receta');
let borrador = null;
/** Al editar: `modificada` de la versión de partida, para detectar cambios de otros. null en una receta nueva. */
let base = null;
/** Lo que había al abrir, para saber si hay cambios que se perderían. */
let inicial = '';
/** Foto elegida y ya reducida ({ grande, mini }), o null. `fotoQuitada`: se pulsó «Quitar foto». */
let fotoNueva = null;
let fotoQuitada = false;
let appActual = null;
/** Ingredientes ya usados en las demás recetas, para sugerirlos. */
let indice = [];
let alGuardar = () => {};

// ---------- Ingredientes

function opcionesUnidad(seleccionada) {
  return Object.entries(UNIDADES).map(([clave, u]) =>
    el('option', { value: clave, selected: clave === seleccionada }, u.nombre === clave ? clave : `${clave} (${u.nombre})`),
  );
}

/**
 * Nombre del ingrediente con sugerencias debajo. Mientras escribes: nombres ya usados que encajan.
 * Al salir del campo solo queda, si lo hay, el mismo ingrediente escrito de otra forma («tomates» → «tomate»).
 */
function campoNombre(valor) {
  const input = el('input', { class: 'ing-nombre', placeholder: 'Ingrediente', 'aria-label': 'Ingrediente', value: valor, autocomplete: 'off' });
  const caja = el('div', { class: 'sugerencias', 'aria-live': 'polite' });
  const usar = (nombre) => {
    input.value = nombre;
    caja.replaceChildren();
  };
  const pintar = (soloMismo) => {
    let lista = sugerirIngredientes(indice, input.value);
    if (soloMismo) lista = lista.filter((s) => s.mismo);
    if (!lista.length) return caja.replaceChildren();
    caja.replaceChildren(
      el('span', { class: 'ayuda' }, soloMismo ? 'Ya usas:' : 'Usados:'),
      ...lista.map((s) =>
        el('button', {
          type: 'button',
          class: `sugerencia${s.mismo ? ' mismo' : ''}`,
          title: s.mismo ? 'Es el mismo ingrediente: usa el mismo nombre para que la lista de la compra lo sume' : '',
          // Sin quitar el foco del campo, para que el toque no cuente como «salir».
          onpointerdown: (e) => e.preventDefault(),
          onclick: () => usar(s.nombre),
        }, s.nombre),
      ),
    );
  };
  input.addEventListener('input', () => pintar(false));
  input.addEventListener('focus', () => pintar(false));
  input.addEventListener('blur', () => pintar(true));
  // Con un nombre ya puesto (al editar), avisar desde el principio si hay otra forma más usada.
  if (valor) queueMicrotask(() => pintar(true));
  return [input, caja];
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
    campoNombre(i.nombre),
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

// ---------- Proteínas: fichas para tocar

const leerProteinas = () => [...$('#receta-proteinas').querySelectorAll('[aria-pressed="true"]')].map((b) => b.dataset.proteina);

function pintarProteinas(elegidas) {
  const tocar = (p) => {
    const actuales = leerProteinas();
    // «Vegetal» excluye a las demás, y al revés.
    const nuevas = actuales.includes(p) ? actuales.filter((x) => x !== p) : p === 'vegetal' ? ['vegetal'] : [...actuales.filter((x) => x !== 'vegetal'), p];
    pintarProteinas(nuevas);
  };
  $('#receta-proteinas').replaceChildren(
    ...Object.entries(PROTEINAS).map(([p, { nombre, icono }]) =>
      el('button', { type: 'button', class: `ficha-filtro${elegidas.includes(p) ? ' activa' : ''}`, 'aria-pressed': String(elegidas.includes(p)), 'data-proteina': p, onclick: () => tocar(p) }, `${icono} ${nombre}`)),
  );
}

// ---------- Leer y guardar

function leerFormulario() {
  const f = formulario();
  return {
    ...borrador,
    titulo: f.titulo.value,
    categorias: textoALista(f.categorias.value),
    etiquetas: textoALista(f.etiquetas.value),
    proteinas: leerProteinas(),
    raciones: f.raciones.value,
    tiempo: f.tiempo.value,
    dificultad: f.dificultad.value,
    ingredientes: leerIngredientes(),
    pasos: leerPasos(),
  };
}

/** ¿Hay algo escrito que se perdería al cerrar? */
const hayCambios = () => JSON.stringify(leerFormulario()) !== inicial || Boolean(fotoNueva) || fotoQuitada;

function mostrarErrores(errores) {
  const lista = $('#receta-errores');
  lista.replaceChildren(...errores.map((e) => el('li', {}, e)));
  if (errores.length) dialogo().scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------- Foto

function pintarFoto() {
  const img = $('#receta-foto-vista');
  const ruta = fotoQuitada ? null : borrador.foto;
  const hay = Boolean(fotoNueva || ruta);
  img.hidden = !hay;
  img.classList.remove('cargada', 'sin-foto');
  img.removeAttribute('src');
  if (fotoNueva) {
    img.src = URL.createObjectURL(fotoNueva.grande);
    img.classList.add('cargada');
  } else if (ruta) {
    mostrarFoto(img, appActual.cliente, ruta);
  }
  $('#receta-foto-elegir-texto').textContent = hay ? '📷 Cambiar foto' : '📷 Añadir foto';
  $('#receta-foto-quitar').hidden = !hay;
}

async function fotoElegida(evento) {
  const archivo = evento.target.files?.[0];
  evento.target.value = ''; // Para poder elegir la misma otra vez.
  if (!archivo) return;
  const estado = $('#receta-foto-estado');
  estado.textContent = 'Preparando la foto…';
  // Mientras se prepara no se puede guardar: se guardaría sin la foto nueva.
  const listo = ocupado($('#receta-guardar'), 'Preparando foto…');
  try {
    fotoNueva = await reducirFoto(archivo);
    fotoQuitada = false;
    estado.textContent = '';
    pintarFoto();
  } catch (e) {
    estado.textContent = e.message;
  } finally {
    listo();
  }
}

function quitarFoto() {
  if (fotoNueva) fotoNueva = null;
  else fotoQuitada = true;
  pintarFoto();
}

// ---------- Guardar

async function guardar(evento, app) {
  evento.preventDefault();
  mostrarErrores([]);
  const listo = ocupado($('#receta-guardar'), 'Guardando…');
  const datosForm = leerFormulario();
  const autor = app.config.nombre;
  let subida = null;
  try {
    prepararReceta(datosForm); // Si falta algo, se avisa antes de subir la foto.
    const fotoCambiada = Boolean(fotoNueva) || fotoQuitada;
    if (fotoNueva) {
      $('#receta-guardar').textContent = 'Subiendo foto…';
      subida = await subirFoto(app.cliente, datosForm, fotoNueva, autor);
      $('#receta-guardar').textContent = 'Guardando…';
    }
    if (fotoCambiada) datosForm.foto = subida;
    let resultado;
    if (base === null) {
      resultado = await crearReceta(app.cliente, datosForm, autor);
    } else {
      try {
        resultado = await editarReceta(app.cliente, datosForm, autor, { base, fotoCambiada });
      } catch (e) {
        if (!(e instanceof RecetaCambiadaError)) throw e;
        const cuando = fechaLegible(e.actual.modificada);
        if (!confirm(`Otra persona ha cambiado esta receta (${cuando}) mientras la editabas.\n\nAceptar: guardar tus cambios encima de los suyos.\nCancelar: seguir editando sin guardar.`)) {
          mostrarErrores(['No se ha guardado: otra persona cambió la receta. Puedes guardar encima o cancelar y abrirla de nuevo para ver sus cambios.']);
          await borrarFoto(app.cliente, subida, datosForm.titulo, autor);
          return;
        }
        resultado = await editarReceta(app.cliente, datosForm, autor, { base, forzar: true, fotoCambiada });
      }
    }
    subida = null; // Ya es de la receta: no se borra.
    borrador = null;
    dialogo().close();
    alGuardar(resultado.datos, resultado.receta);
    // La foto anterior se borra al final: si falla, solo queda un archivo suelto.
    if (resultado.fotoAnterior) borrarFoto(app.cliente, resultado.fotoAnterior, resultado.receta.titulo, autor);
  } catch (e) {
    if (subida) await borrarFoto(app.cliente, subida, datosForm.titulo, autor);
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
  indice = indiceIngredientes(appActual.almacen.items('recetas'), receta.id);
  const f = formulario();
  f.reset();
  $('#receta-titulo-dialogo').textContent = esNueva ? 'Nueva receta' : 'Editar receta';
  f.titulo.value = receta.titulo;
  f.categorias.value = receta.categorias.join(', ');
  f.etiquetas.value = receta.etiquetas.join(', ');
  pintarProteinas(receta.proteinas ?? []);
  f.raciones.value = receta.raciones;
  f.tiempo.value = receta.tiempo ?? '';
  f.dificultad.value = receta.dificultad ?? '';
  const ingredientes = receta.ingredientes.map((i) => ({ ...i, cantidad: i.cantidad === null ? '' : String(i.cantidad).replace('.', ',') }));
  $('#receta-ingredientes').replaceChildren(...(ingredientes.length ? ingredientes.map(filaIngrediente) : [filaIngrediente()]));
  $('#receta-pasos').replaceChildren(...(receta.pasos.length ? receta.pasos.map(filaPaso) : [filaPaso()]));
  fotoNueva = null;
  fotoQuitada = false;
  $('#receta-foto-estado').textContent = '';
  pintarFoto();
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
  appActual = app;
  $('#receta-foto-archivo').addEventListener('change', fotoElegida);
  $('#receta-foto-quitar').addEventListener('click', quitarFoto);
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
