// El trabajador de fondo de Pásalo. Guarda lo que no cambia (la página, los
// iconos, las fuentes) para que abra al instante y aguante un túnel del metro.
// Lo que son datos de la gente NO se guarda nunca: eso siempre va a la red.
const BODEGA = 'pasalo-v1';
const BASICO = ['/', '/index.html', '/icono-180.png', '/icono-512.png', '/at-designs.png', '/manifest.json'];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(BODEGA)
      .then(function(c){ return c.addAll(BASICO); })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys()
      .then(function(viejas){
        return Promise.all(viejas.filter(function(n){ return n !== BODEGA; })
                                 .map(function(n){ return caches.delete(n); }));
      })
      .then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  const url = new URL(e.request.url);

  if(e.request.method !== 'GET') return;
  if(url.origin !== location.origin) return;

  // nada de la gente se guarda: ni el catálogo, ni las cuentas, ni las fotos
  if(url.pathname.startsWith('/api/') ||
     url.pathname.startsWith('/fotos/') ||
     url.pathname.startsWith('/caras/')) return;

  // la página: primero la red, y si no hay, lo guardado
  if(e.request.mode === 'navigate'){
    e.respondWith(
      fetch(e.request)
        .then(function(r){
          const copia = r.clone();
          caches.open(BODEGA).then(function(c){ c.put('/index.html', copia); });
          return r;
        })
        .catch(function(){ return caches.match('/index.html'); })
    );
    return;
  }

  // lo demás: lo guardado si está, y si no la red
  e.respondWith(
    caches.match(e.request).then(function(guardado){
      return guardado || fetch(e.request).then(function(r){
        if(r.ok && r.type === 'basic'){
          const copia = r.clone();
          caches.open(BODEGA).then(function(c){ c.put(e.request, copia); });
        }
        return r;
      });
    })
  );
});
