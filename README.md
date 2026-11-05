# Coquere

Recetario familiar con planificador de menús y lista de la compra. Web estática (GitHub Pages) que lee y escribe los datos en un repo privado de GitHub; cada dispositivo se conecta con su propio token. Sin servidor ni paso de compilación.

Para configurarlo: [Puesta_en_marcha.md](Puesta_en_marcha.md). Formato de los datos: [Esquema_de_datos.md](Esquema_de_datos.md).

## Desarrollo

```sh
npm run serve      # http://localhost:8000 (los módulos ES no cargan con file://)
npm test           # tests con node --test, sin dependencias
npm run versionar  # tras cambiar CSS o JS: actualiza marcas de versión y CSP en index.html
```

| Fichero | Contenido |
| --- | --- |
| `js/main.js` | Interfaz: listado, ajustes, alta de recetas y arranque |
| `js/listado.js` | Listado de recetas de la pantalla principal |
| `js/filtros.js` | Búsqueda y filtros del listado |
| `js/fotos.js` | Fotos: reducir en el dispositivo, subir a `fotos/` del repo privado, ver con caché |
| `js/ficha.js` | Ficha de receta (`#receta/<id>`) y pantalla encendida mientras se cocina |
| `js/github.js` | Contents API: leer con `sha`, escribir y reintentar ante conflicto, archivos |
| `js/recetas.js`, `js/formulario-receta.js` | Alta de recetas en `recetas.json` y su formulario |
| `js/receta.js` | Modelo de receta: unidades, normalización y validación |
| `js/almacen.js` | Datos en memoria y copia en `localStorage` |
| `js/config.js` | Ajustes del dispositivo (nombre, repo, token) |
| `js/estado.js`, `js/dom.js`, `js/texto.js` | Estado compartido y ayudantes |
| `scripts/versionar.js` | Marcas de versión contra la caché y CSP |

## Seguridad

- Nunca usar `innerHTML` ni parecidos: la interfaz se construye con `el()` de `js/dom.js` y `textContent`. `tests/seguridad.test.js` lo comprueba.
- La CSP solo permite conectar con `api.github.com`. Si alguna vez hace falta otra API, añádela en `politica()` de `scripts/versionar.js`.
- Librerías externas, si llegan: versión fija y SRI.
