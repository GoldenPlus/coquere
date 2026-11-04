# Puesta en marcha

Coquere son dos repos de GitHub: este (público, solo código, publicado con GitHub Pages) y `coquere-datos` (privado, con las recetas). Cada dispositivo se conecta al privado con **su propio token**.

## 1. Repo de datos (una vez)

GitHub → *New repository*:

- Nombre: `coquere-datos`
- Visibilidad: **Private**
- Sin README ni nada más: los ficheros se crean solos con la primera receta.

## 2. Un token por dispositivo

Repite esto para cada móvil, tablet u ordenador, y ponle un nombre que diga cuál es (`coquere-movil-xabier`, `coquere-pc-cocina`…). Así, si pierdes uno, revocas solo ese y el resto sigue funcionando.

GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → *Generate new token*:

- **Expiration:** 1 año como máximo. Apunta la fecha para renovarlo.
- **Repository access:** *Only select repositories* → `coquere-datos` (solo ese).
- **Permissions → Repository permissions → Contents: Read and write.** Nada más (Metadata: Read-only se añade solo).

Copia el token y pégalo directamente en Coquere en ese dispositivo. No lo guardes en notas, chats ni correos.

## 3. Publicar la web (una vez)

En este repo: Settings → Pages → *Deploy from a branch* → `main` / `(root)`. La web queda en `https://<usuario>.github.io/coquere/`.

## 4. Conectar cada dispositivo

Abre la web, rellena tu nombre, `usuario/coquere-datos` y el token de ese dispositivo, y pulsa **Guardar y conectar**. Debe aparecer «● Conectado».

## Si pierdes un dispositivo o dejas de usarlo

- **Perdido o robado:** revoca su token en GitHub (Fine-grained tokens → el token → *Revoke*). Los demás siguen funcionando.
- **Prestado o vendido:** en Coquere, Ajustes → **Olvidar este dispositivo**, y después revoca el token.

## Por qué es seguro

- El repo público solo tiene código; las recetas están en el privado.
- Cada token solo puede leer y escribir el contenido de `coquere-datos`: no da acceso al resto de tu cuenta.
- La web declara una política de seguridad (CSP) que solo le deja ejecutar su propio código y hablar únicamente con `api.github.com`, así que el token no puede enviarse a otro sitio.
- La app nunca interpreta el texto de las recetas como HTML; los tests lo comprueban.
