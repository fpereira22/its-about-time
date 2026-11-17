import { playSfx, type SfxName } from '../audio/sfx';
import type { VinetaKit } from '../ui/Vineta';

/**
 * El sonido de las emociones en las viñetas: besos, nervios, sustos, llanto... Una viñeta es muda salvo que
 * (1) tenga su tabla aquí, o (2) se arme con un `Spec` (misiones 8-11): entonces el sonido sale de su propio
 * dibujo (corazones, lágrimas, ojos cerrados), ver `cuesFromSpec`.
 *
 * Una viñeta que ya suena por dentro (el chat, la comida, el partido) no necesita nada aquí.
 * Una viñeta nueva con una emoción clara: súmale su id a la lista del ánimo que le toca.
 */

/** [ms desde que se abre la viñeta, efecto]. */
export type Cue = readonly [ms: number, sfx: SfxName];
export type Cues = readonly Cue[];

/** Cada ánimo es una secuencia corta; las viñetas se agrupan por ánimo. */
export const MOODS = {
  /** Mirarse, la sonrisa de «ya, me gustas»: arpa que sube. */
  amor: [[350, 'amor']],
  /** El beso: el chasquido suave y, encima, el arpa. */
  beso: [[250, 'beso'], [950, 'amor']],
  /** Rozarse las manos, un guiño, una pregunta con segundas. */
  chispa: [[300, 'chispa']],
  /** Las caras cada vez más cerca y el corazón a mil. */
  casi: [[200, 'latido'], [1150, 'latido'], [1900, 'chispa']],
  /** Un nudo en el estómago: nerviosismo, vergüenza, una decisión. */
  nervios: [[250, 'latido']],
  /** Un abrazo, dormirse juntos, un recuerdo lindo: cajita de música. */
  ternura: [[400, 'ternura']],
  /** Ternura, y un suspiro de lo bien que se está. */
  dulce: [[300, 'suspiro'], [1000, 'ternura']],
  /** El abrazo de la despedida: llegan caminando (0,75 s) y recién ahí suena. */
  abrazo: [[800, 'ternura']],
  /** Abrazo con lágrimas. */
  abrazo_llanto: [[800, 'ternura'], [1900, 'llanto']],
  llanto: [[400, 'llanto'], [2800, 'llanto']],
  /** Lágrimas de risa (el final de la peli). */
  llanto_risa: [[400, 'llanto'], [1700, 'risa']],
  /** Despedidas, derrotas, un «ojalá». */
  triste: [[400, 'triste']],
  /** ¡BU! */
  susto: [[250, 'susto']],
  /** Un susto de broma: pega el salto y de ahí se ríen. */
  susto_risa: [[250, 'susto'], [1400, 'risa']],
  /** Algo no está bien; el zumbido grave que crece. */
  suspenso: [[100, 'suspenso']],
  /** Suspenso que revienta en un susto. */
  terror: [[100, 'suspenso'], [2000, 'susto']],
  /** Frío en la espalda: algo que no se ve, un cuento de miedo. */
  escalofrio: [[250, 'escalofrio']],
  /** Un dato que nadie esperaba. */
  sorpresa: [[250, 'sorpresa']],
  risa: [[300, 'risa']],
  /** Alivio, sueño, amanecer. */
  suspiro: [[350, 'suspiro']],
  /** El mensaje que no debía llegar: se oye y se corta la respiración. */
  mensaje_tenso: [[150, 'notify'], [900, 'latido'], [1500, 'suspenso']],
} as const satisfies Record<string, Cues>;

type Mood = keyof typeof MOODS;

/** Sonidos a medida (los que no calzan con un ánimo). */
const CUSTOM: Record<string, Cues> = {
  // La viñeta de la confesión late tres veces ("tum", cada 0,48 s, en hileras).
  m7_confesion: [[300, 'latido'], [1260, 'latido'], [2220, 'latido']],
  // La Cali de noche que se vuelve a prender, barrio por barrio.
  m6_mirador: [[500, 'amor'], [2200, 'suspiro']],
  // Los dos de perfil, cada vez más cerca (el beso que no fue).
  m6_casi: [[200, 'latido'], [1150, 'latido'], [2100, 'latido'], [3000, 'chispa']],
  // Grover los interrumpe: el casi se corta con un golpe y se ríen.
  m6_grover_casi: [[200, 'sorpresa'], [1100, 'risa']],
  // Pasos en la noche y, de pronto, la sombra con cachos del Buziraco.
  m6_buziraco: [[100, 'suspenso'], [2400, 'escalofrio']],
  // El T31 arranca y todos se van para atrás.
  m6_tiron: [[150, 'sorpresa']],
  // La pesadilla: 10:47 en rojo y el celular lleno de mensajes de la U.
  pesadilla: [[100, 'suspenso'], [1700, 'susto']],
  // El sueño del viernes: el pez que te recuerda respirar.
  m6_sueno: [[300, 'burbujas'], [1200, 'suspiro']],
  // Sira te mira a los ojos y, de pronto, el beso en el bus.
  m7_beso_bus: [[250, 'beso'], [950, 'amor']],
  // Los dos pegados a la ventana del bus y los corazones que suben.
  m7_bus_corazones: [[300, 'amor']],
  // El baile en la sala, con un compás de más.
  m7_salsa_fin: [[300, 'chispa'], [1200, 'amor']],
  // La carta de la mamá, con su letra redonda.
  m7_carta: [[400, 'ternura'], [1500, 'suspiro']],
  // El choque en el pasillo, nariz con nariz.
  m7_choque: [[100, 'sorpresa'], [600, 'chispa']],
  // La puerta: tocan y el corazón se agita.
  m7_toc_toc: [[100, 'latido']],
  // Pasos y un «toc, toc» en la 1104 / el 805.
  m11_toc: [[100, 'latido']],
  m11_toc_final: [[100, 'latido'], [900, 'suspenso']],
  // El mensaje de Sira en el celular, el último giro de la historia.
  m11_cel_sira_final: [[200, 'notify'], [1000, 'latido'], [1700, 'suspenso']],
  m11_vibra: [[150, 'latido'], [1000, 'suspenso']],
  m11_negro_final: [[200, 'suspenso'], [2300, 'latido']],
  m11_flash_sira: [[100, 'escalofrio'], [800, 'latido']],
  // La luna en el 1104: cada cuadro, más cerca.
  m11_cuarto_luna: [[400, 'suspiro']],
  m11_cuarto_luna_2: [[300, 'chispa']],
  m11_cuarto_luna_3: [[200, 'latido'], [1000, 'chispa']],
  m11_cuarto_luna_4: [[200, 'latido'], [1150, 'latido']],
  m11_cuarto_abrazo: [[300, 'ternura'], [1300, 'amor']],
  m11_cuarto_susurro: [[300, 'suspiro'], [1400, 'chispa']],
  m11_luna_fundido: [[300, 'suspiro'], [1400, 'ternura']],
  // El insomnio y los pensamientos a las tres de la mañana.
  m11_insomnio: [[300, 'suspiro'], [1700, 'latido']],
  // El mirador del 14: las manos y el valle.
  m11_mano_balcon: [[400, 'chispa'], [1400, 'ternura']],
};

/** Ánimo → ids de viñeta. */
const BY_MOOD: Partial<Record<Mood, string>> = {
  // --- Prólogo: los abrazos de la despedida ---
  abrazo: 'abrazo_papa abrazo_hermano',
  abrazo_llanto: 'abrazo_mama abrazo_familia',
  ternura: `dibujo llamada_mama recuerdo_vecina recuerdo_marraqueta
    m5_buenas_noches m6_buenas_noches m6_cuento m6_regalo m6_abrazo m6_poema m6_atardecer m6_porche
    m7_abrazo
    m9_auto_dormidos m9_taxi_amanecer m9_laura_acuarela
    m10_abrazo_danilo m10_piedra_sentados
    m11_abrazo_vuelta m11_abrazo_sira m11_cabeza_hombro m11_beso_cabeza m11_amor_camiseta
    m11_dibujo_ane m11_postit m11_estrellita m11_familia_laura m11_gabarra_ria
    m11_p_laura_cuida m11_p_promesa m11_p_laura_volver`,
  dulce: `m7_dormidos m7_cama m9_amanecer m11_dormida_pecho m11_dormida_hombro m11_sofa_peli`,
  triste: `cali_derrota futbol_autogol m8_laura_agur m8_despedida_plaza m8_whatif_nada m9_laura_agur
    m10_danilo_nostalgia m11_laura_se_va m11_agur m11_agur_calima m11_perdon_no m11_mustia m11_sufrir
    m11_bajada_fin m11_futbol_pierde m11_pinpon_pierde`,
  llanto: 'm8_renzo_llora',
  llanto_risa: 'm7_llorando m11_peli_llora m11_laura_llora_risa',
  risa: `m11_peli_risa m11_laura_risa m11_amparo_rie m11_risa_palta m9_laura_risa`,
  suspiro: `m7_dormir m8_bus_vuelta m9_roxane_sueno m10_dormido m10_cel_boca_abajo m11_alivio m11_no_dormir m11_no_duerme`,
  // --- El primer encuentro, las miradas, el cosquilleo ---
  amor: `m5_sira m6_piscina_noche m8_rueda_atardecer m8_laura_destino m9_laura_pergola m9_pergola_baile
    m9_mirador_puntos m7_paraguas_noche m11_cena_vela m11_vela m11_media_vela m11_bonita_pareja
    m11_tortolitos m11_te_quiero m11_mirador_noche m11_mirador_valle m11_p_laura_cita m11_luna_grande m11_balcon_luna`,
  chispa: `m8_laura m8_tami_puerta m8_whatif_escalera m8_laura_sirimiri m9_laura_susurro m9_laura_guino m9_roxane_cerca
    m9_cel_entrega m9_cel_devuelve m6_sira_ermita m7_bajo_paraguas m11_mano_baile m11_mano_valle m11_siguen_mano
    m11_dame_mano m11_p_ensena_mano m11_cara_a_cara m10_laura_like`,
  casi: `m8_rueda_casi m9_ascensor_abre m9_ascensor_laura m10_historia_laura m11_casi`,
  nervios: `m5_sira_sorpresa m10_borrador m10_puntitos m10_respuesta_enviada m11_laura_nerviosa
    m11_sofa_tortura m11_confiesa m11_decision_balcon m11_dos_caras m11_dos_partes m11_decide_laura
    m11_decide_sira m11_decide_ambas m6_varado`,
  // --- Besos ---
  beso: `m7_beso m7_final m9_beso m8_whatif_beso m8_tami_mejilla m11_beso_mejilla m11_beso_laura m11_beso_laura_2
    m11_beso_sira_esquina m11_sira_beso_pasillo`,
  // --- Miedo ---
  susto: 'm6_raponazo',
  susto_risa: 'm6_susto',
  suspenso: `m6_san_antonio m6_apagon m10_puente_lejos m10_puente_tablas m11_mirilla`,
  escalofrio: `m11_escalofrio m11_fantasma m11_pozo m11_laura_miedo`,
  sorpresa: `m10_mono m11_wow m11_madre_mia m11_euskera_grito m11_ya_escuchaste m11_delatado m10_danilo_sabe`,
};

/** Id → cues. Se llena una vez, al cargar el módulo. */
export const VINETA_CUES: Record<string, Cues> = (() => {
  const table: Record<string, Cues> = {};
  for (const [mood, ids] of Object.entries(BY_MOOD) as Array<[Mood, string]>) {
    for (const id of ids.split(/\s+/).filter(Boolean)) table[id] = MOODS[mood];
  }
  return { ...table, ...CUSTOM };
})();

/** Lo mínimo que se mira de un `Spec` (src/art/vinetas_m8.ts): quiénes salen (y con qué cara) y los efectos. */
export interface SpecLike {
  c?: string[];
  fx?: string | string[];
}

/**
 * El sonido de una viñeta de `Spec`, sacado de lo que muestra. Solo suena la emoción más fuerte:
 * dos con los ojos cerrados y corazones = beso; lágrimas = llanto; corazones = amor; un corazoncito = chispa;
 * gotas de sudor = nervios; zzz = sueño.
 */
export function cuesFromSpec(spec: SpecLike): Cues | undefined {
  const fx = spec.fx ? (Array.isArray(spec.fx) ? spec.fx : [spec.fx]) : [];
  const moods = (spec.c ?? []).map((s) => s.split(' ')[1] ?? '');
  const closed = moods.filter((m) => m === 'closed').length;
  if (fx.includes('hearts') && closed >= 2) return MOODS.beso;
  if (moods.includes('cry')) return MOODS.llanto;
  if (fx.includes('hearts')) return MOODS.amor;
  if (fx.includes('heart1')) return MOODS.chispa;
  if (fx.includes('zzz') || fx.includes('snore')) return MOODS.suspiro;
  if (fx.includes('sweat')) return MOODS.nervios;
  return undefined;
}

/** Programa los sonidos de una viñeta (se cancelan solos si se cierra antes). */
export function playCues(kit: VinetaKit, cues: Cues | undefined): void {
  for (const [ms, sfx] of cues ?? []) kit.after(ms, () => playSfx(sfx));
}
