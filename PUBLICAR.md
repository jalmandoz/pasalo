# Cómo poner Pásalo en internet

El proyecto ya está listo y conectado a Vercel como **pasalo**. Falta una sola cosa: dónde se
guardan los datos.

## Por qué hace falta una base de datos

Cuando Pásalo corre en tu máquina, todo vive en archivos dentro de `datos/`: las cuentas, las
publicaciones y las fotos. **Vercel no guarda archivos.** Cada vez que alguien entra, el
servidor arranca limpio, así que todo lo que se hubiera guardado se pierde.

Por eso el código ya está separado en dos: la lógica (`lib/logica.js`) no sabe dónde se
guardan las cosas, y `lib/datos.js` decide. Si encuentra una base de datos la usa; si no, usa
archivos. No hay que tocar nada más.

## Los dos pasos que faltan (unos 3 minutos)

### 1. La base de datos

1. Entra a **vercel.com** y abre el proyecto **pasalo**
2. Pestaña **Storage** → **Create Database** → elige **Postgres** (Neon)
3. Nómbrala `pasalo-datos`, región la más cercana (Washington D.C. suele ser la mejor desde
   Venezuela)
4. Cuando la cree, dale **Connect** al proyecto pasalo

Con eso aparece sola la variable `POSTGRES_URL` y el código la detecta. Las tablas se crean
solas la primera vez, no hay que hacer nada más.

### 2. Las fotos

1. Misma pestaña **Storage** → **Create Database** → elige **Blob**
2. Nómbrala `pasalo-fotos` y dale **Connect** al proyecto

Aparece la variable `BLOB_READ_WRITE_TOKEN` y las fotos empiezan a guardarse ahí. Blob las
sirve por su cuenta desde su CDN, así que cargan rápido.

Las dos cosas tienen capa gratis. Para el tamaño de Pásalo no se paga nada.

## Y ya

Cuando estén conectadas:

```
cd ~/pasalo && vercel --prod
```

## Si prefieres otra cosa

El código no depende de Vercel. Para cambiar de base de datos solo hay que escribir otro
archivo como `lib/datos-postgres.js` con las mismas nueve funciones, y apuntarlo desde
`lib/datos.js`. Supabase, Neon directo, Turso, lo que sea.
