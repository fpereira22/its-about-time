# Ranking y votos

En el título van apareciendo y desapareciendo, translúcidas, las **reseñas** de los jugadores
(promedio de estrellas y comentarios recientes; se ocultan en Ajustes → "Reseñas").
La opción **Top 10** del menú abre la pantalla completa (A/D pasa a las opiniones), donde se vota
con nombre, estrellas y comentario.
No hay login.

## Cómo funciona

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

### Hojas

- `players_info`: `id, nombre, puntaje, misiones, total, actualizado, creado` (una fila por jugador; el puntaje nunca baja).
- `comments`: `fecha, id, nombre, estrellas, comentario, puntaje, misiones` (una fila por voto; el promedio usa el último voto de cada jugador).

El script escribe los encabezados la primera vez. Si ya hay datos, el juego lee por nombre de columna (el orden no importa).

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
para mantener la misma URL.

## Límites conocidos

- Sin login, el puntaje lo informa el navegador: alguien con conocimientos puede inflarlo. El script
  recorta a valores razonables, limita la frecuencia (5 s por puntaje, 30 s por voto) y no deja usar
  un nombre que ya tiene otro jugador. Para borrar una fila tramposa, se borra en la planilla.
- Los nombres admiten letras (con acentos), números, espacios y `. _ -`, de 2 a 16 caracteres.
  Comentarios hasta 280. Los textos que empiezan con `= + - @` se guardan con `'` delante (no son fórmulas).
- Si borras el `localStorage`, el jugador pierde su identidad y tendría que elegir otro nombre.
