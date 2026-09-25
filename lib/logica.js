// Toda la lógica de Pásalo. No sabe si corre en tu máquina o publicado:
// eso lo resuelve lib/datos.js. Recibe un pedido y devuelve qué responder.
import crypto from 'crypto';
import * as datos from './datos.js';

const DURA_SESION = 30 * 24 * 3600 * 1000;   // 30 días

function limpiar(txt, tope){
  return String(txt == null ? '' : txt).trim().slice(0, tope);
}
function json(codigo, dato, extra){
  return Object.assign({codigo:codigo, json:dato}, extra || {});
}

/* ---------- contraseñas ---------- */
function cifrar(clave, sal){
  return crypto.scryptSync(clave, sal, 64).toString('hex');
}
function nuevaClave(clave){
  const sal = crypto.randomBytes(16).toString('hex');
  return {sal:sal, hash:cifrar(clave, sal)};
}
function claveCuadra(clave, usuario){
  const intento  = Buffer.from(cifrar(clave, usuario.sal), 'hex');
  const guardado = Buffer.from(usuario.hash, 'hex');
  return intento.length === guardado.length && crypto.timingSafeEqual(intento, guardado);
}

/* ---------- sesiones ---------- */
export function galletaDe(cabecera){
  const par = String(cabecera || '').split(';').map(function(t){ return t.trim(); })
    .find(function(t){ return t.startsWith('pasalo_sesion='); });
  return par ? par.slice('pasalo_sesion='.length) : null;
}

async function quienEs(llave){
  if(!llave) return null;

  const sesiones = await datos.leerSesiones();
  const s = sesiones[llave];
  if(!s) return null;

  if(Date.now() - s.desde > DURA_SESION){
    delete sesiones[llave];
    await datos.guardarSesiones(sesiones);
    return null;
  }

  const gente = await datos.leerUsuarios();
  return gente.find(function(u){ return u.id === s.usuario; }) || null;
}

async function abrirSesion(usuarioId){
  const llave = crypto.randomBytes(24).toString('hex');
  const sesiones = await datos.leerSesiones();

  // de paso se limpian las vencidas, si no la tabla crece para siempre
  const ahora = Date.now();
  Object.keys(sesiones).forEach(function(k){
    if(ahora - sesiones[k].desde > DURA_SESION) delete sesiones[k];
  });

  sesiones[llave] = {usuario:usuarioId, desde:ahora};
  await datos.guardarSesiones(sesiones);

  return 'pasalo_sesion=' + llave + '; HttpOnly; SameSite=Lax; Secure; Path=/; Max-Age=' + (DURA_SESION/1000);
}

// lo que la página puede ver de un usuario: nunca la clave ni la sal
function enPublico(u){
  if(!u) return null;
  return {
    id:u.id, nombre:u.nombre, apellido:u.apellido, correo:u.correo,
    carnet:u.carnet, universidad:u.universidad, carrera:u.carrera, whatsapp:u.whatsapp,
    foto:u.foto || null, desde:u.fecha,
    manda: esAdmin(u)
  };
}

/* ---------- crear cuenta ---------- */
async function registrar(d){
  const campos = {
    nombre:      limpiar(d.nombre, 40),
    apellido:    limpiar(d.apellido, 40),
    correo:      limpiar(d.correo, 90).toLowerCase(),
    carnet:      limpiar(d.carnet, 15),
    universidad: limpiar(d.universidad, 90),
    carrera:     limpiar(d.carrera, 60),
    whatsapp:    limpiar(d.whatsapp, 20)
  };

  const faltan = [];
  if(!campos.nombre)      faltan.push('tu nombre');
  if(!campos.apellido)    faltan.push('tu apellido');
  if(!campos.correo)      faltan.push('tu correo');
  if(!campos.carnet)      faltan.push('tu carnet');
  if(!campos.universidad) faltan.push('tu universidad');
  if(!campos.carrera)     faltan.push('tu carrera');
  if(!campos.whatsapp)    faltan.push('tu WhatsApp');
  if(faltan.length) return json(400, {error:'Falta ' + faltan.join(', ') + '.'});

  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(campos.correo)){
    return json(400, {error:'Ese correo no se ve bien. Revísalo.'});
  }
  if(String(d.clave || '').length < 6){
    return json(400, {error:'La contraseña necesita al menos 6 caracteres.'});
  }

  const gente = await datos.leerUsuarios();
  if(gente.some(function(u){ return u.correo === campos.correo; })){
    return json(409, {error:'Ya hay una cuenta con ese correo. Inicia sesión.'});
  }
  // dos universidades pueden repetir el mismo carnet, lo único es el par
  if(gente.some(function(u){ return u.carnet === campos.carnet && u.universidad === campos.universidad; })){
    return json(409, {error:'Ya hay una cuenta con ese carnet en esa universidad.'});
  }

  const secreto = nuevaClave(String(d.clave));
  const usuario = Object.assign({
    id: crypto.randomUUID(),
    sal: secreto.sal,
    hash: secreto.hash,
    fecha: new Date().toISOString()
  }, campos);

  gente.push(usuario);
  await datos.guardarUsuarios(gente);

  return json(200, {ok:true, usuario:enPublico(usuario)}, {galleta: await abrirSesion(usuario.id)});
}

/* ---------- entrar ---------- */
async function entrar(d){
  const correo = limpiar(d.correo, 90).toLowerCase();
  const clave  = String(d.clave || '');
  if(!correo || !clave) return json(400, {error:'Pon tu correo y tu contraseña.'});

  const gente = await datos.leerUsuarios();
  const usuario = gente.find(function(u){ return u.correo === correo; });

  // el mismo mensaje en los dos casos: no se le dice a nadie qué correos existen
  if(!usuario || !claveCuadra(clave, usuario)){
    return json(401, {error:'El correo o la contraseña no coinciden.'});
  }

  return json(200, {ok:true, usuario:enPublico(usuario)}, {galleta: await abrirSesion(usuario.id)});
}

/* ---------- publicar ---------- */
async function publicar(d, usuario){
  const faltan = [];
  if(!limpiar(d.titulo, 90))    faltan.push('el título');
  if(!limpiar(d.categoria, 40)) faltan.push('la categoría');
  if(d.precio === '' || d.precio == null || isNaN(Number(d.precio))) faltan.push('el precio');
  if(faltan.length) return json(400, {error:'Falta ' + faltan.join(', ') + '.'});

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const entran = (Array.isArray(d.fotos) ? d.fotos : []).slice(0, 5);
  const fotos = [];
  for(let i = 0; i < entran.length; i++){
    const guardada = await datos.guardarImagen(entran[i], 'fotos', id + '-' + i);
    if(guardada) fotos.push(guardada);
  }

  const ficha = {
    id: id,
    titulo:      limpiar(d.titulo, 90),
    categoria:   limpiar(d.categoria, 40),
    estado:      limpiar(d.estado, 30),
    carrera:     limpiar(d.carrera, 60) || usuario.carrera,
    precio:      Math.max(0, Number(d.precio)),
    descripcion: limpiar(d.descripcion, 700),
    fotos: fotos,
    // quién lo pasa sale de la cuenta, no de lo que se escriba en el formulario
    dueno:       usuario.id,
    universidad: usuario.universidad,
    nombre:      usuario.nombre,
    contacto:    usuario.whatsapp,
    carnet:      usuario.carnet,
    fecha: new Date().toISOString()
  };

  const libro = await datos.leerLibro();
  libro.unshift(ficha);
  await datos.guardarLibro(libro);

  return json(200, {ok:true, ficha:paraElCatalogo(ficha)});
}

/* ---------- editar y borrar lo tuyo ---------- */
function miFicha(libro, id, usuario){
  const i = libro.findIndex(function(c){ return c.id === id; });
  if(i < 0) return {error:'Esa publicación ya no está.', codigo:404};
  if(libro[i].dueno !== usuario.id) return {error:'Esa publicación no es tuya.', codigo:403};
  return {i:i};
}

async function editar(d, usuario){
  const libro = await datos.leerLibro();
  const hallado = miFicha(libro, limpiar(d.id, 40), usuario);
  if(hallado.error) return json(hallado.codigo, {error:hallado.error});

  const vieja = libro[hallado.i];

  const faltan = [];
  if(!limpiar(d.titulo, 90))    faltan.push('el título');
  if(!limpiar(d.categoria, 40)) faltan.push('la categoría');
  if(d.precio === '' || d.precio == null || isNaN(Number(d.precio))) faltan.push('el precio');
  if(faltan.length) return json(400, {error:'Falta ' + faltan.join(', ') + '.'});

  // las fotos llegan mezcladas: las que ya estaban son una url, las nuevas son data
  const entran = (Array.isArray(d.fotos) ? d.fotos : []).slice(0, 5);
  const fotos = [];
  for(let i = 0; i < entran.length; i++){
    const f = entran[i];
    if(typeof f === 'string' && !f.startsWith('data:')){ fotos.push(f); continue; }
    const guardada = await datos.guardarImagen(f, 'fotos', vieja.id + '-e' + Date.now().toString(36) + i);
    if(guardada) fotos.push(guardada);
  }

  // las que se quitaron se van
  for(const f of (vieja.fotos || [])){
    if(!fotos.includes(f)) await datos.borrarImagen(f);
  }

  libro[hallado.i] = Object.assign({}, vieja, {
    titulo:      limpiar(d.titulo, 90),
    categoria:   limpiar(d.categoria, 40),
    estado:      limpiar(d.estado, 30),
    carrera:     limpiar(d.carrera, 60),
    precio:      Math.max(0, Number(d.precio)),
    descripcion: limpiar(d.descripcion, 700),
    fotos:       fotos,
    editada:     new Date().toISOString()
  });

  await datos.guardarLibro(libro);
  return json(200, {ok:true, ficha:paraElCatalogo(libro[hallado.i])});
}

async function borrar(d, usuario){
  const libro = await datos.leerLibro();
  const hallado = miFicha(libro, limpiar(d.id, 40), usuario);
  if(hallado.error) return json(hallado.codigo, {error:hallado.error});

  for(const f of (libro[hallado.i].fotos || [])) await datos.borrarImagen(f);
  libro.splice(hallado.i, 1);
  await datos.guardarLibro(libro);

  return json(200, {ok:true});
}

/* ---------- la foto de perfil ---------- */
async function miFoto(d, usuario){
  const gente = await datos.leerUsuarios();
  const mio = gente.find(function(u){ return u.id === usuario.id; });
  if(!mio) return json(404, {error:'No se encontró tu cuenta.'});

  if(d.foto === null){
    if(mio.foto) await datos.borrarImagen(mio.foto);
    delete mio.foto;
  }else{
    const guardada = await datos.guardarImagen(d.foto, 'caras', usuario.id + '-' + Date.now().toString(36));
    if(!guardada) return json(400, {error:'Esa imagen no se pudo usar. Prueba con otra.'});
    if(mio.foto) await datos.borrarImagen(mio.foto);   // fuera la anterior, no se acumulan
    mio.foto = guardada;
  }

  await datos.guardarUsuarios(gente);
  return json(200, {ok:true, usuario:enPublico(mio)});
}

/* ================= EL PANEL ================= */
// Quién es admin sale de una variable del servidor, nunca de la propia cuenta:
// así nadie puede darse permisos a sí mismo.
function esAdmin(usuario){
  if(!usuario) return false;
  const lista = String(process.env.ADMINS || '')
    .split(',').map(function(c){ return c.trim().toLowerCase(); }).filter(Boolean);
  return lista.includes(String(usuario.correo || '').toLowerCase());
}

// Lo que el panel ve de una cuenta. Ni la clave ni la sal salen de aquí.
function cuentaEnPanel(u, libro){
  return {
    id: u.id,
    nombre: u.nombre + ' ' + u.apellido,
    correo: u.correo,
    universidad: u.universidad,
    carrera: u.carrera,
    carnet: u.carnet,
    whatsapp: u.whatsapp,
    foto: u.foto || null,
    desde: u.fecha,
    publicaciones: libro.filter(function(c){ return c.dueno === u.id; }).length
  };
}

async function resumenPanel(){
  const gente = await datos.leerUsuarios();
  const libro = await datos.leerLibro();

  // cuántas cuentas y cuántas cosas hay en cada universidad
  const porUniversidad = {};
  function casilla(nombre){
    if(!porUniversidad[nombre]) porUniversidad[nombre] = {universidad:nombre, cuentas:0, publicaciones:0};
    return porUniversidad[nombre];
  }
  gente.forEach(function(u){ casilla(u.universidad || 'Sin universidad').cuentas++; });
  libro.forEach(function(c){ casilla(c.universidad || 'Sin universidad').publicaciones++; });

  const universidades = Object.values(porUniversidad)
    .sort(function(a, b){ return (b.cuentas + b.publicaciones) - (a.cuentas + a.publicaciones); });

  const nuevas = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  return json(200, {
    numeros: {
      cuentas: gente.length,
      publicaciones: libro.length,
      universidades: universidades.length,
      cuentasNuevas: gente.filter(function(u){ return u.fecha > nuevas; }).length,
      publicacionesNuevas: libro.filter(function(c){ return c.fecha > nuevas; }).length,
      conFoto: libro.filter(function(c){ return (c.fotos || []).length; }).length,
      regaladas: libro.filter(function(c){ return !c.precio; }).length
    },
    universidades: universidades,
    cuentas: gente
      .slice().sort(function(a, b){ return (b.fecha || '').localeCompare(a.fecha || ''); })
      .map(function(u){ return cuentaEnPanel(u, libro); }),
    // el panel sí ve todo, de todas las universidades, pero sin el carnet de nadie
    publicaciones: libro.map(function(c){
      const copia = Object.assign({}, c);
      delete copia.carnet;
      return copia;
    })
  });
}

async function borrarDelPanel(d){
  const id = limpiar(d.id, 40);
  const libro = await datos.leerLibro();
  const i = libro.findIndex(function(c){ return c.id === id; });
  if(i < 0) return json(404, {error:'Esa publicación ya no está.'});

  for(const f of (libro[i].fotos || [])) await datos.borrarImagen(f);
  libro.splice(i, 1);
  await datos.guardarLibro(libro);
  return json(200, {ok:true});
}

async function borrarCuenta(d, quienPide){
  const id = limpiar(d.id, 40);
  if(id === quienPide.id) return json(400, {error:'No puedes borrar tu propia cuenta desde aquí.'});

  const gente = await datos.leerUsuarios();
  const usuario = gente.find(function(u){ return u.id === id; });
  if(!usuario) return json(404, {error:'Esa cuenta ya no está.'});
  if(esAdmin(usuario)) return json(403, {error:'No se puede borrar a otro administrador.'});

  // se va la cuenta y con ella todo lo suyo: publicaciones, fotos y sesiones
  const libro = await datos.leerLibro();
  const suyas = libro.filter(function(c){ return c.dueno === id; });
  for(const c of suyas){
    for(const f of (c.fotos || [])) await datos.borrarImagen(f);
  }
  await datos.guardarLibro(libro.filter(function(c){ return c.dueno !== id; }));

  if(usuario.foto) await datos.borrarImagen(usuario.foto);
  await datos.guardarUsuarios(gente.filter(function(u){ return u.id !== id; }));

  const sesiones = await datos.leerSesiones();
  Object.keys(sesiones).forEach(function(k){ if(sesiones[k].usuario === id) delete sesiones[k]; });
  await datos.guardarSesiones(sesiones);

  return json(200, {ok:true, borradas: suyas.length});
}

/* ---------- lo que sale al catálogo ---------- */
function paraElCatalogo(c){
  const copia = Object.assign({}, c);
  delete copia.carnet;
  return copia;               // la universidad sí va: el catálogo puede traer varias
}

/* ================= la puerta ================= */
export async function atender(p){
  const {metodo, ruta, cuerpo, galleta} = p;
  // p.consulta trae el valor de ?unis=... cuando lo hay

  if(metodo === 'POST' && ruta === '/api/registrar') return registrar(cuerpo || {});
  if(metodo === 'POST' && ruta === '/api/entrar')    return entrar(cuerpo || {});

  if(metodo === 'POST' && ruta === '/api/salir'){
    if(galleta){
      const sesiones = await datos.leerSesiones();
      delete sesiones[galleta];
      await datos.guardarSesiones(sesiones);
    }
    return json(200, {ok:true},
      {galleta:'pasalo_sesion=; HttpOnly; SameSite=Lax; Secure; Path=/; Max-Age=0'});
  }

  const usuario = await quienEs(galleta);

  if(metodo === 'GET' && ruta === '/api/yo'){
    return json(200, {usuario:enPublico(usuario)});
  }

  // de aquí para abajo hace falta estar dentro
  const puertaCerrada = {
    '/api/publicar':          'Entra a tu cuenta para publicar.',
    '/api/editar':            'Entra a tu cuenta.',
    '/api/borrar':            'Entra a tu cuenta.',
    '/api/mi-foto':           'Entra a tu cuenta.',
    '/api/mis-publicaciones': 'Entra a tu cuenta.',
    '/api/universidades':     'Entra a tu cuenta.',
    '/api/publicaciones':     'Entra a tu cuenta para ver el catálogo.'
  };
  if(puertaCerrada[ruta] && !usuario) return json(401, {error:puertaCerrada[ruta]});

  // el panel: puerta aparte, solo para quien esté en la lista de admins
  if(ruta.startsWith('/api/panel')){
    if(!esAdmin(usuario)) return json(403, {error:'Esta parte no es para ti.'});
    if(metodo === 'GET'  && ruta === '/api/panel')                 return resumenPanel();
    if(metodo === 'POST' && ruta === '/api/panel/borrar')          return borrarDelPanel(cuerpo || {});
    if(metodo === 'POST' && ruta === '/api/panel/borrar-cuenta')   return borrarCuenta(cuerpo || {}, usuario);
    return json(404, {error:'No está'});
  }

  if(metodo === 'POST' && ruta === '/api/publicar') return publicar(cuerpo || {}, usuario);
  if(metodo === 'POST' && ruta === '/api/editar')   return editar(cuerpo || {}, usuario);
  if(metodo === 'POST' && ruta === '/api/borrar')   return borrar(cuerpo || {}, usuario);
  if(metodo === 'POST' && ruta === '/api/mi-foto')  return miFoto(cuerpo || {}, usuario);

  if(metodo === 'GET' && ruta === '/api/mis-publicaciones'){
    const libro = await datos.leerLibro();
    return json(200, libro.filter(function(c){ return c.dueno === usuario.id; }).map(paraElCatalogo));
  }

  // qué universidades hay con algo publicado, para el menú de etiquetas.
  // Solo nombres y cuántas cosas tiene cada una, nunca el contenido.
  if(metodo === 'GET' && ruta === '/api/universidades'){
    const libro = await datos.leerLibro();
    const cuenta = {};
    libro.forEach(function(c){
      if(!c.universidad) return;
      cuenta[c.universidad] = (cuenta[c.universidad] || 0) + 1;
    });
    if(!cuenta[usuario.universidad]) cuenta[usuario.universidad] = 0;

    const lista = Object.keys(cuenta)
      .map(function(u){ return {universidad:u, publicaciones:cuenta[u]}; })
      .sort(function(a, b){ return a.universidad.localeCompare(b.universidad, 'es'); });
    return json(200, lista);
  }

  // El catálogo arranca en tu universidad. Se pueden sumar otras con ?unis=,
  // y "*" las trae todas. La tuya va siempre, no se puede quitar.
  if(metodo === 'GET' && ruta === '/api/publicaciones'){
    const libro = await datos.leerLibro();

    const pedidas = String(p.consulta || '').trim();
    if(pedidas === '*') return json(200, libro.map(paraElCatalogo));

    const quiere = new Set([usuario.universidad]);
    pedidas.split(',').map(function(u){ return u.trim(); }).filter(Boolean)
      .forEach(function(u){ quiere.add(u); });

    const suyas = libro.filter(function(c){ return quiere.has(c.universidad); });
    return json(200, suyas.map(paraElCatalogo));
  }

  // las imágenes guardadas en disco (en producción las sirve Blob por su cuenta)
  if(metodo === 'GET' && (ruta.startsWith('/fotos/') || ruta.startsWith('/caras/'))){
    const imagen = await datos.leerImagen(ruta);
    if(!imagen) return {codigo:404};
    return {codigo:200, imagen:imagen};
  }

  return null;   // no es cosa nuestra
}
