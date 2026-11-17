# Ranking, votos, respaldo en la nube y datos de uso

Todo pasa por la misma planilla de Google y el mismo Apps Script ([`apps-script/Ranking.gs`](../apps-script/Ranking.gs)):

| Hoja | Qué guarda | ¿Pública? |
| --- | --- | --- |
| `players_info` | Ranking: una fila por jugador | Sí (el juego la lee como CSV) |
| `comments` | Votos y reseñas | Sí |
| `player_data` | Respaldo del progreso: una fila por jugador | **No** |
| `metadata_local` | Datos de uso: una fila por sesión | **No** |
| `resumen` | Fórmulas sobre las dos anteriores (la arma `crearResumen()`) | **No** |

> **Importante:** en *Archivo → Compartir → Publicar en la web*, publica **solo** `players_info` y
> `comments` (una por una), nunca "Todo el documento": si no, cualquiera con el link vería los
> respaldos y los datos de uso. Más seguro todavía: pon las hojas privadas en otra planilla y pega su
> id en `PRIVATE_SPREADSHEET_ID` del script.

## Ranking y votos

En el título van apareciendo y desapareciendo, translúcidas, las **reseñas** de los jugadores
(promedio de estrellas y comentarios recientes; se ocultan en Ajustes → "Reseñas").
La opción **Top 10** del menú abre la pantalla completa (A/D pasa a las opiniones), donde se vota
con nombre, estrellas y comentario.
No hay login.

### Cómo funciona

| Qué | Por dónde |
| --- | --- |
| Leer | La planilla publicada en la web, hoja por hoja como CSV (`src/config/ranking.ts`). Google tarda ~5 min en reflejar cambios; mientras, el juego muestra lo que el propio jugador acaba de enviar. |
| Escribir | La aplicación web de Apps Script [`apps-script/Ranking.gs`](../apps-script/Ranking.gs). |
| Puntaje | Todo lo conseguido en **Progreso** (`Records.totals().found`): coleccionables, secretos, logros y finales. Desempata misiones completadas y después quién llegó antes. |
| Nombre | La primera vez que se abre el juego, un saludo pide el nombre (`Ranking.setDraftName`). Solo se guarda en el navegador: rellena el formulario de votos y no se publica hasta que el jugador envía. Con "Ahora no" no se vuelve a pedir. |
| ¿Lo disfrutas? | Al completar misiones (`shouldAskEnjoy`: a las 2 completadas y después cada 3, máximo 3 veces) sale "¿Estás disfrutando el juego?". Sí abre el voto con 5 estrellas; Más o menos lo abre pidiendo qué mejorar. No sale si ya votó o eligió "No volver a preguntar". Ninguno de los dos avisos sale con el navegador automatizado (`navigator.webdriver`, las capturas de las promos). |
| Identidad | Una llave al azar en `localStorage` (`santiago-laberinto:ranking-player`). La planilla guarda solo un hash de 12 caracteres (`id`), así nadie puede escribir en la fila de otro aunque la planilla sea pública. |

El puntaje se publica solo cuando el jugador ya tiene nombre: al completar una misión y al volver al
título (si subió). En modo admin no se publica solo (todo está desbloqueado); el formulario sí envía.

### Hojas del ranking

- `players_info`: `id, nombre, puntaje, misiones, total, actualizado, creado` (una fila por jugador; el puntaje nunca baja).
- `comments`: `fecha, id, nombre, estrellas, comentario, puntaje, misiones` (una fila por voto; el promedio usa el último voto de cada jugador).

El script escribe los encabezados la primera vez. Si ya hay datos, el juego lee por nombre de columna (el orden no importa).

## Respaldo en la nube (`player_data`)

El juego sigue guardando todo en `localStorage` como siempre; [`src/systems/CloudSave.ts`](../src/systems/CloudSave.ts)
copia esas claves a la planilla en segundo plano, sin avisar.

- **Partes**: el progreso va en columnas separadas, cada una comprimida (gzip + base64, `gz1:...`):
  `partida` (la automática), `espacios` (los 3 de guardado), `progreso` (Progreso, código Konami y
  récord de la culebrita), `stats` (minijuegos), `ajustes` y `jugador` (nombre, voto, etc., sin la llave).
  Las claves de cada una están en [`src/systems/storageKeys.ts`](../src/systems/storageKeys.ts).
- **Liviano**: cada minuto revisa si algo cambió (hash de cada parte) y sube **solo las partes que
  cambiaron**, como mucho cada 3 min; al completar una misión o guardar en un espacio sube a los pocos
  segundos, y al ocultar o cerrar la pestaña también (con `keepalive`).
- **Carga específica**: al abrir el juego pide solo los hashes (`load` con `parts: []`). Si otro
  dispositivo cambió una parte y acá no se tocó desde la última vez, baja **solo esa parte** y recarga
  el título. Si cambió en los dos lados, gana este dispositivo.
- **Código de jugador**: está en Ajustes (también en la pausa); en un dispositivo sin partidas, además, en el menú del título ("Tengo un código") y en el saludo de la primera vez ("¿Ya jugaste en otro dispositivo?"). Es la llave secreta del jugador escrita en 26
  letras (`XXXXX-XXXXX-XXXXX-XXXXX-XXXXXX`). Escrito en otro dispositivo, trae todo el progreso
  (reemplaza el de ese dispositivo, avisando antes) y ese dispositivo pasa a ser el mismo jugador,
  también en el ranking.
- Columnas legibles para mirar la planilla sin descomprimir: `nombre, creado, actualizado, rev,
  dispositivo, mision, misiones, puntaje, minutos_juego, bytes`.
- No corre en modo admin (ni en `npm run dev`) ni con el navegador automatizado.

## Datos de uso (`metadata_local`)

[`src/systems/UsageStats.ts`](../src/systems/UsageStats.ts) crea una fila por sesión y la actualiza
cada 3 min y al ocultar la pestaña. Recargar la página sigue la misma sesión; volver después de 30 min
oculto empieza otra.

| Columna | Qué es |
| --- | --- |
| `sesion`, `jugador` | Id de la sesión y el mismo `id` del ranking / respaldo (para unir hojas) |
| `inicio`, `ultimo` | Hora del servidor (zona de la planilla) |
| `minutos` | Minutos con el juego visible |
| `jugando` | Minutos en un mapa o minijuego, tocando algo en los últimos 90 s |
| `fecha_local`, `hora_local`, `dia` | Fecha, hora (0–23) y día **del jugador** |
| `visita`, `nuevo` | Número de sesión de ese navegador; `sí` en la primera |
| `pais`, `region`, `ciudad` | Aproximados, según la IP ([geojs.io](https://www.geojs.io/), gratis y sin llave). Vacíos si un bloqueador lo frena |
| `ip_hash` | Hash de la IP con una sal secreta (Propiedades del script): cuenta conexiones distintas. **La IP no se guarda** |
| `zona_horaria`, `idioma` | Del navegador (sirven de respaldo si no hay ubicación) |
| `dispositivo`, `so`, `navegador`, `pantalla`, `pwa` | movil/tablet/escritorio, sistema, navegador, resolución y si está instalada como app |
| `origen` | `?ref=` o `?utm_source=` del link (ej. `…/?ref=instagram`), si no el sitio que lo mandó, si no `directo` |
| `mision`, `misiones`, `puntaje` | Dónde va al final de la sesión |

Se apaga en **Ajustes → Datos de uso** (y no corre en modo admin). El aviso está en la ventana del
código de jugador.

**Para medir campañas**: comparte links con `?ref=` distinto por canal (`?ref=tiktok`,
`?ref=instagram`, `?ref=amigos`) y mira el bloque "Por origen" del resumen.

## Hoja `resumen`

Después de instalar el script, elige `crearResumen` arriba en el editor y ▶ **Ejecutar** (una vez).
Arma la hoja con fórmulas que se actualizan solas: jugadores distintos, sesiones, nuevos vs. que
volvieron, minutos jugando (total y promedio), sesiones de hoy y de 7 días, y tablas por país,
ciudad, día, hora local, día de la semana, equipo, origen y "hasta dónde llegan" (cuántos jugadores
tienen 0, 1, 2… misiones completadas). Para gráficos: selecciona una tabla → Insertar → Gráfico.
Si cambias columnas del script, vuelve a correrla.

## Instalar el Apps Script (una vez)

1. Abre la planilla → **Extensiones → Apps Script**.
2. Borra lo que haya en `Código.gs` y pega el contenido de `apps-script/Ranking.gs`. Guarda.
3. **Implementar → Nueva implementación** → tipo **Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
4. Autoriza los permisos (Google avisa que la app "no está verificada": *Configuración avanzada → Ir a…*).
5. Copia la URL que termina en `/exec` y pégala en `RANKING_SCRIPT_URL` de `src/config/ranking.ts`.
6. Comprueba: abrir la URL en el navegador debe mostrar `{"ok":true,"service":"its-about-time-ranking"}`.

Si cambias el script después, usa **Implementar → Gestionar implementaciones → editar → Versión nueva**
para mantener la misma URL. (Abrir la URL debe decir `"version":2` con el respaldo y los datos de uso.)

Las hojas `player_data` y `metadata_local` pueden estar vacías o con encabezados propios sin datos:
el script escribe los suyos la primera vez.

## Límites conocidos

- Sin login, el puntaje lo informa el navegador: alguien con conocimientos puede inflarlo. El script
  recorta a valores razonables, limita la frecuencia (5 s por puntaje, 30 s por voto) y no deja usar
  un nombre que ya tiene otro jugador. Para borrar una fila tramposa, se borra en la planilla.
- Los nombres admiten letras (con acentos), números, espacios y `. _ -`, de 2 a 16 caracteres.
  Comentarios hasta 280. Los textos que empiezan con `= + - @` se guardan con `'` delante (no son fórmulas).
- Si borras el `localStorage`, el jugador pierde su identidad, salvo que haya anotado su código de jugador.
- Quien tenga el código de un jugador puede usar su progreso (y su nombre en el ranking). Por eso se
  muestra solo en Ajustes, con el aviso de guardarlo en privado.
- Apps Script atiende ~30 ejecuciones a la vez y cada escritura toma el candado de la planilla. Con
  ~2 envíos por jugador cada 3 min alcanza para unos cientos de jugadores simultáneos; si el juego crece
  más, conviene pasar el respaldo y los datos de uso a un servidor de verdad (Supabase, Firebase).
- Una parte que comprimida pasa de 48.000 caracteres (el límite de una celda es 50.000) no se sube y
  queda solo en el navegador. Hoy cada parte pesa unos pocos KB.
