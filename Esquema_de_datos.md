# Esquema de datos

Los datos viven en el repo privado `coquere-datos`. Cada fichero JSON tiene la forma `{ "version": 1, "items": [...] }`; `version` sube solo si un cambio obliga a migrar los datos guardados.

El código del esquema está en `js/receta.js` (`normalizarReceta`, `validarReceta`, `UNIDADES`) y sus tests en `tests/receta.test.js`.

## recetas.json

```json
{
  "version": 1,
  "items": [
    {
      "id": "r3f9a1c2b7d40",
      "titulo": "Tortilla de patatas",
      "categorias": ["Segundos"],
      "etiquetas": ["vegetariana", "fácil"],
      "proteinas": ["huevo"],
      "raciones": 4,
      "tiempo": 40,
      "dificultad": 2,
      "ingredientes": [
        { "cantidad": 6, "unidad": "unidad", "nombre": "huevo", "detalle": "grande" },
        { "cantidad": 750, "unidad": "g", "nombre": "patata", "detalle": "" },
        { "cantidad": null, "unidad": "al gusto", "nombre": "sal", "detalle": "" }
      ],
      "pasos": ["Pelar y cortar las patatas.", "Freírlas a fuego medio."],
      "notas": [
        { "fecha": "2026-11-05T10:00:00.000Z", "autor": "Ana", "texto": "Mejor con cebolla." }
      ],
      "puntuacion": 5,
      "foto": "fotos/r3f9a1c2b7d40.jpg",
      "creada": "2026-11-05T10:00:00.000Z",
      "modificada": "2026-11-05T10:00:00.000Z"
    }
  ]
}
```

| Campo | Tipo | Obligatorio | Notas |
| --- | --- | --- | --- |
| `id` | texto | sí | Lo genera la app (`r` + 12 caracteres). No cambia nunca; los menús lo usarán para enlazar recetas. |
| `titulo` | texto | sí | |
| `categorias` | lista de textos | lista, puede estar vacía | Tipo de plato: «Primeros», «Postres»… |
| `etiquetas` | lista de textos | lista, puede estar vacía | Libres: «vegetariana», «rápida»… Sin repetidos (no distingue tildes ni mayúsculas). El generador usa «comida»/«cena» y las estaciones «primavera», «verano», «otoño», «invierno» (prefiere las de la estación, con un mes de margen). |
| `proteinas` | lista de textos | no (falta en recetas antiguas: equivale a vacía) | De la lista fija: `carne blanca`, `carne roja`, `pescado blanco`, `pescado azul`, `marisco`, `huevo`, `legumbre`, `vegetal`. Sin repetidos y en ese orden; `vegetal` (sin carne, pescado, huevo ni legumbre) no se combina con las demás. Sirve para equilibrar el menú semanal. |
| `raciones` | entero ≥ 1 | sí | Base para el escalado. Una receta nueva parte de 4. |
| `tiempo` | entero ≥ 0 o `null` | no | Minutos totales. |
| `dificultad` | entero 1–5 o `null` | no | |
| `ingredientes` | lista | lista, puede estar vacía | Ver abajo. |
| `pasos` | lista de textos | lista, puede estar vacía | En orden. Cada paso puede tener varias líneas. |
| `notas` | lista de `{ fecha, autor, texto }` | lista, puede estar vacía | `fecha` en ISO 8601; `autor` es el nombre del dispositivo que la escribió. |
| `puntuacion` | entero 1–5 o `null` | no | |
| `foto` | ruta o `null` | no | Siempre dentro de `fotos/` del repo de datos (`.jpg`, `.png` o `.webp`). Nunca una URL externa. Al lado está su miniatura (`….mini.jpg`). Cada foto nueva tiene nombre nuevo: un archivo de foto no cambia nunca. |
| `creada`, `modificada` | fecha ISO 8601 | sí | |

### Ingredientes

| Campo | Tipo | Notas |
| --- | --- | --- |
| `cantidad` | número > 0 o `null` | Al escribir se aceptan «1,5», «1/2» y «1 1/2». `null` si no se indica. |
| `unidad` | una de la lista | Si no se indica, `unidad`. |
| `nombre` | texto, obligatorio | Lo que se compra: «huevo», «patata». |
| `detalle` | texto | Libre: «maduro», «en dados», «grande». No afecta a la lista de la compra. |

### Unidades

Solo se admiten estas, para que el escalado y la lista de la compra puedan sumar y convertir:

| Tipo | Unidades (equivalencia) |
| --- | --- |
| Masa | `g`, `kg` (1000 g) |
| Volumen | `ml`, `cl` (10 ml), `l` (1000 ml), `cdta` (5 ml), `cda` (15 ml), `taza` (240 ml), `vaso` (200 ml) |
| Recuento | `unidad`, `diente`, `rodaja`, `loncha`, `tira`, `lata`, `sobre`, `manojo`, `ramita`, `pizca`, `chorro`: cada una solo se suma consigo misma |
| Sin cantidad | `al gusto`: la cantidad siempre es `null` |

Añadir una unidad es seguro (basta con incluirla en `UNIDADES`); quitarla o renombrarla obligaría a migrar recetas.

## menus.json

Una entrada por receta planificada. Un hueco (día + comida o cena) puede tener varias recetas, cada una con sus raciones; no se repite la misma receta en un hueco. El orden de las entradas de un hueco en el fichero es el orden en que se muestran (primer plato, segundo…). Un hueco vacío simplemente no tiene entradas.

```json
{
  "version": 1,
  "items": [
    { "fecha": "2026-11-09", "hueco": "cena", "receta": "r3f9a1c2b7d40", "raciones": 4, "origen": "manual" }
  ]
}
```

| Campo | Tipo | Notas |
| --- | --- | --- |
| `fecha` | `AAAA-MM-DD` | Día local del dispositivo, sin hora. |
| `hueco` | `comida` o `cena` | |
| `receta` | id de receta | Al borrar una receta se quitan sus entradas. |
| `raciones` | entero 1–50 | Por defecto, las raciones de la familia (ver `ajustes.json`). |
| `origen` | `manual` o `auto` | `manual`: elegida a mano; el generador de menús no la cambia nunca. `auto`: la puso la app («Rellenar huecos» o «Que elija la app»); se puede regenerar. |

### Huecos especiales

Un hueco se puede marcar como «Comemos fuera» o «Libre / improvisar». Es una entrada sin `receta` ni `raciones` que ocupa el hueco ella sola (no se mezcla con recetas). El generador no la toca, y no cuenta en la lista de la compra ni en el equilibrio semanal.

```json
{ "fecha": "2026-11-14", "hueco": "comida", "especial": "fuera", "nota": "en casa de la abuela", "origen": "manual" }
```

| Campo | Tipo | Notas |
| --- | --- | --- |
| `especial` | `fuera` o `libre` | «Comemos fuera» o «Libre / improvisar». |
| `nota` | texto, hasta 200 caracteres | Puede estar vacía. |

Quien recorra `items` para sumar ingredientes o contar recetas debe saltarse las entradas con `especial` (`esEspecial()` en `js/menus.js`).

## lista.json

La lista de la compra actual, compartida por la familia. Se genera desde el menú de unas fechas; lo añadido a mano se conserva al volver a generarla.

```json
{
  "version": 1,
  "desde": "2026-11-09",
  "hasta": "2026-11-15",
  "generada": "2026-11-09T18:00:00.000Z",
  "items": [
    { "id": "r:patata", "nombre": "patata", "cantidades": [{ "cantidad": 1.63, "unidad": "kg" }], "sinCantidad": false, "recetas": ["Tortilla de patatas", "Lentejas"], "manual": false },
    { "id": "m:3f9a1c2b", "nombre": "pilas", "cantidades": [], "sinCantidad": true, "recetas": [], "manual": true }
  ]
}
```

| Campo | Tipo | Notas |
| --- | --- | --- |
| `desde`, `hasta` | `AAAA-MM-DD` | Fechas del menú con las que se generó. Faltan si solo hay cosas añadidas a mano. |
| `id` | texto | `r:<clave del ingrediente>` si viene del menú; `m:<aleatorio>` si se añadió a mano. |
| `nombre` | texto | El nombre más usado en las recetas para ese ingrediente (tomate y tomates se juntan). |
| `cantidades` | lista de `{ cantidad, unidad }` | Ya escaladas a las raciones de cada comida y sumadas; varias si no se pueden sumar («400 g + 2 latas»). |
| `sinCantidad` | sí/no | Solo «al gusto», pizca o chorro: se compra a ojo. |
| `recetas` | lista de títulos | Para qué recetas es. |
| `manual` | sí/no | Añadido a mano. |

## ajustes.json

Ajustes compartidos por toda la familia (los de cada dispositivo, como el token, no salen de ese dispositivo). No es una lista.

```json
{ "version": 1, "racionesFamilia": 4, "categoriasFueraDelMenu": ["Postres"] }
```

| Campo | Tipo | Notas |
| --- | --- | --- |
| `racionesFamilia` | entero 1–50 | Raciones con las que entra una receta nueva en el menú. Si falta, 4. |
| `categoriasFueraDelMenu` | lista de textos | Categorías que no salen al rellenar el menú automáticamente. Si falta, entran todas. |
| `limitesProteinas` | objeto de enteros 0–14 | Límites del marcador de equilibrio semanal: `carne` (máx., 4), `carneRoja` (máx., 1), `pescado` (mín., 3; incluye marisco), `pescadoAzul` (mín., 1), `legumbre` (mín., 3), `huevo` (máx., 3). Los que falten, los recomendados. |
