// Guardar en archivos. Es lo que se usa cuando corres Pásalo en tu máquina.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const AQUI   = path.dirname(fileURLToPath(import.meta.url));
const DATOS  = path.join(AQUI, '..', 'datos');
const FOTOS  = path.join(DATOS, 'fotos');
const CARAS  = path.join(DATOS, 'caras');
const LIBRO  = path.join(DATOS, 'publicaciones.json');
const GENTE  = path.join(DATOS, 'usuarios.json');
const LLAVES = path.join(DATOS, 'sesiones.json');

fs.mkdirSync(FOTOS, {recursive:true});
fs.mkdirSync(CARAS, {recursive:true});
[[LIBRO,'[]'], [GENTE,'[]'], [LLAVES,'{}']].forEach(function(par){
  if(!fs.existsSync(par[0])) fs.writeFileSync(par[0], par[1]);
});

function leer(archivo, porDefecto){
  try{ return JSON.parse(fs.readFileSync(archivo, 'utf8')); }
  catch(e){ return porDefecto; }
}
function escribir(archivo, dato){
  fs.writeFileSync(archivo, JSON.stringify(dato, null, 2));
}

function carpetaDe(url){
  return url.startsWith('/caras/') ? CARAS : FOTOS;
}

export const donde = 'archivos';

export async function leerUsuarios(){ return leer(GENTE, []); }
export async function guardarUsuarios(lista){ escribir(GENTE, lista); }

export async function leerSesiones(){ return leer(LLAVES, {}); }
export async function guardarSesiones(obj){ escribir(LLAVES, obj); }

export async function leerLibro(){ return leer(LIBRO, []); }
export async function guardarLibro(lista){ escribir(LIBRO, lista); }

// dataUrl entra, url pública sale
export async function guardarImagen(dataUrl, carpeta, base){
  const m = /^data:image\/(jpeg|jpg|png|webp);base64,([\s\S]+)$/.exec(dataUrl || '');
  if(!m) return null;

  const extension = m[1] === 'jpeg' ? 'jpg' : m[1];
  const nombre = base + '.' + extension;
  const destino = carpeta === 'caras' ? CARAS : FOTOS;

  fs.writeFileSync(path.join(destino, nombre), Buffer.from(m[2], 'base64'));
  return '/' + carpeta + '/' + nombre;
}

export async function borrarImagen(url){
  if(!url) return;
  const archivo = path.join(carpetaDe(url), path.basename(url));
  if(fs.existsSync(archivo)) fs.unlinkSync(archivo);
}

const TIPOS = {'.jpg':'image/jpeg', '.png':'image/png', '.webp':'image/webp'};

export async function leerImagen(url){
  const archivo = path.join(carpetaDe(url), path.basename(url));
  if(!fs.existsSync(archivo)) return null;
  return {tipo: TIPOS[path.extname(archivo)] || 'image/jpeg', datos: fs.readFileSync(archivo)};
}
