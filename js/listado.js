// Listado de recetas de la pantalla principal.

import { compararTitulos } from './texto.js';
import { el } from './dom.js';
import { rutaMini } from './fotos.js';

export const NOMBRES_DIFICULTAD = { 1: 'Muy fácil', 2: 'Fácil', 3: 'Media', 4: 'Difícil', 5: 'Muy difícil' };

/** 40 → «40 min», 75 → «1 h 15 min», 120 → «2 h». */
export function formatearTiempo(minutos) {
  if (!Number.isInteger(minutos) || minutos <= 0) return '';
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** 4 → «★★★★☆»; sin puntuar, ''. */
export function estrellas(puntuacion) {
  if (!Number.isInteger(puntuacion) || puntuacion < 1 || puntuacion > 5) return '';
  return '★'.repeat(puntuacion) + '☆'.repeat(5 - puntuacion);
}

/** Lo que se muestra de cada receta, ordenado por título (sin distinguir tildes ni mayúsculas). */
export function filasListado(recetas) {
  return [...recetas]
    .sort((a, b) => compararTitulos(a.titulo, b.titulo))
    .map((r) => ({
      id: r.id,
      titulo: r.titulo,
      categoria: (r.categorias ?? []).join(', '),
      tiempo: formatearTiempo(r.tiempo),
      dificultad: NOMBRES_DIFICULTAD[r.dificultad] ?? '',
      estrellas: estrellas(r.puntuacion),
      puntuacion: r.puntuacion,
      foto: r.foto ?? null,
    }));
}

function tarjeta(f, verFoto) {
  let mini = el('span', { class: 'miniatura vacia', 'aria-hidden': 'true' }, '🍽');
  if (f.foto && verFoto) {
    mini = el('img', { class: 'miniatura', alt: '', loading: 'lazy' });
    verFoto(mini, rutaMini(f.foto));
  }
  const datos = [f.tiempo && `⏱ ${f.tiempo}`, f.dificultad].filter(Boolean).join(' · ');
  const cabeza = el(
    'div',
    { class: 'receta-cabeza' },
    el('h3', {}, f.titulo),
    f.estrellas && el('span', { class: 'estrellas', title: `${f.puntuacion} de 5`, 'aria-label': `Puntuación: ${f.puntuacion} de 5` }, f.estrellas),
  );
  const resumen = (f.categoria || datos) &&
    el('p', { class: 'receta-datos' }, f.categoria && el('span', { class: 'categoria' }, f.categoria), datos && el('span', {}, datos));
  return el('li', { class: 'receta' }, el('a', { href: `#receta/${encodeURIComponent(f.id)}`, class: 'receta-enlace' }, mini, el('div', { class: 'receta-texto' }, cabeza, resumen)));
}

/** Pinta el listado en `contenedor`; sin recetas, una invitación a crear la primera. `verFoto(img, ruta)` carga miniaturas. */
export function pintarListado(contenedor, recetas, verFoto) {
  const filas = filasListado(recetas);
  contenedor.replaceChildren(
    filas.length
      ? el('ul', { class: 'lista-recetas' }, filas.map((f) => tarjeta(f, verFoto)))
      : el('p', { class: 'vacio' }, 'Aún no hay recetas. Pulsa «＋ Nueva receta» para crear la primera.'),
  );
}
