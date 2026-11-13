// Dictado por voz en el móvil: al escribir en un campo de texto aparece un botón 🎤 junto a él; lo pulsas, hablas
// y lo dicho se escribe donde está el cursor. Usa el reconocimiento de voz del navegador (Chrome en Android,
// Safari en iOS); si no lo hay, o no es una pantalla táctil, no sale nada.

const ESPACIO = /\s$/;
const FIN_DE_FRASE = /[.!?¡¿:]\s*$/;

/** Campos que se pueden dictar: texto libre, sin números, contraseñas ni datos técnicos (spellcheck="false"). */
export function admiteDictado(campo) {
  if (!campo || campo.disabled || campo.readOnly) return false;
  if (campo.dataset?.voz === 'no' || campo.getAttribute?.('spellcheck') === 'false') return false;
  if (['numeric', 'decimal'].includes(campo.getAttribute?.('inputmode'))) return false;
  if (campo.tagName === 'TEXTAREA') return true;
  return campo.tagName === 'INPUT' && ['text', 'search'].includes(campo.type);
}

/**
 * Mete lo dictado en `valor` en lugar de la selección [inicio, fin]: con espacios alrededor si hace falta y
 * mayúscula al empezar el campo o una frase (salvo `mayusculas: false`). Respeta `max` caracteres.
 * Devuelve el texto nuevo y dónde queda el cursor.
 */
export function insertarDictado(valor, inicio, fin, dictado, { mayusculas = true, max = Infinity } = {}) {
  let texto = dictado.trim().replace(/\s+/g, ' ');
  if (!texto) return { valor, cursor: fin };
  const antes = valor.slice(0, inicio);
  const despues = valor.slice(fin);
  if (mayusculas && (!antes.trim() || FIN_DE_FRASE.test(antes))) texto = texto[0].toLocaleUpperCase('es-ES') + texto.slice(1);
  if (antes && !ESPACIO.test(antes)) texto = ' ' + texto;
  if (despues && !/^[\s.,;:!?)]/.test(despues)) texto += ' ';
  texto = texto.slice(0, Math.max(0, max - antes.length - despues.length));
  return { valor: antes + texto + despues, cursor: antes.length + texto.length };
}

const MENSAJES = {
  'not-allowed': 'Sin permiso para el micrófono',
  'service-not-allowed': 'Dictado no disponible',
  'audio-capture': 'No se oye el micrófono',
  network: 'Sin conexión para dictar',
  'no-speech': 'No se ha oído nada',
};

/** Pone en marcha el dictado en toda la página. No hace nada si el navegador no reconoce la voz. */
export function iniciarDictado() {
  const Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Reconocimiento || !matchMedia('(pointer: coarse)').matches) return;

  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'boton-voz';
  boton.hidden = true;
  boton.setAttribute('aria-label', 'Dictar por voz');
  boton.textContent = '🎤';
  document.body.append(boton);

  let campo = null;
  let escucha = null;
  let temporizador;

  const colocar = () => {
    if (!campo || boton.hidden) return;
    const r = campo.getBoundingClientRect();
    const alto = boton.offsetHeight || 40;
    const vista = window.visualViewport;
    const arriba = vista ? vista.offsetTop : 0;
    // Encima del campo, a la derecha; si no cabe, debajo.
    let top = r.top - alto - 4;
    if (top < arriba + 4) top = r.bottom + 4;
    boton.style.top = `${top}px`;
    boton.style.left = `${Math.max(4, Math.min(r.right, window.innerWidth - 4) - boton.offsetWidth)}px`;
  };

  const mostrar = (nuevo) => {
    campo = nuevo;
    // Un diálogo abierto tapa lo demás: el botón tiene que ir dentro de él.
    const capa = campo.closest('dialog[open]') || document.body;
    if (boton.parentElement !== capa) capa.append(boton);
    boton.hidden = false;
    colocar();
  };

  const ocultar = () => {
    if (escucha) return;
    boton.hidden = true;
    campo = null;
  };

  const mensaje = (texto) => {
    boton.textContent = `🎤 ${texto}`;
    colocar();
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      boton.textContent = '🎤';
      colocar();
    }, 3000);
  };

  const escribir = (dictado) => {
    if (!campo) return;
    const { valor, cursor } = insertarDictado(campo.value, campo.selectionStart ?? campo.value.length, campo.selectionEnd ?? campo.value.length, dictado, {
      mayusculas: campo.getAttribute('autocapitalize') !== 'off',
      max: campo.maxLength > 0 ? campo.maxLength : Infinity,
    });
    campo.value = valor;
    campo.setSelectionRange?.(cursor, cursor);
    // Para que reaccione como si se hubiera tecleado (búsqueda, sugerencias…).
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const parar = () => {
    escucha?.abort();
    escucha = null;
    boton.classList.remove('escuchando');
    boton.setAttribute('aria-label', 'Dictar por voz');
  };

  const empezar = () => {
    const r = new Reconocimiento();
    r.lang = 'es-ES';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => escribir([...e.results].filter((x) => x.isFinal).map((x) => x[0].transcript).join(' '));
    r.onerror = (e) => {
      if (e.error !== 'aborted') mensaje(MENSAJES[e.error] || 'No se ha podido dictar');
    };
    r.onend = () => {
      if (escucha === r) parar();
      if (document.activeElement !== campo) ocultar();
    };
    escucha = r;
    boton.classList.add('escuchando');
    boton.setAttribute('aria-label', 'Dejar de dictar');
    try {
      r.start();
    } catch {
      parar();
      mensaje('No se ha podido dictar');
    }
  };

  // Que tocar el botón no quite el foco del campo (ni cierre el teclado).
  boton.addEventListener('pointerdown', (e) => e.preventDefault());
  boton.addEventListener('mousedown', (e) => e.preventDefault());
  boton.addEventListener('click', () => (escucha ? parar() : empezar()));

  document.addEventListener('focusin', (e) => {
    if (admiteDictado(e.target)) {
      if (escucha && e.target !== campo) parar();
      mostrar(e.target);
    } else if (e.target !== boton) {
      parar();
      ocultar();
    }
  });
  document.addEventListener('focusout', (e) => {
    // Al pasar a otro campo, focusin ya lo recoloca; esperar a ver adónde va el foco.
    if (e.target === campo) setTimeout(() => !admiteDictado(document.activeElement) && ocultar(), 0);
  });
  document.addEventListener('close', () => { parar(); ocultar(); }, true);
  window.addEventListener('scroll', colocar, true);
  window.addEventListener('resize', colocar);
  window.visualViewport?.addEventListener('resize', colocar);
  window.visualViewport?.addEventListener('scroll', colocar);
}
