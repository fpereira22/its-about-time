import type { Style } from './sandboxTalk';

/**
 * Reparto del modo libre (sandbox, solo dev por ahora): con quién se puede charlar y a quién se le puede regalar qué.
 *
 * Todo lo de cada persona va aquí: cómo saluda según cuánto la conoces, los temas de conversación, qué le
 * encanta o le gusta de lo que se puede regalar, y cómo reacciona. Los árboles de diálogo se arman a partir de
 * estos datos (src/systems/Sandbox.ts); para sumar a alguien o un tema, basta con editar esta tabla.
 */

export interface SandboxTopic {
  id: string;
  /** Lo que dice la opción del menú. */
  label: string;
  /** La respuesta, de a una página por línea. */
  lines: string[];
}

export interface SandboxPerson {
  id: string;
  /** Cómo reacciona a cumplidos, bromas y besos (src/data/sandboxTalk.ts). */
  style: Style;
  /** ¿Se puede coquetear y besar? Si no, las bromas y el abrazo ocupan su lugar. */
  romance: boolean;
  /** Corazones que hacen falta para un beso en los labios («la química»). */
  needHearts: number;
  /** Temas más personales: se abren cuando ya hay confianza (nivel 1). */
  deep: SandboxTopic[];
  /** Nombre que sale en el cuadro de diálogo. */
  name: string;
  /** Personaje de sprites.json. */
  sprite: string;
  /** Saludo según la confianza: [recién conocidos, ya hay confianza, cercanos]. */
  greet: [string, string, string];
  topics: SandboxTopic[];
  /** Ítems que le encantan (+3 de confianza) y que le gustan (+2). Cualquier otro suma +1. */
  loves: string[];
  likes: string[];
  /** Reacción al regalo según cuánto le gustó. `{item}` es el nombre del regalo. */
  reaction: { love: string; like: string; meh: string };
}

/** Cuánto suma a la confianza cada cosa que se hace por primera vez con alguien. */
export const POINTS = { topic: 1, love: 3, like: 2, meh: 1, chat: 1, lips: 2 } as const;
/** Puntos para llegar a cada nivel de confianza (0 = recién conocidos). */
export const BAND_AT: readonly [number, number] = [4, 10];
/** Corazones que se muestran: uno cada dos puntos, hasta este tope. */
export const MAX_HEARTS = 5;

/** Ítems con que parte el sandbox (de a 2): para regalar de entrada. */
export const SANDBOX_BAG: readonly string[] = [
  'sopaipilla', 'empanada', 'completo', 'mote', 'alfajor', 'pandebono', 'bunuelo', 'lulada', 'cholado',
  'helado_carrito', 'chocolatina', 'girasol', 'libro_maria', 'cafe_salento', 'llavero_palma', 'pulsera_neon', 'oblea', 'manjar',
];

export const SANDBOX_CAST: readonly SandboxPerson[] = [
  {
    id: 'sira',
    style: 'timida',
    romance: true,
    needHearts: 4,
    name: 'Sira',
    sprite: 'sira',
    greet: ['Ey, hola. ¿Qué hacemos?', '¡Hola! Qué bueno verte. Ven, siéntate un rato.', 'Justo estaba pensando en ti. ¿Cómo vas?'],
    topics: [
      { id: 'agua', label: 'La natación', lines: ['Cuando estoy en el agua se me callan todos los pensamientos.', 'Es lo único que me hace sentir liviana. Lo recomiendo.'] },
      { id: 'cali', label: 'Cali', lines: ['Cali no se explica, se camina.', 'Con algo frío en la mano y el sol cayendo. Ahí entiendes todo.'] },
      { id: 'helados', label: 'Helados', lines: ['Maracuyá. Sin discusión.', 'Si me traes de otro sabor, igual lo recibo. Pero me sé quién eres.'] },
      { id: 'planes', label: 'Planes para el fin de semana', lines: ['Quiero un plan sin plan: caminar y ver qué sale.', 'Los mejores días de mi vida no estaban en la agenda.'] },
    ],
    deep: [
      { id: 'miedo', label: 'Lo que más te da miedo', lines: ['Quedarme quieta mucho rato. Cuando paro, pienso.', 'Por eso nado: el agua no deja pensar.'] },
      { id: 'sueno', label: 'Lo que sueñas', lines: ['Un día entero sin reloj ni mensajes.', 'Y alguien con quien no haga falta llenar los silencios.'] },
    ],
    loves: ['helado_carrito', 'cholado', 'girasol', 'libro_maria'],
    likes: ['lulada', 'chocolatina', 'cafe_salento', 'pulsera_neon'],
    reaction: {
      love: '¿{item}? Eso era exactamente lo que quería. ¿Cómo supiste?',
      like: 'Ay, {item}. Gracias, de verdad. Qué detalle.',
      meh: '{item}... Bueno, es un detalle. Gracias.',
    },
  },
  {
    id: 'laura',
    style: 'directa',
    romance: true,
    needHearts: 4,
    name: 'Laura',
    sprite: 'laura',
    greet: ['Hola. Eres el chileno, ¿no? Vale.', '¡Ey, tú! Justo a tiempo.', 'Ven, que te cuento algo y no te rías.'],
    topics: [
      { id: 'bakio', label: 'Bakio', lines: ['Bakio es un pueblo pequeño con una playa enorme.', 'Allí el mar manda. Todo lo demás es un plan B.'] },
      { id: 'pimpon', label: 'El pimpón', lines: ['En el frontón hay una mesa y ahí he perdido muchos veranos.', 'Pero cada derrota me enseñó algo. Mentira, solo me dio rabia.'] },
      { id: 'comida', label: 'La comida de allá', lines: ['Pintxos y un txakoli bien frío. Lo demás es relleno.', 'Aquí echo de menos el pan, no te voy a mentir.'] },
      { id: 'extraño', label: 'Lo que extrañas de casa', lines: ['El ruido del mar de madrugada, y a mi gente.', 'Pero también me encanta estar aquí. Las dos cosas a la vez.'] },
    ],
    deep: [
      { id: 'familia', label: 'Tu familia', lines: ['Mi gente es ruidosa, cariñosa y muy de opinar.', 'Si los conocieras, te caerían bien en cinco minutos.'] },
      { id: 'futuro', label: 'Lo que quieres hacer después', lines: ['Ver mundo sin perder el hogar. Difícil, pero ahí voy.', 'Y tener una playa cerca, siempre.'] },
    ],
    loves: ['cafe_salento', 'chocolatina', 'libro_maria', 'llavero_palma'],
    likes: ['manjar', 'alfajor', 'oblea', 'pandebono'],
    reaction: {
      love: '¡Hostia, {item}! Esto me ha hecho el día. Gracias, de verdad.',
      like: 'Anda, {item}. Qué majo. Gracias.',
      meh: '{item}... vale, gracias. Tiene su gracia.',
    },
  },
  {
    id: 'danilo',
    style: 'calida',
    romance: false,
    needHearts: 4,
    name: 'Danilo',
    sprite: 'danilo',
    greet: ['Qué más, parce. Todo bien por aquí.', '¡Ey! Vení, que hay buen parche.', 'Parce, qué bueno que viniste. De verdad.'],
    topics: [
      { id: 'rio', label: 'El río', lines: ['Un domingo en el río y se arregla cualquier semana.', 'Agua fría, buena música y nada que hacer.'] },
      { id: 'comida', label: 'Lo que más te gusta comer', lines: ['Un buen sancocho con aguacate, y no me pregunten más.', 'Y de postre lo que haya. No soy exigente.'] },
      { id: 'musica', label: 'La música', lines: ['Salsa pa bailar, rock pa pensar.', 'Y de todo un poquito pa que la gente no se aburra.'] },
      { id: 'futuro', label: 'Qué quieres hacer más adelante', lines: ['Estar tranquilo y que los míos estén bien.', 'Lo demás se va dando. Yo confío.'] },
    ],
    deep: [
      { id: 'barrio', label: 'Tu barrio', lines: ['En mi barrio todos se saludan, aunque no se caigan bien.', 'Eso no lo cambio por nada.'] },
      { id: 'miedo', label: 'Lo que te asusta', lines: ['Quedarme sin gente. Lo demás se arregla.', 'Por eso cuido a los míos como oro.'] },
    ],
    loves: ['chontaduro', 'bunuelo', 'lulada', 'pandebono'],
    likes: ['sopaipilla', 'empanada', 'cholado', 'cafe_salento'],
    reaction: {
      love: '¡Uy, {item}! Eso sí es una buena. Gracias, parce.',
      like: 'Qué nota, {item}. Muchas gracias.',
      meh: '{item}... bueno, se agradece el gesto.',
    },
  },
  {
    id: 'tami',
    style: 'bromista',
    romance: true,
    needHearts: 5,
    name: 'Tami',
    sprite: 'tami',
    greet: ['¡Hola! ¿Qué más, qué hubo?', '¡Ey, mi vida! Cuéntame todo.', 'Ay, qué rico verte. Ven, ven, ven.'],
    topics: [
      { id: 'cali', label: 'Cali de noche', lines: ['De noche Cali se pone otra: más suelta, más bonita.', 'Siempre hay una excusa para salir a bailar.'] },
      { id: 'fiesta', label: 'La fiesta', lines: ['Mi regla es llegar tarde y quedarme hasta que prendan las luces.', 'Pero cuando la música es buena, me quedo igual.'] },
      { id: 'estudio', label: 'La universidad', lines: ['Estudiar y vivir al mismo tiempo, ese es el truco.', 'Y si no, café. Mucho café.'] },
      { id: 'chisme', label: 'Chismes', lines: ['Mmm, no te los digo todos hoy. Un poquito.', 'Es que si te los cuento todos, me quedo sin plan.'] },
    ],
    deep: [
      { id: 'casa', label: 'Tu casa', lines: ['Mi casa es chiquita pero siempre hay alguien. Y siempre sobra comida.', 'Es el mejor lugar del mundo, no te voy a mentir.'] },
      { id: 'sueno', label: 'Lo que te gustaría ser', lines: ['Alguien que organice fiestas que la gente recuerde años después.', 'O dueña de un lugar con buena música. Todavía no decido.'] },
    ],
    loves: ['pulsera_neon', 'helado_carrito', 'chocolatina', 'girasol'],
    likes: ['lulada', 'cholado', 'oblea', 'bunuelo'],
    reaction: {
      love: '¡¿{item}?! ¡Eres lo máximo! Gracias, gracias, gracias.',
      like: 'Ay, qué lindo: {item}. Gracias, mi vida.',
      meh: '{item}... jaja, gracias, qué original.',
    },
  },
  {
    id: 'richi',
    style: 'timida',
    romance: false,
    needHearts: 4,
    name: 'Richi',
    sprite: 'richi',
    greet: ['Hola, ve. ¿Cómo andás?', '¡Qué más, ve! Pasá, pasá.', 'Ve, qué bueno que estés por acá.'],
    topics: [
      { id: 'pasto', label: 'Pasto', lines: ['Pasto es frío, pero la gente es caliente. Es así.', 'Y el Galeras de fondo. Aquí no hay mejor postal.'] },
      { id: 'cuy', label: 'La comida de allá', lines: ['Allá el cuy es de fiesta. Los primeros días me daba cosa.', 'Ahora lo extraño, ve. Qué cosa.'] },
      { id: 'futbol', label: 'El fútbol', lines: ['Para mí el fútbol es de barrio: piedra, arco y a correr.', 'Lo importante es jugar. Ganar es un bonus.'] },
      { id: 'frio', label: 'El frío', lines: ['Aquí me creen exagerado. Allá esto es calor.', 'Pero igual me gusta el solcito, no creas.'] },
    ],
    deep: [
      { id: 'familia', label: 'Tu familia', lines: ['Mi familia es de pocas palabras y mucho abrazo.', 'Los extraño más de lo que aparento.'] },
      { id: 'sueno', label: 'Lo que sueñas', lines: ['Tener un lugar con fogón, algo caliente para tomar y gente que llegue sin avisar.', 'Con eso, ve, ya estaría.'] },
    ],
    loves: ['empanada', 'sopaipilla', 'manjar', 'cafe_salento'],
    likes: ['pandebono', 'alfajor', 'bunuelo', 'mote'],
    reaction: {
      love: 'Qué rico, ve, {item}. Gracias, de verdad.',
      like: 'Uy, {item}. Gracias, estaba justo para eso.',
      meh: '{item}... bueno, ahí vemos. Gracias.',
    },
  },
  {
    id: 'juanpa',
    style: 'bromista',
    romance: false,
    needHearts: 4,
    name: 'Juanpa',
    sprite: 'juanpa',
    greet: ['Parce, ¿qué más?', '¡Hola, hermano! Qué bueno verte por acá.', 'Hermano, qué bueno que viniste. Ya sabía.'],
    topics: [
      { id: 'deporte', label: 'El deporte', lines: ['Me gusta el deporte porque ahí no hay nada que explicar.', 'Le pegás y listo. O no. Pero le pegaste.'] },
      { id: 'musica', label: 'La música', lines: ['Un poquito de todo. Reggaetón para el parche, salsa para el alma.', 'Pero en el carro, rock. Siempre rock.'] },
      { id: 'comida', label: 'La comida', lines: ['Todo lo que tenga queso. En serio, todo.', 'Y si tiene arepa, mejor.'] },
      { id: 'parche', label: 'El parche', lines: ['El parche es lo que hace que cualquier ciudad se sienta casa.', 'Sin parche, no hay ciudad.'] },
    ],
    deep: [
      { id: 'futuro', label: 'Lo que quieres hacer después', lines: ['Vivir de algo que me guste, aunque gane menos.', 'Lo importante es no mirar el reloj con rabia.'] },
      { id: 'amigos', label: 'Qué es un buen amigo', lines: ['Un buen amigo es el que te avisa cuando la estás regando.', 'Y el que no te lo recuerda después.'] },
    ],
    loves: ['pandebono', 'bunuelo', 'chocolatina', 'sopaipilla'],
    likes: ['empanada', 'completo', 'lulada', 'cholado'],
    reaction: {
      love: '¡Hermano, {item}! Eso sí. Mil gracias.',
      like: 'Uy, {item}. Qué buena, gracias.',
      meh: '{item}... ahí, gracias. Se agradece.',
    },
  },
  {
    id: 'renzo',
    style: 'directa',
    romance: false,
    needHearts: 4,
    name: 'Renzo',
    sprite: 'renzo',
    greet: ['¿Qué tal, causa?', '¡Causa! Qué bueno que viniste.', 'Causa, justo a ti te quería ver.'],
    topics: [
      { id: 'arequipa', label: 'Arequipa', lines: ['Arequipa es la ciudad blanca, y el volcán es de la familia.', 'Si no has ido, vas. Es una orden.'] },
      { id: 'picanteria', label: 'La picantería', lines: ['Rocoto relleno y chupe. Ahí se acaban los problemas.', 'Aquí cuesta encontrar algo así de bueno.'] },
      { id: 'pimpon', label: 'El pimpón', lines: ['En Arequipa yo era campeón del barrio, causa. Del barrio. Del pasaje, más bien.', 'Pero siempre me gustó competir, aunque pierda.'] },
      { id: 'parche', label: 'El parche', lines: ['Con buena compañía, hasta lo malo se hace gracioso.', 'Eso lo aprendí aquí.'] },
    ],
    deep: [
      { id: 'lejos', label: 'Estar lejos de casa', lines: ['Al principio duele. Después se vuelve una forma de crecer.', 'Pero el rocoto se huele de lejos, causa.'] },
      { id: 'sueno', label: 'Lo que sueñas', lines: ['Volver a mi ciudad con algo bueno que contar.', 'Y que mi viejo se ría escuchándome.'] },
    ],
    loves: ['empanada', 'sopaipilla', 'manjar', 'chocolatina'],
    likes: ['pandebono', 'alfajor', 'mote', 'cafe_salento'],
    reaction: {
      love: '¡Causa, {item}! Qué detalle. Gracias, de verdad.',
      like: 'Ya pues, {item}. Gracias, causa.',
      meh: '{item}... ya, gracias. Qué cosas.',
    },
  },
];

/** Ciudades del sandbox: se viaja en taxi o bus entre los lugares de un mismo país; entre países, en avión. */
export interface SandboxCity {
  id: string;
  name: string;
  country: 'CL' | 'CO';
}

export const SANDBOX_CITIES: readonly SandboxCity[] = [
  { id: 'santiago', name: 'Santiago', country: 'CL' },
  { id: 'paine', name: 'Paine', country: 'CL' },
  { id: 'cali', name: 'Cali', country: 'CO' },
  { id: 'pance', name: 'Pance', country: 'CO' },
  { id: 'salento', name: 'Salento', country: 'CO' },
];

/** Sitios del sandbox: dónde aparece el jugador y quiénes están ahí. */
export interface SandboxPlace {
  id: string;
  /** Ciudad (id de SANDBOX_CITIES). */
  city: string;
  /** Nombre del lugar, sin la ciudad. */
  name: string;
  /** "Ciudad · Lugar": como se ve en las listas y los carteles. */
  label: string;
  map: string;
  spawn: string;
  cast: string[];
  /** País: se viaja en taxi o bus entre los sitios del mismo país; entre países, en avión desde un aeropuerto. */
  country: 'CL' | 'CO';
  /** Aeropuerto: tiene mostrador de vuelos y manda a este otro sitio (id) en avión. */
  flightTo?: string;
}

const cityById = new Map(SANDBOX_CITIES.map((c) => [c.id, c]));

function place(id: string, city: string, name: string, map: string, spawn: string, cast: string[], flightTo?: string): SandboxPlace {
  const c = cityById.get(city) as SandboxCity;
  return { id, city, name, label: `${c.name} · ${name}`, map, spawn, cast, country: c.country, ...(flightTo ? { flightTo } : {}) };
}

export const SANDBOX_PLACES: readonly SandboxPlace[] = [
  // Santiago
  place('providencia', 'santiago', 'Av. Providencia', 'providencia', 'inicio', ['renzo', 'richi', 'juanpa']),
  place('baquedano', 'santiago', 'Estación Baquedano', 'metro_baquedano', 'entrada', ['renzo', 'juanpa']),
  place('costanera', 'santiago', 'Costanera Center', 'costanera_1', 'ascensor', ['richi', 'renzo']),
  place('central', 'santiago', 'Estación Central', 'estacion_central', 'post_torniquete', ['juanpa', 'richi']),
  place('antonio_varas', 'santiago', 'Antonio Varas (la U)', 'antonio_varas', 'metro', ['renzo', 'richi', 'juanpa']),
  place('sanguchería', 'santiago', 'Sanguchería Al Toque', 'resto_chileno', 'entrada', ['renzo', 'juanpa']),
  place('scl', 'santiago', 'Aeropuerto (salidas)', 'scl_salidas', 'auto', ['renzo', 'juanpa'], 'clo'),
  place('scl_llegadas', 'santiago', 'Aeropuerto (llegadas)', 'scl_llegadas', 'avion', ['renzo', 'juanpa']),
  // Paine
  place('paine', 'paine', 'El pueblo', 'paine', 'casa', ['richi', 'renzo']),
  place('casa_paine', 'paine', 'La casa (primer piso)', 'casa_piso1', 'comedor', ['juanpa']),
  place('estacion_paine', 'paine', 'Estación de Paine', 'estacion_paine', 'entrada', ['renzo', 'richi']),
  place('sandias', 'paine', 'Restorán Las Sandías', 'restaurante_paine', 'puerta', ['juanpa', 'richi']),
  // Cali
  place('cali', 'cali', 'Atrio de La Ermita', 'centro_cali', 'atrio', ['sira', 'tami', 'danilo']),
  place('san_antonio', 'cali', 'San Antonio', 'san_antonio', 'atrio', ['sira', 'laura']),
  place('pucc', 'cali', 'Plaza del campus', 'pucc_campus', 'plaza', ['tami', 'juanpa', 'richi', 'renzo']),
  place('pucc_cafeteria', 'cali', 'Cafetería Central', 'pucc_cafeteria', 'puerta', ['tami', 'juanpa']),
  place('pucc_piscina', 'cali', 'Centro Deportivo', 'pucc_piscina', 'entrada', ['sira', 'renzo']),
  place('universidades', 'cali', 'Estación Universidades', 'universidades', 'afuera', ['richi', 'juanpa']),
  place('itsisi', 'cali', 'Universidad Itsisi', 'itsisi', 'saman', ['laura', 'sira']),
  place('bobo', 'cali', 'Cuadra del Bobo', 'bobo_cuadra', 'lobby', ['sira', 'laura', 'juanpa']),
  place('bobo_lobby', 'cali', 'Lobby del Bobo', 'bobo_lobby', 'entrada', ['sira', 'laura']),
  place('bobo_805', 'cali', 'Depa 805', 'bobo_piso8', 'inicio', ['laura']),
  place('bobo_1104', 'cali', 'Depa 1104', 'bobo_piso11', 'puerta_dentro', ['sira']),
  place('farmadia', 'cali', 'Farmadía 24H', 'farmadia', 'entrada', ['sira', 'tami']),
  place('heladeria', 'cali', 'Heladería Corazones', 'heladeria_corazones', 'puerta', ['sira', 'tami']),
  place('guayacan', 'cali', 'C.C. Guayacán Plaza', 'guayacan_plaza', 'puerta', ['tami', 'laura']),
  place('barberia', 'cali', 'Barbería 360', 'barberia_360', 'puerta', ['juanpa', 'danilo']),
  place('ruta_barberia', 'cali', 'Carrera 121', 'ruta_barberia', 'desde_u', ['juanpa', 'danilo']),
  place('billar', 'cali', 'Billares El Arriero', 'bar_billar', 'entrada', ['danilo', 'juanpa', 'richi']),
  place('casa_tami', 'cali', 'Casa de Tami (Cristo Rey)', 'casa_tami', 'llegada', ['tami', 'sira', 'danilo']),
  place('rooftop', 'cali', 'Rooftop de Antoine', 'rooftop_cali', 'llegada', ['tami', 'laura']),
  place('chorrera', 'cali', 'Chorrera del Indio', 'chorrera', 'llegada', ['laura', 'danilo']),
  place('voragine', 'cali', 'La Vorágine', 'voragine', 'llegada', ['laura', 'sira']),
  place('clo', 'cali', 'Aeropuerto (llegadas)', 'clo_llegadas', 'avion', ['danilo', 'tami']),
  place('clo_salidas', 'cali', 'Aeropuerto (salidas)', 'clo_salidas', 'puerta', ['danilo', 'tami'], 'scl_llegadas'),
  // Pance
  place('pance', 'pance', 'Casa', 'pance', 'casa', ['danilo', 'tami', 'renzo', 'sira']),
  place('pance_casa', 'pance', 'Casa de doña Mery', 'pance_casa', 'puerta', ['danilo']),
  place('pance_burger', 'pance', 'Pance Burger', 'pance_burger', 'puerta', ['danilo', 'tami']),
  place('pance_rio', 'pance', 'Río Pance (Ecoparque)', 'pance_rio', 'llegada', ['danilo', 'sira', 'tami']),
  // Salento
  place('salento', 'salento', 'Plaza', 'salento', 'plaza', ['laura', 'danilo', 'sira']),
  place('casita', 'salento', 'Hostal La Casita', 'salento_casita', 'entrada', ['laura', 'richi']),
  place('bahareque', 'salento', 'Disco El Bahareque', 'disco_salento', 'entrada', ['laura', 'juanpa', 'danilo']),
  place('parque', 'salento', 'Parque del Café', 'parque_cafe', 'llegada', ['laura', 'richi', 'juanpa']),
];
