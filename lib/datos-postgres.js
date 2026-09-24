// Guardar en Postgres (los datos) y en Vercel Blob (las imágenes).
// Es lo que se usa cuando Pásalo corre publicado.
import { sql } from '@vercel/postgres';
import { put, del } from '@vercel/blob';

export const donde = 'postgres';

// Tres tablas y ya. Se crean solas la primera vez.
let listo = null;
async function preparar(){
  if(listo) return listo;
  listo = (async function(){
    await sql`CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      ficha JSONB NOT NULL
    )`;
    await sql`CREATE TABLE IF NOT EXISTS sesiones (
      llave TEXT PRIMARY KEY,
      usuario TEXT NOT NULL,
      desde BIGINT NOT NULL
    )`;
    await sql`CREATE TABLE IF NOT EXISTS publicaciones (
      id TEXT PRIMARY KEY,
      fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
      ficha JSONB NOT NULL
    )`;
  })();
  return listo;
}

export async function leerUsuarios(){
  await preparar();
  const {rows} = await sql`SELECT ficha FROM usuarios`;
  return rows.map(function(r){ return r.ficha; });
}

export async function guardarUsuarios(lista){
  await preparar();
  // se guarda lo que hay: se insertan o actualizan todos y se van los que sobran
  const ids = lista.map(function(u){ return u.id; });
  for(const u of lista){
    await sql`INSERT INTO usuarios (id, ficha) VALUES (${u.id}, ${JSON.stringify(u)}::jsonb)
              ON CONFLICT (id) DO UPDATE SET ficha = EXCLUDED.ficha`;
  }
  if(ids.length){
    await sql.query('DELETE FROM usuarios WHERE NOT (id = ANY($1))', [ids]);
  }else{
    await sql`DELETE FROM usuarios`;
  }
}

export async function leerSesiones(){
  await preparar();
  const {rows} = await sql`SELECT llave, usuario, desde FROM sesiones`;
  const salida = {};
  rows.forEach(function(r){ salida[r.llave] = {usuario: r.usuario, desde: Number(r.desde)}; });
  return salida;
}

export async function guardarSesiones(obj){
  await preparar();
  const llaves = Object.keys(obj);
  for(const llave of llaves){
    await sql`INSERT INTO sesiones (llave, usuario, desde)
              VALUES (${llave}, ${obj[llave].usuario}, ${obj[llave].desde})
              ON CONFLICT (llave) DO UPDATE SET usuario = EXCLUDED.usuario, desde = EXCLUDED.desde`;
  }
  if(llaves.length){
    await sql.query('DELETE FROM sesiones WHERE NOT (llave = ANY($1))', [llaves]);
  }else{
    await sql`DELETE FROM sesiones`;
  }
}

export async function leerLibro(){
  await preparar();
  const {rows} = await sql`SELECT ficha FROM publicaciones ORDER BY fecha DESC`;
  return rows.map(function(r){ return r.ficha; });
}

export async function guardarLibro(lista){
  await preparar();
  const ids = lista.map(function(c){ return c.id; });
  for(const c of lista){
    await sql`INSERT INTO publicaciones (id, fecha, ficha)
              VALUES (${c.id}, ${c.fecha}, ${JSON.stringify(c)}::jsonb)
              ON CONFLICT (id) DO UPDATE SET ficha = EXCLUDED.ficha`;
  }
  if(ids.length){
    await sql.query('DELETE FROM publicaciones WHERE NOT (id = ANY($1))', [ids]);
  }else{
    await sql`DELETE FROM publicaciones`;
  }
}

/* ---------- las imágenes van a Blob, que sí las sirve solo ---------- */
export async function guardarImagen(dataUrl, carpeta, base){
  const m = /^data:image\/(jpeg|jpg|png|webp);base64,([\s\S]+)$/.exec(dataUrl || '');
  if(!m) return null;

  const extension = m[1] === 'jpeg' ? 'jpg' : m[1];
  const subida = await put(carpeta + '/' + base + '.' + extension,
                           Buffer.from(m[2], 'base64'),
                           {access:'public', contentType:'image/' + m[1], addRandomSuffix:false});
  return subida.url;      // aquí la url ya es absoluta, la sirve Blob
}

export async function borrarImagen(url){
  if(!url || !url.startsWith('http')) return;
  try{ await del(url); }catch(e){}
}

// con Blob no hace falta: la url apunta directo a su CDN
export async function leerImagen(){ return null; }
