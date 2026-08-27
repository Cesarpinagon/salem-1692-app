import { CARD_COLOR } from './constants.js';

const DEFINITIONS = Object.freeze([
  { key: 'ACCUSATION', name: 'Acusación', description: 'Suma 1 punto de acusación frente a otro jugador.', color: CARD_COLOR.RED, points: 1, trigger: 'ON_PLAY', targetRules: 'OTHER_PLAYER', duration: 'UNTIL_TRYAL', visibility: 'PUBLIC' },
  { key: 'EVIDENCE', name: 'Evidencia', description: 'Suma 3 puntos de acusación frente a otro jugador.', color: CARD_COLOR.RED, points: 3, trigger: 'ON_PLAY', targetRules: 'OTHER_PLAYER', duration: 'UNTIL_TRYAL', visibility: 'PUBLIC' },
  { key: 'WITNESS', name: 'Testigo', description: 'Suma 7 puntos de acusación y provoca inmediatamente un Juicio.', color: CARD_COLOR.RED, points: 7, trigger: 'ON_PLAY', targetRules: 'OTHER_PLAYER', duration: 'UNTIL_TRYAL', visibility: 'PUBLIC' },
  { key: 'ALIBI', name: 'Coartada', description: 'Retira cartas rojas por un total máximo de 3 puntos frente a otro jugador.', color: CARD_COLOR.GREEN, trigger: 'ON_PLAY', targetRules: 'OTHER_PLAYER', duration: 'IMMEDIATE', visibility: 'PUBLIC' },
  { key: 'ARSON', name: 'Incendio', description: 'Descarta todas las cartas de la mano de otro jugador.', color: CARD_COLOR.GREEN, trigger: 'ON_PLAY', targetRules: 'OTHER_PLAYER', duration: 'IMMEDIATE', visibility: 'PUBLIC' },
  { key: 'CURSE', name: 'Maldición', description: 'Descarta una carta azul situada frente a otro jugador.', color: CARD_COLOR.GREEN, trigger: 'ON_PLAY', targetRules: 'OTHER_PLAYER_BLUE_CARD', duration: 'IMMEDIATE', visibility: 'PUBLIC' },
  { key: 'ROBBERY', name: 'Robo', description: 'Entrega la mano completa de otro jugador a un tercer jugador; quien juega Robo no puede recibirla.', color: CARD_COLOR.GREEN, trigger: 'ON_PLAY', targetRules: 'TWO_OTHER_PLAYERS_ORDERED', targetCount: 2, duration: 'IMMEDIATE', visibility: 'PUBLIC' },
  { key: 'SCAPEGOAT', name: 'Chivo Expiatorio', description: 'Mueve todas las cartas situadas frente a otro jugador hacia un tercer jugador.', color: CARD_COLOR.GREEN, trigger: 'ON_PLAY', targetRules: 'TWO_OTHER_PLAYERS_ORDERED', targetCount: 2, duration: 'IMMEDIATE', visibility: 'PUBLIC' },
  { key: 'STOCKS', name: 'Cepo', description: 'Se coloca frente a otro jugador, que pierde su siguiente turno.', color: CARD_COLOR.GREEN, trigger: 'ON_PLAY', targetRules: 'OTHER_PLAYER', duration: 'UNTIL_SKIPPED_TURN', visibility: 'PUBLIC' },
  { key: 'ASYLUM', name: 'Asilo', description: 'Protege del asesinato de las Brujas durante la Noche.', color: CARD_COLOR.BLUE, trigger: 'ON_PLAY', targetRules: 'ANY_ALIVE_PLAYER', duration: 'PERMANENT', visibility: 'PUBLIC' },
  { key: 'MERCY', name: 'Piedad', description: 'Impide que se jueguen directamente cartas rojas contra este jugador.', color: CARD_COLOR.BLUE, trigger: 'ON_PLAY', targetRules: 'ANY_ALIVE_PLAYER', duration: 'PERMANENT', visibility: 'PUBLIC' },
  { key: 'MATCHMAKER', name: 'Casamentero', description: 'Dos portadores distintos quedan vinculados: si uno muere, el otro también.', color: CARD_COLOR.BLUE, trigger: 'ON_PLAY', targetRules: 'ANY_ALIVE_PLAYER', duration: 'PERMANENT', visibility: 'PUBLIC' },
  { key: 'BLACK_CAT', name: 'Gato Negro', description: 'Antes de Conspiración, su portador revela una carta de Juicio.', color: CARD_COLOR.BLUE, trigger: 'ON_PLAY', targetRules: 'ANY_ALIVE_PLAYER', duration: 'PERMANENT', visibility: 'PUBLIC' },
  { key: 'CONSPIRACY', name: 'Conspiración', description: 'Antes del intercambio, el portador del Gato Negro revela una carta de Juicio; después todos toman simultáneamente una carta oculta del jugador de su izquierda.', color: CARD_COLOR.BLACK, trigger: 'ON_DRAW', targetRules: 'TRYAL_CARD', duration: 'IMMEDIATE', visibility: 'PUBLIC' },
  { key: 'NIGHT', name: 'Noche', description: 'Inicia inmediatamente la fase de Noche y vuelve al fondo al reconstruir el mazo.', color: CARD_COLOR.BLACK, trigger: 'ON_DRAW', targetRules: 'NONE', duration: 'IMMEDIATE', visibility: 'PUBLIC' },
]);

export const STANDARD_DECK_COUNTS = Object.freeze({
  ACCUSATION: 35,
  EVIDENCE: 5,
  WITNESS: 1,
  ALIBI: 3,
  ARSON: 1,
  CURSE: 1,
  ROBBERY: 1,
  SCAPEGOAT: 2,
  STOCKS: 3,
  ASYLUM: 1,
  MERCY: 1,
  MATCHMAKER: 2,
  BLACK_CAT: 1,
  CONSPIRACY: 1,
  NIGHT: 1,
});

export function buildTownDeck() {
  return Object.entries(STANDARD_DECK_COUNTS).flatMap(([key, count]) => {
    const definition = getCardDefinition(key);
    return Array.from({ length: count }, (_, index) => ({
      ...definition,
      id: count === 1 ? `${key}_UNIQUE` : `${key}_${index + 1}`,
    }));
  });
}

export function getCardDefinition(key) {
  return DEFINITIONS.find((card) => card.key === key);
}
