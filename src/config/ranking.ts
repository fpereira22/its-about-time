/**
 * Ranking y votos (ver docs/ranking.md).
 *
 * - Lectura: la planilla de Google publicada en la web, hoja por hoja como CSV (sin servidor propio).
 * - Escritura: la aplicación web de Apps Script (apps-script/Ranking.gs). Mientras RANKING_SCRIPT_URL
 *   esté vacía el ranking se ve, pero no se puede votar ni publicar el puntaje.
 */

/** "Publicar en la web" de la planilla (la parte .../pub, sin parámetros). */
export const RANKING_SHEET_PUB =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ10tY99qOiqltW9bBVWcRGbYTkjCH_k6f_Gu-EyqKgQlYiTnMn2gFr-UwxltpGG2Cx3Cq6LGMmT5bp/pub';

/** gid de cada hoja (sale en la URL de la hoja publicada). */
export const RANKING_GIDS = { players: '0', comments: '1898336750' } as const;

/** URL de la implementación de Apps Script (termina en /exec). */
export const RANKING_SCRIPT_URL: string =
  'https://script.google.com/macros/s/AKfycbw5Gu_rdExUbfA920XXe9i6P_7EGLCERsKk00YuCusuEESS5N2MWGAgtKnn5MqAmP_w/exec';

export function rankingCsvUrl(sheet: keyof typeof RANKING_GIDS): string {
  return `${RANKING_SHEET_PUB}?gid=${RANKING_GIDS[sheet]}&single=true&output=csv`;
}
