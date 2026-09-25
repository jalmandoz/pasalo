// Pásalo es una página web, no una app que se instala.
// Este archivo solo existe para retirar el trabajador de fondo que llegó a
// estar publicado un rato, y borrar lo que hubiera guardado.
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys()
      .then(function(cuales){
        return Promise.all(cuales.map(function(c){ return caches.delete(c); }));
      })
      .then(function(){ return self.registration.unregister(); })
      .then(function(){ return self.clients.matchAll(); })
      .then(function(paginas){ paginas.forEach(function(p){ p.navigate(p.url); }); })
  );
});
