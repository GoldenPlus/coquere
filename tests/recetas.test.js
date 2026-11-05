import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { crearCliente, codificarBase64, decodificarBase64 } from '../js/github.js';
import { nuevaReceta } from '../js/receta.js';
import { crearReceta, editarReceta, borrarReceta, puntuarReceta, anadirNota, textoALista, RecetaInvalidaError, RecetaCambiadaError, RecetaBorradaError } from '../js/recetas.js';

globalThis.crypto ??= webcrypto; // Node 18 no lo trae global; el navegador sí.

/**
 * recetas.json simulado en GitHub. `otroGuarda` mete una receta de otro dispositivo justo antes de la primera
 * escritura; `otroCambia(items)` hace lo mismo con cualquier cambio.
 */
function github({ items = [], otroGuarda, otroCambia } = {}) {
  if (otroGuarda) otroCambia = (lista) => [...lista, otroGuarda];
  const borrados = [];
  let sha = 1;
  let datos = items.length ? { version: 1, items } : null;
  const mensajes = [];
  const res = (status, cuerpo) => ({ ok: status < 300, status, json: async () => cuerpo });
  const fetch = async (url, op = {}) => {
    if (url.includes('/contents/fotos/')) {
      if (op.method === 'DELETE') borrados.push(url.split('/contents/')[1]);
      return res(200, { sha: 'foto' });
    }
    if (!url.endsWith('/contents/recetas.json')) return res(200, {});
    if (!op.method) return datos ? res(200, { sha: `s${sha}`, encoding: 'base64', content: codificarBase64(JSON.stringify(datos)) }) : res(404, {});
    if (otroCambia) {
      datos = { version: 1, items: otroCambia(datos?.items ?? []) };
      sha++;
      otroCambia = null;
    }
    const cuerpo = JSON.parse(op.body);
    if ((cuerpo.sha ?? null) !== (datos ? `s${sha}` : null)) return res(datos && !cuerpo.sha ? 422 : 409, {});
    datos = JSON.parse(decodificarBase64(cuerpo.content));
    sha++;
    mensajes.push(cuerpo.message);
    return res(201, { content: { sha: `s${sha}` } });
  };
  return { cliente: crearCliente({ token: 't', repo: 'a/coquere-datos', fetch }), mensajes, borrados, get datos() { return datos; } };
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

/** Una receta ya guardada, con la fecha de la versión que se abre para editar. */
const guardada = (titulo, modificada = '2026-11-01T10:00:00.000Z') => ({ ...borrador(titulo), raciones: 4, ingredientes: [], pasos: [], creada: modificada, modificada });

test('editar sustituye la receta en su sitio y deja las demás', async () => {
  const a = guardada('Gazpacho');
  const b = guardada('Lentejas');
  const gh = github({ items: [a, b] });
  const ahora = new Date('2026-11-05T12:00:00Z');
  const { datos, receta } = await editarReceta(gh.cliente, { ...b, titulo: 'Lentejas con chorizo', raciones: '6' }, 'Ana', { base: b.modificada }, ahora);
  assert.deepEqual(datos.items.map((r) => r.titulo), ['Gazpacho', 'Lentejas con chorizo']);
  assert.equal(receta.raciones, 6);
  assert.equal(receta.id, b.id);
  assert.equal(receta.creada, b.creada);
  assert.equal(receta.modificada, ahora.toISOString());
  assert.deepEqual(gh.mensajes, ['Cambios: Lentejas con chorizo (por Ana)']);
});

test('si otro dispositivo cambió la misma receta, avisa; con forzar guarda encima', async () => {
  const r = guardada('Lentejas');
  const suya = { ...r, titulo: 'Lentejas de la abuela', modificada: '2026-11-05T09:00:00.000Z' };
  const gh = github({ items: [r], otroCambia: () => [suya] });
  await assert.rejects(editarReceta(gh.cliente, { ...r, raciones: '2' }, 'Ana', { base: r.modificada }), (e) => {
    assert.ok(e instanceof RecetaCambiadaError);
    assert.equal(e.actual.titulo, 'Lentejas de la abuela');
    return true;
  });
  assert.equal(gh.datos.items[0].titulo, 'Lentejas de la abuela');
  const { datos } = await editarReceta(gh.cliente, { ...r, raciones: '2' }, 'Ana', { base: r.modificada, forzar: true });
  assert.equal(datos.items[0].raciones, 2);
  assert.equal(datos.items[0].titulo, 'Lentejas');
});

test('si otro dispositivo cambió otra receta a la vez, se guardan los dos cambios', async () => {
  const a = guardada('Gazpacho');
  const b = guardada('Lentejas');
  const gh = github({ items: [a, b], otroCambia: (items) => [{ ...items[0], titulo: 'Gazpacho andaluz' }, items[1]] });
  const { datos } = await editarReceta(gh.cliente, { ...b, raciones: '2' }, 'Ana', { base: b.modificada });
  assert.deepEqual(datos.items.map((r) => [r.titulo, r.raciones]), [['Gazpacho andaluz', 4], ['Lentejas', 2]]);
});

test('editar una receta que otro dispositivo ha borrado lo dice y no la recrea', async () => {
  const r = guardada('Lentejas');
  const gh = github({ items: [r], otroCambia: () => [] });
  await assert.rejects(editarReceta(gh.cliente, r, 'Ana', { base: r.modificada }), RecetaBorradaError);
  assert.deepEqual(gh.datos.items, []);
});

test('borrar quita la receta y su foto con miniatura (la de GitHub); si ya no estaba, no escribe nada', async () => {
  const a = guardada('Gazpacho');
  const b = { ...guardada('Lentejas'), foto: 'fotos/vieja.jpg' };
  // Otro dispositivo le cambió la foto: se borra la que hay en GitHub, no la de la copia local.
  const gh = github({ items: [a, { ...b, foto: 'fotos/lentejas.jpg' }] });
  const { datos } = await borrarReceta(gh.cliente, b, 'Ana');
  assert.deepEqual(datos.items.map((r) => r.titulo), ['Gazpacho']);
  assert.deepEqual(gh.borrados, ['fotos/lentejas.jpg', 'fotos/lentejas.mini.jpg']);
  await borrarReceta(gh.cliente, b, 'Ana');
  assert.deepEqual(gh.mensajes, ['Borrada: Lentejas (por Ana)']);
});

test('puntuar y anotar se guardan sin cambiar la fecha de modificación', async () => {
  const r = guardada('Lentejas');
  const gh = github({ items: [r] });
  await puntuarReceta(gh.cliente, r, 4, 'Ana');
  await anadirNota(gh.cliente, r, '  Le faltó sal  ', 'Ana', new Date('2026-11-05T12:00:00Z'));
  const { receta } = await anadirNota(gh.cliente, r, 'Mejor con chorizo', 'Luis', new Date('2026-11-12T12:00:00Z'));
  assert.equal(receta.puntuacion, 4);
  assert.deepEqual(receta.notas, [
    { fecha: '2026-11-05T12:00:00.000Z', autor: 'Ana', texto: 'Le faltó sal' },
    { fecha: '2026-11-12T12:00:00.000Z', autor: 'Luis', texto: 'Mejor con chorizo' },
  ]);
  assert.equal(receta.modificada, r.modificada);
  assert.deepEqual(gh.mensajes, ['Puntuación 4/5: Lentejas (por Ana)', 'Nota: Lentejas (por Ana)', 'Nota: Lentejas (por Luis)']);
});

test('una nota añadida desde otro dispositivo a la vez no se pierde', async () => {
  const r = guardada('Lentejas');
  const suya = { fecha: '2026-11-05T11:00:00.000Z', autor: 'Luis', texto: 'La suya' };
  const gh = github({ items: [r], otroCambia: (items) => [{ ...items[0], notas: [suya] }] });
  const { receta } = await anadirNota(gh.cliente, r, 'La mía', 'Ana', new Date('2026-11-05T12:00:00Z'));
  assert.deepEqual(receta.notas.map((n) => n.texto), ['La suya', 'La mía']);
});

test('editar, incluso guardando encima, nunca borra notas ni puntuación de GitHub', async () => {
  const r = guardada('Lentejas');
  const nota = { fecha: '2026-11-05T11:00:00.000Z', autor: 'Luis', texto: 'No me borres' };
  const gh = github({ items: [r], otroCambia: (items) => [{ ...items[0], notas: [nota], puntuacion: 5, titulo: 'Otro título', modificada: '2026-11-05T11:00:00.000Z' }] });
  // El formulario se abrió antes: lleva notas vacías y sin puntuación.
  const { receta } = await editarReceta(gh.cliente, { ...r, raciones: '2' }, 'Ana', { base: r.modificada, forzar: true });
  assert.equal(receta.titulo, 'Lentejas');
  assert.deepEqual(receta.notas, [nota]);
  assert.equal(receta.puntuacion, 5);
});

test('anotar en una receta borrada o con nota vacía da un error claro', async () => {
  const r = guardada('Lentejas');
  await assert.rejects(anadirNota(github({ items: [guardada('Otra')] }).cliente, r, 'hola', 'Ana'), RecetaBorradaError);
  await assert.rejects(anadirNota(github({ items: [r] }).cliente, r, '   ', 'Ana'), RecetaInvalidaError);
  await assert.rejects(puntuarReceta(github({ items: [r] }).cliente, r, 7, 'Ana'), /La puntuación va de 1 a 5/);
});

test('editar sin tocar la foto conserva la de GitHub; cambiarla devuelve la anterior para borrarla', async () => {
  const r = { ...guardada('Lentejas'), foto: 'fotos/a.jpg' };
  // Otro dispositivo puso otra foto y el formulario aún tiene la vieja: sin fotoCambiada se respeta la de GitHub.
  const gh = github({ items: [{ ...r, foto: 'fotos/b.jpg' }] });
  const sinCambio = await editarReceta(gh.cliente, { ...r, raciones: '2' }, 'Ana', { base: r.modificada });
  assert.equal(sinCambio.receta.foto, 'fotos/b.jpg');
  assert.equal(sinCambio.fotoAnterior, null);
  const nueva = await editarReceta(gh.cliente, { ...sinCambio.receta, foto: 'fotos/c.jpg' }, 'Ana', { base: sinCambio.receta.modificada, fotoCambiada: true });
  assert.equal(nueva.receta.foto, 'fotos/c.jpg');
  assert.equal(nueva.fotoAnterior, 'fotos/b.jpg');
  const quitada = await editarReceta(gh.cliente, { ...nueva.receta, foto: null }, 'Ana', { base: nueva.receta.modificada, fotoCambiada: true });
  assert.equal(quitada.receta.foto, null);
  assert.equal(quitada.fotoAnterior, 'fotos/c.jpg');
});
