// Una sola puerta a los datos. Si hay Postgres detrás, se usa; si no, archivos.
const hayPostgres = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL);

const modulo = hayPostgres
  ? await import('./datos-postgres.js')
  : await import('./datos-archivos.js');

export const donde           = modulo.donde;
export const leerUsuarios    = modulo.leerUsuarios;
export const guardarUsuarios = modulo.guardarUsuarios;
export const leerSesiones    = modulo.leerSesiones;
export const guardarSesiones = modulo.guardarSesiones;
export const leerLibro       = modulo.leerLibro;
export const guardarLibro    = modulo.guardarLibro;
export const guardarImagen   = modulo.guardarImagen;
export const borrarImagen    = modulo.borrarImagen;
export const leerImagen      = modulo.leerImagen;
