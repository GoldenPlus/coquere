// Vista «Tengo»: apuntas lo que tienes y salen las recetas que más lo aprovechan, con lo que falta.

import { recetasConLoQueTengo, conIngrediente } from './tengo.js';
import { indiceIngredientes, sugerirIngredientes } from './ingredientes.js';
import { $, el } from './dom.js';

let app = null;
/** Lo que tengo: dura mientras la app está abierta. */
let tengo = [];

function pintarSugerencias() {
  const input = $('#tengo-anadir').texto;
  const ultimo = input.value.split(',').at(-1);
  const lista = sugerirIngredientes(indiceIngredientes(app.almacen.items('recetas')), ultimo, 5);
  $('#tengo-sugerencias').replaceChildren(...(lista.length ? [
    el('span', { class: 'ayuda' }, 'En tus recetas:'),
    ...lista.map((s) => el('button', {
      type: 'button', class: 'sugerencia',
      onpointerdown: (e) => e.preventDefault(),
      onclick: () => anadir([...input.value.split(',').slice(0, -1), s.nombre]),
    }, s.nombre)),
  ] : []));
}

function anadir(nombres) {
  for (const n of nombres) tengo = conIngrediente(tengo, n);
  const input = $('#tengo-anadir').texto;
  input.value = '';
  input.focus();
  pintarTengo();
}

function resultado({ receta, usa, faltan }) {
  return el('li', { class: 'tengo-receta' },
    el('a', { class: 'hueco-receta', href: `#receta/${encodeURIComponent(receta.id)}` }, receta.titulo),
    el('span', { class: 'tengo-usa' }, `Usa: ${usa.join(', ')}`),
    faltan.length
      ? el('span', { class: 'tengo-falta' }, `Te falta: ${faltan.join(', ')}`)
      : el('span', { class: 'tengo-todo' }, '✓ Tienes todo'));
}

export function pintarTengo() {
  $('#tengo-fichas').replaceChildren(...tengo.map((t) => el('button', {
    type: 'button', class: 'ficha-filtro activa', 'aria-label': `Quitar ${t}`, title: 'Quitar',
    onclick: () => { tengo = tengo.filter((x) => x !== t); pintarTengo(); },
  }, `${t} ✕`)));
  $('#tengo-vaciar').hidden = tengo.length < 2;
  const lista = recetasConLoQueTengo(app.almacen.items('recetas'), tengo);
  $('#tengo-resultados').replaceChildren(...lista.map(resultado));
  $('#tengo-resumen').textContent = !tengo.length
    ? 'Añade lo que tienes en la nevera o la despensa, uno a uno o separado por comas.'
    : lista.length
      ? `${lista.length === 1 ? '1 receta lo aprovecha' : `${lista.length} recetas lo aprovechan`}; primero las que usan más.`
      : 'Ninguna receta lleva esto.';
  pintarSugerencias();
}

export function prepararTengo(estadoApp) {
  app = estadoApp;
  const form = $('#tengo-anadir');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.texto.value.trim()) return form.texto.focus();
    anadir(form.texto.value.split(','));
  });
  form.texto.addEventListener('input', pintarSugerencias);
  $('#tengo-vaciar').addEventListener('click', () => { tengo = []; pintarTengo(); });
}
