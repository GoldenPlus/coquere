// Listado de recetas de la pantalla principal.

import { compararTitulos } from './texto.js';
import { el } from './dom.js';

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
    }));
}

function tarjeta(f) {
  const datos = [f.tiempo && `⏱ ${f.tiempo}`, f.dificultad].filter(Boolean).join(' · ');
  return el(
    'li',
    { class: 'receta', 'data-id': f.id },
    el(
      'div',
      { class: 'receta-cabeza' },
      el('h3', {}, f.titulo),
      f.estrellas && el('span', { class: 'estrellas', title: `${f.puntuacion} de 5`, 'aria-label': `Puntuación: ${f.puntuacion} de 5` }, f.estrellas),
    ),
    (f.categoria || datos) &&
      el('p', { class: 'receta-datos' }, f.categoria && el('span', { class: 'categoria' }, f.categoria), datos && el('span', {}, datos)),
  );
}

/** Pinta el listado en `contenedor`; sin recetas, una invitación a crear la primera. */
export function pintarListado(contenedor, recetas) {
  const filas = filasListado(recetas);
  contenedor.replaceChildren(
    filas.length
      ? el('ul', { class: 'lista-recetas' }, filas.map(tarjeta))
      : el('p', { class: 'vacio' }, 'Aún no hay recetas. Pulsa «＋ Nueva receta» para crear la primera.'),
  );
}
