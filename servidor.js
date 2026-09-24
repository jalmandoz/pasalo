// Pásalo · sirve la página y guarda las publicaciones. Sin dependencias.
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PUERTO = 4322;
const RAIZ   = __dirname;
const DATOS  = path.join(RAIZ, 'datos');
const FOTOS  = path.join(DATOS, 'fotos');
const LIBRO  = path.join(DATOS, 'publicaciones.json');

const TOPE_CUERPO = 14 * 1024 * 1024;   // 14 MB, las fotos ya vienen achicadas

fs.mkdirSync(FOTOS, {recursive:true});
if(!fs.existsSync(LIBRO)) fs.writeFileSync(LIBRO, '[]');

const TIPOS = {
  '.html':'text/html; charset=utf-8',
  '.css' :'text/css; charset=utf-8',
  '.js'  :'text/javascript; charset=utf-8',
  '.svg' :'image/svg+xml',
  '.png' :'image/png',
  '.jpg' :'image/jpeg',
  '.jpeg':'image/jpeg',
  '.webp':'image/webp',
  '.json':'application/json; charset=utf-8'
};

function leerLibro(){
  try{ return JSON.parse(fs.readFileSync(LIBRO, 'utf8')); }
  catch(e){ return []; }
}

function responderJson(res, codigo, dato){
  const cuerpo = JSON.stringify(dato);
  res.writeHead(codigo, {'Content-Type':'application/json; charset=utf-8'});
  res.end(cuerpo);
}

function limpiar(txt, tope){
  return String(txt == null ? '' : txt).trim().slice(0, tope);
}

// guarda una foto que llega como data URL y devuelve su ruta pública
function guardarFoto(dataUrl, id, i){
  const m = /^data:image\/(jpeg|jpg|png|webp);base64,([\s\S]+)$/.exec(dataUrl || '');
  if(!m) return null;

  const extension = m[1] === 'jpeg' ? 'jpg' : m[1];
  const nombre = id + '-' + i + '.' + extension;
  fs.writeFileSync(path.join(FOTOS, nombre), Buffer.from(m[2], 'base64'));
  return '/fotos/' + nombre;
}

function publicar(cuerpo, res){
  let d;
  try{ d = JSON.parse(cuerpo); }
  catch(e){ return responderJson(res, 400, {error:'No se entendió lo que llegó'}); }

  const faltan = [];
  if(!limpiar(d.titulo, 90))     faltan.push('el título');
  if(!limpiar(d.categoria, 40))  faltan.push('la categoría');
  if(!limpiar(d.contacto, 30))   faltan.push('el WhatsApp');
  if(!limpiar(d.carnet, 15))     faltan.push('el carnet');
  if(d.precio === '' || d.precio == null || isNaN(Number(d.precio))) faltan.push('el precio');

  if(faltan.length){
    return responderJson(res, 400, {error:'Falta ' + faltan.join(', ')});
  }

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const fotos = (Array.isArray(d.fotos) ? d.fotos : [])
    .slice(0, 5)
    .map(function(f, i){ return guardarFoto(f, id, i); })
    .filter(Boolean);

  const ficha = {
    id:        id,
    titulo:    limpiar(d.titulo, 90),
    categoria: limpiar(d.categoria, 40),
    estado:    limpiar(d.estado, 30),
    carrera:   limpiar(d.carrera, 60),
    carnet:    limpiar(d.carnet, 15),
    precio:    Math.max(0, Number(d.precio)),
    descripcion: limpiar(d.descripcion, 700),
    nombre:    limpiar(d.nombre, 60),
    contacto:  limpiar(d.contacto, 30),
    fotos:     fotos,
    fecha:     new Date().toISOString()
  };

  const libro = leerLibro();
  libro.unshift(ficha);
  fs.writeFileSync(LIBRO, JSON.stringify(libro, null, 2));

  responderJson(res, 200, {ok:true, ficha:ficha});
}

http.createServer(function(pedido, res){
  const ruta = decodeURIComponent(pedido.url.split('?')[0]);

  if(pedido.method === 'POST' && ruta === '/api/publicar'){
    let cuerpo = '';
    let corto = false;

    pedido.on('data', function(trozo){
      cuerpo += trozo;
      if(cuerpo.length > TOPE_CUERPO){
        corto = true;
        pedido.destroy();
        responderJson(res, 413, {error:'Las fotos pesan demasiado. Sube menos o más livianas.'});
      }
    });
    pedido.on('end', function(){ if(!corto) publicar(cuerpo, res); });
    return;
  }

  if(pedido.method === 'GET' && ruta === '/api/publicaciones'){
    return responderJson(res, 200, leerLibro());
  }

  // las fotos guardadas
  if(ruta.startsWith('/fotos/')){
    const foto = path.join(FOTOS, path.basename(ruta));
    return fs.readFile(foto, function(error, contenido){
      if(error){ res.writeHead(404).end(); return; }
      res.writeHead(200, {'Content-Type': TIPOS[path.extname(foto)] || 'image/jpeg'});
      res.end(contenido);
    });
  }

  // la página y lo suyo
  const destino = path.join(RAIZ, path.normalize(ruta === '/' ? '/index.html' : ruta));
  if(!destino.startsWith(RAIZ)){
    res.writeHead(403).end('Fuera de sitio');
    return;
  }

  fs.readFile(destino, function(error, contenido){
    if(error){
      res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}).end('No está');
      return;
    }
    res.writeHead(200, {'Content-Type': TIPOS[path.extname(destino)] || 'application/octet-stream'});
    res.end(contenido);
  });
}).listen(PUERTO, function(){
  console.log('Pásalo en http://localhost:' + PUERTO);
});
