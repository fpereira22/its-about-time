# Formato de mapa

Los mapas viven en `src/data/maps/<id>.json` y se cargan automáticamente (`import.meta.glob` en `src/systems/GameMap.ts`). El formato está pensado para escribirse a mano **y** para generarse más adelante desde OpenStreetMap con un script: cada fila es un string de caracteres, y una leyenda traduce cada carácter a un tipo de tile.

Tipos TypeScript: `MapData` y relacionados en `src/types/map.ts`.

## Convenciones

- Coordenadas en **tiles** (no píxeles). `x` crece hacia el oriente (derecha), `y` hacia el sur (abajo). Origen `(0, 0)` arriba a la izquierda.
- Un tile mide **16×16 px**. La resolución lógica del juego es 320×180 (20×11,25 tiles visibles).
- Los personajes se dibujan anclados **abajo al centro** de su tile (`origin (0.5, 1)`). La profundidad depende de su `y`, así quien está más al sur se dibuja encima.
- En `labels`, `x` e `y` aceptan decimales (ej. `12.5`) para centrar texto entre tiles.

## Campos

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | string | sí | Identificador único. Lo usan warps, `npcs.json`, `rides.json` y la misión |
| `name` | string | sí | Nombre legible. En interiores sin zonas se muestra como cartel al entrar |
| `kind` | `"overworld"` \| `"interior"` | sí | Escena que lo carga: `Overworld` o `Interior` |
| `tileSize` | number | sí | Siempre `16` (ver nota al final) |
| `width`, `height` | number | sí | Tamaño en tiles. Debe calzar con `rows` |
| `legend` | objeto | sí | Carácter → clave de tile (o autotile de edificio) |
| `rows` | string[] | sí | `height` strings de `width` caracteres cada uno |
| `background` | string (color CSS) | no | Fondo de la cámara fuera del mapa. Por defecto `#101018` |
| `spawns` | objeto | sí | Puntos de aparición con nombre |
| `warps` | arreglo | no | Tiles que llevan a otro mapa/spawn al pisarlos |
| `zones` | arreglo | no | Rectángulos con nombre de calle/lugar (cartel al entrar) |
| `triggers` | arreglo | no | Rectángulos que disparan un evento de historia al pisarlos |
| `labels` | arreglo | no | Letreros de texto fijos en el mundo |
| `crowd` | objeto | no | Gente de relleno: pasajeros en los asientos y de pie en áreas |
| `region` | `"cali"` | no | En Cali el tráfico lleva taxis amarillos y el bus alimentador, y la gente dice otras frases (por defecto, Santiago) |
| `lights` | arreglo | no | Guirnaldas de ampolletas que brillan de noche: `{ "x", "y", "w" }` en tiles (de `(x, y)` a lo ancho de `w`) |

### `legend` y `rows`

```json
"legend": { ".": "vereda", "=": "calle", "-": "calle_linea_h", "#": "edificio", "G": "edificio:vidrio", "M": "metro" },
"rows": [
  "######",
  "......",
  "======"
]
```

Cada carácter de cada fila debe estar en `legend`. Los valores son claves del catálogo de tiles (abajo) o un autotile de edificio. Los caracteres los elige cada mapa; los mapas actuales usan esta convención:

| Carácter | Tile | Carácter | Tile |
|---|---|---|---|
| `.` | `vereda` | `#` | `edificio` |
| `=` | `calle` | `G` | `edificio:vidrio` |
| `-` | `calle_linea_h` | `D` | `puerta` |
| `\|` | `calle_linea_v` | `M` | `metro` |
| `z` | `cebra_h` | `X` | `metro_cerrado` |
| `Z` | `cebra_v` | `~` | `agua` |
| `"` | `pasto` | `_` | `baranda` |
| `*` | `pasto_flor` | `t` | `arbol_vereda` |
| `T` | `arbol` | `P` | `arbol_plaza` |
| `a` | `adoquin` | `B` | `banca_plaza` |
| `f` / `b` / `k` | `farol` / `banca` / `basurero` | | |

### `spawns`

```json
"spawns": {
  "inicio": { "x": 4, "y": 19, "dir": "right" },
  "metro_tobalaba": { "x": 204, "y": 19, "dir": "up" }
}
```

`dir` es `up`, `down`, `left` o `right`. El spawn debe estar dentro del mapa. Conviene que **no** esté sobre un tile de warp.

### `warps`

```json
"warps": [
  { "x": 22, "y": 13, "to": "metro_baquedano", "spawn": "entrada" },
  { "x": 150, "y": 13, "to": "providencia", "spawn": "atajo_salida", "if": { "flag": "conoce_atajo" }, "blockedDialogue": "atajo_cerrado" }
]
```

- Se activa al **terminar un paso** sobre `(x, y)`: fade y cambio de escena (Overworld o Interior según el `kind` del destino). `to` puede ser el mismo mapa (escaleras entre andenes).
- `if` (opcional): condición (ver README). Si no se cumple y hay `blockedDialogue`, se abre ese diálogo y el jugador retrocede un tile.
- El tile del warp debe ser caminable (`metro`, `escalera`, `puerta`, etc.).

### `zones`

```json
"zones": [
  { "name": "Av. Andrés Bello", "subtitle": "Ribera del Mapocho", "x": 0, "y": 0, "w": 212, "h": 8 },
  { "name": "Av. Salvador", "subtitle": "Av. Providencia", "x": 30, "y": 8, "w": 34, "h": 22 }
]
```

Al entrar a una zona con otro nombre se muestra un cartel (`name` + `subtitle`). Si las zonas se solapan, **gana la primera de la lista**: pon las más específicas antes.

### `triggers`

```json
"triggers": [
  { "id": "puerta_costanera", "x": 182, "y": 13, "w": 1, "h": 1, "event": "llegar_costanera" }
]
```

Al terminar un paso dentro del rectángulo se emite el evento de historia `event`. Puede ser el `victoryEvent` de la misión o el nombre de un script de `StoryScripts`.

- `if` (opcional): solo se dispara si se cumple la condición.
- `once: true`: se dispara una sola vez por partida (guarda la flag `trigger_<idMapa>_<id>`).

### `labels`

```json
"labels": [{ "x": 182, "y": 10, "text": "COSTANERA CENTER" }]
```

Texto centrado en `(x, y)` con fuente HUD sobre fondo azul semitransparente. `color` es opcional (CSS). Se dibuja sobre todo lo demás.

### `crowd`

```json
"crowd": {
  "lines": "metro",
  "seats": 0.65,
  "areas": [{ "x": 0, "y": 3, "w": 22, "h": 2, "count": 6, "dir": "up" }]
}
```

- `lines`: grupo de frases de `src/data/crowd.json` → `lines` (al hablarle, cada persona dice una al azar). Los personajes que pueden aparecer y su nombre están en `crowd.json` → `people`.
- `seats`: fracción de los tiles de asiento (`vagon_asiento`, `vagon_asiento_s`, `micro_asiento`) que se ocupan. Siempre quedan al menos 3 libres para que el jugador se siente.
- `areas`: rectángulos donde se para gente; `count` personas por área y `dir` opcional (hacia dónde miran casi siempre).
- Nunca se pone a nadie en spawns, warps, triggers, sobre un NPC ni al lado de uno (para poder hablarle), y solo se ocupa un lugar si no tapa el pasillo. Si no cabe, se pone menos gente.
- En un viaje en metro, cada vez que se abren las puertas se baja y sube gente.

## Validación

`GameMap` valida cada mapa la primera vez que se carga y lanza un error con el mapa y la fila si:

- `rows.length` no es igual a `height`, o alguna fila no mide `width` caracteres;
- un carácter no está en `legend`;
- una clave de tile no existe en `TILE_DEFS` (salvo `edificio`);
- un `edificio:<estilo>` usa un estilo inexistente;
- un spawn queda fuera del mapa;
- un warp apunta a un mapa o spawn que no existe.

**No se valida:** que zonas, triggers y labels estén dentro del mapa, que el `dir` de un spawn sea válido, ni que los diálogos referenciados existan (eso se reporta recién al abrirlos).

## Catálogo de tiles

Definidos en `src/art/tiles.ts` (`TILE_DEFS`). La solidez es propiedad del tipo de tile.

**Exterior**

| Clave | Sólido | Clave | Sólido |
|---|---|---|---|
| `pasto` | no | `arbol` (sobre pasto) | sí |
| `pasto_flor` | no | `arbol_vereda` | sí |
| `vereda` | no | `arbol_plaza` (sobre adoquín) | sí |
| `adoquin` | no | `banca` (sobre vereda) | sí |
| `calle` | no | `banca_plaza` (sobre adoquín) | sí |
| `calle_linea_h` (línea central E-O) | no | `farol` | sí |
| `calle_linea_v` (línea central N-S) | no | `basurero` | sí |
| `cebra_h` (franjas horizontales: cruzar una calle E-O) | no | `metro_cerrado` | sí |
| `cebra_v` (franjas verticales: cruzar una calle N-S) | no | `agua` | sí |
| `metro` (escalera de acceso) | no | `baranda` | sí |
| `puerta` (puerta de vidrio) | no | `vacio` | sí |

**Interior: estación**

| Clave | Sólido | Clave | Sólido |
|---|---|---|---|
| `piso` | no | `muro` (cara de muro) | sí |
| `piso_linea` (borde amarillo del andén) | no | `muro_techo` (parte superior del muro) | sí |
| `escalera` | no | `via` | sí |
| | | `torniquete` | sí |

**Interior: vagón y micro**

| Clave | Sólido | Clave | Sólido |
|---|---|---|---|
| `vagon_piso` | no | `vagon_asiento`, `vagon_ventana`, `vagon_muro`, `vagon_puerta`, `barra` | sí |
| `micro_piso` | no | `micro_asiento`, `micro_ventana`, `micro_puerta`, `micro_tablero` | sí |

### Autotile de edificios

En la leyenda, `edificio` o `edificio:<estilo>` se resuelven por posición, mirando los vecinos de arriba y abajo en la misma columna:

| Situación | Tile resultante |
|---|---|
| El tile de abajo no es edificio | `<estilo>_fachada` o `<estilo>_vitrina` (1 de cada 3 aprox., según la posición): fachada a nivel de calle |
| El de abajo es edificio pero el de 2 más abajo no | `<estilo>_fachada_alta` (ventanas) |
| El de arriba no es edificio | `<estilo>_borde` (borde iluminado del techo) |
| En otro caso | `<estilo>_techo`, o de vez en cuando `<estilo>_techo_equipo` (aire acondicionado) o `<estilo>_techo_claraboya` |

- Estilos: `ladrillo`, `crema`, `gris`, `vidrio`. Con `edificio` a secas, el estilo se elige de forma determinista entre `ladrillo`, `crema` y `gris`. Cambia cada **5 columnas** (un "edificio" por segmento) según la fila superior de la manzana, así toda la columna de una manzana comparte estilo.
- Todos los tiles de edificio son sólidos.
- La vista es cenital con fachadas hacia el sur (estilo Pokémon): las manzanas al sur de una calle muestran techo hacia ella.
- Para meter algo en una fachada (puerta, acceso a metro), reemplaza ese carácter por `D` o `M`. El autotile recalcula los vecinos.

## Ejemplo mínimo completo

Un mapa de 12×8 válido: una cuadra con fachadas, vereda, calle, un acceso al metro y un parque.

```json
{
  "id": "ejemplo",
  "name": "Calle de ejemplo",
  "kind": "overworld",
  "tileSize": 16,
  "width": 12,
  "height": 8,
  "legend": {
    ".": "vereda",
    "=": "calle",
    "-": "calle_linea_h",
    "#": "edificio",
    "\"": "pasto",
    "T": "arbol",
    "M": "metro"
  },
  "rows": [
    "############",
    "############",
    "............",
    "============",
    "------------",
    "============",
    "....M.......",
    "\"\"T\"\"\"\"\"\"T\"\""
  ],
  "zones": [{ "name": "Calle de ejemplo", "subtitle": "Santiago", "x": 0, "y": 0, "w": 12, "h": 8 }],
  "spawns": { "inicio": { "x": 1, "y": 2, "dir": "down" } },
  "warps": [{ "x": 4, "y": 6, "to": "metro_baquedano", "spawn": "entrada" }],
  "triggers": [{ "id": "saludo", "x": 8, "y": 2, "w": 1, "h": 1, "event": "start_ride", "once": true, "if": { "flag": "nunca" } }],
  "labels": [{ "x": 4, "y": 5.5, "text": "METRO" }]
}
```

Para probarlo, guárdalo como `src/data/maps/ejemplo.json` y llévalo desde otro mapa con un warp (`"to": "ejemplo", "spawn": "inicio"`). El trigger del ejemplo nunca se dispara (la flag `nunca` no existe); está solo para mostrar el formato.

## Generar mapas desde OpenStreetMap (futuro)

Todavía no hay script. Este es el pipeline propuesto para una herramienta en Python que escriba este mismo JSON (por ejemplo `tools/osm2map.py`, con `requests` + `shapely` + `pyproj`).

1. **Descargar.** Consulta Overpass por *bbox* (ej. Plaza Baquedano → Tobalaba):
   - `way[highway]` (calles con `name`, `highway`, `lanes`, `oneway`);
   - `way[building]` / `landuse` (manzanas);
   - `leisure=park` y `landuse=grass` (parques);
   - `waterway` / `natural=water` (Mapocho, canales);
   - `railway=subway_entrance` y `station=subway` (accesos y estaciones de metro);
   - `highway=bus_stop` (paraderos).
2. **Proyectar a metros** (UTM 19S, EPSG:32719) para trabajar con distancias reales.
3. **Compresión esquemática.** El juego no usa escala real:
   - una escala distinta por eje (ej. el eje de la avenida principal comprimido ~10× y el transversal ~4×);
   - o un remapeo por tramos: fija el **orden** de las calles transversales y asigna a cada tramo un ancho en tiles (ej. 30–34), sin importar su largo real;
   - las calles se alinean a la grilla (enderezar a ejes E-O / N-S cuando la desviación sea menor a ~20°).
4. **Rasterizar a grilla de 16 px** (un carácter por celda):
   - calles como pasillos: `=` con una línea central `-` (E-O) o `|` (N-S), con un ancho según `highway`/`lanes` (ej. 3 tiles para avenidas, 2 para calles);
   - una fila de vereda `.` a cada lado;
   - manzanas y edificios = muros `#` (el autotile pone techos y fachadas);
   - parques `"` con árboles `T` cada N tiles;
   - agua `~` con baranda `_` en los bordes.
5. **Cruces peatonales.** En cada intersección, `cebra_h` (`z`) en las columnas a cada lado de la calle transversal sobre la calle E-O, y `cebra_v` (`Z`) en las filas de vereda que cruzan la calle N-S.
6. **Nombres de calle → `zones`.** Un rectángulo por tramo entre transversales, con `name` = nombre de la transversal y `subtitle` = avenida principal. Las zonas específicas (parques, edificios notables) van primero.
7. **Estaciones → `spawns` y `warps`.** Cada `subway_entrance` se rasteriza como `M` en el borde de la manzana más cercana (fuera de la fila de vereda transitable). Se agrega un spawn `metro_<estacion>` en la vereda adyacente y un warp hacia el mapa interior correspondiente.
8. **Paraderos.** Se exportan como sugerencias de posición para NPCs `object: "paradero"` (no como tiles).
9. **Salida.** El script escribe `src/data/maps/<id>.json` y un `<id>.report.txt` con lo descartado (calles sin nombre, geometrías muy chicas).

**Se deja manual:** NPCs y objetos (`npcs.json`), `triggers` de historia, `labels` decorativos, ajustes finos de decoración (faroles, bancas) y la ubicación de puertas o atajos con significado narrativo. El generador no debe sobrescribir esas partes: lo ideal es que mezcle su salida con un archivo de *overrides* escrito a mano.

## Nota sobre `tileSize`

El campo existe para el futuro, pero hoy el movimiento, la cámara y los sprites usan la constante `TILE = 16` (`src/config/display.ts`). Usa siempre `16`.
