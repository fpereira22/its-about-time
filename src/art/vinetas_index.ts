/**
 * Viñetas de cada lugar, juntas en un chunk aparte del bundle principal (ver loadVinetas en
 * src/ui/Vineta.ts). Una viñeta nueva: su archivo exporta un `Record<string, VinetaBuilder>` y se suma aquí.
 */
import { AUTO_VINETAS } from './vinetas_auto';
import { CALI_VINETAS } from './vinetas_cali';
import { CALI_VINETAS_2 } from './vinetas_cali_2';
import { FUTBOL_VINETAS } from './vinetas_futbol';
import { M5_VINETAS } from './vinetas_m5';
import { M5_VINETAS_2 } from './vinetas_m5_2';
import { M6_VINETAS } from './vinetas_m6';
import { M6_VINETAS_2 } from './vinetas_m6_2';
import { M6_CHAT_VINETAS } from './vinetas_m6_chat';
import { M6_VINETAS_3 } from './vinetas_m6_3';
import { M7_VINETAS } from './vinetas_m7';
import { M7_VINETAS_2 } from './vinetas_m7_2';
import { M7_VINETAS_3 } from './vinetas_m7_3';
import { M7_VINETAS_4 } from './vinetas_m7_4';
import { M8_VINETAS } from './vinetas_m8';
import { M9_VINETAS } from './vinetas_m9';
import { M10_VINETAS } from './vinetas_m10';
import { CALLE_VINETAS } from './vinetas_calle';
import { CASA_VINETAS } from './vinetas_casa';
import { COMIDA_VINETAS } from './vinetas_comida';
import { PIEZA_VINETAS } from './vinetas_pieza';
import { VUELO_VINETAS } from './vinetas_vuelo';
import type { VinetaBuilder } from '../ui/Vineta';

export const PLACE_VINETAS: Record<string, VinetaBuilder> = {
  ...CASA_VINETAS,
  ...PIEZA_VINETAS,
  ...AUTO_VINETAS,
  ...VUELO_VINETAS,
  ...CALLE_VINETAS,
  ...COMIDA_VINETAS,
  ...CALI_VINETAS,
  ...CALI_VINETAS_2,
  ...FUTBOL_VINETAS,
  ...M5_VINETAS,
  ...M5_VINETAS_2,
  ...M6_VINETAS,
  ...M6_VINETAS_2,
  ...M6_VINETAS_3,
  ...M6_CHAT_VINETAS,
  ...M7_VINETAS,
  ...M7_VINETAS_2,
  ...M7_VINETAS_3,
  ...M7_VINETAS_4,
  ...M8_VINETAS,
  ...M9_VINETAS,
  ...M10_VINETAS,
};
