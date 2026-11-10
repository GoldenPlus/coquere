// Tarjeta «Hoy» encima del listado: la comida y la cena del menú de hoy.

import { HUECOS, ESPECIALES, entradasDe, especialDe, esEspecial } from './menus.js';
import { el } from './dom.js';

const NOMBRE_HUECO = { comida: 'Comida', cena: 'Cena' };
const ICONO_ESPECIAL = { fuera: '🍴', libre: '🎲' };

/** Enlace a la ficha con las raciones del menú: «#receta/<id>/<raciones>». */
export const enlaceReceta = (id, raciones) => `#receta/${encodeURIComponent(id)}${raciones ? `/${raciones}` : ''}`;

/**
 * Lo planificado para una fecha, por hueco: { hueco, especial, platos: [{ receta, raciones }] }.
 * `especial` es { especial, nota } o null; las recetas borradas no salen.
 */
export function menuDelDia(menus, recetas, fecha) {
  const porId = new Map(recetas.map((r) => [r.id, r]));
  return HUECOS.map((hueco) => {
    const especial = especialDe(menus, fecha, hueco);
    const platos = especial ? [] : entradasDe(menus, fecha, hueco)
      .filter((e) => !esEspecial(e) && porId.has(e.receta))
      .map((e) => ({ receta: porId.get(e.receta), raciones: e.raciones }));
    return { hueco, especial: especial && { especial: especial.especial, nota: especial.nota ?? '' }, platos };
  });
}

/** Contenido de la tarjeta. */
export function construirHoy(dia, fecha) {
  const nada = dia.every((h) => !h.especial && !h.platos.length);
  const titulo = el('h2', {}, 'Hoy');
  if (nada) {
    return [titulo, el('p', { class: 'hoy-vacio' }, 'Sin planificar. ', el('a', { href: `#menu/${fecha}` }, 'Ir al menú'))];
  }
  return [
    titulo,
    ...dia.map(({ hueco, especial, platos }) => el(
      'div',
      { class: 'hoy-hueco' },
      el('span', { class: 'hueco-nombre' }, NOMBRE_HUECO[hueco]),
      el('div', { class: 'hoy-platos' },
        especial
          ? [el('span', { class: 'hueco-especial' }, `${ICONO_ESPECIAL[especial.especial] ?? ''} ${ESPECIALES[especial.especial] ?? especial.especial}`.trim()),
             especial.nota && el('span', { class: 'hueco-nota' }, especial.nota)]
          : platos.length
            ? platos.map(({ receta, raciones }) => el('a', { class: 'hueco-receta', href: enlaceReceta(receta.id, raciones) }, receta.titulo,
                el('span', { class: 'hoy-raciones' }, ` · ${raciones === 1 ? '1 ración' : `${raciones} raciones`}`)))
            : el('a', { class: 'hoy-sin', href: `#menu/${fecha}` }, 'Sin planificar'),
      ),
    )),
  ];
}
