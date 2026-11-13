// Interfaz: navegación entre recetas, menú y ficha; ajustes; alta de recetas y arranque.

import { guardarConfig, borrarConfig, normalizarRepo } from './config.js';
import { crearCliente } from './github.js';
import { crearAlmacen } from './almacen.js';
import { limpiar, normalizar } from './texto.js';
import { app } from './estado.js';
import { $, el, aviso, fechaLegible, ocupado } from './dom.js';
import { abrirNuevaReceta, abrirEditarReceta, prepararFormularioReceta } from './formulario-receta.js';
import { borrarReceta, puntuarReceta, anadirNota } from './recetas.js';
import { mostrarFoto } from './fotos.js';
import { filtrosVacios, filtrosActivos, filtrarRecetas, construirPanel, opcionesFiltro } from './filtros.js';
import { categoriasFuera } from './generador.js';
import { pintarListado } from './listado.js';
import { construirFicha, pantallaEncendida, puedeMantenerPantalla } from './ficha.js';
import { entradasDe, inicioSemana, racionesFamilia, guardarAjustesFamilia, usosDeReceta, quitarRecetaDeMenus, leerFecha, esFechaISO } from './menus.js';
import { prepararMenu, pintarMenu, hoyISO } from './vista-menu.js';
import { prepararCompra, pintarCompra } from './vista-compra.js';
import { menuDelDia, construirHoy, cocinarDoble, textoCocinarDoble } from './hoy.js';
import { prepararTengo, pintarTengo } from './vista-tengo.js';
import { GRUPOS, LIMITE_MAX, limitesProteinas } from './equilibrio.js';

function mostrarEstado(texto, esError = false) {
  const nodo = $('#estado');
  nodo.textContent = texto;
  nodo.classList.toggle('error', esError);
}

/**
 * Vista según la dirección: «#receta/<id>» (ficha), «#menu» o «#menu/<fecha>» (semana de esa fecha)
 * y cualquier otra cosa, el listado de recetas.
 */
function vistaEnDireccion() {
  const ficha = location.hash.match(/^#receta\/([^/]+)(?:\/(\d{4}-\d{2}-\d{2})\/(comida|cena))?$/);
  if (ficha) return { tipo: 'receta', id: decodeURIComponent(ficha[1]), fecha: ficha[2] ?? null, hueco: ficha[3] ?? null };
  const menu = location.hash.match(/^#menu(?:\/(\d{4}-\d{2}-\d{2}))?$/);
  if (menu) return { tipo: 'menu', lunes: inicioSemana(menu[1] && esFechaISO(menu[1]) ? menu[1] : hoyISO()) };
  if (location.hash === '#compra') return { tipo: 'compra' };
  if (location.hash === '#tengo') return { tipo: 'tengo' };
  return { tipo: 'recetas' };
}
const idEnDireccion = () => (vistaEnDireccion().tipo === 'receta' ? vistaEnDireccion().id : null);

/** Dónde estaba cada vista al salir de ella, para volver al mismo sitio. */
const scrollPorVista = { recetas: 0, menu: 0, compra: 0, tengo: 0 };
let vistaAnterior = 'recetas';
/** Búsqueda y filtros del listado: duran mientras la app está abierta (también al ir y volver de una ficha). */
let filtros = filtrosVacios();
const verFoto = (img, ruta) => mostrarFoto(img, app.cliente, ruta);

function render() {
  // Con copia local se muestra al instante, aunque aún no haya respuesta de GitHub.
  const hayDatos = Boolean(app.cliente && app.almacen.fecha);
  const vista = vistaEnDireccion();
  const enFicha = hayDatos && vista.tipo === 'receta';
  const enMenu = hayDatos && vista.tipo === 'menu';
  const enCompra = hayDatos && vista.tipo === 'compra';
  const enTengo = hayDatos && vista.tipo === 'tengo';
  const otraVista = enFicha || enMenu || enCompra || enTengo;
  $('#pestanas').hidden = !hayDatos || enFicha;
  $('#recetario').hidden = !hayDatos || otraVista;
  $('#vista-menu').hidden = !enMenu;
  $('#vista-compra').hidden = !enCompra;
  $('#vista-tengo').hidden = !enTengo;
  $('#vista-ficha').hidden = !enFicha;
  $('#btn-nueva').hidden = !hayDatos || otraVista;
  $('#pestana-recetas').toggleAttribute('aria-current', !enMenu && !enCompra && !enTengo);
  $('#pestana-menu').toggleAttribute('aria-current', enMenu);
  $('#pestana-compra').toggleAttribute('aria-current', enCompra);
  $('#pestana-tengo').toggleAttribute('aria-current', enTengo);
  pantallaEncendida(enFicha);
  if (!hayDatos) return;
  const recetas = app.almacen.items('recetas');
  if (enFicha) return pintarFicha(recetas.find((r) => r.id === vista.id), vista);
  if (enMenu) return pintarMenu(vista.lunes);
  if (enCompra) return pintarCompra();
  if (enTengo) return pintarTengo();
  const hoy = hoyISO();
  $('#hoy').hidden = false;
  $('#hoy').replaceChildren(...construirHoy(menuDelDia(app.almacen.items('menus'), recetas, hoy), hoy));
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

/** Raciones y aviso de la ficha abierta desde un hueco del menú: las del hueco o, si se cocina para más días, la suma. */
function desdeElMenu(receta, { fecha, hueco }) {
  if (!receta || !fecha) return { raciones: null, avisoMenu: null };
  const menus = app.almacen.items('menus');
  const entrada = entradasDe(menus, fecha, hueco).find((e) => e.receta === receta.id);
  if (!entrada) return { raciones: null, avisoMenu: null };
  const doble = cocinarDoble(menus, fecha, hueco, receta.id);
  return doble
    ? { raciones: doble.raciones, avisoMenu: `🍲 ${textoCocinarDoble(doble, fecha)} (${doble.propias} para esta ${hueco} y ${doble.raciones - doble.propias} para después). Las cantidades ya están sumadas.` }
    : { raciones: entrada.raciones, avisoMenu: null };
}

function pintarFicha(receta, vista = {}) {
  const { raciones, avisoMenu } = desdeElMenu(receta, vista);
  fichaActual = receta ?? null;
  $('#ficha-editar').hidden = !receta;
  $('#ficha-borrar').hidden = !receta;
  // Si se actualiza desde GitHub y la receta no ha cambiado, no se redibuja: se conservan los pasos tachados.
  const clave = receta ? JSON.stringify([receta, raciones, avisoMenu]) : 'ninguna';
  if (clave === fichaPintada && !$('#vista-ficha').hidden) return;
  fichaPintada = clave;
  $('#ficha').replaceChildren(
    receta ? construirFicha(receta, { onPuntuar: puntuar, onNota: guardarNota, verFoto, raciones, avisoMenu }) : el('p', { class: 'vacio' }, 'No se encuentra esta receta. Puede que la hayan borrado desde otro dispositivo.'),
  );
  $('#ficha-pantalla').hidden = !(receta && puedeMantenerPantalla());
}

/** Al cambiar de vista: la ficha empieza arriba; la lista y el menú vuelven a donde estaban. */
function cambioDeVista() {
  if (vistaAnterior !== 'receta') scrollPorVista[vistaAnterior] = window.scrollY;
  render();
  const { tipo } = vistaEnDireccion();
  if (tipo !== 'receta') fichaPintada = null;
  $('#ficha-volver').textContent = { menu: '← Menú', tengo: '← Tengo' }[history.state?.desde] ?? '← Recetas';
  if (tipo !== vistaAnterior) window.scrollTo(0, tipo === 'receta' ? 0 : scrollPorVista[tipo]);
  vistaAnterior = tipo;
}

/** Volver con «atrás» si se llegó desde la lista o el menú; si se abrió la ficha directamente, ir a la lista. */
function volver() {
  if (history.state?.desde) history.back();
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
  $('#ajustes-familia').hidden = !(app.cliente && app.almacen.fecha);
  f.racionesFamilia.value = racionesFamilia(app.almacen.datos('ajustes'));
  pintarCategoriasMenu(categoriasFuera(app.almacen.datos('ajustes')));
  pintarLimites(limitesProteinas(app.almacen.datos('ajustes')));
  $('#dlg-ajustes').showModal();
}

/** Fichas de categorías: activas las que entran en el menú automático. */
function pintarCategoriasMenu(fuera) {
  const { categorias } = opcionesFiltro(app.almacen.items('recetas'));
  const estaFuera = (c) => fuera.some((x) => normalizar(x) === normalizar(c));
  $('#ajustes-categorias-menu').hidden = !categorias.length;
  $('#ajustes-categorias').replaceChildren(...categorias.map((c) =>
    el('button', {
      type: 'button', class: `ficha-filtro${estaFuera(c) ? '' : ' activa'}`, 'aria-pressed': String(!estaFuera(c)), 'data-categoria': c,
      onclick: () => pintarCategoriasMenu(estaFuera(c) ? fuera.filter((x) => normalizar(x) !== normalizar(c)) : [...fuera, c]),
    }, c)));
}

/** Un campo por grupo del marcador: «Carne ≤ [4]», «Pescado ≥ [3]»… */
function pintarLimites(limites) {
  $('#ajustes-limites').replaceChildren(...GRUPOS.map((g) => el('label', { class: g.dentroDe ? 'sub' : '' },
    `${g.dentroDe ? `${g.dentroDe === 'carne' ? 'Carne' : 'Pescado'} ${g.nombre}` : g.nombre} ${g.tipo === 'max' ? '≤' : '≥'}`,
    el('input', { type: 'number', min: 0, max: LIMITE_MAX, step: 1, inputmode: 'numeric', 'data-limite': g.id, value: String(limites[g.id]) }))));
}

/** Límites del formulario, o null si alguno no es válido. */
function leerLimites() {
  const limites = {};
  for (const campo of $('#ajustes-limites').querySelectorAll('input')) {
    const n = Number(campo.value);
    if (campo.value === '' || !Number.isInteger(n) || n < 0 || n > LIMITE_MAX) return null;
    limites[campo.dataset.limite] = n;
  }
  return limites;
}

const leerCategoriasFuera = () => [...$('#ajustes-categorias').querySelectorAll('[aria-pressed="false"]')].map((b) => b.dataset.categoria);

async function guardarAjustes(evento) {
  evento.preventDefault();
  const f = evento.target;
  const error = $('#ajustes-error');
  const repo = normalizarRepo(f.repo.value);
  const nueva = { nombre: limpiar(f.nombre.value), repo, token: f.token.value.trim() };
  if (!nueva.nombre || !nueva.token) return void (error.textContent = 'Rellena tu nombre y el token.');
  if (!repo) return void (error.textContent = 'El repositorio debe tener la forma usuario/nombre.');
  const limites = $('#ajustes-familia').hidden ? null : leerLimites();
  if (!$('#ajustes-familia').hidden && !limites) return void (error.textContent = `Los límites del equilibrio semanal van de 0 a ${LIMITE_MAX}.`);

  const listo = ocupado($('#ajustes-guardar'), 'Comprobando…');
  error.textContent = '';
  try {
    const cliente = crearCliente(nueva);
    await app.almacen.recargar(cliente);
    // Ajustes de la familia: compartidos en ajustes.json, solo los que se han cambiado.
    if (!$('#ajustes-familia').hidden) {
      const actuales = app.almacen.datos('ajustes');
      const cambios = {};
      const raciones = Number(f.racionesFamilia.value);
      if (raciones !== racionesFamilia(actuales)) cambios.racionesFamilia = raciones;
      // Las categorías que ya no existen se conservan: si vuelve a haber recetas suyas, siguen fuera.
      const visibles = new Set(opcionesFiltro(app.almacen.items('recetas')).categorias.map(normalizar));
      const fuera = [...categoriasFuera(actuales).filter((c) => !visibles.has(normalizar(c))), ...leerCategoriasFuera()];
      if (JSON.stringify([...fuera].sort()) !== JSON.stringify([...categoriasFuera(actuales)].sort())) cambios.categoriasFueraDelMenu = fuera;
      if (JSON.stringify(limites) !== JSON.stringify(limitesProteinas(actuales))) cambios.limitesProteinas = limites;
      if (Object.keys(cambios).length) app.almacen.fijar('ajustes', await guardarAjustesFamilia(cliente, cambios, nueva.nombre));
    }
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
  const usos = usosDeReceta(app.almacen.items('menus'), receta.id);
  const enMenu = usos.length
    ? `\n\nEstá en el menú (se quitará de ahí):\n${usos.slice(0, 6).map((u) => `· ${leerFecha(u.fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}, ${u.hueco}`).join('\n')}${usos.length > 6 ? `\n· y ${usos.length - 6} más` : ''}`
    : '';
  if (!confirm(`¿Borrar «${receta.titulo}»?\nSe borra en todos los dispositivos y no se puede deshacer.${enMenu}`)) return;
  const listo = ocupado($('#ficha-borrar'), 'Borrando…');
  try {
    const { datos } = await borrarReceta(app.cliente, receta, app.config.nombre);
    app.almacen.fijar('recetas', datos);
    if (usos.length) app.almacen.fijar('menus', await quitarRecetaDeMenus(app.cliente, receta, app.config.nombre));
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
  // Marca las fichas abiertas desde la lista o el menú, para que «←» equivalga al botón atrás.
  for (const [contenedor, desde] of [['#listado', 'recetas'], ['#hoy', 'recetas'], ['#vista-menu', 'menu'], ['#vista-tengo', 'tengo']]) {
    $(contenedor).addEventListener('click', (e) => {
      const enlace = e.target.closest('a[href^="#receta/"]');
      if (!enlace) return;
      e.preventDefault();
      history.pushState({ desde }, '', enlace.getAttribute('href'));
      cambioDeVista();
    });
  }
  prepararMenu(app, render);
  prepararCompra(app, render);
  prepararTengo(app);

  window.addEventListener('online', recargar);
  window.addEventListener('offline', () => mostrarEstado('Sin conexión. Puedes consultar, pero no guardar cambios.'));

  vistaAnterior = vistaEnDireccion().tipo;
  render();
  if (app.cliente) recargar();
  else abrirAjustes();
}

iniciar();
