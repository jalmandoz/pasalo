// La función que atiende todo en Vercel. La lógica vive en lib/logica.js,
// aquí solo se traduce entre el formato de Vercel y el nuestro.
import { atender, galletaDe } from '../lib/logica.js';

export default async function handler(pedido, respuesta){
  const ruta = (pedido.url || '').split('?')[0];

  let cuerpo = pedido.body;
  if(typeof cuerpo === 'string'){
    try{ cuerpo = JSON.parse(cuerpo); }catch(e){ cuerpo = {}; }
  }

  let salida;
  try{
    salida = await atender({
      metodo:  pedido.method,
      ruta:    decodeURIComponent(ruta),
      cuerpo:  cuerpo,
      galleta: galletaDe(pedido.headers.cookie)
    });
  }catch(e){
    console.error('Pásalo se cayó en', ruta, e);
    return respuesta.status(500).json({error:'Algo se rompió de este lado. Intenta otra vez.'});
  }

  if(!salida) return respuesta.status(404).json({error:'No está'});

  if(salida.galleta) respuesta.setHeader('Set-Cookie', salida.galleta);

  if(salida.imagen){
    respuesta.setHeader('Content-Type', salida.imagen.tipo);
    respuesta.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return respuesta.status(salida.codigo).send(salida.imagen.datos);
  }

  if(salida.json === undefined) return respuesta.status(salida.codigo).end();
  return respuesta.status(salida.codigo).json(salida.json);
}

// las fotos llegan en base64 dentro del JSON, así que el cuerpo pesa
export const config = {
  api: { bodyParser: { sizeLimit: '15mb' } }
};
