// Pásalo · sirve la página, las cuentas y las publicaciones. Sin dependencias.
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const PUERTO = 4322;
const RAIZ   = __dirname;
const DATOS  = path.join(RAIZ, 'datos');
const FOTOS  = path.join(DATOS, 'fotos');
const CARAS  = path.join(DATOS, 'caras');
const LIBRO  = path.join(DATOS, 'publicaciones.json');
const GENTE  = path.join(DATOS, 'usuarios.json');
const LLAVES = path.join(DATOS, 'sesiones.json');

const TOPE_CUERPO = 14 * 1024 * 1024;        // 14 MB, las fotos ya vienen achicadas
const DURA_SESION = 30 * 24 * 3600 * 1000;   // 30 días

fs.mkdirSync(FOTOS, {recursive:true});
fs.mkdirSync(CARAS, {recursive:true});
[[LIBRO,'[]'], [GENTE,'[]'], [LLAVES,'{}']].forEach(function(par){
  if(!fs.existsSync(par[0])) fs.writeFileSync(par[0], par[1]);
});

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

/* ---------- guardar y leer ---------- */
function leer(archivo, porDefecto){
  try{ return JSON.parse(fs.readFileSync(archivo, 'utf8')); }
  catch(e){ return porDefecto; }
}
function escribir(archivo, dato){
  fs.writeFileSync(archivo, JSON.stringify(dato, null, 2));
}
function responderJson(res, codigo, dato, cabeceras){
  res.writeHead(codigo, Object.assign({'Content-Type':'application/json; charset=utf-8'}, cabeceras || {}));
  res.end(JSON.stringify(dato));
}
function limpiar(txt, tope){
  return String(txt == null ? '' : txt).trim().slice(0, tope);
}

/* ---------- contraseñas ---------- */
function cifrar(clave, sal){
  return crypto.scryptSync(clave, sal, 64).toString('hex');
}
function nuevaClave(clave){
  const sal = crypto.randomBytes(16).toString('hex');
  return {sal: sal, hash: cifrar(clave, sal)};
}
function claveCuadra(clave, usuario){
  const intento = Buffer.from(cifrar(clave, usuario.sal), 'hex');
  const guardado = Buffer.from(usuario.hash, 'hex');
  return intento.length === guardado.length && crypto.timingSafeEqual(intento, guardado);
}

/* ---------- sesiones ---------- */
function galletaDe(pedido){
  const crudo = pedido.headers.cookie || '';
  const par = crudo.split(';').map(function(t){ return t.trim(); })
                   .find(function(t){ return t.startsWith('pasalo_sesion='); });
  return par ? par.slice('pasalo_sesion='.length) : null;
}

function quienEs(pedido){
  const llave = galletaDe(pedido);
  if(!llave) return null;

  const sesiones = leer(LLAVES, {});
  const s = sesiones[llave];
  if(!s) return null;

  if(Date.now() - s.desde > DURA_SESION){
    delete sesiones[llave];
    escribir(LLAVES, sesiones);
    return null;
  }

  return leer(GENTE, []).find(function(u){ return u.id === s.usuario; }) || null;
}

function abrirSesion(usuarioId){
  const llave = crypto.randomBytes(24).toString('hex');
  const sesiones = leer(LLAVES, {});
  sesiones[llave] = {usuario: usuarioId, desde: Date.now()};
  escribir(LLAVES, sesiones);
  return 'pasalo_sesion=' + llave + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=' + (DURA_SESION/1000);
}

// lo que la página puede ver de un usuario: nunca la clave ni la sal
function enPublico(u){
  if(!u) return null;
  return {
    id:u.id, nombre:u.nombre, apellido:u.apellido, correo:u.correo,
    carnet:u.carnet, universidad:u.universidad, carrera:u.carrera, whatsapp:u.whatsapp,
    foto:u.foto || null, desde:u.fecha
  };
}

/* ---------- crear cuenta ---------- */
function registrar(d, res){
  const campos = {
    nombre:   limpiar(d.nombre, 40),
    apellido: limpiar(d.apellido, 40),
    correo:   limpiar(d.correo, 90).toLowerCase(),
    carnet:   limpiar(d.carnet, 15),
    universidad: limpiar(d.universidad, 90),
    carrera:  limpiar(d.carrera, 60),
    whatsapp: limpiar(d.whatsapp, 20)
  };

  const faltan = [];
  if(!campos.nombre)   faltan.push('tu nombre');
  if(!campos.apellido) faltan.push('tu apellido');
  if(!campos.correo)   faltan.push('tu correo');
  if(!campos.carnet)   faltan.push('tu carnet');
  if(!campos.universidad) faltan.push('tu universidad');
  if(!campos.carrera)  faltan.push('tu carrera');
  if(!campos.whatsapp) faltan.push('tu WhatsApp');
  if(faltan.length) return responderJson(res, 400, {error:'Falta ' + faltan.join(', ') + '.'});

  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(campos.correo)){
    return responderJson(res, 400, {error:'Ese correo no se ve bien. Revísalo.'});
  }
  if(String(d.clave || '').length < 6){
    return responderJson(res, 400, {error:'La contraseña necesita al menos 6 caracteres.'});
  }

  const gente = leer(GENTE, []);
  if(gente.some(function(u){ return u.correo === campos.correo; })){
    return responderJson(res, 409, {error:'Ya hay una cuenta con ese correo. Inicia sesión.'});
  }
  // dos universidades pueden repetir el mismo numero de carnet, asi que el par es lo unico
  if(gente.some(function(u){
      return u.carnet === campos.carnet && u.universidad === campos.universidad;
    })){
    return responderJson(res, 409, {error:'Ya hay una cuenta con ese carnet en esa universidad.'});
  }

  const secreto = nuevaClave(String(d.clave));
  const usuario = Object.assign({
    id: crypto.randomUUID(),
    sal: secreto.sal,
    hash: secreto.hash,
    fecha: new Date().toISOString()
  }, campos);

  gente.push(usuario);
  escribir(GENTE, gente);

  responderJson(res, 200, {ok:true, usuario:enPublico(usuario)}, {'Set-Cookie': abrirSesion(usuario.id)});
}

/* ---------- entrar ---------- */
function entrar(d, res){
  const correo = limpiar(d.correo, 90).toLowerCase();
  const clave  = String(d.clave || '');

  if(!correo || !clave){
    return responderJson(res, 400, {error:'Pon tu correo y tu contraseña.'});
  }

  const usuario = leer(GENTE, []).find(function(u){ return u.correo === correo; });
  // el mismo mensaje en los dos casos: no se le dice a nadie qué correos existen
  if(!usuario || !claveCuadra(clave, usuario)){
    return responderJson(res, 401, {error:'El correo o la contraseña no coinciden.'});
  }

  responderJson(res, 200, {ok:true, usuario:enPublico(usuario)}, {'Set-Cookie': abrirSesion(usuario.id)});
}

/* ---------- publicar ---------- */
function guardarImagen(dataUrl, carpeta, base, nombreUrl){
  const m = /^data:image\/(jpeg|jpg|png|webp);base64,([\s\S]+)$/.exec(dataUrl || '');
  if(!m) return null;
  const extension = m[1] === 'jpeg' ? 'jpg' : m[1];
  const nombre = base + '.' + extension;
  fs.writeFileSync(path.join(carpeta, nombre), Buffer.from(m[2], 'base64'));
  return nombreUrl + '/' + nombre;
}

function guardarFoto(dataUrl, base, i){
  return guardarImagen(dataUrl, FOTOS, base + '-' + i, '/fotos');
}

function publicar(d, res, usuario){
  const faltan = [];
  if(!limpiar(d.titulo, 90))    faltan.push('el título');
  if(!limpiar(d.categoria, 40)) faltan.push('la categoría');
  if(d.precio === '' || d.precio == null || isNaN(Number(d.precio))) faltan.push('el precio');
  if(faltan.length) return responderJson(res, 400, {error:'Falta ' + faltan.join(', ') + '.'});

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const fotos = (Array.isArray(d.fotos) ? d.fotos : [])
    .slice(0, 5)
    .map(function(f, i){ return guardarFoto(f, id, i); })
    .filter(Boolean);

  const ficha = {
    id: id,
    titulo:    limpiar(d.titulo, 90),
    categoria: limpiar(d.categoria, 40),
    estado:    limpiar(d.estado, 30),
    carrera:   limpiar(d.carrera, 60) || usuario.carrera,
    precio:    Math.max(0, Number(d.precio)),
    descripcion: limpiar(d.descripcion, 700),
    fotos: fotos,
    // quién lo pasa sale de la cuenta, no de lo que se escriba en el formulario
    dueno:       usuario.id,
    universidad: usuario.universidad,
    nombre:   usuario.nombre,
    contacto: usuario.whatsapp,
    carnet:   usuario.carnet,
    fecha: new Date().toISOString()
  };

  const libro = leer(LIBRO, []);
  libro.unshift(ficha);
  escribir(LIBRO, libro);

  responderJson(res, 200, {ok:true, ficha:ficha});
}

/* ---------- editar y borrar lo tuyo ---------- */
function borrarFotos(rutas){
  (rutas || []).forEach(function(r){
    const archivo = path.join(FOTOS, path.basename(r));
    if(fs.existsSync(archivo)) fs.unlinkSync(archivo);
  });
}

// la ficha y su sitio en el libro, solo si es tuya
function miFicha(id, usuario){
  const libro = leer(LIBRO, []);
  const i = libro.findIndex(function(c){ return c.id === id; });
  if(i < 0) return {error:'Esa publicación ya no está.', codigo:404};
  if(libro[i].dueno !== usuario.id) return {error:'Esa publicación no es tuya.', codigo:403};
  return {libro:libro, i:i};
}

function editar(d, res, usuario){
  const hallado = miFicha(limpiar(d.id, 40), usuario);
  if(hallado.error) return responderJson(res, hallado.codigo, {error:hallado.error});

  const {libro, i} = hallado;
  const vieja = libro[i];

  const faltan = [];
  if(!limpiar(d.titulo, 90))    faltan.push('el título');
  if(!limpiar(d.categoria, 40)) faltan.push('la categoría');
  if(d.precio === '' || d.precio == null || isNaN(Number(d.precio))) faltan.push('el precio');
  if(faltan.length) return responderJson(res, 400, {error:'Falta ' + faltan.join(', ') + '.'});

  // las fotos llegan mezcladas: las que ya estaban vienen como ruta, las nuevas como data
  const entran = (Array.isArray(d.fotos) ? d.fotos : []).slice(0, 5);
  const fotos = entran.map(function(f, n){
    if(typeof f === 'string' && f.startsWith('/fotos/')) return f;
    return guardarFoto(f, vieja.id + '-e' + Date.now().toString(36) + n, 0);
  }).filter(Boolean);

  // las que se quitaron se van del disco
  borrarFotos((vieja.fotos || []).filter(function(f){ return !fotos.includes(f); }));

  libro[i] = Object.assign({}, vieja, {
    titulo:      limpiar(d.titulo, 90),
    categoria:   limpiar(d.categoria, 40),
    estado:      limpiar(d.estado, 30),
    carrera:     limpiar(d.carrera, 60),
    precio:      Math.max(0, Number(d.precio)),
    descripcion: limpiar(d.descripcion, 700),
    fotos:       fotos,
    editada:     new Date().toISOString()
  });

  escribir(LIBRO, libro);
  responderJson(res, 200, {ok:true, ficha:paraElCatalogo(libro[i])});
}

function borrar(d, res, usuario){
  const hallado = miFicha(limpiar(d.id, 40), usuario);
  if(hallado.error) return responderJson(res, hallado.codigo, {error:hallado.error});

  const {libro, i} = hallado;
  borrarFotos(libro[i].fotos);
  libro.splice(i, 1);
  escribir(LIBRO, libro);

  responderJson(res, 200, {ok:true});
}

/* ---------- lo que ve el catálogo: sin carnet de nadie ---------- */
function paraElCatalogo(c){
  const copia = Object.assign({}, c);
  delete copia.carnet;
  delete copia.universidad;   // todas son de la misma, no hace falta repetirlo
  return copia;
}

/* ---------- el servidor ---------- */
function conCuerpo(pedido, res, sigue){
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
  pedido.on('end', function(){
    if(corto) return;
    try{ sigue(JSON.parse(cuerpo || '{}')); }
    catch(e){ responderJson(res, 400, {error:'No se entendió lo que llegó.'}); }
  });
}

http.createServer(function(pedido, res){
  const ruta = decodeURIComponent(pedido.url.split('?')[0]);

  if(pedido.method === 'POST' && ruta === '/api/registrar'){
    return conCuerpo(pedido, res, function(d){ registrar(d, res); });
  }

  if(pedido.method === 'POST' && ruta === '/api/entrar'){
    return conCuerpo(pedido, res, function(d){ entrar(d, res); });
  }

  if(pedido.method === 'POST' && ruta === '/api/salir'){
    const llave = galletaDe(pedido);
    if(llave){
      const sesiones = leer(LLAVES, {});
      delete sesiones[llave];
      escribir(LLAVES, sesiones);
    }
    return responderJson(res, 200, {ok:true},
      {'Set-Cookie':'pasalo_sesion=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'});
  }

  // la foto de perfil
  if(pedido.method === 'POST' && ruta === '/api/mi-foto'){
    const usuario = quienEs(pedido);
    if(!usuario) return responderJson(res, 401, {error:'Entra a tu cuenta.'});

    return conCuerpo(pedido, res, function(d){
      const gente = leer(GENTE, []);
      const mio = gente.find(function(u){ return u.id === usuario.id; });
      if(!mio) return responderJson(res, 404, {error:'No se encontró tu cuenta.'});

      if(d.foto === null){                       // quitarla
        if(mio.foto){
          const viejaRuta = path.join(CARAS, path.basename(mio.foto));
          if(fs.existsSync(viejaRuta)) fs.unlinkSync(viejaRuta);
        }
        delete mio.foto;
      }else{
        const guardada = guardarImagen(d.foto, CARAS, usuario.id + '-' + Date.now().toString(36), '/caras');
        if(!guardada) return responderJson(res, 400, {error:'Esa imagen no se pudo usar. Prueba con otra.'});

        if(mio.foto){                            // fuera la anterior, no se acumulan
          const viejaRuta = path.join(CARAS, path.basename(mio.foto));
          if(fs.existsSync(viejaRuta)) fs.unlinkSync(viejaRuta);
        }
        mio.foto = guardada;
      }

      escribir(GENTE, gente);
      responderJson(res, 200, {ok:true, usuario:enPublico(mio)});
    });
  }

  // lo que yo he publicado
  if(pedido.method === 'GET' && ruta === '/api/mis-publicaciones'){
    const usuario = quienEs(pedido);
    if(!usuario) return responderJson(res, 401, {error:'Entra a tu cuenta.'});

    const mias = leer(LIBRO, []).filter(function(c){ return c.dueno === usuario.id; });
    return responderJson(res, 200, mias.map(paraElCatalogo));
  }

  if(pedido.method === 'GET' && ruta === '/api/yo'){
    return responderJson(res, 200, {usuario: enPublico(quienEs(pedido))});
  }

  if(pedido.method === 'POST' && ruta === '/api/publicar'){
    const usuario = quienEs(pedido);
    if(!usuario) return responderJson(res, 401, {error:'Entra a tu cuenta para publicar.'});
    return conCuerpo(pedido, res, function(d){ publicar(d, res, usuario); });
  }

  // cada universidad tiene su propio catalogo: el filtro vive aqui, no en la pagina
  if(pedido.method === 'POST' && ruta === '/api/editar'){
    const usuario = quienEs(pedido);
    if(!usuario) return responderJson(res, 401, {error:'Entra a tu cuenta.'});
    return conCuerpo(pedido, res, function(d){ editar(d, res, usuario); });
  }

  if(pedido.method === 'POST' && ruta === '/api/borrar'){
    const usuario = quienEs(pedido);
    if(!usuario) return responderJson(res, 401, {error:'Entra a tu cuenta.'});
    return conCuerpo(pedido, res, function(d){ borrar(d, res, usuario); });
  }

  if(pedido.method === 'GET' && ruta === '/api/publicaciones'){
    const usuario = quienEs(pedido);
    if(!usuario) return responderJson(res, 401, {error:'Entra a tu cuenta para ver el catálogo.'});

    const suyas = leer(LIBRO, []).filter(function(c){
      return c.universidad === usuario.universidad;
    });
    return responderJson(res, 200, suyas.map(paraElCatalogo));
  }

  if(ruta.startsWith('/caras/')){
    const cara = path.join(CARAS, path.basename(ruta));
    return fs.readFile(cara, function(error, contenido){
      if(error){ res.writeHead(404).end(); return; }
      res.writeHead(200, {'Content-Type': TIPOS[path.extname(cara)] || 'image/jpeg'});
      res.end(contenido);
    });
  }

  if(ruta.startsWith('/fotos/')){
    const foto = path.join(FOTOS, path.basename(ruta));
    return fs.readFile(foto, function(error, contenido){
      if(error){ res.writeHead(404).end(); return; }
      res.writeHead(200, {'Content-Type': TIPOS[path.extname(foto)] || 'image/jpeg'});
      res.end(contenido);
    });
  }

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
