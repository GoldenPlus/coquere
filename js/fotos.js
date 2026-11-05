// Fotos de las recetas: se reducen en el dispositivo y se guardan en fotos/ del repo privado.
// Cada foto nueva lleva un nombre distinto, así un archivo nunca cambia y se puede guardar en caché para siempre.

const LADO_GRANDE = 1600;
const LADO_MINI = 240;
const CACHE = 'coquere-fotos';

/** fotos/r1a2b-lz3k9.jpg → fotos/r1a2b-lz3k9.mini.jpg */
export const rutaMini = (ruta) => ruta.replace(/\.(jpe?g|png|webp)$/i, '.mini.$1');

export const nuevaRutaFoto = (idReceta, ahora = new Date()) => `fotos/${idReceta}-${ahora.getTime().toString(36)}.jpg`;

/** Medidas para que el lado mayor no pase de `maximo`, sin agrandar nunca. */
export function medidas(ancho, alto, maximo) {
  const escala = Math.min(1, maximo / Math.max(ancho, alto));
  return { ancho: Math.max(1, Math.round(ancho * escala)), alto: Math.max(1, Math.round(alto * escala)) };
}

async function aJpeg(imagen, maximo, calidad) {
  const { ancho, alto } = medidas(imagen.width, imagen.height, maximo);
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d');
  ctx.fillStyle = '#fff'; // Las PNG con transparencia quedan sobre blanco, no sobre negro.
  ctx.fillRect(0, 0, ancho, alto);
  ctx.drawImage(imagen, 0, 0, ancho, alto);
  const blob = await new Promise((ok) => lienzo.toBlob(ok, 'image/jpeg', calidad));
  if (!blob) throw new Error('No se ha podido preparar la foto.');
  return blob;
}

/** De la foto elegida saca una versión grande y una miniatura en JPEG, ya giradas según la cámara. */
export async function reducirFoto(archivo) {
  let imagen;
  try {
    imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Este navegador no puede leer esa imagen. Prueba con una foto JPEG o PNG.');
  }
  try {
    return { grande: await aJpeg(imagen, LADO_GRANDE, 0.82), mini: await aJpeg(imagen, LADO_MINI, 0.75) };
  } finally {
    imagen.close?.();
  }
}

const bytes = async (blob) => new Uint8Array(await blob.arrayBuffer());

/** Sube la foto y su miniatura; devuelve la ruta que se guarda en la receta. */
export async function subirFoto(cliente, receta, foto, autor, ahora = new Date()) {
  const ruta = nuevaRutaFoto(receta.id, ahora);
  await cliente.subirArchivo(rutaMini(ruta), await bytes(foto.mini), `Foto (miniatura): ${receta.titulo} (por ${autor})`);
  await cliente.subirArchivo(ruta, await bytes(foto.grande), `Foto: ${receta.titulo} (por ${autor})`);
  guardarEnMemoria(ruta, foto.grande);
  guardarEnMemoria(rutaMini(ruta), foto.mini);
  return ruta;
}

/** Borra la foto y su miniatura. No falla: si algo queda, es solo un archivo suelto en el repo. */
export async function borrarFoto(cliente, ruta, titulo, autor) {
  if (!ruta) return;
  for (const r of [ruta, rutaMini(ruta)]) {
    try {
      await cliente.borrarArchivo(r, `Foto borrada: ${titulo} (por ${autor})`);
    } catch {
      // Se puede borrar a mano en el repo.
    }
  }
}

// ---------- Ver fotos: memoria → caché del navegador → GitHub

const enMemoria = new Map();
const guardarEnMemoria = (ruta, blob) => enMemoria.set(ruta, Promise.resolve(URL.createObjectURL(blob)));

async function deCache(ruta) {
  try {
    const res = await (await caches.open(CACHE)).match(ruta);
    return res ? res.blob() : null;
  } catch {
    return null; // Sin Cache API (modo privado, http…): se descarga siempre.
  }
}

async function aCache(ruta, blob) {
  try {
    await (await caches.open(CACHE)).put(ruta, new Response(blob));
  } catch {
    // No cabe o no hay caché: no pasa nada.
  }
}

/** Dirección blob: para mostrar una foto del repo privado (que necesita el token para leerse). */
export function urlFoto(cliente, ruta) {
  if (!enMemoria.has(ruta)) {
    const promesa = (async () => {
      let blob = await deCache(ruta);
      if (!blob) {
        blob = await cliente.leerArchivo(ruta);
        await aCache(ruta, blob);
      }
      return URL.createObjectURL(blob);
    })();
    enMemoria.set(ruta, promesa);
    promesa.catch(() => enMemoria.delete(ruta)); // Si falla (sin red), se reintenta la próxima vez.
  }
  return enMemoria.get(ruta);
}

/** Pone la foto en `img` cuando llega; si no llega, deja el hueco con su fondo. */
export function mostrarFoto(img, cliente, ruta) {
  urlFoto(cliente, ruta)
    .then((url) => {
      img.src = url;
      img.classList.add('cargada');
    })
    .catch(() => img.classList.add('sin-foto'));
}
