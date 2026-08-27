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
  ALL_TRYALS_REVEALED: 'revelo todas sus cartas de Juicio',
  WITCH_ATTACK: 'ataque de las Brujas',
  MARRIAGE_BOND: 'vinculo mortal de Casamentero',
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
  ALIBI: 'Retira cartas de acusación que sumen como máximo 3 puntos.',
  ARSON: 'Descarta toda la mano de otro jugador.',
  CURSE: 'Descarta una carta azul situada frente a otro jugador.',
  ROBBERY: 'Mueve toda la mano de un jugador a un tercer jugador, sin beneficiar a quien juega la carta.',
  SCAPEGOAT: 'Mueve el conjunto completo de cartas situadas frente a un jugador hacia un tercero.',
  STOCKS: 'Hace que otro jugador pierda su siguiente turno; varios Cepos se acumulan.',
  ASYLUM: 'Protege del asesinato de las Brujas durante la Noche.',
  MERCY: 'Impide que se jueguen directamente cartas rojas contra su portador.',
  SANCTUARY: 'Proteccion azul permanente contra el ataque de las Brujas durante la Noche.',
  MATCHMAKER: 'Vincula mortalmente a dos portadores distintos. Si ambas cartas quedan frente a la misma persona, se descartan.',
  BLACK_CAT: 'Antes de Conspiración, su portador revela una carta de Juicio.',
}[card?.key] || 'Carta de Salem.');

export const CARD_GLOSSARY = [
  { name: 'Acusación / Evidencia / Testigo', description: 'Las rojas aportan 1, 3 y 7 puntos. Al alcanzar 7 se inicia inmediatamente un Juicio.' },
  { name: 'Coartada', description: 'Retira cartas rojas elegidas que sumen hasta 3 puntos y luego se descarta.' },
  { name: 'Incendio', description: 'Descarta toda la mano de otro jugador, sin tocar las cartas frente a él.' },
  { name: 'Maldición', description: 'Descarta una carta azul elegida frente a otro jugador.' },
  { name: 'Robo', description: 'Pasa toda la mano de otro jugador a un tercero; quien juega Robo no puede ser origen ni destino.' },
  { name: 'Chivo Expiatorio', description: 'Mueve todas las cartas frente a otro jugador hacia un tercero; quien la juega no puede ser origen ni destino.' },
  { name: 'Cepo', description: 'Hace perder el siguiente turno y después se descarta. Los Cepos se acumulan.' },
  { name: 'Asilo', description: 'Protege únicamente del asesinato nocturno de las Brujas.' },
  { name: 'Piedad', description: 'Impide que su portador reciba directamente cartas rojas.' },
  { name: 'Casamentero', description: 'Dos portadores distintos quedan vinculados mortalmente. Si ambas cartas coinciden frente a uno, se descartan.' },
  { name: 'Gato Negro', description: 'Es una carta azul asignada en el Amanecer. Antes de Conspiración, su portador revela una carta de Juicio.' },
  { name: 'Conspiración', description: 'Nunca se reparte inicialmente. Después del Gato Negro, todos toman simultáneamente una carta de Juicio del jugador de su izquierda.' },
  { name: 'Noche', description: 'Es una carta negra colocada al fondo. Al robarse inicia la Noche; al terminar, el descarte se baraja y Noche vuelve al fondo.' },
];
