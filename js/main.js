// Interfaz: estado de la conexión, ajustes y arranque.

import { guardarConfig, borrarConfig, normalizarRepo } from './config.js';
import { crearCliente } from './github.js';
import { crearAlmacen } from './almacen.js';
import { limpiar } from './texto.js';
import { app } from './estado.js';
import { $, aviso, fechaLegible, ocupado } from './dom.js';

function mostrarEstado(texto, esError = false) {
  const nodo = $('#estado');
  nodo.textContent = texto;
  nodo.classList.toggle('error', esError);
}

function render() {
  const conectado = Boolean(app.cliente && app.almacen.fecha);
  $('#conexion').hidden = !conectado;
  if (!conectado) return;
  const n = app.almacen.items('recetas').length;
  $('#conexion-repo').textContent = app.config.repo;
  $('#conexion-nombre').textContent = app.config.nombre;
  $('#conexion-recetas').textContent = n === 1 ? '1 receta' : `${n} recetas`;
  $('#conexion-fecha').textContent = fechaLegible(app.almacen.fecha);
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

// ---------- Arranque

function iniciar() {
  $('#btn-recargar').addEventListener('click', recargar);
  $('#btn-ajustes').addEventListener('click', abrirAjustes);
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
