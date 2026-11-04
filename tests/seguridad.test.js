// Comprobaciones de seguridad del código: el token solo puede ir a la API de GitHub
// y ningún texto de las recetas puede acabar interpretado como HTML.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const RAIZ = new URL('..', import.meta.url);
const leer = (ruta) => readFileSync(new URL(ruta, RAIZ), 'utf8');
const html = leer('index.html');

test('index.html tiene CSP que solo deja conectar con la API de GitHub', () => {
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
  assert.ok(csp, 'falta la CSP');
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /connect-src https:\/\/api\.github\.com(;|$)/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
});

test('la CSP va antes que cualquier script', () => {
  assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('<script'));
});

test('el código no usa formas de insertar HTML ni de ejecutar texto como código', () => {
  const prohibido = /\.innerHTML|\.outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function\(/;
  for (const f of readdirSync(new URL('js/', RAIZ))) {
    assert.doesNotMatch(leer(`js/${f}`), prohibido, `js/${f}`);
  }
});

test('no hay scripts externos ni manejadores en línea en index.html', () => {
  assert.doesNotMatch(html, /<script[^>]+src="https?:/);
  assert.doesNotMatch(html, /\son[a-z]+="/);
});
