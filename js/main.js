// Interfaz: listado de recetas, estado de la conexión, ajustes, alta de recetas y arranque.

import { guardarConfig, borrarConfig, normalizarRepo } from './config.js';
import { crearCliente } from './github.js';
import { crearAlmacen } from './almacen.js';
import { limpiar } from './texto.js';
import { app } from './estado.js';
import { $, aviso, fechaLegible, ocupado } from './dom.js';
import { abrirNuevaReceta, prepararFormularioReceta } from './formulario-receta.js';
import { pintarListado } from './listado.js';

function mostrarEstado(texto, esError = false) {
  const nodo = $('#estado');
  nodo.textContent = texto;
  nodo.classList.toggle('error', esError);
}

function render() {
  // Con copia local se muestra al instante, aunque aún no haya respuesta de GitHub.
  const hayDatos = Boolean(app.cliente && app.almacen.fecha);
  $('#recetario').hidden = !hayDatos;
  $('#btn-nueva').hidden = !hayDatos;
  if (!hayDatos) return;
  const recetas = app.almacen.items('recetas');
  const fecha = fechaLegible(app.almacen.fecha);
  $('#resumen-recetas').textContent = recetas.length === 1 ? '1 receta' : `${recetas.length} recetas`;
  $('#resumen-fecha').textContent = `actualizado ${fecha}`;
  pintarListado($('#listado'), recetas);
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

  window.addEventListener('online', recargar);
  window.addEventListener('offline', () => mostrarEstado('Sin conexión. Puedes consultar, pero no guardar cambios.'));

  render();
  if (app.cliente) recargar();
  else abrirAjustes();
}

iniciar();
