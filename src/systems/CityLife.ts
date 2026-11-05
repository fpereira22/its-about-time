import Phaser from 'phaser';
import { charKey, vehicleKey } from '../art/SpriteRegistry';
import { frameIndex } from '../art/characters';
import { TILE } from '../config/display';
import { DIR_VECTORS, type Direction } from '../types/map';
import { Dialogue } from './DialogueManager';
import { GameMap } from './GameMap';

interface LaneConfig {
  rowY: number;
  pixelY: number;
  direction: 1 | -1;
  minSpeed: number;
  maxSpeed: number;
  /** Pista ancha por donde pueden pasar micros. */
  bus?: boolean;
}

/** Cebras donde los peatones cruzan la avenida (columnas y veredas de ambos lados). */
interface CrossingConfig {
  cols: number[];
  topRow: number;
  bottomRow: number;
}

/** Tiles de calzada que cuentan para detectar carriles horizontales. */
const ROAD_TILES = new Set(['calle', 'calle_linea_h', 'cebra_h', 'cebra_v']);

interface ActiveVehicle {
  sprite: Phaser.GameObjects.Image;
  laneIndex: number;
  direction: 1 | -1;
  currentSpeed: number;
  desiredSpeed: number;
  width: number;
  waitingTimer: number;
}

const VEHICLE_POOL = [
  { type: 'taxi', weight: 30 },
  { type: 'sedan_blanco', weight: 15 },
  { type: 'sedan_rojo', weight: 12 },
  { type: 'sedan_azul', weight: 12 },
  { type: 'sedan_gris', weight: 12 },
  { type: 'hatchback_verde', weight: 10 },
  { type: 'hatchback_naranjo', weight: 10 },
  { type: 'furgon', weight: 10 },
  { type: 'micro', weight: 5 },
];

const PEDESTRIAN_SPRITES = [
  'transeunte_joven',
  'transeunte_runner',
  'transeunte_ejecutiva',
  'transeunte_abuelita',
  'transeunte_skater',
  'oficinista',
  'estudiante',
  'turista',
  'senora',
  'vendedor',
  'pasajera',
];

/** Cali (mapas con `region: "cali"`): taxis amarillos, el bus alimentador y otras frases. */
const CALI_VEHICLE_POOL = [
  { type: 'taxi_cali', weight: 34 },
  { type: 'sedan_blanco', weight: 14 },
  { type: 'sedan_rojo', weight: 10 },
  { type: 'sedan_azul', weight: 10 },
  { type: 'sedan_gris', weight: 12 },
  { type: 'hatchback_verde', weight: 8 },
  { type: 'hatchback_naranjo', weight: 8 },
  { type: 'furgon', weight: 6 },
  { type: 'bus_cali', weight: 5 },
];

const CALI_QUOTES = [
  '¡Uy, qué calor tan hijuemadre! Y eso que son las doce.',
  '¿Sí o qué, mijo? Buenas, buenas.',
  'Ve, ¿vos no sabés dónde venden el mango biche con sal y limón?',
  'Voy de afán, que me deja el MIO... digo, el bus.',
  'Esta tarde llueve. Mire cómo están los Farallones de nublados.',
  '¡Qué más, parce! ¿Todo bien o qué?',
  'Por aquí todo es cerquita... caminando media hora, pues.',
  'Ojo al cruzar la 25, que esos carros no frenan ni por la Virgen.',
  'Hoy hay salsa en el parque, ¿sí sabía? Caiga.',
  'Uy, ¿usted es extranjero? Se le nota en el caminado.',
];

const SANTIAGO_QUOTES = [
  '¡Hola! Qué lindo día para caminar por Providencia.',
  'Voy apurado a una reunión en Los Leones, disculpa...',
  '¿La micro 411? Sí, esa te deja en la puerta del Costanera.',
  'Ojo al cruzar la calle, que los autos a veces andan muy rápido.',
  'Un cafecito con tostadas me vendría tan bien a esta hora.',
  '¡Qué calor está haciendo en Santiago hoy!',
  'Dicen que el Costanera está lleno como siempre.',
  'Si tomas la micro, acuérdate de tocar el timbre antes de tu parada.',
  'Me encanta este barrio, siempre hay movimiento.',
  '¡Permiso, que llego tarde a la pega!',
  '¡Qué lindo el quiltro que te sigue!',
  'Cuidado con la Bip!, a veces las máquinas de carga fallan.',
];

const CROSSING_COLS = [30, 31, 32, 64, 65, 66, 98, 99, 100, 132, 133, 134, 166, 167, 168, 196, 197, 198];

interface ActivePedestrian {
  sprite: Phaser.GameObjects.Sprite;
  tileX: number;
  tileY: number;
  pixelX: number;
  pixelY: number;
  dir: Direction;
  speed: number;
  step: 0 | 1 | 2;
  stepTimer: number;
  quote: string;
  isCrossing: boolean;
  pausedTimer: number;
}

export class CityLife {
  private readonly lanes: LaneConfig[] = [];
  private readonly sidewalkRows: number[] = [];
  private crossing: CrossingConfig | null = null;
  private readonly vehicles: ActiveVehicle[] = [];
  private readonly pedestrians: ActivePedestrian[] = [];
  private vehicleSpawnTimer = 0;
  private pedestrianSpawnTimer = 0;
  private maxVehicles = 9;
  private maxPedestrians = 7;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly map: GameMap,
    private readonly getPlayerPos: () => { tileX: number; tileY: number; pixelX: number; pixelY: number },
  ) {
    this.setupLanes();
  }

  private setupLanes(): void {
    if (this.map.id === 'providencia') {
      // Av. Andrés Bello: filas 4 y 5 hacia el poniente (izquierda), fila 6 hacia el oriente (derecha)
      this.lanes.push({ rowY: 4, pixelY: (4 + 1) * TILE, direction: -1, minSpeed: 60, maxSpeed: 82 });
      this.lanes.push({ rowY: 5, pixelY: (5 + 1) * TILE, direction: -1, minSpeed: 65, maxSpeed: 86 });
      this.lanes.push({ rowY: 6, pixelY: (6 + 1) * TILE, direction: 1, minSpeed: 60, maxSpeed: 82, bus: true });
      // Av. Providencia: filas 15, 16 y 17 hacia el oriente (derecha)
      this.lanes.push({ rowY: 15, pixelY: (15 + 1) * TILE, direction: 1, minSpeed: 65, maxSpeed: 86 });
      this.lanes.push({ rowY: 16, pixelY: (16 + 1) * TILE, direction: 1, minSpeed: 55, maxSpeed: 75 });
      this.lanes.push({ rowY: 17, pixelY: (17 + 1) * TILE, direction: 1, minSpeed: 48, maxSpeed: 65, bus: true });
      this.sidewalkRows.push(3, 7, 14, 18, 19);
      this.crossing = { cols: CROSSING_COLS, topRow: 14, bottomRow: 18 };
      return;
    }

    // Detección automática: una fila es carril solo si casi todo su ancho es calzada. Así una calle
    // vertical (que pasa por muchas filas) no genera carriles que atraviesen los edificios.
    const roadRows: number[] = [];
    for (let y = 0; y < this.map.height; y++) {
      let road = 0;
      for (let x = 0; x < this.map.width; x++) {
        if (ROAD_TILES.has(this.map.tileKeyAt(x, y) ?? '')) road++;
      }
      if (road >= this.map.width * 0.8) roadRows.push(y);
    }

    // Filas seguidas forman una avenida: la mitad norte va al poniente y la sur al oriente.
    const avenues: number[][] = [];
    for (const y of roadRows) {
      const last = avenues[avenues.length - 1];
      if (last && last[last.length - 1] === y - 1) last.push(y);
      else avenues.push([y]);
    }
    for (const rows of avenues) {
      rows.forEach((y, i) => {
        const direction: 1 | -1 = i < rows.length / 2 ? -1 : 1;
        const bus = i === 0 || i === rows.length - 1;
        this.lanes.push({ rowY: y, pixelY: (y + 1) * TILE, direction, minSpeed: 50, maxSpeed: 75, bus });
      });
      // Veredas: la fila justo al norte y al sur de la avenida, si casi toda es caminable.
      for (const y of [rows[0] - 1, rows[rows.length - 1] + 1]) {
        if (y < 0 || y >= this.map.height || roadRows.includes(y)) continue;
        let walkable = 0;
        for (let x = 0; x < this.map.width; x++) if (!this.map.isSolid(x, y)) walkable++;
        if (walkable >= this.map.width * 0.6) this.sidewalkRows.push(y);
      }
    }
  }

  update(delta: number): void {
    this.updateTraffic(delta);
    this.updatePedestrians(delta);
  }

  // -------------------------------------------------------------------------
  // Tráfico vehicular
  // -------------------------------------------------------------------------

  private updateTraffic(delta: number): void {
    const cam = this.scene.cameras.main;
    const camLeft = cam.scrollX;
    const camRight = cam.scrollX + cam.width;
    const dt = delta / 1000;
    const player = this.getPlayerPos();

    // Actualizar y ordenar autos
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      const lane = this.lanes[v.laneIndex];
      let targetSpeed = v.desiredSpeed;

      // 1. Distancia de seguridad con el auto de adelante en el mismo carril
      let minAheadDist = 9999;
      let aheadVehicle: ActiveVehicle | null = null;
      for (const other of this.vehicles) {
        if (other === v || other.laneIndex !== v.laneIndex) continue;
        const dist = v.direction === 1 ? other.sprite.x - v.sprite.x : v.sprite.x - other.sprite.x;
        if (dist > 0 && dist < minAheadDist) {
          minAheadDist = dist;
          aheadVehicle = other;
        }
      }

      if (aheadVehicle) {
        if (minAheadDist < 30) {
          targetSpeed = 0;
        } else if (minAheadDist < 52) {
          targetSpeed = Math.min(v.desiredSpeed, aheadVehicle.currentSpeed * 0.8);
        }
      }

      // 2. Respetar al jugador si está cruzando la calle en este carril
      if (player.tileY === lane.rowY) {
        const playerDist = v.direction === 1 ? player.pixelX - v.sprite.x : v.sprite.x - player.pixelX;
        if (playerDist > 0 && playerDist < 46) {
          targetSpeed = 0;
          v.waitingTimer += delta;
        } else {
          v.waitingTimer = 0;
        }
      } else {
        v.waitingTimer = 0;
      }

      // Suavizar aceleración y frenado
      v.currentSpeed = Phaser.Math.Linear(v.currentSpeed, targetSpeed, targetSpeed === 0 ? 0.15 : 0.05);
      v.sprite.x += v.direction * v.currentSpeed * dt;

      // Despawn fuera de cámara
      const isOffscreen =
        (v.direction === 1 && v.sprite.x > camRight + 120) ||
        (v.direction === -1 && v.sprite.x < camLeft - 120) ||
        v.sprite.x < -80 ||
        v.sprite.x > this.map.width * TILE + 80;

      if (isOffscreen) {
        v.sprite.destroy();
        this.vehicles.splice(i, 1);
      }
    }

    // Spawn periódico al azar pero ordenado
    this.vehicleSpawnTimer += delta;
    if (this.vehicleSpawnTimer > 1200 && this.vehicles.length < this.maxVehicles) {
      this.vehicleSpawnTimer = 0;
      this.trySpawnVehicle(camLeft, camRight);
    }
  }

  private trySpawnVehicle(camLeft: number, camRight: number): void {
    if (this.lanes.length === 0) return;
    const laneIndex = Phaser.Math.Between(0, this.lanes.length - 1);
    const lane = this.lanes[laneIndex];

    const spawnX = lane.direction === 1 ? Math.max(0, camLeft - 50) : Math.min(this.map.width * TILE, camRight + 50);

    // Evitar spawn encima de otro vehículo en el mismo carril
    const tooClose = this.vehicles.some((v) => v.laneIndex === laneIndex && Math.abs(v.sprite.x - spawnX) < 65);
    if (tooClose) return;

    // Elegir tipo según pesos
    const pool = this.map.data.region === 'cali' ? CALI_VEHICLE_POOL : VEHICLE_POOL;
    const taxi = this.map.data.region === 'cali' ? 'taxi_cali' : 'taxi';
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
    let rand = Phaser.Math.Between(1, totalWeight);
    let chosenType = taxi;
    for (const item of pool) {
      rand -= item.weight;
      if (rand <= 0) {
        chosenType = item.type;
        break;
      }
    }

    // Micros solo en pistas anchas (como Providencia pista Solo Bus o Andrés Bello)
    if ((chosenType === 'micro' || chosenType === 'bus_cali') && !lane.bus) {
      chosenType = taxi;
    }

    const key = vehicleKey(chosenType);
    if (!this.scene.textures.exists(key)) return;

    const img = this.scene.add.image(spawnX, lane.pixelY, key).setOrigin(0.5, 1);
    img.setDepth(lane.pixelY + 1);
    if (lane.direction === -1) img.setFlipX(true);

    const speed = Phaser.Math.Between(lane.minSpeed, lane.maxSpeed);
    this.vehicles.push({
      sprite: img,
      laneIndex,
      direction: lane.direction,
      currentSpeed: speed,
      desiredSpeed: speed,
      width: img.width,
      waitingTimer: 0,
    });
  }

  // -------------------------------------------------------------------------
  // Peatones (Transeúntes)
  // -------------------------------------------------------------------------

  private updatePedestrians(delta: number): void {
    const cam = this.scene.cameras.main;
    const camLeft = cam.scrollX;
    const camRight = cam.scrollX + cam.width;
    const dt = delta / 1000;

    for (let i = this.pedestrians.length - 1; i >= 0; i--) {
      const p = this.pedestrians[i];

      if (p.pausedTimer > 0) {
        p.pausedTimer -= delta;
        continue;
      }

      // Animación de caminata
      p.stepTimer += delta;
      if (p.stepTimer > 180) {
        p.stepTimer = 0;
        p.step = p.step === 1 ? 2 : 1;
        p.sprite.setFrame(frameIndex(p.dir, p.step));
      }

      // Movimiento
      const vec = DIR_VECTORS[p.dir];
      p.pixelX += vec.x * p.speed * dt;
      p.pixelY += vec.y * p.speed * dt;
      p.sprite.setPosition(Math.round(p.pixelX), Math.round(p.pixelY));
      p.sprite.setDepth(p.pixelY + 1);

      p.tileX = Math.floor(p.pixelX / TILE);
      p.tileY = Math.floor(p.pixelY / TILE);

      // Comprobar cruce de cebra o giro
      const crossing = this.crossing;
      if (p.isCrossing && crossing) {
        // Si estaba cruzando la calle y ya llegó al otro lado (vereda), volver a caminar horizontal
        if (p.tileY <= crossing.topRow || p.tileY >= crossing.bottomRow) {
          p.isCrossing = false;
          p.dir = Phaser.Math.RND.pick(['left', 'right'] as Direction[]);
          p.sprite.setFrame(frameIndex(p.dir, 0));
        }
      } else if (crossing) {
        // En un paso de cebra, probabilidad baja de cruzar la calle
        if (crossing.cols.includes(p.tileX) && (p.tileY === crossing.topRow || p.tileY === crossing.bottomRow)) {
          if (Phaser.Math.Between(1, 200) === 1) {
            p.isCrossing = true;
            p.dir = p.tileY === crossing.topRow ? 'down' : 'up';
            p.sprite.setFrame(frameIndex(p.dir, 0));
          }
        }
      }

      // Despawn si está muy lejos de la cámara
      const isOffscreen = p.pixelX < camLeft - 180 || p.pixelX > camRight + 180 || p.pixelX < 0 || p.pixelX > this.map.width * TILE;
      if (isOffscreen) {
        p.sprite.destroy();
        this.pedestrians.splice(i, 1);
      }
    }

    // Spawn periódico
    this.pedestrianSpawnTimer += delta;
    if (this.pedestrianSpawnTimer > 1800 && this.pedestrians.length < this.maxPedestrians) {
      this.pedestrianSpawnTimer = 0;
      this.trySpawnPedestrian(camLeft, camRight);
    }
  }

  private trySpawnPedestrian(camLeft: number, camRight: number): void {
    if (this.sidewalkRows.length === 0) return;
    const rowY = Phaser.Math.RND.pick(this.sidewalkRows);

    const spawnDir: Direction = Phaser.Math.RND.pick(['left', 'right'] as Direction[]);
    const spawnX = spawnDir === 'right' ? Math.max(0, camLeft - 25) : Math.min(this.map.width * TILE, camRight + 25);
    const tileX = Math.floor(spawnX / TILE);

    if (this.map.isSolid(tileX, rowY)) return;

    // Evitar superposición
    const tooClose = this.pedestrians.some((p) => Math.abs(p.pixelX - spawnX) < 24 && Math.abs(p.pixelY - (rowY + 1) * TILE) < 8);
    if (tooClose) return;

    const spriteId = Phaser.Math.RND.pick(PEDESTRIAN_SPRITES);
    const key = charKey(spriteId);
    if (!this.scene.textures.exists(key)) return;

    const pixelY = (rowY + 1) * TILE;
    const sprite = this.scene.add.sprite(spawnX, pixelY, key, frameIndex(spawnDir, 0)).setOrigin(0.5, 1);
    sprite.setDepth(pixelY + 1);

    this.pedestrians.push({
      sprite,
      tileX,
      tileY: rowY,
      pixelX: spawnX,
      pixelY,
      dir: spawnDir,
      speed: Phaser.Math.Between(20, 28),
      step: 0,
      stepTimer: 0,
      quote: Phaser.Math.RND.pick(this.map.data.region === 'cali' ? CALI_QUOTES : SANTIAGO_QUOTES),
      isCrossing: false,
      pausedTimer: 0,
    });
  }

  /**
   * Si el jugador interactúa (E) mirando al tile enfrente, interactúa con el peatón.
   */
  interactAt(x: number, y: number, playerFacing: Direction): boolean {
    const ped = this.pedestrians.find((p) => p.tileX === x && p.tileY === y);
    if (!ped) return false;

    // Girar hacia el jugador
    const oppositeDir: Record<Direction, Direction> = {
      up: 'down',
      down: 'up',
      left: 'right',
      right: 'left',
    };
    ped.dir = oppositeDir[playerFacing];
    ped.sprite.setFrame(frameIndex(ped.dir, 0));
    ped.pausedTimer = 5000;

    void Dialogue.sayText(ped.quote, 'Transeúnte');
    return true;
  }

  destroy(): void {
    for (const v of this.vehicles) v.sprite.destroy();
    for (const p of this.pedestrians) p.sprite.destroy();
    this.vehicles.length = 0;
    this.pedestrians.length = 0;
  }
}
