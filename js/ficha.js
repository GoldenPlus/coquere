// Ficha de una receta: pensada para leerla en el móvil mientras se cocina.

import { UNIDADES } from './receta.js';
import { NOMBRES_DIFICULTAD, formatearTiempo, estrellas } from './listado.js';
import { el, fechaLegible } from './dom.js';

const FRACCIONES = { 0.25: '¼', 0.5: '½', 0.75: '¾', [1 / 3]: '⅓', [2 / 3]: '⅔', 0.125: '⅛' };

/** 0.5 → «½», 1.5 → «1 ½», 2.25 → «2 ¼», 0.3 → «0,3», 1.333… → «1 ⅓». */
export function formatearCantidad(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '';
  const entera = Math.floor(n + 1e-9);
  const resto = n - entera;
  if (resto < 1e-6) return String(entera);
  for (const [valor, simbolo] of Object.entries(FRACCIONES)) {
    if (Math.abs(resto - Number(valor)) < 0.01) return entera ? `${entera} ${simbolo}` : simbolo;
  }
  return n.toLocaleString('es-ES', { maximumFractionDigits: 2 });
}

/** Unidades de recuento que se escriben en plural con más de una: «2 dientes». */
const CON_PLURAL = new Set(['diente', 'rodaja', 'loncha', 'lata', 'sobre', 'manojo', 'ramita', 'pizca', 'chorro', 'taza', 'vaso']);
const FEMENINAS = new Set(['rodaja', 'loncha', 'lata', 'ramita', 'pizca', 'taza']);

/**
 * Texto de un ingrediente: { cantidad: «750 g de», nombre: «patata», detalle: «nueva» }.
 * Con «unidad» solo va el número («6» huevos); con «al gusto», detrás («sal, al gusto»).
 * Sin cantidad: «una pizca de sal», o solo el nombre si la unidad es de peso o volumen.
 */
export function textoIngrediente(i) {
  const unidad = UNIDADES[i.unidad];
  if (unidad?.sinCantidad) return { cantidad: '', nombre: i.nombre, detalle: [i.detalle, 'al gusto'].filter(Boolean).join(', ') };
  const numero = formatearCantidad(i.cantidad);
  let palabra = '';
  if (i.unidad !== 'unidad' && (numero || CON_PLURAL.has(i.unidad))) {
    palabra = i.unidad + (CON_PLURAL.has(i.unidad) && i.cantidad > 1 ? 's' : '');
    if (!numero) palabra = `${FEMENINAS.has(i.unidad) ? 'una' : 'un'} ${palabra}`;
    palabra += ' de';
  }
  return { cantidad: [numero, palabra].filter(Boolean).join(' '), nombre: i.nombre, detalle: i.detalle };
}

function seccion(titulo, ...contenido) {
  return el('section', { class: 'ficha-seccion' }, el('h3', {}, titulo), ...contenido);
}

/** Cinco estrellas que se tocan para puntuar. */
function puntuador(r, onPuntuar) {
  const estrellasBotones = [1, 2, 3, 4, 5].map((n) =>
    el('button', {
      type: 'button',
      class: `estrella${r.puntuacion >= n ? ' llena' : ''}`,
      'aria-label': `Puntuar con ${n} de 5`,
      'aria-pressed': String(r.puntuacion === n),
      onclick: (e) => onPuntuar(n, e.currentTarget.parentElement),
    }, r.puntuacion >= n ? '★' : '☆'),
  );
  return el(
    'div',
    { class: 'puntuador', role: 'group', 'aria-label': 'Puntuación' },
    estrellasBotones,
    el('span', { class: 'ayuda' }, r.puntuacion ? `${r.puntuacion} de 5` : 'Sin puntuar: toca una estrella'),
  );
}

/** Notas de la más reciente a la más antigua. */
export const notasOrdenadas = (notas) => [...notas].sort((a, b) => b.fecha.localeCompare(a.fecha));

function seccionNotas(r, onNota) {
  if (!onNota && !r.notas.length) return null;
  let formulario = null;
  if (onNota) {
    const texto = el('textarea', { rows: 2, placeholder: 'Por ejemplo: la última vez le faltó sal', 'aria-label': 'Nueva nota' });
    const boton = el('button', { type: 'submit' }, 'Añadir nota');
    formulario = el('form', { class: 'nueva-nota', onsubmit: (e) => (e.preventDefault(), onNota(texto, boton)) }, texto, boton);
  }
  return seccion(
    'Notas',
    formulario,
    r.notas.length
      ? el('ul', { class: 'notas' }, notasOrdenadas(r.notas).map((n) =>
          el('li', {}, el('p', {}, n.texto), el('p', { class: 'ayuda' }, `${n.autor} · ${fechaLegible(n.fecha)}`)),
        ))
      : el('p', { class: 'ayuda' }, 'Aún no hay notas.'),
  );
}

/**
 * Construye la ficha completa (sin la barra de volver, que pone main.js).
 * `onPuntuar(n, grupo)` y `onNota(textarea, boton)` guardan; sin ellos la ficha es de solo lectura.
 * `verFoto(img, ruta)` carga la foto del repo privado.
 */
export function construirFicha(r, { onPuntuar, onNota, verFoto } = {}) {
  let foto = null;
  if (r.foto && verFoto) {
    foto = el('img', { class: 'ficha-foto', alt: `Foto: ${r.titulo}` });
    verFoto(foto, r.foto);
  }
  const datos = [
    ['Raciones', String(r.raciones)],
    ['Tiempo', formatearTiempo(r.tiempo)],
    ['Dificultad', NOMBRES_DIFICULTAD[r.dificultad] ?? ''],
  ].filter(([, v]) => v);
  const chips = [...r.categorias.map((c) => ['categoria', c]), ...r.etiquetas.map((e) => ['etiqueta', e])];

  return el(
    'article',
    { class: 'ficha' },
    foto,
    el('h2', {}, r.titulo),
    onPuntuar
      ? puntuador(r, onPuntuar)
      : r.puntuacion && el('p', { class: 'estrellas grande', 'aria-label': `Puntuación: ${r.puntuacion} de 5` }, estrellas(r.puntuacion)),
    chips.length > 0 && el('ul', { class: 'chips' }, chips.map(([tipo, t]) => el('li', { class: tipo }, t))),
    datos.length > 0 && el('dl', { class: 'ficha-datos' }, datos.map(([k, v]) => el('div', {}, el('dt', {}, k), el('dd', {}, v)))),
    seccion(
      'Ingredientes',
      r.ingredientes.length
        ? el('ul', { class: 'ingredientes' }, r.ingredientes.map((i) => {
            const t = textoIngrediente(i);
            return el('li', {}, t.cantidad && el('strong', {}, `${t.cantidad} `), t.nombre, t.detalle && el('span', { class: 'detalle' }, `, ${t.detalle}`));
          }))
        : el('p', { class: 'ayuda' }, 'Sin ingredientes.'),
    ),
    seccion(
      'Pasos',
      r.pasos.length
        ? [
            el('p', { class: 'ayuda' }, 'Toca un paso para tacharlo cuando lo termines.'),
            el('ol', { class: 'pasos-ficha' }, r.pasos.map((p) =>
              el('li', { tabindex: 0, role: 'button', 'aria-pressed': 'false', onclick: tachar, onkeydown: (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), tachar(e)) }, p),
            )),
          ]
        : el('p', { class: 'ayuda' }, 'Sin pasos.'),
    ),
    seccionNotas(r, onNota),
  );
}

function tachar(evento) {
  const li = evento.currentTarget;
  li.setAttribute('aria-pressed', String(li.classList.toggle('hecho')));
}

// ---------- Pantalla encendida mientras la ficha está abierta (si el navegador lo permite)

let bloqueo = null;
let quiereBloqueo = false;

async function pedirBloqueo() {
  if (!quiereBloqueo || bloqueo || !navigator.wakeLock || document.visibilityState !== 'visible') return;
  try {
    bloqueo = await navigator.wakeLock.request('screen');
    bloqueo.addEventListener('release', () => (bloqueo = null));
  } catch {
    // Sin permiso (batería baja, navegador antiguo…): la ficha funciona igual.
  }
}

// Al volver a la app el navegador suelta el bloqueo; se pide de nuevo.
globalThis.document?.addEventListener('visibilitychange', pedirBloqueo);

export function pantallaEncendida(si) {
  quiereBloqueo = si;
  if (si) pedirBloqueo();
  else bloqueo?.release().catch(() => {});
}

export const puedeMantenerPantalla = () => Boolean(globalThis.navigator?.wakeLock);
