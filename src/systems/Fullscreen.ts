/** Pantalla completa del navegador: tecla P en el PC, botón "pantalla" de los controles táctiles en el celular. */

export function canFullscreen(): boolean {
  return Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen);
}

export function isFullscreen(): boolean {
  return Boolean(document.fullscreenElement);
}

/** Entra o sale. Llamar desde una pulsación del jugador: el navegador lo exige. */
export function toggleFullscreen(): void {
  if (document.fullscreenElement) {
    void document.exitFullscreen().catch(() => {});
    return;
  }
  document.documentElement
    .requestFullscreen({ navigationUI: 'hide' })
    .then(() => {
      // En Android se puede fijar la horizontal (iOS no lo permite: ahí el juego se adapta solo).
      const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      return orientation.lock?.('landscape');
    })
    .catch(() => {});
}

/** Tecla P en cualquier escena (en el PC). Va por el keydown nativo para que cuente como gesto del jugador. */
export function attachFullscreenKey(): void {
  if (!canFullscreen()) return;
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyP' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    toggleFullscreen();
  });
}
