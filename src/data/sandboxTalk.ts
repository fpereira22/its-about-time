/**
 * Frases del modo libre que no dependen de la persona sino de su manera de ser (`Style`): cumplidos, coqueteo,
 * bromas, besos, y las charlas con gente de la calle. Se usan con el reparto fijo (sandboxCast.ts) y con los
 * desconocidos que se encuentran en cada mapa (sandboxStreet.ts).
 *
 * Todo texto aquí es de relleno genérico: nada de hechos de la historia.
 */

/** Cómo reacciona cada quien: define el tono de las respuestas. */
export type Style = 'timida' | 'directa' | 'calida' | 'bromista';

export const STYLES: readonly Style[] = ['timida', 'directa', 'calida', 'bromista'];

/** Una respuesta por estilo. */
export type ByStyle = Record<Style, string>;

/** Los tres cumplidos que se pueden hacer (cada uno suma confianza una sola vez por persona). */
export interface Compliment {
  id: string;
  label: string;
  /** Si la persona no es de coqueteo se usa `friendLabel`. */
  friendLabel?: string;
  reply: ByStyle;
}

export const COMPLIMENTS: readonly Compliment[] = [
  {
    id: 'estilo',
    label: 'Me gusta tu estilo',
    reply: {
      timida: 'Ay... ¿en serio? Es lo primero que me pongo y ya. Gracias.',
      directa: 'Lo sé. Pero gracias por notarlo.',
      calida: '¡Gracias! Me da gusto que lo notaras, de verdad.',
      bromista: 'Años de práctica frente al espejo. Por fin rinden frutos.',
    },
  },
  {
    id: 'onda',
    label: 'Qué buena onda eres',
    reply: {
      timida: 'Qué lindo. No suelo oír eso. Gracias.',
      directa: 'Vale. Tú tampoco estás mal, para ser alguien que viene a decir cosas.',
      calida: 'Tú también, ¿sabes? Se nota cuando alguien es buena gente.',
      bromista: 'Cobro por cada halago, pero a ti te lo dejo gratis.',
    },
  },
  {
    id: 'sonrisa',
    label: 'Tienes una sonrisa linda',
    friendLabel: 'Tienes una risa contagiosa',
    reply: {
      timida: 'Me estás haciendo sonrojar. Para, para.',
      directa: 'Gracias. Y no la regalo, ¿eh? Hay que ganársela.',
      calida: 'Ay, qué amor. Me hiciste el día con eso.',
      bromista: '¿Esta? Es de fábrica, no tiene mérito. Pero gracias.',
    },
  },
];

/** Coqueteo: tres niveles. Hace falta cierta confianza para que caiga bien (`needHearts`). */
export interface Flirt {
  id: string;
  label: string;
  needHearts: number;
  warm: ByStyle;
  /** Si todavía es pronto. */
  early: ByStyle;
}

export const FLIRTS: readonly Flirt[] = [
  {
    id: 'mirar',
    label: 'Mirar un rato, sin decir nada',
    needHearts: 0,
    warm: {
      timida: 'Me da risa... y vergüenza. Pero no quito la vista.',
      directa: 'Me estás mirando. Me gusta que lo hagas sin disimular.',
      calida: 'Sonríe, sin apuro. Se queda un segundo más de lo necesario.',
      bromista: '¿Tengo algo en la cara? ... Ah, no. Era eso.',
    },
    early: {
      timida: 'Eh... ¿pasa algo? Me da vergüenza que me mires así.',
      directa: 'Mmm. ¿Y esa mirada?',
      calida: 'Se ríe, algo confundida. Mira para otro lado.',
      bromista: '¿Me debes plata o qué? Jaja.',
    },
  },
  {
    id: 'cita',
    label: 'Decir que te gustaría invitar a algo',
    needHearts: 2,
    warm: {
      timida: 'Okey. Sí. Creo que sí. Avísame y voy.',
      directa: 'Me parece bien. Dime cuándo y dónde.',
      calida: '¡Qué lindo! Me encantaría. Por favor, organiza algo.',
      bromista: 'Si hay comida, me tienes ganado. Si no, igual voy, pero con cara larga.',
    },
    early: {
      timida: 'Ay, no sé... déjame conocerte un poco más.',
      directa: 'Todavía no nos conocemos tanto. Vamos más despacio.',
      calida: 'Me da cosita. Hablemos un poco más primero.',
      bromista: 'Qué rápido vas. Primero un cafecito, después veremos.',
    },
  },
  {
    id: 'cerca',
    label: 'Tomar su mano',
    needHearts: 3,
    warm: {
      timida: 'No la suelta. Aprieta apenas, mirando el suelo.',
      directa: 'Entrelaza los dedos con los tuyos. No dice nada. No hace falta.',
      calida: 'Te aprieta la mano y se acerca un poco más.',
      bromista: 'Mira nuestras manos y sonríe. «Qué atrevido... me gusta.»',
    },
    early: {
      timida: 'Retira la mano despacito. «Perdón... todavía no.»',
      directa: 'Se suelta con suavidad. «Aún no estamos ahí.»',
      calida: 'Sonríe, pero se separa un paso. «Dame tiempo.»',
      bromista: '«Ey, ey, ey, primero un helado.» Y se ríe.',
    },
  },
];

/** Para quienes no son de coqueteo: bromas (suman confianza igual, una vez cada una). */
export interface Joke {
  id: string;
  label: string;
  reply: ByStyle;
}

export const JOKES: readonly Joke[] = [
  {
    id: 'chiste',
    label: 'Contar un chiste malo',
    reply: {
      timida: 'Se ríe bajito, tapándose la boca. «Es muy malo... pero me reí.»',
      directa: '«Qué malo.» Y se ríe igual.',
      calida: '¡Jajaja! Qué malo, qué malo. Cuéntame otro.',
      bromista: '«Ese es de los míos.» Y te choca la mano.',
    },
  },
  {
    id: 'apuesta',
    label: 'Proponer una apuesta tonta',
    reply: {
      timida: '«Yo no apuesto, pero... ¿qué se apuesta?» Se ríe.',
      directa: '«Acepto. Y te advierto: no pierdo.»',
      calida: '¡Hecho! El que pierda invita algo rico.',
      bromista: '«Apuesto a que pierdes. Ya te puedes ir preparando.»',
    },
  },
  {
    id: 'apodo',
    label: 'Ponerle un apodo',
    reply: {
      timida: '«¿Apodo? Nadie me ha puesto... bueno, déjalo así.»',
      directa: '«Me gusta. Úsalo con cariño.»',
      calida: '«¡Qué lindo!, me lo quedo.»',
      bromista: '«Ahora yo te pongo uno a ti. Prepárate.»',
    },
  },
];

/** Besos y abrazos. */
export interface KissLines {
  /** Mejilla (o abrazo, si es solo amistad) cuando ya hay confianza. */
  cheekOk: ByStyle;
  cheekNo: ByStyle;
  /** En los labios, cuando hay química suficiente. */
  lipsOk: ByStyle;
  lipsAgain: ByStyle;
  /** Todavía no hay química: lo rechaza con cariño. */
  lipsNo: ByStyle;
}

export const KISS: KissLines = {
  cheekOk: {
    timida: 'Se pone roja y mira el suelo. «Qué... qué lindo.»',
    directa: 'Se deja y sonríe. «Está bien, me gusta.»',
    calida: 'Cierra los ojos un segundo. «Qué dulce eres.»',
    bromista: 'Se ríe. «Con esa cara de bueno, cómo decirte que no.»',
  },
  cheekNo: {
    timida: 'Da un paso atrás, con los nervios a flor de piel. «Perdón, aún no...»',
    directa: 'Te frena con la mano. «Todavía no, ¿ya?»',
    calida: 'Sonríe, pero se aparta. «Ay, no sé. Más adelante.»',
    bromista: '«Ey, ey, ¿y esa confianza?» Se ríe, se aparta.',
  },
  lipsOk: {
    timida: 'Tiembla un poco, y se deja. Cuando abre los ojos, está sonriendo. «No te vayas a ir...»',
    directa: 'Te toma de la camisa y te besa primero. «Llevaba un rato queriendo hacer eso.»',
    calida: 'Se acerca despacio. Es un beso lento, cálido, de esos que no necesitan explicación.',
    bromista: 'Te besa riéndose. «Ahora sí lo hiciste. No hay vuelta atrás.»',
  },
  lipsAgain: {
    timida: 'Te besa de nuevo, más tranquila esta vez.',
    directa: 'Te besa otra vez, sin avisar.',
    calida: 'Otro beso más, y se queda pegado a tu lado un momento.',
    bromista: '«¿Otro? Está bien, pero me debes un helado.»',
  },
  lipsNo: {
    timida: 'Gira la cara, con las mejillas rojas. «Perdón. Es que todavía no... no sé.»',
    directa: 'Se aparta con calma. «No. Aún no hay química para eso. Y tú lo sabes.»',
    calida: 'Pone una mano en tu pecho, sonriendo. «Dame tiempo. Quiero que sea de verdad.»',
    bromista: 'Se ríe. «Mmm, no. Todavía no te ganaste el premio gordo.»',
  },
};

/** Cuando se pregunta si se puede ver/hablar más tarde (teléfono o en persona). */
export const NUMBER_LINES = {
  yes: {
    timida: 'Saca el celular con las manos medio temblorosas. «Toma, anota... no se lo des a nadie.»',
    directa: 'Te quita el celular y teclea su propio número. «Escríbeme. No me dejes en visto.»',
    calida: '«¡Claro! Ten.» Te dicta el número con una sonrisa.',
    bromista: '«Te lo doy, pero no lo uses para vender seguros.» Lo anota y se ríe.',
  } as ByStyle,
  no: {
    timida: '«Ay... no sé, es que no te conozco mucho. Perdón.»',
    directa: '«Todavía no. Gánate un poco más la confianza.»',
    calida: '«Mejor hablemos un rato más primero, ¿sí?»',
    bromista: '«¿Mi número? Primero un par de chistes buenos y lo hablamos.»',
  } as ByStyle,
};

/** Respuestas cuando se propone un plan en persona o por el celular. */
export const PLAN_LINES = {
  yes: {
    timida: '«Ok... sí. Allá nos vemos.»',
    directa: '«Perfecto. Allá estaré.»',
    calida: '«¡Qué buen plan! Nos vemos ahí.»',
    bromista: '«Voy, pero llego cuando me dé la gana. Es broma. Allá nos vemos.»',
  } as ByStyle,
  no: {
    timida: '«Hoy no puedo, perdón... otro día, ¿sí?»',
    directa: '«No tengo espacio hoy. Más adelante.»',
    calida: '«Ay, hoy me es imposible. ¡Otro día, prometido!»',
    bromista: '«Hoy tengo la agenda más llena que un bus en hora punta. Otro día.»',
  } as ByStyle,
};

/** Saludos de la gente de la calle, por estilo y confianza [recién conocidos, hay confianza, cercanos]. */
export const STREET_GREET: Record<Style, [string, string, string]> = {
  timida: ['Ah, hola... ¿me hablas a mí?', 'Hola de nuevo. Qué bueno verte.', 'Hola... ya te estaba esperando, creo.'],
  directa: ['Hola. ¿Qué necesitas?', 'Otra vez tú. Me alegra.', 'Hola. Qué bueno que viniste.'],
  calida: ['¡Hola! ¿Cómo va todo?', '¡Hola de nuevo! Qué gusto verte.', '¡Ey, tú! Ven, ven, cuéntame todo.'],
  bromista: ['¡Epa! ¿Andas perdido o buscando plan?', '¡Pero mira quién volvió! Ya te extrañaba.', '¡Mi persona favorita de este barrio!'],
};

/** Temas de charla con gente de la calle. `{lugar}` es el sitio donde se está. */
export interface StreetTopic {
  id: string;
  label: string;
  /** Solo con confianza (nivel 1 o más). */
  deep?: boolean;
  lines: Record<Style, string[]>;
}

export const STREET_TOPICS: readonly StreetTopic[] = [
  {
    id: 'lugar',
    label: 'Preguntar por el lugar',
    lines: {
      timida: ['Eh... {lugar} está bien, creo.', 'Vengo seguido porque no hay mucha gente. Qué raro sonó.'],
      directa: ['{lugar} es lo que ves: sin adornos.', 'Lo que me gusta es que nadie te molesta.'],
      calida: ['¡Me encanta {lugar}! Siempre hay algo lindo que ver.', 'Si tienes tiempo, date una vuelta con calma. Vale la pena.'],
      bromista: ['{lugar}: aquí se viene a hacer nada con mucho estilo.', 'Yo ya soy parte del paisaje. Me deberían cobrar por salir en las fotos.'],
    },
  },
  {
    id: 'dia',
    label: 'Preguntar cómo va su día',
    lines: {
      timida: ['Normal, supongo. Un día más.', 'Gracias por preguntar. No muchos lo hacen.'],
      directa: ['Con prisa, como siempre. Pero me das un minuto.', 'Ya mejoró, la verdad.'],
      calida: ['Va bastante bien. ¡Y ahora un poco mejor!', 'Siempre es bueno parar un momento a charlar.'],
      bromista: ['Ha sido un día de esos... de los que uno cuenta después.', 'Pero ya se arregló: apareciste tú y me río.'],
    },
  },
  {
    id: 'planes',
    label: 'Preguntar qué hace por acá',
    lines: {
      timida: ['Solo paso por aquí. No tengo mucho plan.', 'Aunque a veces es lindo no tener ninguno.'],
      directa: ['Ando haciendo una vuelta y me falta poco.', 'Después, nada. Libre. Por si acaso.'],
      calida: ['Doy una vuelta y veo qué sale. ¡Lo mejor es lo que no se planea!', 'Si quieres, hacemos algo juntos más tarde.'],
      bromista: ['Estoy en una misión secreta. Es broma: espero a alguien que no llega.', 'Pero me estoy divirtiendo igual contigo.'],
    },
  },
  {
    id: 'comida',
    label: '¿Cuál es su comida favorita?',
    deep: true,
    lines: {
      timida: ['Me da vergüenza: cualquier cosa con queso.', 'Es mi pequeño secreto. No lo cuentes.'],
      directa: ['Lo que sea que lleve picante y sea abundante.', 'No me gustan las porciones tímidas.'],
      calida: ['Lo que cocina mi familia, ¡sin duda! Nada como casa.', 'Algún día te invito.'],
      bromista: ['Todo lo que se pueda comer con las manos, sin cubiertos.', 'La etiqueta es para quienes no tienen hambre.'],
    },
  },
  {
    id: 'sueno',
    label: '¿Qué sueña hacer algún día?',
    deep: true,
    lines: {
      timida: ['Viajar solo, sin que nadie me mire. Suena raro.', 'Pero me hace ilusión.'],
      directa: ['Tener mi propio negocio. Sin jefes.', 'Y que me vaya bien, claro.'],
      calida: ['Una casa con patio, perros y gente de visita.', 'Con eso soy feliz.'],
      bromista: ['Ganarme la lotería y desaparecer sin avisar.', 'Mentira. A los dos días me aburriría.'],
    },
  },
];

/** Abrazo (para quienes no son de coqueteo): hace falta algo de confianza. */
export const HUG = {
  ok: {
    timida: 'Duda un segundo, pero se deja abrazar. «Gracias... lo necesitaba.»',
    directa: 'Te da dos palmadas fuertes en la espalda. «Así se hace.»',
    calida: 'Te abraza con ganas y no te suelta enseguida. «Qué bueno tenerte.»',
    bromista: 'Te abraza y finge ahogarse. «¡Suéltame, que me aplastas! ...No, no me sueltes.»',
  } as ByStyle,
  no: {
    timida: 'Se pone un poco tenso, incómodo. «Perdón, aún no soy de abrazos...»',
    directa: 'Te mira, alza una ceja. «Eh. Todavía no nos conocemos tanto.»',
    calida: 'Sonríe y te ofrece la mano. «Mejor un apretón, por ahora.»',
    bromista: '«¿Un abrazo? Primero invítame algo. Luego vemos.»',
  } as ByStyle,
};
