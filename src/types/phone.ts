import type { Condition } from './story';

export interface PhoneContact {
  name: string;
  /** Color del avatar y de las burbujas. */
  color: string;
  /** Aparece en la app Teléfono (se le puede llamar). */
  callable?: boolean;
  /** Solo aparece en la app Teléfono si se cumple (ej. doña Mery, recién desde Cali). */
  if?: Condition;
  /** Mientras se cumpla, su conversación no aparece en Mensajes (ej. Sira durante el recuerdo de Salento). */
  hideIf?: Condition;
}

export interface PhoneMessage {
  /** Contacto de la conversación (con `mine`, a quién se lo mandaste). */
  from: string;
  text: string;
  /** Lo escribiste tú: burbuja a la derecha, sin notificación (el chat con Sira de la misión 6). */
  mine?: boolean;
}

export interface PhoneCall {
  from: string;
  /** Diálogo que se abre al contestar. */
  dialogue: string;
  /** Mensaje que llega si rechazas la llamada (opcional). */
  missed?: string;
}

/**
 * Regla automática: cuando se cumple `if` (y ya pasaron `afterMs` de partida), llega el
 * mensaje o la llamada. Cada regla se dispara una sola vez por partida (flag `tel_<id>`).
 */
export interface PhoneTrigger {
  id: string;
  /** Solo se dispara en esta misión (id de missions/*.json). Sin `mission`, en todas. */
  mission?: string;
  if?: Condition;
  afterMs?: number;
  message?: string;
  call?: string;
}

/** Llamada que hace el jugador desde la app Teléfono: la primera regla que se cumple para ese contacto. */
export interface PhoneOutgoing {
  to: string;
  if?: Condition;
  /** Diálogo de la conversación. Sin diálogo, nadie contesta. */
  dialogue?: string;
}

/** Correo de la app de la universidad. Se ve si se cumple `if`; al abrirlo se marca la flag `correo_<id>`. */
export interface PhoneMail {
  from: string;
  subject: string;
  text: string;
  if?: Condition;
}

export interface PhoneData {
  contacts: Record<string, PhoneContact>;
  messages: Record<string, PhoneMessage>;
  calls: Record<string, PhoneCall>;
  triggers: PhoneTrigger[];
  outgoing: PhoneOutgoing[];
  mail: Record<string, PhoneMail>;
}
