// Nombres de ingredientes: reconocer el mismo ingrediente escrito de otra forma y sugerir los ya usados.

import { normalizar } from './texto.js';

/**
 * Clave para comparar ingredientes: sin tildes ni mayúsculas y cada palabra sin plural.
 * «Tomates» y «tomate», «limones» y «limón», «nueces» y «nuez» dan la misma clave.
 * Es una aproximación (no un diccionario): solo sirve para comparar, nunca se muestra.
 */
export function claveIngrediente(nombre) {
  return normalizar(nombre)
    .split(' ')
    .filter(Boolean)
    .map((p) => (p.length <= 3 ? p : p.replace(/ces$/, 'z').replace(/s$/, '').replace(/e$/, '')))
    .join(' ');
}

/**
 * Nombres usados en las recetas, uno por clave, con la forma más usada y cuántas recetas lo llevan.
 * `excepto`: id de la receta que se está editando, para no contar sus propios ingredientes.
 */
export function indiceIngredientes(recetas, excepto = null) {
  const porClave = new Map();
  for (const r of recetas) {
    if (r.id === excepto) continue;
    const vistos = new Set();
    for (const i of r.ingredientes ?? []) {
      const clave = claveIngrediente(i.nombre);
      if (!clave || vistos.has(clave)) continue;
      vistos.add(clave);
      const entrada = porClave.get(clave) ?? { clave, usos: 0, formas: new Map() };
      entrada.usos++;
      entrada.formas.set(i.nombre, (entrada.formas.get(i.nombre) ?? 0) + 1);
      porClave.set(clave, entrada);
    }
  }
  return [...porClave.values()].map(({ clave, usos, formas }) => ({
    clave,
    usos,
    nombre: [...formas.entries()].sort((a, b) => b[1] - a[1])[0][0],
    texto: normalizar([...formas.keys()][0]),
  }));
}

/**
 * Sugerencias para lo escrito: primero el mismo ingrediente escrito de otra forma (`mismo: true`),
 * después los que empiezan igual y luego los que lo contienen; dentro de cada grupo, los más usados.
 * No sugiere lo que ya está escrito tal cual.
 */
export function sugerirIngredientes(indice, escrito, maximo = 4) {
  const texto = normalizar(escrito);
  if (!texto) return [];
  const clave = claveIngrediente(escrito);
  const puntos = (e) => {
    if (e.clave === clave) return 3;
    if (e.texto.startsWith(texto) || e.clave.startsWith(clave)) return 2;
    if (e.texto.includes(texto)) return 1;
    return 0;
  };
  return indice
    .filter((e) => e.nombre !== escrito.trim() && puntos(e) > 0)
    .sort((a, b) => puntos(b) - puntos(a) || b.usos - a.usos || a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, maximo)
    .map((e) => ({ nombre: e.nombre, mismo: e.clave === clave }));
}
