# Pásalo

Marketplace de reventa entre estudiantes universitarios.

## Arrancarlo

```
node servidor.js
```

Queda en http://localhost:4322

## Qué hay dentro

- `index.html` · toda la pantalla: carga, cuenta, bienvenida, publicar y comprar
- `servidor.js` · sirve la página, las cuentas y las publicaciones. Sin dependencias
- `datos/` · lo que la gente crea. No va a git
  - `usuarios.json` · las cuentas, con la contraseña cifrada
  - `sesiones.json` · quién está dentro ahora mismo
  - `publicaciones.json` · lo que se publicó
  - `fotos/` · las fotos de cada publicación
  - `caras/` · las fotos de perfil

## El camino de la persona

1. **Carga**: el logotipo en degradado con la luz barriéndolo y la barra llenándose.
   Al pie, la firma de AT Designs.
2. **Cuenta**: primero dos botones, crear cuenta o iniciar sesión. Cada uno abre su
   formulario y se puede volver atrás. Crear cuenta son tres pasos. Si ya había entrado
   antes, toda esta pantalla se salta.
3. **Bienvenida**: el logotipo grande, "Encuentra todo lo que necesites para tu carrera" y
   los dos caminos.
4. **Publicar**: tres pasos. Lo que la cuenta ya sabe (nombre, WhatsApp, carnet, carrera) no
   se vuelve a preguntar.
5. **Comprar**: **cada universidad tiene su propio catálogo**. Solo se ve lo publicado por
   gente de la tuya, sin forma de mirar las otras. Debajo, buscador, filtros por categoría y
   carrera, ficha detallada y botón de WhatsApp con el mensaje escrito.

## La barra de arriba y el perfil

Cuando hay sesión, arriba se queda una barra fija: el logotipo a la izquierda, que lleva al
inicio, y a la derecha la foto de perfil con el nombre. Al tocarla se abre el perfil.

El perfil tiene la foto, el nombre, la universidad y la carrera; los datos de la cuenta
(correo, WhatsApp, carnet y desde cuándo); todo lo que esa persona ha publicado; y el botón de
cerrar sesión.

La foto se puede cambiar o quitar. Se recorta cuadrada y se achica a 400 px en el navegador
antes de subirla, y al cambiarla se borra la anterior del disco para que no se acumulen.
Quien no tenga foto ve la inicial de su nombre sobre el cobalto.

## Universidades y carreras

La lista de universidades son las 28 con sede en Caracas, más "Otra": las autónomas y
experimentales públicas, las privadas, y los institutos y colegios universitarios. Salió de
Wikipedia y del sitio de la UCV, no de memoria.

La carrera es un campo abierto con 54 sugerencias, porque cada universidad le pone su propio
nombre a lo mismo. El filtro del catálogo no usa esa lista: se arma con las carreras que de
verdad aparecen publicadas, y se esconde si todavía no hay ninguna.

## Las cuentas

La contraseña se guarda cifrada con `scrypt` y una sal distinta por persona, nunca en claro.
La sesión es una cookie `HttpOnly` que dura 30 días, y la llave vive en `sesiones.json`.

El carnet se pide al crear la cuenta pero **el catálogo nunca lo muestra**: se quita antes de
mandar las publicaciones a la página.

El corte por universidad **lo hace el servidor, no la página**. `GET /api/publicaciones` pide
sesión y solo devuelve lo de la universidad de quien pregunta. Aunque alguien abra la API a
mano, no ve otra universidad.

## La marca

Unbounded Black para el logotipo, con el degradado rasante a 105 grados.
Paradas: `2E86E8` · `014BA0` · `01204A` · `000000`.
Satoshi para el texto, la misma familia de propiedash.com. Esquinas de 18 px.

## Editar y borrar

Cuando abres una publicación tuya, en vez del botón de WhatsApp salen **Editar** y **Borrar**.
Editar abre el mismo formulario de publicar, ya cargado con todo, y el botón final dice
"Guardar cambios". Borrar pide confirmación antes, porque no se puede deshacer, y se lleva las
fotos del disco.

El servidor comprueba que la publicación sea tuya en las dos operaciones. Tocar la de otro
devuelve 403 y sin sesión 401. Las fotos que ya estaban se conservan tal cual al editar; solo
se sube lo nuevo, y lo que quitaste se borra del disco.

## Lo que falta

- No se puede marcar algo como vendido, solo borrarlo.
- El carnet no se comprueba contra nada. Cualquiera puede inventar un número.
- No hay recuperación de contraseña.
- Sin paginación: con muchas publicaciones se pintan todas de golpe.
