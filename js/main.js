// Interfaz: listado de recetas, estado de la conexión, ajustes, alta de recetas y arranque.

import { guardarConfig, borrarConfig, normalizarRepo } from './config.js';
import { crearCliente } from './github.js';
import { crearAlmacen } from './almacen.js';
import { limpiar } from './texto.js';
import { app } from './estado.js';
import { $, el, aviso, fechaLegible, ocupado } from './dom.js';
import { abrirNuevaReceta, abrirEditarReceta, prepararFormularioReceta } from './formulario-receta.js';
import { borrarReceta, puntuarReceta, anadirNota } from './recetas.js';
import { mostrarFoto } from './fotos.js';
import { filtrosVacios, filtrosActivos, filtrarRecetas, construirPanel } from './filtros.js';
import { pintarListado } from './listado.js';
import { construirFicha, pantallaEncendida, puedeMantenerPantalla } from './ficha.js';

function mostrarEstado(texto, esError = false) {
  const nodo = $('#estado');
  nodo.textContent = texto;
  nodo.classList.toggle('error', esError);
}

/** Receta abierta según la dirección (#receta/<id>), o null en el listado. */
function idEnDireccion() {
  const m = location.hash.match(/^#receta\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

let scrollListado = 0;
/** Búsqueda y filtros del listado: duran mientras la app está abierta (también al ir y volver de una ficha). */
let filtros = filtrosVacios();
const verFoto = (img, ruta) => mostrarFoto(img, app.cliente, ruta);

function render() {
  // Con copia local se muestra al instante, aunque aún no haya respuesta de GitHub.
  const hayDatos = Boolean(app.cliente && app.almacen.fecha);
  const id = hayDatos ? idEnDireccion() : null;
  const enFicha = id !== null;
  $('#recetario').hidden = !hayDatos || enFicha;
  $('#vista-ficha').hidden = !enFicha;
  $('#btn-nueva').hidden = !hayDatos || enFicha;
  pantallaEncendida(enFicha);
  if (!hayDatos) return;
  const recetas = app.almacen.items('recetas');
  if (enFicha) return pintarFicha(recetas.find((r) => r.id === id));
  const visibles = filtrarRecetas(recetas, filtros);
  const filtrando = visibles.length !== recetas.length || filtros.texto.trim() !== '' || filtrosActivos(filtros) > 0;
  const total = recetas.length === 1 ? '1 receta' : `${recetas.length} recetas`;
  $('#resumen-recetas').textContent = filtrando ? `${visibles.length} de ${total}` : total;
  $('#resumen-fecha').textContent = `actualizado ${fechaLegible(app.almacen.fecha)}`;
  $('#quitar-filtros').hidden = !filtrando;
  const n = filtrosActivos(filtros);
  $('#btn-filtros').textContent = n ? `Filtros (${n})` : 'Filtros';
  $('#btn-filtros').classList.toggle('activo', n > 0);
  if (!$('#filtros').hidden) $('#filtros').replaceChildren(...construirPanel(recetas, filtros, cambiarFiltros).filter(Boolean));
  if (recetas.length && !visibles.length) {
    $('#listado').replaceChildren(el('p', { class: 'vacio' }, 'Ninguna receta cumple la búsqueda y los filtros.'));
  } else {
    pintarListado($('#listado'), visibles, verFoto);
  }
}

function cambiarFiltros(nuevos) {
  filtros = nuevos;
  render();
}

function alternarPanelFiltros() {
  const panel = $('#filtros');
  panel.hidden = !panel.hidden;
  $('#btn-filtros').setAttribute('aria-expanded', String(!panel.hidden));
  render();
}

function quitarFiltros() {
  filtros = filtrosVacios();
  $('#buscar').value = '';
  render();
}

let fichaPintada = null;
/** Receta mostrada en la ficha (para Editar y Borrar). */
let fichaActual = null;

function pintarFicha(receta) {
  fichaActual = receta ?? null;
  $('#ficha-editar').hidden = !receta;
  $('#ficha-borrar').hidden = !receta;
  // Si se actualiza desde GitHub y la receta no ha cambiado, no se redibuja: se conservan los pasos tachados.
  const clave = receta ? JSON.stringify(receta) : 'ninguna';
  if (clave === fichaPintada && !$('#vista-ficha').hidden) return;
  fichaPintada = clave;
  $('#ficha').replaceChildren(
    receta ? construirFicha(receta, { onPuntuar: puntuar, onNota: guardarNota, verFoto }) : el('p', { class: 'vacio' }, 'No se encuentra esta receta. Puede que la hayan borrado desde otro dispositivo.'),
  );
  $('#ficha-pantalla').hidden = !(receta && puedeMantenerPantalla());
}

/** Al cambiar de vista: la ficha empieza arriba; la lista vuelve a donde estaba. */
function cambioDeVista() {
  const deListado = $('#vista-ficha').hidden;
  if (deListado) scrollListado = window.scrollY;
  render();
  if (idEnDireccion() === null) fichaPintada = null;
  window.scrollTo(0, idEnDireccion() !== null ? 0 : scrollListado);
}

/** Volver con «atrás» si se llegó desde la lista; si se abrió la ficha directamente, ir a la lista. */
function volver() {
  if (history.state?.desdeListado) history.back();
  else location.replace('#');
}

async function recargar() {
  if (!app.cliente) return;
  if (!navigator.onLine) {
    const fecha = app.almacen.fecha;
    mostrarEstado(fecha ? `Sin conexión. Mostrando la copia del ${fechaLegible(fecha)}.` : 'Sin conexión.');
    return;
  }
  const listo = ocupado($('#btn-recargar'));
  mostrarEstado('Cargando…');
  try {
    await app.almacen.recargar(app.cliente);
    mostrarEstado('');
  } catch (e) {
    const fecha = app.almacen.fecha;
    mostrarEstado(e.message + (fecha ? ` Mostrando la copia del ${fechaLegible(fecha)}.` : ''), true);
  } finally {
    listo();
    render();
  }
}

// ---------- Ajustes

function abrirAjustes() {
  const f = $('#form-ajustes');
  for (const campo of ['nombre', 'repo', 'token']) f[campo].value = app.config[campo];
  $('#ajustes-error').textContent = '';
  $('#conexion').hidden = !(app.cliente && app.almacen.fecha);
  $('#conexion-repo').textContent = app.config.repo;
  $('#conexion-fecha').textContent = fechaLegible(app.almacen.fecha);
  $('#ajustes-cancelar').hidden = !app.cliente;
  $('#ajustes-olvidar').hidden = !app.cliente;
  $('#dlg-ajustes').showModal();
}

async function guardarAjustes(evento) {
  evento.preventDefault();
  const f = evento.target;
  const error = $('#ajustes-error');
  const repo = normalizarRepo(f.repo.value);
  const nueva = { nombre: limpiar(f.nombre.value), repo, token: f.token.value.trim() };
  if (!nueva.nombre || !nueva.token) return void (error.textContent = 'Rellena tu nombre y el token.');
  if (!repo) return void (error.textContent = 'El repositorio debe tener la forma usuario/nombre.');

  const listo = ocupado($('#ajustes-guardar'), 'Comprobando…');
  error.textContent = '';
  try {
    const cliente = crearCliente(nueva);
    await app.almacen.recargar(cliente);
    guardarConfig(nueva);
    app.config = nueva;
    app.cliente = cliente;
    $('#dlg-ajustes').close();
    mostrarEstado('');
    render();
    aviso(`Conectado. Hola, ${nueva.nombre}.`);
  } catch (e) {
    error.textContent = e.message;
  } finally {
    listo();
  }
}

function olvidarDispositivo() {
  if (!confirm('¿Borrar de este dispositivo el token y la copia de las recetas?\nLos datos del repo no se tocan. Recuerda revocar el token en GitHub si ya no lo vas a usar.')) return;
  borrarConfig();
  app.config = { nombre: '', repo: '', token: '' };
  app.cliente = null;
  app.almacen = crearAlmacen();
  $('#dlg-ajustes').close();
  render();
  abrirAjustes();
}

// ---------- Recetas

function recetaGuardada(datos, receta) {
  app.almacen.fijar('recetas', datos);
  render();
  aviso(`Guardada: ${receta.titulo}`);
}

/** Guarda en GitHub un cambio pequeño de la ficha (puntuación o nota) y la redibuja. */
async function cambioEnFicha(boton, accion, textoOk) {
  const listo = ocupado(boton);
  try {
    const { datos } = await accion();
    app.almacen.fijar('recetas', datos);
    render();
    aviso(textoOk);
    return true;
  } catch (e) {
    aviso(`No se ha guardado. ${e.message}`);
    return false;
  } finally {
    listo();
  }
}

function puntuar(n, grupo) {
  const receta = fichaActual;
  for (const b of grupo.querySelectorAll('button')) b.disabled = true;
  cambioEnFicha(grupo.querySelectorAll('button')[n - 1], () => puntuarReceta(app.cliente, receta, n, app.config.nombre), `Puntuación: ${n} de 5`)
    .finally(() => grupo.querySelectorAll('button').forEach((b) => (b.disabled = false)));
}

async function guardarNota(textarea, boton) {
  const receta = fichaActual;
  if (!textarea.value.trim()) return textarea.focus();
  textarea.disabled = true;
  const ok = await cambioEnFicha(boton, () => anadirNota(app.cliente, receta, textarea.value, app.config.nombre), 'Nota añadida');
  // Si falló, el texto sigue ahí para reintentar; si fue bien, la ficha ya se ha redibujado.
  if (!ok) textarea.disabled = false;
}

async function borrarFicha() {
  const receta = fichaActual;
  if (!receta) return;
  // Cuando haya menús (PL-01), aquí se avisará si la receta está en alguno.
  if (!confirm(`¿Borrar «${receta.titulo}»?\nSe borra en todos los dispositivos y no se puede deshacer.`)) return;
  const listo = ocupado($('#ficha-borrar'), 'Borrando…');
  try {
    const { datos } = await borrarReceta(app.cliente, receta, app.config.nombre);
    app.almacen.fijar('recetas', datos);
    volver();
    aviso(`Borrada: ${receta.titulo}`);
  } catch (e) {
    aviso(`No se ha borrado. ${e.message}`);
  } finally {
    listo();
  }
}

// ---------- Arranque

function iniciar() {
  $('#btn-recargar').addEventListener('click', recargar);
  $('#btn-ajustes').addEventListener('click', abrirAjustes);
  $('#btn-nueva').addEventListener('click', abrirNuevaReceta);
  prepararFormularioReceta(app, recetaGuardada);
  $('#form-ajustes').addEventListener('submit', guardarAjustes);
  $('#ajustes-cancelar').addEventListener('click', () => $('#dlg-ajustes').close());
  $('#ajustes-olvidar').addEventListener('click', olvidarDispositivo);
  // Sin configuración no se puede cerrar el diálogo de ajustes.
  $('#dlg-ajustes').addEventListener('cancel', (e) => {
    if (!app.cliente) e.preventDefault();
  });

  window.addEventListener('hashchange', cambioDeVista);
  $('#ficha-volver').addEventListener('click', volver);
  $('#buscar').addEventListener('input', (e) => cambiarFiltros({ ...filtros, texto: e.target.value }));
  $('#btn-filtros').addEventListener('click', alternarPanelFiltros);
  $('#quitar-filtros').addEventListener('click', quitarFiltros);
  $('#ficha-editar').addEventListener('click', () => fichaActual && abrirEditarReceta(fichaActual));
  $('#ficha-borrar').addEventListener('click', borrarFicha);
  // Marca las entradas abiertas desde la lista, para que «← Recetas» equivalga al botón atrás.
  $('#listado').addEventListener('click', (e) => {
    const enlace = e.target.closest('a[href^="#receta/"]');
    if (!enlace) return;
    e.preventDefault();
    history.pushState({ desdeListado: true }, '', enlace.getAttribute('href'));
    cambioDeVista();
  });

  window.addEventListener('online', recargar);
  window.addEventListener('offline', () => mostrarEstado('Sin conexión. Puedes consultar, pero no guardar cambios.'));

  render();
  if (app.cliente) recargar();
  else abrirAjustes();
}

iniciar();
