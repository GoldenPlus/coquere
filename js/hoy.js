// Tarjeta «Hoy» encima del listado: la comida y la cena del menú de hoy.

import { HUECOS, ESPECIALES, entradasDe, especialDe, esEspecial, sumarDias, leerFecha } from './menus.js';
import { el } from './dom.js';

const NOMBRE_HUECO = { comida: 'Comida', cena: 'Cena' };
const ICONO_ESPECIAL = { fuera: '🍴', libre: '🎲' };

/** Días después de un plato en los que, si vuelve a salir, se avisa de cocinar el doble. */
export const DIAS_COCINAR_DOBLE = 3;

/** Enlace a la ficha desde un hueco del menú: «#receta/<id>/<fecha>/<hueco>» (la ficha toma sus raciones). */
export const enlaceReceta = (id, fecha, hueco) => `#receta/${encodeURIComponent(id)}${fecha ? `/${fecha}/${hueco}` : ''}`;

const orden = (e) => `${e.fecha}|${HUECOS.indexOf(e.hueco)}`;

/**
 * Si la receta de este hueco vuelve a estar en el menú en los DIAS_COCINAR_DOBLE días siguientes, y no
 * se cocinó ya en los anteriores, se cocina todo a la vez: { raciones (suma), propias, otras: [{ fecha, hueco, raciones }] }.
 * Si no, null.
 */
export function cocinarDoble(menus, fecha, hueco, idReceta) {
  const usos = menus.filter((e) => e.receta === idReceta && !esEspecial(e)).sort((a, b) => orden(a).localeCompare(orden(b)));
  const i = usos.findIndex((e) => e.fecha === fecha && e.hueco === hueco);
  if (i < 0) return null;
  const este = usos[i];
  const desde = sumarDias(fecha, -DIAS_COCINAR_DOBLE);
  if (usos.slice(0, i).some((e) => e.fecha >= desde)) return null;
  const hasta = sumarDias(fecha, DIAS_COCINAR_DOBLE);
  const otras = usos.slice(i + 1).filter((e) => e.fecha <= hasta).map(({ fecha: f, hueco: h, raciones }) => ({ fecha: f, hueco: h, raciones }));
  if (!otras.length) return null;
  return { raciones: este.raciones + otras.reduce((s, e) => s + e.raciones, 0), propias: este.raciones, otras };
}

/** «También para el jueves: cocina 8 raciones» (o «para la cena», si es el mismo día). */
export function textoCocinarDoble(doble, fecha) {
  const cuando = doble.otras.map((o) => (o.fecha === fecha
    ? `la ${o.hueco}`
    : `el ${leerFecha(o.fecha).toLocaleDateString('es-ES', { weekday: 'long' })}${o.hueco === 'cena' ? ' en la cena' : ''}`));
  const lista = cuando.length > 1 ? `${cuando.slice(0, -1).join(', ')} y ${cuando.at(-1)}` : cuando[0];
  return `También para ${lista}: cocina ${doble.raciones} raciones`;
}

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
      .map((e) => ({ receta: porId.get(e.receta), raciones: e.raciones, doble: cocinarDoble(menus, fecha, hueco, e.receta) }));
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
            ? platos.map(({ receta, raciones, doble }) => el('div', { class: 'hoy-plato' },
                el('a', { class: 'hueco-receta', href: enlaceReceta(receta.id, fecha, hueco) }, receta.titulo,
                  el('span', { class: 'hoy-raciones' }, ` · ${raciones === 1 ? '1 ración' : `${raciones} raciones`}`)),
                doble && el('span', { class: 'cocinar-doble' }, `🍲 ${textoCocinarDoble(doble, fecha)}`)))
            : el('a', { class: 'hoy-sin', href: `#menu/${fecha}` }, 'Sin planificar'),
      ),
    )),
  ];
}
