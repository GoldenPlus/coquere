// Estado compartido de la app: configuración, cliente de GitHub y datos.

import { leerConfig, configCompleta } from './config.js';
import { crearCliente } from './github.js';
import { crearAlmacen } from './almacen.js';

const config = leerConfig();

export const app = {
  almacen: crearAlmacen(),
  config,
  cliente: configCompleta(config) ? crearCliente(config) : null,
};
