// Búsqueda y filtros del listado de recetas.

import { normalizar, compararTitulos } from './texto.js';
import { NOMBRES_DIFICULTAD, formatearTiempo } from './listado.js';
import { el } from './dom.js';

export const filtrosVacios = () => ({ texto: '', categoria: null, etiquetas: [], puntuacionMin: null, dificultadMax: null, tiempoMax: null });

export const TIEMPOS = [15, 30, 45, 60, 90];

/** Cuántos filtros hay puestos (la búsqueda no cuenta: se ve en su caja). */
export function filtrosActivos(f) {
  return [f.categoria, f.puntuacionMin, f.dificultadMax, f.tiempoMax].filter((v) => v !== null).length + f.etiquetas.length;
}

const clave = (t) => normalizar(t);

/**
 * Recetas que cumplen búsqueda y filtros. Cada palabra buscada debe aparecer en el título o en algún
 * ingrediente. Una receta sin tiempo, dificultad o puntuación no pasa el filtro correspondiente.
 */
export function filtrarRecetas(recetas, f) {
  const palabras = normalizar(f.texto).split(' ').filter(Boolean);
  const etiquetas = f.etiquetas.map(clave);
  return recetas.filter((r) => {
    if (palabras.length) {
      const donde = normalizar([r.titulo, ...r.ingredientes.map((i) => i.nombre)].join(' '));
      if (!palabras.every((p) => donde.includes(p))) return false;
    }
    if (f.categoria !== null && !r.categorias.some((c) => clave(c) === clave(f.categoria))) return false;
    if (etiquetas.length) {
      const suyas = r.etiquetas.map(clave);
      if (!etiquetas.every((e) => suyas.includes(e))) return false;
    }
    if (f.puntuacionMin !== null && !(r.puntuacion >= f.puntuacionMin)) return false;
    if (f.dificultadMax !== null && !(r.dificultad !== null && r.dificultad <= f.dificultadMax)) return false;
    if (f.tiempoMax !== null && !(r.tiempo !== null && r.tiempo > 0 && r.tiempo <= f.tiempoMax)) return false;
    return true;
  });
}

/** Categorías y etiquetas que existen, sin repetir (sin distinguir tildes ni mayúsculas) y por orden alfabético. */
export function opcionesFiltro(recetas) {
  const juntar = (listas) => {
    const vistas = new Map();
    for (const t of listas.flat()) if (!vistas.has(clave(t))) vistas.set(clave(t), t);
    return [...vistas.values()].sort(compararTitulos);
  };
  return { categorias: juntar(recetas.map((r) => r.categorias)), etiquetas: juntar(recetas.map((r) => r.etiquetas)) };
}

// ---------- Panel

function ficha(texto, activa, alTocar) {
  return el('button', { type: 'button', class: `ficha-filtro${activa ? ' activa' : ''}`, 'aria-pressed': String(activa), onclick: alTocar }, texto);
}

function grupo(titulo, fichas) {
  return fichas.length ? el('div', { class: 'grupo-filtro' }, el('h3', {}, titulo), el('div', { class: 'fichas' }, fichas)) : null;
}

/** Ficha de elección única: tocar la activa la quita. */
const unica = (f, campo, valor, cambiar) => () => cambiar({ ...f, [campo]: f[campo] === valor ? null : valor });

/** Contenido del panel de filtros. `cambiar(nuevos)` se llama con los filtros nuevos en cada toque. */
export function construirPanel(recetas, f, cambiar) {
  const { categorias, etiquetas } = opcionesFiltro(recetas);
  const conEtiqueta = (e) => f.etiquetas.some((x) => clave(x) === clave(e));
  return [
    grupo('Categoría', categorias.map((c) => ficha(c, f.categoria !== null && clave(f.categoria) === clave(c), unica(f, 'categoria', c, cambiar)))),
    grupo('Etiquetas', etiquetas.map((e) => ficha(e, conEtiqueta(e), () =>
      cambiar({ ...f, etiquetas: conEtiqueta(e) ? f.etiquetas.filter((x) => clave(x) !== clave(e)) : [...f.etiquetas, e] }),
    ))),
    grupo('Tiempo', TIEMPOS.map((t) => ficha(`≤ ${formatearTiempo(t)}`, f.tiempoMax === t, unica(f, 'tiempoMax', t, cambiar)))),
    grupo('Dificultad', [1, 2, 3, 4].map((d) => ficha(d === 1 ? NOMBRES_DIFICULTAD[1] : `Hasta ${NOMBRES_DIFICULTAD[d].toLowerCase()}`, f.dificultadMax === d, unica(f, 'dificultadMax', d, cambiar)))),
    grupo('Puntuación', [3, 4, 5].map((p) => ficha(p === 5 ? '★★★★★' : `${'★'.repeat(p)} o más`, f.puntuacionMin === p, unica(f, 'puntuacionMin', p, cambiar)))),
  ];
}
