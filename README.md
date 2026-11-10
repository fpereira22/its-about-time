# It's About Time

Juego web 2D top-down en pixel art, estilo GBA, ambientado en calles reales de Santiago de Chile (comprimidas y esquemáticas). Este repositorio contiene siete misiones del Modo Historia: **Misión 1: "De Baquedano al Costanera"**, **Misión 2: "La prueba de Optimización"**, **Misión 3: "Rumbo a Cali"**, **Misión 4: "Primer día en la U"**, **Misión 5: "Un martes cualquiera"**, **Misión 6: "Letras sobre el río"** y **Misión 7: "Lluvia en el piso 8"**. Al elegir *Nueva partida* en el título se elige la misión.

En pantalla, la misión 1 se llama **Prólogo** (es el tutorial) y las demás se muestran corridas en uno: `mission02` es "Misión 1", `mission07` es "Misión 6" (`missionLabel` en `src/systems/Mission.ts`). Este README y el código siguen usando los números internos.

El nombre del juego está en `src/config/game.ts` (`GAME_TITLE`).

Stack: **Phaser 3 + TypeScript (strict) + Vite**. Sin backend. Todo el contenido (mapas, NPCs, diálogos, viajes, misión) es **data-driven** (JSON en `src/data/`).

---

## Requisitos y comandos

- Node.js 20.12 o superior (probado con Node 24 / npm 11).

```bash
npm install && npm run dev   # abre el juego en el navegador (Vite)
npm run build                # typecheck + build de producción en dist/
npm run typecheck            # solo tsc --noEmit (código y tests)
npm test                     # tests (Vitest); npm run test:watch los repite al guardar
npm run check                # todo lo que corre el CI: tipos, tests y build
npm run preview              # sirve el build de dist/ (con el service worker)
npm run icons                # regenera los íconos de la app instalable (public/icons/)
```

### Tests y CI

Los tests están en `tests/` y corren con Vitest sobre jsdom (`vitest.config.ts`; `tests/setup.ts` simula el canvas que Phaser pide al importarse y vacía `localStorage` antes de cada test).

- **Lógica:** condiciones (`conditions.test.ts`), partida y migración de guardados (`saveData.test.ts`) y ajustes (`settings.test.ts`).
- **Integridad del contenido** (`content.test.ts`): cada `next` / `goto` / `branches` apunta a un nodo que existe; los efectos nombran viñetas, ítems, mapas y spawns, mensajes, llamadas y sonidos que existen; warps, `enter` y fauna de los mapas; NPCs; ítems con `use`; inicio y coleccionables de cada misión. Si agregas contenido con un typo, `npm test` dice dónde (antes solo aparecía en la consola al jugar justo esa parte).

`.github/workflows/ci.yml` corre tipos, tests y build en cada push (a cualquier rama) y en cada pull request.

### Build y app instalable

El build sale en varios archivos (ver `vite.config.ts`): `phaser` (el motor, que el navegador guarda entre versiones), el juego, y dos chunks con el contenido de la historia: `dialogues` (`src/data/dialogues.ts`) y `vinetas_index` (`src/art/vinetas_index.ts`). Esos dos se piden apenas arranca el juego y llegan mientras se ve el título (`src/systems/Content.ts`); el título los espera antes de entrar a un mapa y, si aún no llegan, muestra "Cargando la historia...".

En producción el juego es una **PWA**: `public/manifest.webmanifest` y los íconos permiten instalarlo en el celular o el PC, y el service worker (`pwa/service-worker.js`, que el plugin de `vite.config.ts` completa con la lista de archivos de cada build como `dist/sw.js`) descarga el juego entero la primera vez, así que después se puede jugar sin internet. Cada build nuevo cambia la versión del caché y borra la anterior. En `npm run dev` no se registra.

> **Aviso de npm 11:** al instalar puede aparecer `npm warn allow-scripts ... esbuild@... (postinstall)`. Es inofensivo: npm no ejecutó el script de postinstalación de esbuild, pero el binario de la plataforma ya viene como dependencia opcional y Vite funciona igual.

## Controles

| Tecla | Acción |
|---|---|
| **WASD** o **flechas** | Caminar en grilla (un toque corto solo gira al personaje) |
| **F** o **Shift** | Filigrana en el partido (misión 4); gritar «¡Marco!» / «¡Polo!» en la piscina y «¡Cinco!» en el juego de cartas (misión 5); respirar de lado en la clase de natación y prender la linterna del celular en el apagón (misión 6); secarte las lágrimas de la cebolla y colar los fideos (misión 7) |
| **E** (también Enter / Espacio) | Interactuar con lo que está enfrente · avanzar o completar el texto · sentarse en un asiento libre del metro o la micro (para pararse, camina) |
| **W / S** + **E** | Elegir una opción de respuesta en un diálogo |
| **Esc** | Menú de pausa (misión actual, inventario, ropa, guardar, cargar, ajustes, salir) |
| **Tab** | Inventario: ver Bip! y efectivo, y usar ítems (comer, leer, ver saldo) |
| **M** | Silenciar / activar el sonido (se recuerda entre partidas; es el mismo "Sonido" de Ajustes) |
| **Q** | Celular (mensajes, Bip!, mapa, metro, misión, cámara, culebrita, teléfono y Mi U: el correo de la universidad). La app **Mapa** deja el celular en la mano, al costado, con la ruta, cuánto falta y las paradas que quedan (no pausa); **Q** lo guarda |
| **Mouse** | En el mapa de la Línea 1 (muro de la estación): clic en una estación para comentarla (también A/D + E) |

Mientras hay un diálogo abierto el jugador no se mueve.

## Ajustes

Desde el título o la pausa (**Ajustes**), con W/S para elegir la fila y A/D (o E) para cambiarla: volumen de **Música** y de **Efectos** (0 a 10; los efectos incluyen la lluvia y el viento), **Sonido** (silencio total, igual que la tecla M), velocidad del **Texto** (lenta, normal, rápida o instantánea) y **Controles táctiles** (Auto o Siempre; "Nunca" queda solo en el modo admin para que nadie en un celular se quede sin controles). Se aplican al instante y se guardan en este navegador, aparte de la partida (`santiago-laberinto:settings`, `src/systems/Settings.ts`; el silencio de antes, `santiago-laberinto:mute`, se lee una vez).

## Guardado

- **Partida automática** (`santiago-laberinto:save`): se guarda sola con cada cambio; es la de *Continuar* en el título. Guarda el mapa y el último spawn, no el tile exacto.
- **Espacios de guardado** (`santiago-laberinto:slots`, `src/systems/SaveSlots.ts`): 3 espacios, como los *save states* de un emulador. Desde la pausa, **Guardar** y **Cargar**; desde el título, **Cargar partida** (aparece si hay alguno ocupado). Guardan la partida entera más el tile exacto y hacia dónde mira el jugador. Solo se puede guardar con el jugador libre en un mapa: no en diálogos, viajes en metro o micro ni minijuegos (`MapScene.saveBlockedReason`). Cargar uno reemplaza la partida automática.
- **Versiones del guardado:** la partida lleva un número de versión (`SAVE_VERSION` en `src/systems/SaveData.ts`). Si cambias la forma de lo que se guarda, sube la versión y agrega el paso en `MIGRATIONS`: las partidas viejas (la automática y los espacios) se actualizan al cargarse en vez de perderse. Una partida corrupta o de una versión más nueva se ignora.
- **Misiones bloqueadas:** en *Nueva partida* solo está disponible el Prólogo y las misiones cuya anterior se completó alguna vez (según `santiago-laberinto:records`, el mismo registro de *Progreso*). Las bloqueadas salen como "???  (bloqueada)".

## Misión 1: "De Baquedano al Costanera"

Partes en Plaza Baquedano y tienes que llegar a la entrada del Costanera Center (junto a Nueva Tajamar, antes de Av. Tobalaba). Empiezas con $3.000 y una Bip! sin saldo. Hay tres maneras de llegar:

1. **Metro:** encuentra el acceso abierto, carga la Bip! (una máquina está mala), pasa el torniquete, elige el andén correcto (Línea 1 dirección Los Dominicos) y bájate en Tobalaba.
2. **Micro:** pregunta qué recorrido sirve, espera en el paradero (no todas paran, y no todas van por Providencia), sube con saldo y toca el timbre antes de tu parada.
3. **A pie:** la ruta más larga por Av. Providencia (Salvador → Manuel Montt → Pedro de Valdivia → Los Leones → Tobalaba), con más NPCs, coleccionables (sopaipilla, empanada, completo, mote con huesillo) y un atajo secreto.

Si te bajas antes o te equivocas de dirección, caminas el resto o pierdes tiempo. Al llegar se muestra el tiempo, la ruta usada, los coleccionables y los logros extra.

## Misión 2: "La prueba de Optimización"

Domingo 21:00 en Paine (Inés de Suárez 122). El HUD muestra la **hora del día** en vez del cronómetro.

1. **Noche:** terminas de comer en el comedor (primer piso). Lleva los platos al lavaplatos y lávalos, sube a ducharte y acuéstate (pones la alarma a las 7:00).
2. **Lunes 7:00:** apaga la alarma. Si la pospones tres veces te quedas dormido y faltas a la prueba (final secreto)... hasta que despiertas: era una pesadilla.
3. Vístete en el ropero (eliges la ropa), lávate la cara, toma la mochila (primer piso) y camina a la Estación Paine.
4. Carga la tarjeta y paga el pasaje ($1.060) en el validador. El tren Rancagua – Estación Central llega al andén a las 7:20 (si llegas antes y eliges esperar, el reloj se adelanta), sale a las 7:30 y para en Linderos, Buin, Buin Zoo y San Bernardo antes de Estación Central, donde llega 40 minutos después (el letrero del vagón y un cartel muestran cada estación).
5. En Estación Central toma la Línea 1 dirección Los Dominicos hasta Manuel Montt y camina a Antonio Varas 880: la Universidad Antonio Varas (ficticia), edificios A1 y A2, pisos -1 a 6.
6. Revisa en la app **Mi U** del celular el correo del cambio de sala: la prueba es en la **A2-403**.
7. La prueba es oral, sobre el problema de la mochila (seis preguntas). Si te equivocas, el profesor explica y puedes volver a rendirla.
8. Con todo correcto, al salir el profesor Cuervo te cita a su oficina (A2, piso 6, 604): te vas de intercambio a Colombia. Llama a tu mamá desde la app **Teléfono** para terminar.

## Misión 3: "Rumbo a Cali"

Viernes 20:30. La despedida antes del intercambio en Cali, Colombia (vuelo CA 742 de la 01:50).

1. **Restorán Las Sandías (Paine):** última cena con mamá, papá y tu hermano chico. Desde la mesa (E frente al plato) pides, comes y conversas con cada uno; después pides la cuenta.
2. **La casa:** junta tus cosas (ropero, escritorio, velador, cama, baño y lo que te pase tu mamá) y arma la maleta: máximo **23 kg**, cada cosa entra entera o no entra (el problema de la mochila). Con 23 kg exactos ganas un logro. El carnet va en la mochila, nunca en la maleta.
3. **En auto** por la Ruta 5, Autopista Central, Vespucio y la Ruta 68 hasta el aeropuerto.
4. **Aeropuerto de Santiago (Terminal 2)**, en tres mapas: check-in en la isla B (la balanza muestra el peso de tu maleta), la **despedida** de tu familia en el acceso a Embarque Internacional (música propia, lágrimas y los abrazos animados de lado en una viñeta; tu hermano te regala un dibujo que después puedes mirar desde el inventario), la PDI con tu carnet (Feli P., 23 años, chileno), el control del SAG con el beagle, seguridad (rayos X), el duty free y los espigones D y E. La tarjeta de embarque dice E4, pero la puerta **cambia**: hay que mirar las pantallas. En la D6 te sientas a esperar y llaman por grupos.
5. **El avión:** 30 filas (no hay fila 13), primera clase adelante. Tu asiento es el **18A**, ventana, al medio del avión en turista. Al sentarte empieza el vuelo de 6 horas: despegue, la cordillera, la comida, tu vecina caleña, turbulencia y el cambio de hora (Colombia tiene 2 horas menos).
6. **Aeropuerto de Cali:** Migración Colombia, la cinta de equipaje y la aduana del ICA. Si el SAG te advirtió de algo y no le hiciste caso, en Cali te lo decomisan.
7. **En furgón** con don Jairo desde Palmira, por la recta Cali–Palmira, el río Cauca y Cali, hasta **Pance**. Toca la puerta de la casa y llama a tu mamá para terminar.


## Misión 4: "Primer día en la U"

Lunes 6:00 en Pance, Cali, en la casa de doña Mery. El HUD muestra el **clima y la temperatura** en vez del saldo Bip!, y mientras dure el desfase, la hora de Chile al lado de la de Cali (en ese momento, 2 horas más).

1. **El desfase:** suena la alarma a las 6:00, pero el reloj de pulsera dice 8:00. El mundo se mece un poco (la cámara se ladea) hasta que tomas desayuno. El reloj se atrasa en el velador.
2. **La casa:** ducha (fría), ropero, mochila y el desayuno de doña Mery (arepa, pericos, chocolate o tinto). Te ofrece paraguas: si lo llevas, no te empapas en el aguacero (logro).
3. **Bus P27** de Pance a la Calle 18. La **Universidad Cristiana-Caleña (PUCC, ficticia)** sigue el trazado real de la Javeriana Cali (OpenStreetMap, 1 tile ≈ 6 m): portería de la Calle 18, Plaza Central, Biblioteca, Cafetería Central, Teatrino, Auditorio, Capilla, Palmas, Guayacanes, El Lago, Ciencias Económicas, Administrativo, Educación Continua, Bienestar, Acacias, Samán, Almendros, Cedro Rosado, Ciencias de la Salud, Villa Javier, el lago, el laguito, la cancha principal, el centro deportivo (gimnasio, piscina, tenis, vóley y básquet) y los parqueaderos. Los 13 edificios con interior tienen sus pisos reales (Cedro Rosado 6, Palmas y Guayacanes 5, ...) y ascensor desde 4 pisos.
4. **9:00, Plaza Central:** la coordinadora Mónica y los diez de intercambio (cuatro españoles, cuatro franceses, un peruano y otro chileno): presentaciones, el viaje, qué les parece Cali y el reto de fútbol contra Ingeniería. Te dan el carnet.
5. **Cafetería Central** (buñuelo, pandebono, empanada, tinto). Al salir **se larga el aguacero**: tormenta con lluvia, relámpagos y truenos. Bus de vuelta a casa.
6. **Almuerzo:** te cambias la ropa mojada y cocinas **fideos con hogao** paso a paso (sin errores, logro). Escampa.
7. **Tarde en la U:** la **polera azul** (número 14) en Bienestar (Deportes, 1er piso) y la clase de **Modelación Logística** en Educación Continua, piso 2, sala EC 203 (vendedor viajero, vecino más cercano y ruteo con capacidad).
8. **4:30, el partido** (escena propia, 11 contra 11): controlas al 14. WASD corre. Con la pelota, **E apunta**: el juego pasa a cámara lenta, WASD gira la flecha y la barra de potencia sube y baja; **E otra vez patea** (suave = pase, fuerte = tiro; si la flecha apunta a un compañero, el pase lo busca y le llega a los pies). **F o Shift: filigrana** (bicicleta, elástica, caño o sombrero): los rivales cerca quedan parados y por un momento no te la pueden quitar. Sin la pelota, E le quita la pelota al rival cercano o se la pide a un compañero. Antes del pitazo puedes **calentar con el equipo** (tutorial de 5 ejercicios: correr al cono, pase, pedirla, filigrana y remate; Esc lo salta) o ir directo al partido. Tu gol, tu hat-trick y tu autogol tienen viñeta en el momento (E la salta), y el post partido cambia según lo que pasó: festejo del equipo, en andas tras un hat-trick, la tarjeta de figura del partido con 2 goles o más, la burla cariñosa del autogol y el comentario de Johan si fue goleada. Dos tiempos de 80 s; el reloj avanza de 16:30 a 18:15 y la luz se pone de atardecer.
9. **Si ganan:** taxi al **rooftop** de Antoine (piso 21, Ciudad Jardín). La noche pasa con cada conversación (y una llovizna a las 21:30 que escampa a las 22:00); con Álvaro, Diego y Nacho listos, el brindis frente a Cali de noche. **Si pierden o empatan:** el equipo molido en el pasto al atardecer, bus a casa y aguapanela con doña Mery.

En el campus andan sueltos **dos pavos reales** que aparecen en un lugar distinto cada vez que entras (campo `fauna` del mapa): deambulan, de vez en cuando abren la cola y gritan, y si les hablas hay viñeta. Con lluvia, si llevas el paraguas de doña Mery caminas debajo de él; si no, vas goteando. Casi todo lo que se toca en la casa (cuadro, hamaca, ducha, ventana, ventilador, nevera, lavamanos, reloj, mochila), lo que se come y los recuerdos del viaje tienen su viñeta.

## Misión 5: "Un martes cualquiera"

Martes 7:00 en Pance. Un día "normal" en Cali que termina con un Instagram.

1. **La casa:** el pelo amaneció como un nido (con pajarito). Doña Mery da desayuno (calentado o avena con pandebono) y recomienda la **Barbería 360** de Ciudad Pacífica: «la del Fredy».
2. **Bus P27** a la U y **a estudiar**: Biblioteca, 2º piso, Sala de Estudio. La tarea de ruteo con capacidad (tres preguntas: vecino más cercano, cuántos viajes, cómo agrupar los clientes) mientras el reloj corre hasta el mediodía. Llega el correo del profe Julián con los equipos (Equipo 5: tú, Valentina, Camilo y una tal «S. Martínez») y el mensaje de Grover.
3. **A pie desde las 12** por el trazado real (OpenStreetMap) de la ruta U → barbería: Calle 18 al sur, Carrera 121 (lago El Retiro, Club del Municipio), cruce de la Calle 25, Carrera 120 por las Calles 40, 42, 44 y 45 hasta la 45A (mapa `ruta_barberia`, ~10 m por tile). En el camino: el mango biche del semáforo, el chancero que soñó con un círculo (pista: juega el **360**), el dominó de la tienda, el loro que dice «¡Fredy debe plata!» (y a la tercera, otra cosa), el salpicón, un perro y el parque de Ciudad Pacífica.
4. **Barbería 360:** salsa brava, piso de ajedrez, el mapamundi con alfileres y las fotos «de viaje» de Fredy (con el mismo fondo de cartón). Fredy, enorme y con mucha labia, vivió en Chile («¡al tiro, po!»), en Panamá, en Madrid y en Dubái (una escala). Eliges el corte (degradado, rapado o «el internacional», el mullet) y cambia el peinado del jugador; los "veinte minuticos" son tres horas y media.
5. **De vuelta en la U:** Grover, el amigo boliviano (feísimo: monoceja, mullet, bigotito, dientes de conejo, lunar con pelo y una mosca), perdió las llaves del carro. Búsqueda **no lineal** con pistas: la señora del aseo de la cafetería, la bibliotecaria, el vigilante, la estudiante del lago, la iguana... Un pavo real se las robó y solo las suelta por un **pandebono** (del carrito de la plaza).
6. **El cacharro de Grover** (morenada, bocina de «La Cucaracha», la llama del tablero) hasta la piscina del **Centro Deportivo** de la misma U, el «GLD»: está a seiscientos metros, pero Grover no camina, así que dan la vuelta entera por la Calle 18. El mapa `pucc_piscina` sigue la foto aérea del centro deportivo real: la piscina de 8 carriles con sombrillas azules, los camerinos junto al gimnasio, el coliseo de carpa blanca con sus mástiles de luz, la cancha de tenis azul sobre rojo y las canchas de básquet verdes y azul con zonas amarillas (también se entra caminando desde el campus, por el Centro Deportivo). Control de Bienestar con el carnet, traje de baño de llamas, el panzazo desde el partidor (secreto), el niño que perdió sus gafas, champús.
7. **19:00, Marco Polo** (escena propia, `PiscinaScene`): dos principiantes en los carriles 7 y 8. WASD patalea, **E** da una brazada (con buen ritmo, más fuerte), **F** grita. El aire se gasta y se recupera agarrado del borde; sin aire te hundes. Primero un largo de 25 m; después, ojos cerrados (la pantalla se oscurece y solo se ve el «¡Polo!» de Grover) y al revés (contestas «¡Polo!» o Grover hace trampa y abre un ojo). Eventos: Grover traga agua, un niño se tira bomba, la chica del carril 6 nada mariposa y se ríe. **No hay ganador.**
8. **Al salir:** Sira, chiquitita, blanca, pelo mojado en moño, la nadadora del carril 6. Se gustan desde el primer minuto, con discreción (viñeta con corazones chiquitos, de a uno).
9. **Pance Burger** (a dos casas de doña Mery): el profe Julián, Valentina y Camilo. Pides (la Caleña lleva maduro y piña), cada uno se presenta... y llega tarde «S. Martínez»: es Sira.
10. **El Cinco** (escena propia, `CincoScene`), el juego de Camilo: cinco jugadores, mismo color o número, «¡Quieto!», «¡Pa'trás!», +2, comodín y «Aguacero» (+4). **F**: gritar «¡CINCO!» con una carta (o pillar al que no gritó: roba dos). Cuando sale un 5, todos golpean la mesa (**E**): el último roba.
11. **El coqueteo** a solas y su Instagram (@sira.mtz, en la app ficticia Fotogram). En casa, un mensaje de Sira y fin. Finales: «Flechazo en Pance» (las tres buenas impresiones) o «Despacito, pero con Instagram».


## Misión 6: "Letras sobre el río"

Sigue el hilo de la misión 5 («Jueves 7pm en la piscina»): la clase de natación con Sira y, el sábado, la Feria del Libro en el Bulevar del Río. Bajo el HUD aparece el medidor de **química** con Sira (cada buena respuesta, detalle o gesto suma medio corazón; flags `m6_q_*`).

1. **Jueves 7 p. m., la clase** (escena propia, `NatacionScene`, vista de lado con la mitad bajo el agua): cinco ejercicios con mecánicas distintas. **Burbujas** (mantén E tres tiempos para soltar el aire, suelta para respirar), **la estrella** (A/D equilibran; Sira te sostiene... y te suelta sin avisar), **la patada** (W y S alternados al ritmo de su cuenta, de las manos), **el crol** (E brazada, F respirar de lado cada tres) y **la carrera** de 25 m contra Sira, que nada con un brazo. Esc salta un ejercicio. En el borde, con los pies en el agua, te invita a la feria: el sábado a las 4, afuera de La Ermita.
2. **Sábado en Pance** (cosas secundarias y pistas): el chat de la mañana con Sira (le provoca **maracuyá**, odia las flores cortadas y perdió su «¡Que viva la música!»), los consejos de doña Mery («pregúntele qué está leyendo»), su tarjeta de repuesto (**Tarjeta Recorre**, dos pasajes), el mandado a la carretilla de don Arcesio, el sancocho, el **separador** con una flor del guayacán prensada con la plancha y la llamada de Grover (decirle la verdad o que vas a estudiar cambia el final).
3. **P47 a Universidades** (solo con tarjeta: el chofer no recibe efectivo), chateando con Sira. Cada respuesta abre la viñeta del **chat con ubicación en vivo** (tu puntito y el de ella).
4. **Estación Universidades** (mapa `universidades`, ~8 m por tile, a partir de OpenStreetMap): la estación de cabecera en medio de la Av. Carrera 100, con andén de alimentadores y de troncales, recargadoras, taquilla y torniquetes; el centro comercial **Guayacán Plaza** con su estacionamiento y glorieta (librería, florería, perfumería, papelería y cine adentro), la Calle 16, la Carrera 98, la Autopista Simón Bolívar, la Universidad Pública del Valle, Plaza Aventura y Ciudad Jardín con el corredor del río Lili. **Aprender el sistema**: el tablero y la orientadora explican la T (para en todas) y la E (expresa); subirse al E31, T42, T47 o E27 cuesta 12 a 15 minutos. Si sales por los torniquetes al centro comercial, volver a entrar cobra otro pasaje (hay que recargar). El lustrabotas, las obleas y el mango biche.
5. **El T31** (mapa `articulado`, viaje tipo metro con puertas en cada estación): las 20 paradas reales de Universidades a Torre de Cali (Univalle, Buitrera, Meléndez, Capri, Caldas, Refugio, Pampalinda, Guadalupe, Unidad Deportiva, Lido, Tequendama, Estadio, Manzana del Saber, Santa Librada, San Bosco, San Pascual, Sucre, Petecuy, San Pedro, Torre de Cali). En algunas, el chat con Sira; en Pampalinda sube el rapero de los bombombunes; **en Lido el bus se vara** (falla técnica, +8 minutos de suspenso). Bájate a tiempo en Torre de Cali; si te pasas, quedas en La Ermita.
6. **El centro** (mapa `centro_cali`, ~6 m por tile, girado para que el río corra de poniente a oriente): las estaciones Torre de Cali y La Ermita sobre la Carrera 1, el Parque La Retreta, **La Ermita** (agujas, rosetón y portón), el Bulevar del Río con los **toldos de la feria**, el río Cali con el **Puente Ortiz** (de ladrillo) y el Puente España, el monumento a Jorge Isaacs, el CAM y la Av. 2 Norte. Sira te espera afuera de La Ermita (puntual si llegas antes de las 4:05) y desde ahí camina contigo. En los once toldos: el **debate de «María»** (le gusta que le lleves la contraria con argumentos; el consejo de doña Mery desbloquea una opción), el **libro a ciegas** (la frase correcta es la de su libro perdido), leerles un cuento a los niños, el fanzine del Buziraco, el trueque (un girasol por una piedrita del río), el tinto para dos, bailar salsa o cueca en el toldo de los discos, el stand de Chile, el **poema express** (eliges tres palabras y el poeta escribe un poema según la combinación) y la **firma de Amparo Ledesma** (la fila y la dedicatoria). Cameos: el profe Julián («yo no vi nada») y Antoine.
7. **¡Al ladrón!** (escena propia, `PersecucionScene`, de lado): en el Puente Ortiz un raponero le arranca a Sira la bolsa con el libro firmado. D acelera (gasta aliento), W/E salta, S se desliza; huacales, pendones, la carreta del pandebono, la estatua humana, palomas, charcos y los libros que te tira. Si lo alcanzas, suelta la bolsa; si no, la señora del tinto le pone el pie. El abrazo y el **atardecer** en el puente.
8. **San Antonio** (mapa `san_antonio`): el barrio colonial (Calle 1 Oeste, Calle 2, Calle 3, Carreras 10, 9 y 6) y la **Heladería Corazones**: pides los helados y adivinas el de ella (maracuyá); la conversación de verdad (junio, Chile, tu mamá) y el **regalo** (el separador, el libro, la piedrita... o nada).
9. **La colina de noche**: subiendo la escalinata **se va la luz** en todo el barrio: oscuridad con la linterna del celular (F), que se gasta (cuando se acaba, Sira prende la suya), un gato negro, Sira agarrada de tu brazo. Los cuenteros con velas cuentan la leyenda del **Buziraco** (y el susto). En el **mirador** vuelve la luz y Cali se prende barrio por barrio. El «casi»... y suena el celular: **Grover**, en videollamada. Fuegos artificiales sobre Siloé. Nada hasta ahí.
10. Taxi a Pance, el mensaje de Sira y doña Mery esperando despierta. Finales según la química: «Química pura (y nada hasta ahí)», «Casi, casi» o «Amigos que se miran mucho».


## Misión 7: "Lluvia en el piso 8"

En pantalla, «Misión 6». Sira y el jugador se ven casi todos los días, pero «nada de nada». Él ya no vive en Pance: hace dos semanas se mudó al **Bobo Unic Living** (residencia estudiantil inventada; el nombre es un juego de palabras), una torre de ladrillo naranjo y blanco con piscina, al lado de la bodega **PrecioClub** y al frente de la U. El medidor de **química** vuelve (flags `m7_q_*`, visible con `m7_quimica_visible`) y Sira camina contigo también por los interiores (flag `m7_sira_sigue`).

1. **Martes, el depa 805** (mapa `bobo_piso8`: el pasillo del piso 8 con su ascensor y los vecinos, y el depa: cocina, mesa, sofá con tele, cama doble, baño y el ventanal a los Farallones). El ascensor baja al **lobby** (`bobo_lobby`), donde está **Wilmer**, el de la recepción: lentes de sol en la cabeza, corbata de piña, salsa de los setenta y la leyenda del fantasma de la piscina.
2. **La cuadra** (mapa `bobo_cuadra`, a partir de OpenStreetMap: el PriceSmart Cañasgordas real queda en la Calle 18 con Carrera 121, al frente de la portería de la U): la Calle 18, el PrecioClub con su techo de paneles solares y su tótem azul, la torre con el podio de ladrillo y la ventana redonda, la piscina del patio, el paradero de los buses hacia el norte y la esquina de la Carrera 122 con la **Farmadía 24H** y la panadería. Se cruza a la PUCC por la portería (en el campus, la vereda oriente de la Calle 18 lleva de vuelta).
3. **Los helados** en el carrito de don Efraín (Plaza Central) con Sira y sus amigas de Arquitectura, **Majo** (que habla por las dos) y **Cata** (que dibuja todo): eliges sabor, adivinas el de ella y aguantas el interrogatorio. El miércoles, otra vez helado; las amigas «se acuerdan» de algo y se escapan.
4. **Jueves, los dos solos en la U** (semana de receso), con un plan no lineal: la **maqueta** de Sira (un mirador sobre el río Pance, con una banderita chilena escondida), el **almuerzo** en la Cafetería Central (te roba los patacones), la **selfie con el pavo real** y, al atardecer, **el lago**: la conversación de verdad (su abuelo, Buenaventura, junio)... y un pavo real que grita en el peor momento.
5. **El chat hasta las 3:12**: acostado en la cama, la viñeta del celular con la conversación (cuatro rondas de respuestas, el reloj que vuela) y la invitación al depa. Ella lleva la salsa de su abuela.
6. **Viernes en el depa**: ordenar (la ropa, la loza, el perfume... medio frasco es un secreto), poner el agua... y tocan la puerta. El abrazo, el tomate que se escapa rodando por el pasillo y los ingredientes.
7. **La boloñesa** (escena propia, `CocinaScene`, vista de lado del mesón), en dos partes. Primera: **la cebolla** (E corta cuando el cuchillo pasa por la marca; cada corte pica más los ojos, F te secas las lágrimas o lloras y todo se ve borroso), **zanahoria y tomate** (A/D y W/S alternados, compitiendo con Sira que pela) y **el sofrito** (W/S el fuego para quedar en lo verde, E revolver cuando ella dice «¡revuelve!»; a la mitad, su mano sobre la tuya). Segunda, al volver: **los fideos al dente** (E probar, W tirar uno a la pared para ver si se pega, F colar) y **emplatar** (E suelta los fideos, la salsa y el queso con albahaca sobre el plato). Esc salta un paso.
8. **La nevera vacía** y la **Farmadía**: el choque en el pasillo angosto, las crispetas, la chocolatina y la nevera con tres gaseosas inventadas: **La Caleña** (dorada, «sabor a fiesta»), **Coca-Kola** y **Rojosazón** (la roja). Ninguna pista: si eliges La Caleña, Sira se sorprende (es su favorita desde chiquita).
9. **La vuelta caminando** (tres conversaciones en el camino: lo más loco que has hecho, manjar o arequipe, cuál es tu ventana), **las amigas mudas** en el sofá del lobby (Valentina, Isa y Pao: no dicen nada, solo miran) y Wilmer: «¡Ustedes dos se ven lindísimos juntos!». La espera del **ascensor** (con su música) y el vecino del 807.
10. **La comida** (el brindis), **la peli** del cometa en CineFlix (anime inventado, «Tu nombre bajo el cometa»; ella apoya la cabeza en tu hombro), la siesta de trasnochados, **la confesión** («hasta el loco de la recepción dice que nos vemos lindos juntos»), **el beso**... y afuera se larga la lluvia. Pasan las horas dormidos abrazados.
11. **De noche, el paradero** de la Calle 18 con llovizna (el paraguas de doña Mery está en el closet: se lo puedes prestar), el bus hacia el norte, el corazón en el vidrio empañado y su mensaje. Finales según la química: «La Caleña, la lluvia y el beso», «Lluvia en el piso 8» o «Por fin».

### Ropa del jugador

Cada partida parte con la ropa por defecto. Se cambia en el ropero de la casa (misión 2) o desde la pausa (**Ropa**): gorro o peinado, polera, pantalón, zapatillas y lentes. Las opciones están en `src/systems/PlayerLook.ts`; la textura del jugador se genera según la ropa, el pijama (flag `en_pijama`), la mochila (flag `sin_mochila` la quita) y el código Konami.

---

## Estructura del proyecto

```
├─ index.html              # carga fuentes de Google Fonts, canvas pixelado
├─ docs/map-format.md      # especificación del formato de mapa (y plan OSM)
└─ src/
   ├─ audio/               # música y efectos sintetizados con Web Audio (sin archivos)
   ├─ main.ts              # config de Phaser, escalado entero, acceso __dev
   ├─ config/display.ts    # resolución base 320×180, tile 16, fuentes, zoom
   ├─ scenes/              # escenas (ver tabla)
   ├─ systems/             # lógica del juego (ver tabla)
   ├─ ui/                  # diálogo, carteles, HUD, menú de pausa, inventario, mapa de la L1, letrero LED
   ├─ art/                 # arte procedural: paleta, tiles, personajes, objetos, vehículos
   ├─ types/               # tipos de mapa, historia (diálogos, NPCs) y misión/viajes
   └─ data/
      ├─ maps/*.json       # mapas (providencia, metro_baquedano, vagon, micro, test, test_estacion)
      ├─ dialogues/*.json  # árboles de diálogo (un archivo puede tener muchos)
      ├─ missions/*.json   # una por misión (mission01, mission02)
      ├─ npcs/*.json       # NPCs por misión (se suman a npcs.json)
      ├─ campus.ts         # pisos de los edificios A1 y A2 generados por código
      ├─ campus_cali.ts    # pisos y ascensores de los edificios de la PUCC (misión 4)
      ├─ trayectos.json    # viajes "de película" sentado (auto y furgón de la misión 3)
      ├─ npcs.json         # NPCs y objetos interactuables de todos los mapas
      ├─ items.json        # ítems del inventario
      ├─ rides.json        # viajes en metro y micro
      ├─ metro_l1.json     # estaciones de la Línea 1 (combinaciones y comentarios del mapa interactivo)
      └─ sprites.json      # personajes/objetos procedurales y hojas externas
```

### Escenas (`src/scenes/`)

| Escena | Rol |
|---|---|
| `Boot` | Espera a que carguen las fuentes (máx. 3 s) |
| `Preload` | Carga hojas externas declaradas en `sprites.json` y genera las texturas por código |
| `Title` | Título: nueva partida, continuar, créditos |
| `Overworld` | Mapas exteriores (`kind: "overworld"`) |
| `Interior` | Estación, vagón, micro (`kind: "interior"`); si recibe `ride`, corre el viaje |
| `Futbol` | El partido de la misión 4 (lo abre el script `partido`; el mapa y la UI duermen mientras tanto) |
| `Piscina` | El Marco Polo de la misión 5 (lo abre el script `piscina_m5`) |
| `Cinco` | El juego de cartas de la misión 5 (lo abre el script `hamburguesas`) |
| `Natacion` | La clase de natación de la misión 6 (lo abre el script `clase_natacion`) |
| `Persecucion` | La persecución del raponero en el Bulevar (lo abre el script `raponazo`) |
| `Cocina` | La boloñesa con Sira en el depa de la misión 7, en dos partes (la abren los scripts `cocina_m7_1` y `cocina_m7_2`) |
| `UI` | Escena paralela encima del mapa: diálogos, carteles, HUD, letrero LED del vagón, menú de pausa (Esc), inventario (Tab) y mapa de la Línea 1 |
| `MissionComplete` | Resumen de la misión |
| `Credits` | Créditos y atribución de OpenStreetMap |

`Overworld` e `Interior` heredan de `MapScene` (movimiento, NPCs, warps, triggers, zonas, scripts, quiltro seguidor). Todas heredan de `BaseScene` (zoom entero y textos nítidos).

### Sistemas (`src/systems/`)

| Sistema | Qué hace |
|---|---|
| `Controls` | Teclado centralizado. Las pulsaciones se *consumen* (una E no abre y avanza un diálogo a la vez) |
| `GameMap` | Carga y valida mapas JSON, autotile de edificios, colisiones, zonas, warps, triggers |
| `Actor` | Personaje que se mueve de a un tile con animación de 4 direcciones |
| `Npc` | NPC/objeto de `npcs.json`: visibilidad condicional, deambular, girar al hablarle |
| `DialogueManager` | Recorre árboles de diálogo, evalúa condiciones, aplica efectos (no dibuja) |
| `StoryState` | Flags, inventario, plata, saldo Bip!, reloj, objetivo; guarda en `localStorage` (con try/catch) |
| `Conditions` | Evalúa condiciones (`flag`, `minMoney`, `any`, `not`, ...) |
| `Effects` | Aplica efectos; los que cambian de escena se ejecutan al cerrar el diálogo |
| `EventSystem` | Bus de eventos tipado entre escenas (`state-changed`, `warp`, `story`, `banner`, ...) |
| `RideController` | Viajes en metro/micro: paradas, puertas, timbre, penalizaciones |
| `Crowd` | Gente de relleno (campo `crowd` del mapa): pasajeros sentados y de pie que nunca tapan el paso; en cada estación se baja y sube gente |
| `Seats` | Tiles de asiento y cómo se ve alguien sentado en cada uno (jugador, NPCs y pasajeros) |
| `StoryScripts` | Escenas animadas con nombre (micro que pasa llena, llegada del tren) |
| `Mission` | Registro de misiones (`missions/*.json`), misión en curso, reloj de la historia y resumen final |
| `SaveSlots` | Los 3 espacios de guardado manuales (posición exacta incluida) |
| `SaveData` | Forma de la partida guardada, su versión y las migraciones desde versiones anteriores |
| `Settings` | Ajustes del jugador (volúmenes, silencio, velocidad del texto); avisa con `settings-changed` |
| `Content` | Carga los chunks de diálogos y viñetas al arrancar; el título lo espera antes de entrar a un mapa |
| `PlayerLook` | Ropa del jugador y textura generada según ropa, pijama y mochila (la polera azul de la PUCC aparece en el ropero solo si la tienes) |
| `Darkness` | Apagón (misión 6): oscuridad con un círculo alrededor del jugador y la linterna del celular (F), que se gasta; flags `m6_apagon` y `_linterna` |
| `Weather` | Luz del día según la hora (amanecer, atardecer, noche) y el clima: nubes, lluvia, tormenta con relámpagos, gotas en las ventanas de los interiores y las luces de la ciudad de noche |
| `AudioManager` (`src/audio/`) | Música por pistas (secuenciador chiptune) y efectos; escucha los eventos `music` y `sfx` |
| `SpriteRegistry` (`src/art/`) | Punto único de texturas: genera por código o usa hojas de Aseprite |

---

## Guías

### Agregar un NPC u objeto

Agrega una entrada en `src/data/npcs.json`:

```json
{ "id": "senora", "map": "providencia", "x": 10, "y": 19, "dir": "left", "sprite": "senora", "dialogue": "senora_indicaciones" }
```

| Campo | Descripción |
|---|---|
| `id` | Único |
| `map`, `x`, `y` | Mapa y tile donde aparece |
| `dir` | `up` / `down` / `left` / `right` (por defecto `down`) |
| `sprite` | Personaje de `sprites.json` → `characters` (gira hacia ti y puede deambular) |
| `object` | Objeto de `sprites.json` → `objects` (no gira ni camina) |
| *(sin `sprite` ni `object`)* | **Invisible**: útil para puertas, rejas, timbres sobre tiles sólidos |
| `dialogue` | Id del diálogo que se abre con **E** |
| `wander` | Radio en tiles en que deambula (0 o ausente = quieto) |
| `if` | Condición: el NPC solo existe si se cumple (se reevalúa al cambiar el estado) |
| `solid` | `false` para poder pasar a través (por defecto bloquea) |

Ejemplos reales:

```json
{ "id": "hueso", "map": "providencia", "x": 12, "y": 10, "object": "hueso", "dialogue": "hallazgo_hueso", "if": { "notFlag": "encontro_hueso" } }
{ "id": "quiltro", "map": "providencia", "x": 16, "y": 22, "dir": "down", "sprite": "quiltro", "dialogue": "quiltro", "wander": 2, "if": { "notFlag": "quiltro_sigue" } }
{ "id": "puerta_v1", "map": "vagon", "x": 3, "y": 1, "dialogue": "vagon_puerta" }
```

Se interactúa con el NPC que ocupa el tile **enfrente** del jugador, aunque ese tile sea sólido (ej. un timbre sobre una ventana).

### Agregar un diálogo

Cada archivo de `src/data/dialogues/*.json` es un objeto `{ idDelDialogo: árbol }`. Se cargan todos automáticamente (en un chunk aparte, ver *Build y app instalable*); los ids deben ser únicos entre archivos. `npm test` revisa que cada nodo y efecto apunte a algo que existe.

```json
{
  "sopaipillas": {
    "start": "inicio",
    "nodes": {
      "inicio": {
        "branches": [
          { "if": { "hasItem": "sopaipilla" }, "goto": "ya_compro" },
          { "goto": "oferta" }
        ]
      },
      "oferta": {
        "speaker": "Tía de las sopaipillas",
        "text": "¡Sopaipillas calentitas, recién fritas! A $500. ¿Le doy una?",
        "choices": [
          {
            "label": "Sí, una ($500)",
            "if": { "minMoney": 500 },
            "effects": [{ "pay": 500 }, { "giveItem": "sopaipilla" }, { "setFlag": "hablo_con_tia_sopaipillas" }],
            "goto": "gracias"
          },
          { "label": "No me alcanza...", "if": { "not": { "minMoney": 500 } }, "goto": "fiado" },
          { "label": "Otro día", "goto": "chao" }
        ]
      },
      "gracias": { "speaker": "Tía de las sopaipillas", "text": "¡Que le aproveche!" },
      "ya_compro": { "speaker": "Tía de las sopaipillas", "text": "¿Y? ¿Estaba buena o no?" },
      "fiado": { "speaker": "Tía de las sopaipillas", "text": "Fiado no le puedo dar, mijo." },
      "chao": { "speaker": "Tía de las sopaipillas", "text": "Ya po, aquí voy a estar." }
    }
  }
}
```

**Nodo** (`DialogueNode`):

| Campo | Descripción |
|---|---|
| `speaker` | Nombre en la etiqueta (opcional; sin él es narración) |
| `text` | String o arreglo de páginas. Los textos largos se paginan solos (3 líneas por caja) |
| `effects` | Se aplican **al entrar** al nodo (antes de mostrar el texto, así `{bip}` ya muestra el valor nuevo) |
| `choices` | Opciones al final del texto: `label`, `if` (si no se cumple, la opción no aparece), `effects`, `goto` (sin `goto` = cerrar) |
| `branches` | Lista `{ if, goto }`: se va al primer branch que se cumpla. Un nodo con `branches` y sin `text` es un **enrutador** |
| `next` | Nodo siguiente si no hay `choices` ni `branches` (sin `next` = cerrar) |

**Condiciones** (`Condition`; todos los campos presentes deben cumplirse):

| Campo | Ejemplo |
|---|---|
| `flag` (string o lista) | `{ "flag": "sabe_micro" }` |
| `notFlag` | `{ "notFlag": "quiltro_sigue" }` |
| `hasItem` / `notItem` | `{ "hasItem": "hueso" }` |
| `minMoney` | `{ "minMoney": 1000 }` |
| `minBip` | `{ "minBip": 800 }` |
| `mission` | `{ "mission": "mission05" }` (solo en esa misión: para mapas, NPCs y escenas que comparten varias misiones) |
| `map` | `{ "map": "ruta_barberia" }` (solo si el jugador está en ese mapa: el celular guía a otro destino según dónde estés) |
| `all` / `any` | `{ "any": [{ "flag": "ruta_metro" }, { "flag": "ruta_micro" }] }` |
| `not` | `{ "not": { "minBip": 800 } }` |

**Efectos** (`Effect`; un objeto por acción):

| Efecto | Ejemplo | Nota |
|---|---|---|
| `setFlag` / `clearFlag` | `{ "setFlag": ["ruta_micro", "_subir"] }` | string o lista |
| `giveItem` | `{ "giveItem": "empanada" }` | muestra "¡Obtuviste ...!" (`"silent": true` lo evita); `qty` opcional |
| `takeItem` | `{ "takeItem": "hueso" }` | `qty` opcional |
| `giveMoney` | `{ "giveMoney": 1000 }` | muestra "Recibiste $1.000." |
| `pay` | `{ "pay": 500 }` | cobra efectivo; protégelo con `minMoney` |
| `chargeBip` / `payBip` | `{ "payBip": 800 }` | carga o cobra saldo; protege `payBip` con `minBip` |
| `addTime` | `{ "addTime": 60000 }` | penalización en ms al reloj |
| `clock` | `{ "clock": "lun 07:30", "max": "lun 07:50" }` | reloj de la historia: fija la hora y hasta dónde avanza sola (sin día = mismo día) |
| `clockMax` | `{ "clockMax": "lun 07:19" }` | cambia solo el tope del reloj |
| `sfx` | `{ "sfx": "error" }` | efecto de sonido inmediato (nombres en `src/audio/sfx.ts`) |
| `objective` | `{ "objective": "Usa el atajo de la galería (Los Leones)" }` | cambia el objetivo del HUD |
| `warp` | `{ "warp": { "map": "metro_baquedano", "spawn": "post_torniquete" } }` | al cerrar el diálogo |
| `startScene` | `{ "startScene": "Credits" }` | al cerrar el diálogo; `data` opcional |
| `event` | `{ "event": "micro_esperar", "data": { "x": 26, "lane": 17 } }` | al cerrar el diálogo; dispara un script (ver abajo) |
| `vineta` | `{ "vineta": "abrazo_mama" }` | muestra una viñeta 2D de lado sobre el juego hasta que se cierra el diálogo (`""` la cierra antes). Ids: `abrazo_papa`, `abrazo_hermano`, `abrazo_mama`, `abrazo_familia`, `dibujo` (en `src/ui/Vineta.ts`); las de cada lugar, en `src/art/vinetas_<lugar>.ts`, registradas en `src/art/vinetas_index.ts` |
| `sign` | `{ "sign": "paradero_pa421" }` | dibuja un cartel (tele, paradero, pizarra, diario mural, letrero de estación, mapa) hasta que se cierra el diálogo (`""` lo cierra antes). Ids en `SIGNS` de `src/ui/SignView.ts`. En la prueba, `{ "sign": "prueba", "step": 3 }` marca la pregunta 3 |
| `signMark` | `{ "signMark": "ok" }` | marca la pregunta actual de la pizarra de la prueba con ✓ (`ok`) o ✗ (`bad`) |
| `weather` | `{ "weather": "tormenta" }` | clima de la historia: `despejado`, `nublado`, `lluvia` o `tormenta` (se guarda con la partida) |
| `outfit` | `{ "outfit": { "shirt": "#2050a8" } }` | cambia parte de la ropa del jugador (ponerse la polera de la U) |
| `clockAdd` | `{ "clockAdd": 20 }` | adelanta el reloj de la historia N minutos (las conversaciones del rooftop) |

**Variables en el texto:** `{plata}`, `{bip}`, `{tiempo}` y `{hora}` (hora del celular) siempre; además, cualquier variable puesta en `Dialogue.vars` (los viajes usan `{estacion}` y los scripts de micro `{micro}`).

**Flags temporales:** las flags que empiezan con `_` (ej. `_puertas_abiertas`, `_timbre`, `_subir`) no se guardan en `localStorage`. Sirven para que un diálogo le responda a un script.

### Agregar un mapa

1. Crea `src/data/maps/<id>.json` (se carga solo). El formato completo está en **[docs/map-format.md](docs/map-format.md)**: filas de caracteres + `legend`, `spawns`, `warps`, `zones`, `triggers`, `labels`.
2. Conéctalo con un `warp` desde otro mapa (o un efecto `warp`).
3. Agrega sus NPCs en `npcs.json` con `"map": "<id>"`.

Si algo no cuadra (fila más corta, carácter sin leyenda, warp a un spawn inexistente), el juego lanza un error descriptivo al cargar el mapa.

### Agregar un viaje (metro o micro)

En `src/data/rides.json`:

```json
"metro_oriente": {
  "type": "metro",
  "map": "vagon",
  "spawn": "inicio",
  "line": "Línea 1 · Dir. Los Dominicos",
  "startDialogue": "vagon_inicio",
  "travelMs": 4500,
  "doorsMs": 6500,
  "stops": [
    { "name": "Salvador", "exit": { "map": "providencia", "spawn": "metro_salvador" } },
    { "name": "Tobalaba", "exit": { "map": "providencia", "spawn": "metro_tobalaba" }, "final": true }
  ],
  "end": { "banner": "Próxima estación: El Golf", "dialogue": "metro_te_pasaste", "exit": { "map": "providencia", "spawn": "metro_tobalaba" } }
}
```

- `metro`: en cada parada se abren las puertas por `doorsMs` (flag `_puertas_abiertas`); el jugador se baja con el efecto `{ "event": "ride_exit" }` desde el diálogo de una puerta.
- `micro`: si la flag `_timbre` está activa al llegar a una parada, el jugador se baja solo.
- Bajarse en una parada sin `final: true` marca la flag `bajo_antes` (ruta "+ a pie"). `end.walked: true` hace lo mismo al final de línea.
- El tiempo del viaje se detiene mientras hay un diálogo abierto.
- Para iniciar un viaje: `{ "event": "start_ride", "data": { "ride": "micro_411" } }`, o desde un script con `host.startRide(id)`.

### Editar o agregar una misión

Cada archivo de `src/data/missions/` es una misión (se cargan solas y aparecen en *Nueva partida*, ordenadas por `number`). Ejemplo, `mission01.json`:

```json
{
  "id": "mission01",
  "title": "De Baquedano al Costanera",
  "start": { "map": "providencia", "spawn": "inicio" },
  "introDialogue": "mision1_intro",
  "objective": "Llega al Costanera Center (al oriente)",
  "destination": { "map": "providencia", "x": 182, "y": 13, "name": "Costanera" },
  "victoryEvent": "encontrar_mama",
  "routes": [
    { "id": "metro", "name": "Metro", "if": { "flag": "ruta_metro" } },
    { "id": "micro", "name": "Micro", "if": { "flag": "ruta_micro" } }
  ],
  "defaultRoute": "A pie",
  "walkedSuffix": { "if": { "flag": "bajo_antes" }, "text": " + a pie" },
  "collectibles": ["sopaipilla", "empanada", "completo", "mote"],
  "bonuses": [{ "text": "Llegaste con el quiltro", "if": { "flag": "quiltro_sigue" } }]
}
```

- `destination`: tile al que guía el mapa del celular (app **Mapa**). Calcula la ruta a pie (prefiere veredas y pasos de cebra), los metros que faltan y, en metro o micro, las paradas que quedan hasta la última con `"final": true`.
- `victoryEvent`: cuando se emite ese evento de historia (aquí, un `trigger` en la puerta del Costanera), la misión se completa.
- `routes`: se muestran unidas con " + " todas las que se cumplan; si ninguna, `defaultRoute`.
- `collectibles`: ids de `items.json` (con `"collectible": true`) que cuentan en el resumen.
- `endings` (opcional): finales alternativos `{ "id", "name", "if" }`; al completar la misión se anota el primero que se cumple. Sin `endings`, la misión tiene un "Final único".
- **Progreso** (menú del título): muestra por misión los coleccionables, secretos, logros (`bonuses`) y finales conseguidos en *cualquier* partida. Se guarda aparte (`santiago-laberinto:records` en localStorage, ver `src/systems/Records.ts`), así que *Nueva partida* no lo borra. Lo que falta sale como "???" (los logros sí muestran su texto, como pista).
- Opcionales: `startMoney` (efectivo inicial), `startFlags`, `destinations` (lista de destinos con `if`; se usa el primero que se cumple) y `clock` (`"dom 21:00"`: la misión usa la hora del día; avanza 1 minuto cada 4 s reales hasta el tope de los efectos `clock`/`clockMax`) y `weather` (clima al empezar; con él, el HUD muestra el tiempo y la temperatura en vez del saldo Bip!).

**Al entrar a un mapa:** el campo `enter` del mapa abre diálogos al aparecer el jugador (`{ "id", "dialogue", "if", "once" }`); se usa para ajustar el reloj o hacer escenas de llegada. `music` elige la pista del mapa.

**Celular:** en `phone.json`, un mensaje con `mine: true` lo escribiste tú (burbuja verde a la derecha en la conversación con ese contacto, sin notificación): así funciona el chat con Sira de la misión 6, con el efecto `message`. Los contactos pueden llevar `if` (solo aparecen en la app Teléfono si se cumple); las reglas de `triggers` pueden llevar `mission` (solo esa misión); `outgoing` define qué diálogo se abre al llamar a un contacto con `callable: true` desde la app Teléfono (la primera regla que se cumple); `mail` son los correos de la app Mi U (al abrir uno se marca la flag `correo_<id>`).

**Viajes:** en `rides.json`, `place` es cómo se llama el lugar en el HUD durante el viaje (el T31: «En el T31»), cada parada de metro puede abrir un `dialogue` al abrirse las puertas y avanzar el reloj `minutes` minutos en su tramo (viajes a cualquier hora); `origin` es la estación donde se sube (letrero LED), `color` el de la línea, `announce: true` muestra un cartel en cada estación, `departAt` es la hora de salida (si subes antes, el reloj se adelanta con las puertas abiertas) y cada parada puede tener su propio `doorsMs` y su hora de llegada `clock` (el reloj avanza hasta ella durante el tramo). Las puertas del vagón saben si es la parada `final` con la flag temporal `_parada_final`.

### Agregar un personaje u objeto procedural

**Personaje:** agrega una entrada en `src/data/sprites.json` → `characters`. Se genera con la plantilla humana (o de perro):

```json
"oficinista": {
  "look": { "skin": "#f0c8a0", "hair": "#2a2020", "shirt": "#f0f0f8", "pants": "#383848", "hairStyle": "short", "extras": ["tie", "glasses"], "accent": "#c83848" }
}
```

- `hairStyle`: `short`, `long`, `bun`, `cap` (con `cap` = color de la gorra).
- `extras`: `tie`, `glasses`, `backpack` (`accent` = color de corbata o mochila).
- Perro: `{ "body": "dog", "fur": "#c89458", "spot": "#f0e0c0" }`.

**Objeto:** agrega el id en `sprites.json` → `objects` y su función de dibujo en `src/art/objects.ts` (`OBJECT_ART`), sobre una `PixelGrid` de 16×16 con `.outline()` para el contorno.

**Ítem del inventario:** agrégalo en `src/data/items.json` (`name`, `description`, `icon` = id de objeto, `collectible`). Para que se pueda usar desde el inventario (Tab), agrega `use` (id del diálogo que se abre al usarlo, ver `src/data/dialogues/items.json`), `useLabel` (texto de la acción, ej. "Comer") y opcionalmente `useSfx` (suena si el ítem se consumió):

```json
"sopaipilla": { "name": "Sopaipilla", "description": "Con harto pebre.", "icon": "sopaipilla", "collectible": true, "use": "usar_sopaipilla", "useLabel": "Comer", "useSfx": "eat" }
```

### Sonido

Todo se sintetiza en `src/audio/` (no hay archivos de audio). Desde código: `playSfx('item')` y `playMusic('street')` (`src/audio/sfx.ts`); desde un diálogo: el efecto `{ "sfx": "error" }`. La música se elige sola según la escena (calle, estación, vagón, micro, título, final, créditos).

- **Efecto nuevo:** agrega el nombre a `SfxName` en `sfx.ts` y su función en `SFX` de `sfxDefs.ts`.
- **Pista nueva:** agrega el nombre a `MusicTrack` en `sfx.ts` y su definición en `TRACKS` de `music.ts` (compases de 16 pasos). La misión 3 suma `despedida` (lenta, en menor), `aeropuerto` (tipo lounge) y `salsa` (montuno y tumbao); la 4, `campus` (cumbia), `futbol` (canto de hinchada) y `rooftop` (bolero-salsa con eco); la 5, `barberia` (salsa brava), `morenada` (el carro de Grover), `piscina`, `sira` (bolero) y `hamburguesas` (boogaloo); la 6, `natacion`, `feria` (cumbia con flauta), `persecucion` y `colina` (guitarra de noche, con eco); la 7, `depa` (bossa tranquila), `ascensor` (la música de ascensor de toda la vida) y `cocina` (cumbia juguetona). Efectos nuevos de la 5: la máquina y las tijeras, el agua, «¡Marco!» y «¡Polo!» (voces sintetizadas con formantes), las cartas, el golpe en la mesa, la bocina de Grover y el loro. De la 6: mensaje enviado, latido, gato, fuegos artificiales, burbujas, raponazo, apagón, linterna, la máquina de escribir del poeta, salto y golpe. De la 7: tocar la puerta, el cuchillo, el sofrito, destapar una gaseosa, el beso, la caja registradora y prender la tele.
- **Ambiente:** la lluvia suena en loop con `setAmbient({ rain, indoor })` (la maneja `Weather`); adentro se oye apagada.
- **Texto:** `makeText` (`src/ui/theme.ts`) separa "fi" y "fl" con un carácter invisible: la ligadura de Pixelify Sans se leía como una "A" ("final" → "Anal").

### Línea 1 del metro

`src/data/metro_l1.json` tiene las 27 estaciones en orden (San Pablo → Los Dominicos), sus combinaciones (`transfer`: línea y color) y el `comment` que dice el personaje al hacer clic en el mapa interactivo. Lo usan el mapa del muro de la estación (se abre con el efecto `{ "event": "mapa_linea" }`) y el letrero LED del vagón, que se enciende estación por estación con el evento `ride-progress` que emite `RideController`.

### Reemplazar el arte por spritesheets de Aseprite

1. Exporta el PNG a `public/sprites/` (Vite sirve `public/` en la raíz).
2. Decláralo en `sprites.json` → `sheets`:
   ```json
   "sheets": {
     "char:player": "sprites/player.png",
     "obj:paradero": "sprites/paradero.png"
   }
   ```
3. Formato esperado:
   - **Personajes** (`char:<id>`): hoja de **48×64**, frames de 16×16 en **3 columnas × 4 filas**.
     - Columnas: 0 = quieto, 1 = paso A, 2 = paso B.
     - Filas: 0 = abajo, 1 = izquierda, 2 = derecha, 3 = arriba.
   - **Objetos** (`obj:<id>`): imagen de 16×16.

Si el archivo existe se usa en vez del generado; si falla la carga, se avisa en la consola y se usa la versión procedural. Los tiles (`tiles`) y vehículos (`veh:*`) hoy son solo procedurales (`src/art/tiles.ts`, `src/art/vehicles.ts`).

### Scripts de eventos

Para secuencias que no caben en un diálogo (animaciones, esperas), agrega una función en `src/systems/StoryScripts.ts` → `SCRIPTS` y dispárala desde datos:

```json
{ "label": "Esperar micro", "effects": [{ "event": "micro_esperar", "data": { "x": 26, "lane": 17 } }] }
```

o desde un trigger de mapa (`"event": "nombre"`). Un trigger también puede abrir un diálogo con `"event": "dialogo:<id>"`, y un trigger puesto **sobre un asiento** se dispara al sentarse en él (así empieza el vuelo en el 18A). El script recibe un `ScriptHost` (la escena de mapa activa) con: `setLocked`, `wait`, `say` (abre un diálogo y espera a que cierre), `startRide`, `completeMission`, `drive` (mueve un vehículo), `fade`, `placePlayer`, `shake` (sacude la cámara), `cry` (lágrimas del jugador o de un NPC) y `mapWidthPx`. Para que un diálogo le responda al script, usa una flag temporal (ej. la opción "Subir" pone `_subir`, el script la lee y la borra).

Scripts de la misión 7 (`src/systems/StoryScripts7.ts`): `ascensor_m7` (con `data.to`: `lobby` o `piso8`; con Sira y las bebidas, la espera larga), `helado_martes`, `almuerzo_m7`, `lago_m7`, `chat_noche_m7` (al acostarse en la cama el jueves), `agua_m7`, `cocina_m7_1`, `choque_m7`, `pagar_m7`, `cocina_m7_2` (sigue con la comida, la peli, la cama, el beso y la lluvia) y `paradero_m7`. Con la flag `m7_sira_sigue`, Sira camina detrás del jugador también en los interiores. El medidor de química (`src/ui/QuimicaMeter.ts`) sirve a las misiones 6 y 7 (cada una con su prefijo de flags). El bus `bus_cali_v_n` es el de la Calle 18 visto desde arriba yendo hacia el norte (`flipY` en `src/art/vehicles.ts`).

Scripts de la misión 6 (`src/systems/StoryScripts6.ts`): `clase_natacion`, `almuerzo_m6`, `separador`, `articulado_t31`, `encuentro_ermita`, `poema_express`, `firma_autora`, `raponazo`, `helado_mesa`, `apagon`, `cuentero_buziraco` y `mirador_noche`. Con la flag `m6_sira_sigue`, Sira camina detrás del jugador (como el quiltro de la misión 1).

Scripts de la misión 5 (`src/systems/StoryScripts5.ts`): `estudiar_m5`, `corte_pelo`, `carro_grover_estacionado`, `grover_arranca`, `grover_vuelta`, `piscina_m5` y `hamburguesas`.

Scripts de la misión 4: `despertar_cali` (alarma, posponer y el desfase), `bus_cali` (el bus P27; en Pance se lo ve llegar), `reunion_intercambio`, `cocinar_fideos`, `partido` (abre la escena `Futbol` y sigue con la celebración o la derrota) y `rooftop` (la llovizna de las 21:30).

Scripts actuales: `micro_esperar`, `metro_esperar_tren` (con `texture` y `arrive` opcionales: `arrive` es la hora a la que llega el tren, y si es temprano el reloj se adelanta), `mapa_linea`, `start_ride`, `entrar_costanera`, `ropero`, `fundido` (fundido a negro con un diálogo), `dormir` (alarma, posponer y la pesadilla) y, de la misión 3: `trayecto` (viaje sentado de `trayectos.json`: carteles por tramo, reloj y diálogos), `auto_familia`, `maleta` (los 23 kg), `pesar_maleta`, `despedida`, `esperar_embarque` y `vuelo`.

**Luz del día y clima:** en misiones con hora del día, los exteriores cambian de color con la hora: amanecer rosado (5:20 a 7:00), día, atardecer naranjo y morado (16:50 a 19:30) y noche azul. El clima (efecto `weather`) oscurece y agrega lluvia o tormenta con relámpagos; en los interiores se ven gotas en las ventanas y se oye la lluvia apagada. Los tiles `vista_ciudad` y las guirnaldas del campo `lights` del mapa brillan de noche (el rooftop).

**Viajes sentados:** en `trayectos.json`, un tramo puede llevar `minutes` en vez de `clock` (avanza el reloj N minutos: el bus de Cali se toma a distintas horas) y el viaje puede borrar flags al llegar con `clear`.

---

## Depuración

- En modo dev (`npm run dev`) existe `__dev` en la consola del navegador:
  - `__dev.state.allFlags()`, `__dev.state.inventory()`, `__dev.state.money`, `__dev.state.bip`
  - `__dev.dialogue.active`, `__dev.dialogue.vars`
  - `__dev.game.scene.getScene('Overworld').player.setTile(x, y, 'up')` para teletransportarse
  - `__audio.info()`: estado del audio, pista actual y contador de efectos
- Los mapas se validan al cargarse (`GameMap`): largo de filas, caracteres de la leyenda, tiles y estilos de edificio existentes, spawns dentro del mapa, warps a mapas y spawns existentes. El error dice el mapa y la fila.
- Diálogos o nodos inexistentes y ciclos de `branches`/`next` se reportan con `console.error` al abrirse; los NPCs y warps con diálogos inexistentes, al crear el primer mapa. `npm test` revisa todo eso (y más) sin jugar.
- Para borrar la partida guardada: `localStorage.removeItem('santiago-laberinto:save')`; los espacios de guardado: `santiago-laberinto:slots`; el progreso (y con él los desbloqueos): `santiago-laberinto:records`; los ajustes: `santiago-laberinto:settings`.
- Si probaste el build (`npm run preview`) y el navegador sigue mostrando una versión vieja: el service worker la sirve desde su caché hasta que la página nueva lo actualiza. Recarga una vez más, o en DevTools → Application → Service Workers → *Unregister*.

---

## Créditos

- Datos de calles inspirados en © OpenStreetMap contributors.
- Fuentes **Pixelify Sans** y **Silkscreen** (Google Fonts, licencia SIL Open Font License).
- Motor: Phaser 3. Música y efectos originales, sintetizados por código.

Obra de ficción. En la misión 7, el Bobo Unic Living, la bodega PrecioClub, la Farmadía 24H, la Panadería La Espiga, las gaseosas La Caleña, Coca-Kola y Rojosazón, CineFlix y la película «Tu nombre bajo el cometa» son inventados; la Calle 18, la Carrera 121, la Carrera 122 y Cañasgordas son reales (trazado a partir de © OpenStreetMap contributors). En la misión 6, el centro comercial Guayacán Plaza, la Universidad Pública del Valle, Plaza Aventura, Hojarasca Libros, la Heladería Corazones, la escritora Amparo Ledesma y su novela, la Tarjeta Recorre y los códigos de ruta (T31, E31, T42, T47, E27, P47) son inventados, igual que la Feria del Libro del juego; la estación Universidades y las paradas de la troncal, la Av. Carrera 100, la Calle 16, la Carrera 98, la Autopista Simón Bolívar, Ciudad Jardín, el río Lili, la Torre de Cali, La Ermita, el Parque La Retreta, el Bulevar del Río, el río Cali, el Puente Ortiz, el Puente España, el monumento a Jorge Isaacs, el Parque de los Poetas, el CAM, la Colina y la Capilla de San Antonio son reales (trazado a partir de © OpenStreetMap contributors). En la misión 5, la Barbería 360, Pance Burger, el Autocine, la bodega mayorista y la app Fotogram son inventados; las calles (Calle 18, Carrera 121 y 120, Calle 25, Calles 40 a 45A), el lago El Retiro, Ciudad Pacífica, son reales (trazado a partir de © OpenStreetMap contributors); el Centro Deportivo de la PUCC sigue el de un campus real de Pance. Los nombres de calles, estaciones y lugares son reales, pero el mapa es esquemático. No se usan logos ni marcas reales (Metro, Red, EFE, MIO, comercios): las señales, recorridos de micro y bus y personajes son genéricos o inventados. La Universidad Antonio Varas y la Universidad Cristiana-Caleña son inventadas (el campus de la segunda sigue el trazado de un campus real de Pance, a partir de datos de © OpenStreetMap contributors).
