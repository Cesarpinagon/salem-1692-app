import { CARD_COLOR } from './constants.js';

const DEFINITIONS = [
  { key: 'ACCUSATION', name: 'Acusacion', description: 'Suma 1 punto de acusacion frente a otro jugador.', color: CARD_COLOR.RED, points: 1, trigger: 'ON_PLAY', targetRules: 'OTHER_PLAYER', duration: 'IMMEDIATE', visibility: 'PUBLIC' },
  { key: 'EVIDENCE', name: 'Evidencia', description: 'Suma 3 puntos de acusacion frente a otro jugador.', color: CARD_COLOR.RED, points: 3, trigger: 'ON_PLAY', targetRules: 'OTHER_PLAYER', duration: 'IMMEDIATE', visibility: 'PUBLIC' },
  { key: 'WITNESS', name: 'Testigo', description: 'Suma 7 puntos de acusacion y provoca un Juicio.', color: CARD_COLOR.RED, points: 7, trigger: 'ON_PLAY', targetRules: 'OTHER_PLAYER', duration: 'IMMEDIATE', visibility: 'PUBLIC' },
  { key: 'ALIBI', name: 'Coartada', description: 'Retira todas tus acusaciones acumuladas.', color: CARD_COLOR.GREEN, trigger: 'ON_PLAY', targetRules: 'SELF', duration: 'IMMEDIATE', visibility: 'PUBLIC' },
  { key: 'ASYLUM', name: 'Asilo / Proteccion', description: 'Proteccion azul permanente contra acusaciones y ataques de la Noche.', color: CARD_COLOR.BLUE, trigger: 'ON_PLAY', targetRules: 'ANY_ALIVE_PLAYER', duration: 'PERMANENT', visibility: 'PUBLIC' },
  { key: 'MATCHMAKER', name: 'Casamiento', description: 'Asigna esta carta a un jugador. Cuando dos jugadores distintos tienen una, quedan casados y comparten un vinculo mortal. Cada carta aparece una sola vez por partida.', color: CARD_COLOR.GREEN, trigger: 'ON_PLAY', targetRules: 'ANY_ALIVE_PLAYER', targetCount: 1, duration: 'PERMANENT', visibility: 'PUBLIC' },
  { key: 'CONSPIRACY', name: 'Conspiracion', description: 'Carta unica del mazo. Al robarla, cada jugador toma una carta de Juicio oculta del jugador a su izquierda; vuelve al mazo despues de la Noche.', color: CARD_COLOR.BLACK, trigger: 'ON_DRAW', targetRules: 'TRYAL_CARD', duration: 'IMMEDIATE', visibility: 'PUBLIC' },
  { key: 'NIGHT', name: 'Noche', description: 'Las Brujas eligen una victima y el Alguacil protege secretamente a un jugador.', color: CARD_COLOR.BLACK, trigger: 'ON_DRAW', targetRules: 'NONE', duration: 'IMMEDIATE', visibility: 'PUBLIC' },
];

export function buildTownDeck(playerCount = 4) {
  const targetSize = Math.max(40, (playerCount * 5) + 20);
  const conspiracy = getCardDefinition('CONSPIRACY');
  const matchmaker = getCardDefinition('MATCHMAKER');
  const repeatable = DEFINITIONS.filter((card) => !['CONSPIRACY', 'MATCHMAKER', 'NIGHT'].includes(card.key));
  const deck = [
    { ...conspiracy, id: 'CONSPIRACY_UNIQUE' },
    { ...matchmaker, id: 'MATCHMAKER_1' },
    { ...matchmaker, id: 'MATCHMAKER_2' },
  ];
  const copies = {};
  while (deck.length < targetSize) {
    const definition = repeatable[(deck.length - 3) % repeatable.length];
    copies[definition.key] = (copies[definition.key] || 0) + 1;
    deck.push({ ...definition, id: `${definition.key}_${copies[definition.key]}` });
  }
  return deck;
}

export function getCardDefinition(key) {
  return DEFINITIONS.find((card) => card.key === key);
}
