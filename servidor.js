// Pásalo en tu máquina. Usa la misma lógica que corre publicado.
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { atender, galletaDe } from './lib/logica.js';
import { donde } from './lib/datos.js';

const PUERTO  = Number(process.env.PUERTO || 4322);
const AQUI    = path.dirname(fileURLToPath(import.meta.url));
const PUBLICO = path.join(AQUI, 'public');
const TOPE    = 15 * 1024 * 1024;

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

function conCuerpo(pedido){
  return new Promise(function(listo){
    let crudo = '';
    let corto = false;
    pedido.on('data', function(t){
      crudo += t;
      if(crudo.length > TOPE){ corto = true; pedido.destroy(); listo(null); }
    });
    pedido.on('end', function(){
      if(corto) return;
      try{ listo(JSON.parse(crudo || '{}')); }catch(e){ listo(undefined); }
    });
  });
}

http.createServer(async function(pedido, res){
  const ruta = decodeURIComponent((pedido.url || '').split('?')[0]);

  let cuerpo = {};
  if(pedido.method === 'POST'){
    cuerpo = await conCuerpo(pedido);
    if(cuerpo === null){
      res.writeHead(413, {'Content-Type':'application/json; charset=utf-8'});
      return res.end(JSON.stringify({error:'Las fotos pesan demasiado. Sube menos o más livianas.'}));
    }
    if(cuerpo === undefined){
      res.writeHead(400, {'Content-Type':'application/json; charset=utf-8'});
      return res.end(JSON.stringify({error:'No se entendió lo que llegó.'}));
    }
  }

  let salida = null;
  try{
    salida = await atender({
      metodo: pedido.method,
      ruta: ruta,
      cuerpo: cuerpo,
      galleta: galletaDe(pedido.headers.cookie)
    });
  }catch(e){
    console.error('se cayó en', ruta, e);
    res.writeHead(500, {'Content-Type':'application/json; charset=utf-8'});
    return res.end(JSON.stringify({error:'Algo se rompió de este lado. Intenta otra vez.'}));
  }

  if(salida){
    const cabeceras = {};
    // en tu máquina no hay https, así que la galleta va sin Secure
    if(salida.galleta) cabeceras['Set-Cookie'] = salida.galleta.replace('; Secure', '');

    if(salida.imagen){
      cabeceras['Content-Type'] = salida.imagen.tipo;
      res.writeHead(salida.codigo, cabeceras);
      return res.end(salida.imagen.datos);
    }

    cabeceras['Content-Type'] = 'application/json; charset=utf-8';
    res.writeHead(salida.codigo, cabeceras);
    return res.end(salida.json === undefined ? '' : JSON.stringify(salida.json));
  }

  // la página y lo suyo
  const destino = path.join(PUBLICO, path.normalize(ruta === '/' ? '/index.html' : ruta));
  if(!destino.startsWith(PUBLICO)){
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
  console.log('Pásalo en http://localhost:' + PUERTO + '  ·  datos en ' + donde);
});
