import { BASE_HEIGHT, FONT_HUD } from '../config/display';
import { Admin } from '../systems/Admin';
import { Controls } from '../systems/Controls';
import { Dialogue } from '../systems/DialogueManager';
import { EventSystem } from '../systems/EventSystem';
import { Phone } from '../systems/Phone';
import { BaggageClaim } from '../ui/BaggageClaim';
import { Banner } from '../ui/Banner';
import { DialogueBox } from '../ui/DialogueBox';
import { DocumentView } from '../ui/DocumentView';
import { FlightBoard } from '../ui/FlightBoard';
import { SignView } from '../ui/SignView';
import { Hud } from '../ui/Hud';
import { InventoryScreen } from '../ui/InventoryScreen';
import { LineMapOverlay } from '../ui/LineMapOverlay';
import { PauseMenu } from '../ui/PauseMenu';
import { PhoneScreen } from '../ui/PhoneScreen';
import { PhoneToast } from '../ui/PhoneToast';
import { RideDisplay } from '../ui/RideDisplay';
import { BusViewPrompt } from '../ui/BusViewPrompt';
import { SideMap } from '../ui/SideMap';
import { Vineta } from '../ui/Vineta';
import { WardrobeScreen } from '../ui/WardrobeScreen';
import { QuimicaMeter } from '../ui/QuimicaMeter';
import { makeText } from '../ui/theme';
import { BaseScene } from './BaseScene';
import { MapScene } from './MapScene';

/**
 * Escena paralela que dibuja la interfaz encima del mapa: HUD, carteles, diálogos,
 * pantalla de recorrido, menú de pausa (Esc), inventario (Tab), celular (Q), mapa de la Línea 1
 * y el mapa lateral del celular (app Mapa; Q lo guarda), que no pausa el juego. Solo un panel modal a la vez recibe la entrada.
 */
export class UIScene extends BaseScene {
  private dialogueBox!: DialogueBox;
  private hud!: Hud;
  private menu!: PauseMenu;
  private inventory!: InventoryScreen;
  private lineMap!: LineMapOverlay;
  private rideDisplay!: RideDisplay;
  private phone!: PhoneScreen;
  private sideMap!: SideMap;
  private wardrobe!: WardrobeScreen;
  private baggage!: BaggageClaim;
  private quimica!: QuimicaMeter;

  constructor() {
    super('UI');
    this.fixedCamera = true;
  }

  create(): void {
    this.hud = new Hud(this);
    this.quimica = new QuimicaMeter(this);
    this.rideDisplay = new RideDisplay(this);
    this.sideMap = new SideMap(this);
    this.dialogueBox = new DialogueBox(this);
    Dialogue.setPresenter(this.dialogueBox);
    const banner = new Banner(this);
    EventSystem.onScene(this, 'banner', ({ title, subtitle }) => banner.show(title, subtitle));
    this.menu = new PauseMenu(this);
    this.inventory = new InventoryScreen(this);
    this.lineMap = new LineMapOverlay(this);
    this.phone = new PhoneScreen(this);
    this.wardrobe = new WardrobeScreen(this);
    new PhoneToast(this);
    new DocumentView(this);
    new FlightBoard(this);
    this.baggage = new BaggageClaim(this);
    new Vineta(this);
    new SignView(this);
    new BusViewPrompt(this);
    Phone.reset();
    EventSystem.onScene(this, 'open-line-map', () => {
      const map = this.activeMap();
      if (map && !this.anyModalOpen()) this.lineMap.open(map);
    });
    EventSystem.onScene(this, 'open-baggage-claim', ({ done }) => {
      const map = this.activeMap();
      if (map && !this.anyModalOpen()) this.baggage.open(map, done);
      else done({ found: false, mistakes: 0 });
    });
    EventSystem.onScene(this, 'open-wardrobe', () => {
      const map = this.activeMap();
      if (!map) return;
      // Desde el menú de pausa: el menú se cierra y el ropero toma la pausa.
      if (this.menu.isOpen) this.menu.close();
      if (!this.anyModalOpen()) this.wardrobe.open(map);
    });
    // Recordatorio de que el modo admin está activo (misiones desbloqueadas, Ctrl + <).
    if (Admin.active) {
      makeText(this, 3, BASE_HEIGHT - 2, 'ADMIN', {
        fontFamily: FONT_HUD,
        fontSize: '8px',
        color: '#ff8a5c',
        backgroundColor: '#0d1424',
        padding: { x: 2, y: 1 },
      })
        .setOrigin(0, 1)
        .setAlpha(0.85)
        .setDepth(150);
    }
    this.setupZoom();
  }

  override update(_time: number, delta: number): void {
    const map = this.activeMap();
    this.hud.update(delta, map?.sys.isActive() ? map.playerScreen : undefined);
    this.rideDisplay.update(delta);
    this.quimica.update(delta);
    this.sideMap.update(delta, this.anyModalOpen() ? undefined : map);

    if (this.menu.isOpen) return this.menu.update();
    if (this.inventory.isOpen) return this.inventory.update(delta);
    if (this.lineMap.isOpen) return this.lineMap.update(delta);
    if (this.phone.isOpen) return this.phone.update(delta);
    if (this.wardrobe.isOpen) return this.wardrobe.update(delta);
    if (this.baggage.isOpen) return this.baggage.update(delta);

    if (map?.sys.isActive()) Phone.update();

    const wantsMenu = Controls.consume('menu');
    const wantsInventory = Controls.consume('inventory');
    const wantsPhone = Controls.consume('phone');
    // Con el mapa en la mano, Q lo guarda (no abre el celular).
    if (wantsPhone && this.sideMap.isOpen && map?.sys.isActive()) return this.sideMap.close();
    if (map?.sys.isActive() && map.canOpenMenu) {
      // Una llamada entrante tiene prioridad apenas el jugador queda libre.
      const call = Phone.takePendingCall();
      if (call) return this.phone.openCall(map, call);
      if (wantsMenu) return this.menu.open(map);
      if (wantsInventory) return this.inventory.open(map);
      if (wantsPhone) return this.phone.open(map);
    }
    this.dialogueBox.update(delta);
  }

  private anyModalOpen(): boolean {
    return this.menu.isOpen || this.inventory.isOpen || this.lineMap.isOpen || this.phone.isOpen || this.wardrobe.isOpen || this.baggage.isOpen;
  }

  /** La escena de mapa (Overworld o Interior) en curso, corriendo o en pausa por un panel. */
  private activeMap(): MapScene | undefined {
    return this.scene.manager
      .getScenes(false)
      .find((s): s is MapScene => s instanceof MapScene && (s.sys.isActive() || s.sys.isPaused()));
  }
}
