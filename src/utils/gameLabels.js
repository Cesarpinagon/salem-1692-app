export const tryalLabel = (type) => ({
  WITCH: 'Bruja',
  NOT_WITCH: 'Pueblerino',
  CONSTABLE: 'Alguacil',
}[type] || type || 'Desconocida');

export const colorLabel = (color) => ({
  RED: 'Roja',
  GREEN: 'Verde',
  BLUE: 'Azul',
  BLACK: 'Negra',
}[color] || color || '');

export const winnerLabel = (winner) => ({
  TOWN: 'El Pueblo',
  WITCHES: 'Las Brujas',
}[winner] || winner || 'Sin ganador');

export const deathReasonLabel = (reason) => ({
  REVEALED_WITCH: 'revelo su carta de Bruja',
  CONFESSED_WITCH: 'confeso su carta de Bruja',
  ALL_TRYALS_REVEALED: 'revelo sus cinco cartas de Juicio',
  WITCH_ATTACK: 'ataque de las Brujas',
  MARRIAGE_BOND: 'vinculo mortal de Casamiento',
}[reason] || 'fallecido');

export const subPhaseLabel = (subPhase) => ({
  BLACK_CAT_SELECTION: 'Seleccion del Gato Negro',
  WITCH_SELECTION: 'Seleccion secreta de las Brujas',
  CONSTABLE_SELECTION: 'Proteccion del Alguacil',
  CONFESSION: 'Confesion',
  NIGHT_RESOLUTION: 'Resolucion de la Noche',
  LAST_WORDS: 'Ultimas palabras',
}[subPhase] || 'Noche en Salem');

export const cardDescription = (card) => card?.description || ({
  ACCUSATION: 'Suma puntos de acusacion frente a otro jugador hasta provocar un Juicio.',
  EVIDENCE: 'Suma 3 puntos de acusacion frente a otro jugador.',
  WITNESS: 'Suma 7 puntos de acusacion y provoca un Juicio.',
  ALIBI: 'Retira todas tus acusaciones acumuladas.',
  ASYLUM: 'Proteccion azul permanente contra acusaciones y ataques de la Noche.',
  SANCTUARY: 'Proteccion azul permanente contra acusaciones y ataques de la Noche.',
  MATCHMAKER: 'Asigna la carta a una persona. Cuando dos personas distintas tengan una, quedaran casadas y compartiran un vinculo mortal. No vuelve al mazo.',
}[card?.key] || 'Carta de Salem.');

export const CARD_GLOSSARY = [
  { name: 'Casamiento', description: 'Hay dos cartas que aparecen una sola vez por partida. Cada una se asigna a una persona distinta; el vinculo mortal solo se activa cuando ambas han sido asignadas.' },
  { name: 'Amanecer', description: 'Permite al Alguacil proteger secretamente a un jugador del ataque nocturno de las Brujas.' },
  { name: 'Noche', description: 'La fase comienza automaticamente cuando un jugador roba la ultima carta del mazo principal.' },
  { name: 'Gato Negro', description: 'Al terminar una Conspiracion, obliga a quien lo tenga a revelar una carta de Juicio. Asignarlo al inicio no revela ninguna carta.' },
  { name: 'Conspiracion', description: 'Cada jugador toma una carta de Juicio oculta del jugador a su izquierda. Recibir una Bruja te convierte en Bruja.' },
  { name: 'Asilo / Proteccion', description: 'Carta azul permanente que protege contra acusaciones y ataques de la Noche.' },
  { name: 'Acusaciones', description: 'Las cartas rojas suman puntos frente a un jugador; al llegar a 7 provocan un Juicio.' },
];
