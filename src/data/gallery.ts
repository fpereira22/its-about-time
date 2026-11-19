/**
 * Datos de la Galería (Progreso → E): el diario de cada misión y el catálogo de minijuegos que se pueden
 * repetir sueltos. Para sumar un minijuego nuevo, agrégalo a MINIGAMES con la escena y los datos con que lo abre
 * MapScene.launchMinigame; para escribir el diario de una misión nueva, agrega su entrada a DIARY.
 */

/** Cómo se abre un minijuego: la escena y lo que recibe además de `done`. */
export interface MinigameEntry {
  /** Escena de Phaser (AtraccionScene → 'Atraccion', ParqueScene → 'Parque', CafeScene → 'Cafe'). */
  scene: string;
  data: Record<string, unknown>;
  label: string;
  /** Misión en que se conoce (para agrupar y mostrar). */
  mission: string;
}

const ent = (mission: string, scene: string, label: string, data: Record<string, unknown> = {}): MinigameEntry => ({ mission, scene, label, data });

export const MINIGAMES: readonly MinigameEntry[] = [
  ent('mission04', 'Futbol', 'El partido de la U'),
  ent('mission05', 'Piscina', 'Marco Polo en la piscina'),
  ent('mission05', 'Cinco', 'El Cinco'),
  ent('mission06', 'Natacion', 'Clase de natación'),
  ent('mission06', 'Persecucion', 'La persecución en el Bulevar'),
  ent('mission07', 'Cocina', 'Boloñesa, parte 1', { part: 1 }),
  ent('mission07', 'Cocina', 'Boloñesa, parte 2', { part: 2 }),
  ent('mission07', 'Salsa', 'La salsa'),
  ent('mission08', 'Pool', 'El pool'),
  ent('mission08', 'Pinpon', 'Torneo de pimpón'),
  ent('mission08', 'Atraccion', 'Krater (montaña rusa)', { mode: 'krater' }),
  ent('mission08', 'Atraccion', 'Yippe', { mode: 'yippe' }),
  ent('mission08', 'Atraccion', 'El Barco del Café', { mode: 'barco' }),
  ent('mission08', 'Atraccion', 'Carros chocones', { mode: 'chocones' }),
  ent('mission08', 'Atraccion', 'Tejo', { mode: 'tejo' }),
  ent('mission08', 'Parque', 'Rápidos', { mode: 'rapidos' }),
  ent('mission08', 'Parque', 'Fábulas', { mode: 'fabulas' }),
  ent('mission08', 'Parque', 'El tren', { mode: 'tren' }),
  ent('mission08', 'Parque', 'El show', { mode: 'show' }),
  ent('mission08', 'Parque', 'El ciclón', { mode: 'ciclon' }),
  ent('mission08', 'Parque', 'El teleférico', { mode: 'teleferico' }),
  ent('mission08', 'Parque', 'La rueda', { mode: 'rueda' }),
  ent('mission08', 'Parque', 'La torre', { mode: 'torre' }),
  ent('mission08', 'Cafe', 'El cafetal', { mode: 'cafe' }),
  ent('mission09', 'Fiesta', 'Curvas', { mode: 'curvas' }),
  ent('mission09', 'Fiesta', 'Beer pong', { mode: 'beerpong' }),
  ent('mission09', 'Fiesta', 'El cacho', { mode: 'cacho' }),
  ent('mission09', 'Fiesta', 'La gallina', { mode: 'gallina' }),
  ent('mission10', 'Rio', 'Parquear en el río', { mode: 'parquear' }),
  ent('mission10', 'Rio', 'El chorro', { mode: 'chorro' }),
  ent('mission10', 'Rio', 'La corriente', { mode: 'corriente' }),
  ent('mission10', 'Rio', 'El puente', { mode: 'puente' }),
  ent('mission10', 'Pinpon', 'Pimpón con Laura', { rival: 'laura' }),
  ent('mission10', 'Paseo', 'Los patitos', { mode: 'patitos' }),
  ent('mission10', 'Paseo', 'La trocha', { mode: 'trocha' }),
  ent('mission10', 'Paseo', 'El salto al pozo', { mode: 'salto' }),
  ent('mission10', 'Paseo', 'La cascada', { mode: 'cascada' }),
  ent('mission10', 'Paseo', 'La mano en la cascada', { mode: 'mano' }),
  ent('mission10', 'Paseo', 'Las truchas', { mode: 'trucha' }),
  ent('mission10', 'Paseo', 'La subida', { mode: 'subida' }),
  ent('mission10', 'Paseo', 'La bajada', { mode: 'bajada' }),
  ent('mission10', 'Paseo', 'Las hamburguesas', { mode: 'burger' }),
];

/**
 * Id de un minijuego para recordar que ya se jugó: la escena más lo que lo distingue (modo, parte o rival).
 * MapScene lo calcula con lo mismo con que lo abre, así que coincide con el de MINIGAMES.
 */
export function minigameId(scene: string, data: Record<string, unknown>): string {
  const variant = data.mode ?? data.part ?? data.rival ?? data.partner ?? '';
  return `${scene}${variant === '' ? '' : `:${String(variant)}`}`;
}

/**
 * El diario: qué pasó en cada misión, para quien vuelve después de un tiempo. Solo se ve cuando la misión
 * está completada. Es el resumen de lo que se vio en pantalla, sin los finales alternativos.
 */
export const DIARY: Readonly<Record<string, string>> = {
  mission01: 'Un mensaje de tu mamá te sacó de Plaza Baquedano: te esperaba en el Costanera Center. Fuiste por Providencia, a tu manera.',
  mission02: 'Domingo en Paine. Después de comer con tu mamá te tocó lavar la loza: mañana a las 8:30 era la prueba de Optimización y el tren salía a las 7:30.',
  mission03: 'La cena de despedida en Las Sandías, en Paine, con toda tu familia. Esa misma noche salía tu vuelo a Cali, a la 01:50.',
  mission04: 'Tu primer día en la universidad de Cali: la alarma, el campus y un partido de fútbol.',
  mission05: 'Un martes cualquiera que no lo fue: desayuno con doña Mery, la barbería, Grover y el Marco Polo en la piscina, y el Cinco en Pance.',
  mission06: 'Letras sobre el río: la clase de natación con Sira, la feria del libro en el Bulevar, una persecución y la colina de noche.',
  mission07: 'Una lluvia que no paró en el piso 8 del Bobo Unic Living: la boloñesa, la salsa y la Farmadía, con la lluvia de fondo.',
  mission08: 'Salento, tres semanas antes: el paseo de los de intercambio, el bus con Richi, la casita, el Parque del Café y esa noche en la plaza.',
  mission09: 'La fiesta en la casa de Tami, arriba de todo: Cali prendida desde el cerro, y un «tus recuerdos de hace dos semanas».',
  mission10: 'Un sábado de luna llena en el 11: Laura tocó la puerta con pandebonos, y de ahí en adelante, el río, la selva y La Vorágine.',
};
