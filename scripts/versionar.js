// Pone en index.html la política de seguridad (CSP) y una marca de versión (hash del contenido) en el CSS y en cada módulo JS.
// La marca cambia la dirección del archivo cuando cambia su contenido, así el navegador no usa una copia vieja de su caché.
// La CSP solo deja ejecutar los scripts de esta web y hablar solo con la API de GitHub, para que el token no pueda salir a otro sitio.
// Uso: npm run versionar (y el test de versiones avisa si se olvida).

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const INICIO = '<!-- versiones: generado por npm run versionar -->';
const FIN = '<!-- /versiones -->';

const marca = (ruta) => createHash('sha256').update(readFileSync(RAIZ + ruta)).digest('hex').slice(0, 10);

/** Política de seguridad. `hashMapa`: hash del mapa de módulos, el único script dentro de la página. */
export function politica(hashMapa) {
  return [
    "default-src 'none'",
    `script-src 'self' '${hashMapa}'`,
    "style-src 'self'",
    "img-src 'self' blob: data:",
    "connect-src https://api.github.com",
    "manifest-src 'self'",
    "worker-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

/** Bloque de index.html con la CSP, el CSS, el mapa de módulos y el script principal, cada uno con su marca. */
export function bloqueVersiones() {
  const modulos = readdirSync(RAIZ + 'js').filter((f) => f.endsWith('.js')).sort();
  const lineas = modulos.map((f) => `      "./js/${f}": "./js/${f}?v=${marca(`js/${f}`)}"`).join(',\n');
  const mapa = `\n  { "imports": {\n${lineas}\n  } }\n  `;
  const hashMapa = `sha256-${createHash('sha256').update(mapa).digest('base64')}`;
  return [
    INICIO,
    `  <meta http-equiv="Content-Security-Policy" content="${politica(hashMapa)}">`,
    `  <link rel="stylesheet" href="css/app.css?v=${marca('css/app.css')}">`,
    `  <script type="importmap">${mapa}</script>`,
    `  <script type="module" src="js/main.js?v=${marca('js/main.js')}"></script>`,
    `  ${FIN}`,
  ].join('\n');
}

/** index.html con el bloque de versiones al día. */
export function indexVersionado() {
  const html = readFileSync(RAIZ + 'index.html', 'utf8');
  const i = html.indexOf(INICIO);
  const j = html.indexOf(FIN);
  if (i < 0 || j < 0) throw new Error('index.html no tiene el bloque de versiones');
  return html.slice(0, i) + bloqueVersiones() + html.slice(j + FIN.length);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(RAIZ + 'index.html', indexVersionado());
  console.log('index.html actualizado');
}
