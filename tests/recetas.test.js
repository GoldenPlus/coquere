import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { crearCliente, codificarBase64, decodificarBase64 } from '../js/github.js';
import { nuevaReceta } from '../js/receta.js';
import { crearReceta, textoALista, RecetaInvalidaError } from '../js/recetas.js';

globalThis.crypto ??= webcrypto; // Node 18 no lo trae global; el navegador sí.

/** recetas.json simulado en GitHub. `otroGuarda` mete una receta de otro dispositivo justo antes de la primera escritura. */
function github({ items = [], otroGuarda } = {}) {
  let sha = 1;
  let datos = items.length ? { version: 1, items } : null;
  const mensajes = [];
  const res = (status, cuerpo) => ({ ok: status < 300, status, json: async () => cuerpo });
  const fetch = async (url, op = {}) => {
    if (!url.endsWith('/contents/recetas.json')) return res(200, {});
    if (!op.method) return datos ? res(200, { sha: `s${sha}`, encoding: 'base64', content: codificarBase64(JSON.stringify(datos)) }) : res(404, {});
    if (otroGuarda) {
      datos = { version: 1, items: [...(datos?.items ?? []), otroGuarda] };
      sha++;
      otroGuarda = null;
    }
    const cuerpo = JSON.parse(op.body);
    if ((cuerpo.sha ?? null) !== (datos ? `s${sha}` : null)) return res(datos && !cuerpo.sha ? 422 : 409, {});
    datos = JSON.parse(decodificarBase64(cuerpo.content));
    sha++;
    mensajes.push(cuerpo.message);
    return res(201, { content: { sha: `s${sha}` } });
  };
  return { cliente: crearCliente({ token: 't', repo: 'a/coquere-datos', fetch }), mensajes, get datos() { return datos; } };
}

const borrador = (titulo = 'Lentejas') => ({
  ...nuevaReceta(),
  titulo,
  raciones: '4',
  ingredientes: [
    { cantidad: '300', unidad: 'g', nombre: 'lentejas', detalle: 'pardinas' },
    { cantidad: '', unidad: 'g', nombre: '', detalle: '' },
  ],
  pasos: ['Remojar', ''],
});

test('textoALista separa por comas y quita huecos', () => {
  assert.deepEqual(textoALista(' Postres, rápida ,, Fácil '), ['Postres', 'rápida', 'Fácil']);
  assert.deepEqual(textoALista(''), []);
});

test('la primera receta crea recetas.json, ya limpia y con mensaje de commit', async () => {
  const gh = github();
  const { datos, receta } = await crearReceta(gh.cliente, borrador(), 'Ana');
  assert.equal(gh.datos.items.length, 1);
  assert.deepEqual(datos, gh.datos);
  assert.equal(receta.raciones, 4);
  assert.equal(receta.ingredientes.length, 1);
  assert.deepEqual(receta.pasos, ['Remojar']);
  assert.deepEqual(gh.mensajes, ['Alta: Lentejas (por Ana)']);
});

test('si otro dispositivo guarda a la vez, se conservan las dos recetas', async () => {
  const otra = { ...borrador('Paella'), raciones: 4, ingredientes: [], pasos: [] };
  const gh = github({ items: [{ ...borrador('Gazpacho'), raciones: 4 }], otroGuarda: otra });
  const { datos } = await crearReceta(gh.cliente, borrador(), 'Ana');
  assert.deepEqual(datos.items.map((r) => r.titulo), ['Gazpacho', 'Paella', 'Lentejas']);
  assert.deepEqual(gh.datos, datos);
});

test('una receta inválida no se envía y devuelve todos los problemas', async () => {
  const gh = github();
  const mala = { ...borrador(''), raciones: '0', ingredientes: [{ cantidad: 'mucho', unidad: 'g', nombre: 'sal' }] };
  await assert.rejects(crearReceta(gh.cliente, mala, 'Ana'), (e) => {
    assert.ok(e instanceof RecetaInvalidaError);
    assert.deepEqual(e.errores, [
      'Falta el título.',
      'Las raciones deben ser un número entero mayor que cero.',
      'Ingrediente 1 (sal): la cantidad debe ser un número mayor que cero (vale 1,5 o 1/2).',
    ]);
    return true;
  });
  assert.equal(gh.datos, null);
});
