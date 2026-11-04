import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearCliente, codificarBase64, decodificarBase64, ConflictoError, GitHubError } from '../js/github.js';

test('base64 conserva tildes y emojis', () => {
  const texto = '{"titulo":"Tortilla de patatas 🥔"}';
  assert.equal(decodificarBase64(codificarBase64(texto)), texto);
});

/** Repo simulado: un fichero con sha; `antesDeEscribir` permite simular a otra persona guardando. */
function githubFalso({ items = [], antesDeEscribir } = {}) {
  let version = 1;
  let datos = { version: 1, items };
  const escrituras = [];
  const responder = (estado, cuerpo) => ({ ok: estado < 300, status: estado, json: async () => cuerpo, text: async () => JSON.stringify(cuerpo) });
  const fetch = async (url, opciones = {}) => {
    if (!opciones.method) {
      return responder(200, { sha: `sha${version}`, encoding: 'base64', content: codificarBase64(JSON.stringify(datos)) });
    }
    antesDeEscribir?.({ empujar: (item) => { datos = { ...datos, items: [...datos.items, item] }; version++; } });
    const cuerpo = JSON.parse(opciones.body);
    if (cuerpo.sha !== `sha${version}`) return responder(409, { message: 'conflict' });
    datos = JSON.parse(decodificarBase64(cuerpo.content));
    version++;
    escrituras.push(cuerpo.message);
    return responder(200, { content: { sha: `sha${version}` } });
  };
  return { fetch, escrituras, get datos() { return datos; } };
}

class RepetidaError extends Error {}

/** Añade una receta; falla si ya hay una con el mismo id, como hará la validación real. */
const anadir = (item) => (d) => {
  if (d.items.some((i) => i.id === item.id)) throw new RepetidaError();
  return { ...d, items: [...d.items, item] };
};

test('alta sin conflicto', async () => {
  const gh = githubFalso();
  const cliente = crearCliente({ token: 't', repo: 'a/b', fetch: gh.fetch });
  const res = await cliente.actualizar('recetas.json', anadir({ id: 'manual:1', titulo: 'A' }), 'Alta: A (por Ana)');
  assert.equal(res.datos.items.length, 1);
  assert.deepEqual(gh.escrituras, ['Alta: A (por Ana)']);
});

test('dos altas distintas a la vez: se reintenta y entran las dos', async () => {
  let primera = true;
  const gh = githubFalso({
    antesDeEscribir: ({ empujar }) => {
      if (primera) { primera = false; empujar({ id: 'manual:otro', titulo: 'De otra persona' }); }
    },
  });
  const cliente = crearCliente({ token: 't', repo: 'a/b', fetch: gh.fetch });
  await cliente.actualizar('recetas.json', anadir({ id: 'manual:1', titulo: 'Mío' }), 'Alta');
  assert.deepEqual(gh.datos.items.map((i) => i.id), ['manual:otro', 'manual:1']);
});

test('si al reintentar la mutación falla, el error llega tal cual y no se escribe', async () => {
  let primera = true;
  const receta = { id: 'receta:1', titulo: 'Tortilla' };
  const gh = githubFalso({
    antesDeEscribir: ({ empujar }) => {
      if (primera) { primera = false; empujar(receta); }
    },
  });
  const cliente = crearCliente({ token: 't', repo: 'a/b', fetch: gh.fetch });
  await assert.rejects(cliente.actualizar('recetas.json', anadir({ ...receta }), 'Alta'), RepetidaError);
  assert.equal(gh.datos.items.length, 1);
});

test('tras 3 conflictos seguidos se rinde con ConflictoError', async () => {
  let n = 0;
  const gh = githubFalso({ antesDeEscribir: ({ empujar }) => empujar({ id: `manual:x${n++}`, titulo: `X${n}` }) });
  const cliente = crearCliente({ token: 't', repo: 'a/b', fetch: gh.fetch });
  await assert.rejects(cliente.actualizar('recetas.json', anadir({ id: 'manual:1', titulo: 'Mío' }), 'Alta'), ConflictoError);
});

test('fichero inexistente se lee vacío; token erróneo da mensaje claro', async () => {
  const f404 = async () => ({ ok: false, status: 404 });
  assert.deepEqual((await crearCliente({ token: 't', repo: 'a/b', fetch: f404 }).leer('menus.json')).datos, { version: 1, items: [] });

  const f401 = async () => ({ ok: false, status: 401 });
  await assert.rejects(crearCliente({ token: 'malo', repo: 'a/b', fetch: f401 }).comprobarRepo(), (e) => e instanceof GitHubError && /token/.test(e.message));
});

test('si mutar devuelve null no se escribe nada', async () => {
  const gh = githubFalso({ items: [{ id: 'manual:1', titulo: 'A' }] });
  const cliente = crearCliente({ token: 't', repo: 'a/b', fetch: gh.fetch });
  const res = await cliente.actualizar('recetas.json', () => null, 'Nada');
  assert.equal(res.datos.items.length, 1);
  assert.deepEqual(gh.escrituras, []);
});

test('un fichero sin "items" se lee con lista: false y falla sin ello', async () => {
  const contenido = codificarBase64(JSON.stringify({ version: 1, raciones: 4 }));
  const f = async () => ({ ok: true, status: 200, json: async () => ({ sha: 's', encoding: 'base64', content: contenido }) });
  const cliente = crearCliente({ token: 't', repo: 'a/b', fetch: f });
  assert.equal((await cliente.leer('ajustes.json', { lista: false })).datos.raciones, 4);
  await assert.rejects(cliente.leer('ajustes.json'), /items/);
});

test('JSON roto o de una versión más nueva: mensajes claros', async () => {
  const con = (texto) => async () => ({ ok: true, status: 200, json: async () => ({ sha: 's', encoding: 'base64', content: codificarBase64(texto) }) });
  await assert.rejects(crearCliente({ token: 't', repo: 'a/b', fetch: con('{roto') }).leer('recetas.json'), /JSON válido/);
  await assert.rejects(crearCliente({ token: 't', repo: 'a/b', fetch: con('{"version":99,"items":[]}') }).leer('recetas.json'), /versión más nueva/);
});

test('subir un archivo binario lo manda en base64 sin sha', async () => {
  let peticion;
  const fetch = async (url, opciones) => {
    peticion = { url, ...opciones };
    return { ok: true, status: 201, json: async () => ({}) };
  };
  await crearCliente({ token: 't', repo: 'a/b', fetch }).subirArchivo('fotos/x.jpg', new Uint8Array([0xff, 0xd8, 0xff]), 'Foto');
  assert.ok(peticion.url.endsWith('/repos/a/b/contents/fotos/x.jpg'));
  assert.equal(peticion.method, 'PUT');
  assert.deepEqual(JSON.parse(peticion.body), { message: 'Foto', content: '/9j/' });
});

test('borrar un archivo pide su sha y lo borra; si no existe, no hace nada', async () => {
  const peticiones = [];
  const fetch = async (url, opciones = {}) => {
    peticiones.push({ url, ...opciones });
    if (!opciones.method) return { ok: true, status: 200, json: async () => ({ sha: 'abc' }) };
    return { ok: true, status: 200, json: async () => ({}) };
  };
  await crearCliente({ token: 't', repo: 'a/b', fetch }).borrarArchivo('fotos/x.jpg', 'Baja');
  assert.equal(peticiones[1].method, 'DELETE');
  assert.deepEqual(JSON.parse(peticiones[1].body), { message: 'Baja', sha: 'abc' });

  const sinArchivo = async () => ({ ok: false, status: 404, json: async () => ({}) });
  await crearCliente({ token: 't', repo: 'a/b', fetch: sinArchivo }).borrarArchivo('fotos/x.jpg', 'Baja');
});
