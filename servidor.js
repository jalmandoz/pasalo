// Pásalo · sirve la página. Sin dependencias, solo lo que trae Node.
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PUERTO = 4322;
const RAIZ   = __dirname;

const TIPOS = {
  '.html':'text/html; charset=utf-8',
  '.css' :'text/css; charset=utf-8',
  '.js'  :'text/javascript; charset=utf-8',
  '.svg' :'image/svg+xml',
  '.png' :'image/png',
  '.jpg' :'image/jpeg',
  '.webp':'image/webp',
  '.json':'application/json; charset=utf-8'
};

http.createServer(function(pedido, respuesta){
  let ruta = decodeURIComponent(pedido.url.split('?')[0]);
  if(ruta === '/') ruta = '/index.html';

  const destino = path.join(RAIZ, path.normalize(ruta));
  if(!destino.startsWith(RAIZ)){
    respuesta.writeHead(403).end('Fuera de sitio');
    return;
  }

  fs.readFile(destino, function(error, contenido){
    if(error){
      respuesta.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}).end('No está');
      return;
    }
    respuesta.writeHead(200, {'Content-Type': TIPOS[path.extname(destino)] || 'application/octet-stream'});
    respuesta.end(contenido);
  });
}).listen(PUERTO, function(){
  console.log('Pásalo en http://localhost:' + PUERTO);
});
