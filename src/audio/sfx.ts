import { EventSystem } from '../systems/EventSystem';

/** Efectos de sonido disponibles (los sintetiza AudioManager). */
export type SfxName =
  | 'blip' // letra de la máquina de escribir
  | 'page' // avanzar página de diálogo
  | 'cursor' // mover cursor en menús
  | 'select' // confirmar
  | 'cancel' // volver / cerrar
  | 'open' // abrir menú o panel
  | 'close' // cerrar menú o panel
  | 'bump' // chocar con una pared
  | 'item' // obtener un ítem
  | 'coin' // pagar o recibir plata
  | 'bip' // pasar la tarjeta Bip!
  | 'error' // saldo insuficiente / acción inválida
  | 'door' // entrar/salir (warp)
  | 'chime' // pitido de puertas del metro
  | 'train-arrive'
  | 'train-depart'
  | 'bus-pass'
  | 'bus-brake'
  | 'bell' // timbre de la micro
  | 'dog' // ladrido
  | 'phone' // vibración del celular
  | 'banner' // cartel de calle
  | 'click' // clic de mouse en el mapa de la línea
  | 'eat' // comer algo
  | 'complete' // misión completada
  | 'metro-doors-open' // puertas del metro: aire + campanita
  | 'metro-doors-close' // aviso de cierre: pitidos rápidos y golpe
  | 'bus-doors-open' // micro: pssshh + pitidos
  | 'bus-doors-close'
  | 'ring' // celular sonando (llamada entrante)
  | 'notify' // llegó un mensaje
  | 'camera' // obturador
  | 'elevator' // ding del ascensor
  | 'snake-eat'
  | 'snake-die'
  | 'secret' // encontraste un easter egg
  | 'sit' // sentarse en un asiento
  | 'avion' // turbinas del avión al despegar o aterrizar
  | 'anuncio' // campanita de altoparlante del aeropuerto
  | 'sello' // timbre en el pasaporte
  | 'trueno' // trueno del aguacero (misión 4)
  | 'silbato' // pitazo del árbitro
  | 'patada' // patada a la pelota
  | 'gol' // ¡gol! (grito y aplausos)
  | 'poste' // la pelota pega en el palo
  | 'hervir' // la olla hirviendo
  | 'brindis' // chocar vasos
  | 'ducha' // agua de la ducha
  | 'pavo' // el grito del pavo real
  | 'pito_lejos' // bocina de un auto, abajo en la calle (rooftop)
  | 'moto_lejos' // una moto que pasa allá abajo
  | 'sirena_lejos' // una ambulancia a varias cuadras
  | 'avion_lejos' // un avión que cruza el cielo de noche
  | 'maquina' // la máquina de cortar pelo de Fredy (misión 5)
  | 'tijera' // tijeretazos
  | 'splash' // salpicón de agua (nadar)
  | 'chapuzon' // ¡PLAF! panzazo o salto al agua
  | 'marco' // «¡Marco!» (grito sintetizado)
  | 'polo' // «¡Polo!»
  | 'carta' // tirar una carta en la mesa
  | 'barajar' // barajar el mazo
  | 'mesa' // golpe en la mesa (el Cinco)
  | 'bocina_grover' // la bocina de «La Cucaracha» del cacharro de Grover
  | 'loro' // el loro de la Carrera 120
  | 'enviado' // misión 6: mandaste un mensaje (fiu)
  | 'latido' // el corazón a mil (bum-bum)
  | 'gato' // un gato que maúlla en la oscuridad
  | 'fuegos' // fuegos artificiales a lo lejos
  | 'burbujas' // soplar burbujas bajo el agua
  | 'raponazo' // ¡zas! el ladrón arranca la bolsa
  | 'apagon' // se va la luz (zumbido que se apaga)
  | 'linterna' // clic de la linterna del celular
  | 'teclas' // la máquina de escribir del poeta
  | 'salto' // saltar en la persecución
  | 'golpe' // chocar con algo (persecución)
  | 'toc_toc' // misión 7: tocan la puerta del depa
  | 'cuchillo' // picar en la tabla
  | 'sarten' // el sofrito chisporroteando
  | 'destapar' // abrir una gaseosa (pssst)
  | 'beso' // el beso (suave, con campanita)
  | 'caja_registradora' // ¡tlin! la caja de la farmacia
  | 'tele'; // prender la tele (el zumbido del encendido)

/** Pistas de música de fondo. */
export type MusicTrack =
  | 'title'
  | 'street'
  | 'station'
  | 'train'
  | 'bus'
  | 'complete'
  | 'credits'
  | 'despedida'
  | 'aeropuerto'
  | 'salsa'
  | 'campus'
  | 'futbol'
  | 'rooftop'
  | 'barberia' // misión 5: salsa brava en la Barbería 360
  | 'morenada' // el cacharro de Grover: morenada boliviana con matracas
  | 'piscina' // las piscinas de noche: tranquila, con eco
  | 'sira' // el encuentro: bolero suave
  | 'hamburguesas' // Pance Burger y el Cinco: boogaloo juguetón
  | 'feria' // misión 6: la feria del libro en el Bulevar (pasillo-cumbia alegre, con flauta)
  | 'colina' // la Colina de San Antonio de noche: guitarra y misterio
  | 'persecucion' // ¡al ladrón! (rápida, tensa)
  | 'natacion' // la clase de natación con Sira (juguetona, con burbujas)
  | 'depa' // misión 7: el depa del piso 8 (bossa tranquila, cálida)
  | 'ascensor' // la música del ascensor (bossa de ascensor, obvio)
  | 'cocina' // la boloñesa con Sira (cumbia juguetona)
  ;

/** Sonido ambiente en loop: la lluvia (más fuerte en la tormenta). `indoor` la apaga como detrás de una ventana. */
export interface AmbientState {
  rain: 'none' | 'lluvia' | 'tormenta';
  indoor: boolean;
}

/** Arriba de un edificio: viento (0..1) y murmullo de la ciudad (0..1). Ambos en 0 lo apagan. */
export interface SkylineAmbient {
  wind: number;
  hum: number;
}

export function setSkylineAmbient(state: SkylineAmbient): void {
  EventSystem.emit('skyline-ambient', state);
}

export function playSfx(name: SfxName): void {
  EventSystem.emit('sfx', name);
}

export function playMusic(track: MusicTrack | null): void {
  EventSystem.emit('music', track);
}

export function setAmbient(state: AmbientState): void {
  EventSystem.emit('ambient', state);
}
