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

## El camino de la persona

1. **Carga**: el logotipo en degradado con la luz barriéndolo y la barra llenándose.
   Al pie, la firma de AT Designs.
2. **Cuenta**: crear una en tres pasos, o entrar con correo y contraseña. Si ya había
   entrado antes, se salta este paso.
3. **Bienvenida**: el logotipo grande, "Encuentra todo lo que necesites para tu carrera" y
   los dos caminos.
4. **Publicar**: tres pasos. Lo que la cuenta ya sabe (nombre, WhatsApp, carnet, carrera) no
   se vuelve a preguntar.
5. **Comprar**: catálogo con buscador, filtros por categoría y carrera, ficha detallada y
   botón de WhatsApp con el mensaje escrito.

## Las cuentas

La contraseña se guarda cifrada con `scrypt` y una sal distinta por persona, nunca en claro.
La sesión es una cookie `HttpOnly` que dura 30 días, y la llave vive en `sesiones.json`.

El carnet se pide al crear la cuenta pero **el catálogo nunca lo muestra**: se quita antes de
mandar las publicaciones a la página.

## La marca

Unbounded Black para el logotipo, con el degradado rasante a 105 grados.
Paradas: `2E86E8` · `014BA0` · `01204A` · `000000`.
Satoshi para el texto, la misma familia de propiedash.com. Esquinas de 18 px.

## Lo que falta

- Nadie puede borrar ni marcar como vendida su publicación. Ya se sabe de quién es cada una
  (campo `dueno`), así que está a un paso.
- El carnet no se comprueba contra nada. Cualquiera puede inventar un número.
- No hay recuperación de contraseña.
- Sin paginación: con muchas publicaciones se pintan todas de golpe.
