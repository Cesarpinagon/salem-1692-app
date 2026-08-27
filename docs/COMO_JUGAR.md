# Cómo jugar Salem 1692 Web

Salem 1692 es un juego de identidades ocultas, acusaciones y deducción social para **4 a 12 jugadores**. Cada persona juega desde su propio teléfono y debe mantener en secreto la información privada que aparece en su pantalla.

Esta versión está pensada para partidas privadas con familiares y amigos. El anfitrión comparte directamente con los invitados el enlace de la instalación; no es necesario publicarlo en el repositorio ni en redes sociales.

## 1. Preparar una partida

1. Todos abren la aplicación desde sus teléfonos.
2. Una persona escribe su nombre y pulsa **Crear sala**. Esa persona será el anfitrión.
3. El anfitrión comparte el código de seis caracteres que aparece en pantalla.
4. Los demás escriben su nombre, pulsan **Unirme** e introducen el código.
5. Esperen hasta que todos aparezcan como conectados.
6. El anfitrión pulsa **Iniciar partida**.

No es necesario crear cuentas. La aplicación asigna una identidad anónima a cada navegador.

> Cada jugador debe usar su propio teléfono. No enseñes tu pantalla cuando aparezca información privada, una carta de Juicio o una decisión nocturna.

## 2. Objetivo

Hay dos equipos:

- **El Pueblo** gana cuando ya no queda ninguna carta de Bruja oculta en juego.
- **Las Brujas** ganan cuando todos los jugadores que siguen con vida han pertenecido al equipo de las Brujas en algún momento de la partida.

Un jugador que recibe una carta de Bruja mediante Conspiración pasa a formar parte de las Brujas y continúa perteneciendo a ese equipo aunque después entregue la carta.

## 3. Cartas de Juicio e identidad

Las cartas de Juicio permanecen ocultas en el teléfono de su propietario:

- **Bruja:** convierte a su propietario en miembro de las Brujas.
- **Pueblerino:** indica que esa carta no es de Bruja.
- **Alguacil:** permite proteger secretamente a una persona durante la Noche.

En una partida de cuatro personas, cada jugador comienza con cinco cartas de Juicio. En partidas de cinco a doce personas, cada jugador comienza con cuatro. En toda la partida existe una carta de Bruja y una de Alguacil; las demás son de Pueblerino.

Las cartas pueden cambiar de propietario debido a Conspiración, por lo que las identidades pueden cambiar durante la partida.

## 4. Amanecer inicial y Gato Negro

Al comenzar la partida se muestra una fase privada de Amanecer:

1. La Bruja inicial descubre su identidad.
2. La Bruja elige a otro jugador para entregarle el **Gato Negro**.
3. La asignación no revela ninguna carta de Juicio en ese momento.
4. Después comienza el primer turno del Día.

## 5. Turnos durante el Día

En su turno, un jugador elige entre:

- **Robar dos cartas:** las cartas se resuelven una por una y el turno termina automáticamente al completar el robo.
- **Jugar cartas de su mano:** puede jugar cartas legales y después debe pulsar **Terminar** para cerrar su turno.

La aplicación ilumina únicamente las cartas y objetivos permitidos. Si una carta necesita uno o dos objetivos, selecciónalos en el tablero antes de confirmar.

### Cartas rojas: acusaciones

- **Acusación:** agrega 1 punto.
- **Evidencia:** agrega 3 puntos.
- **Testigo:** agrega 7 puntos.

Los puntos se colocan frente al jugador objetivo. Cuando llega a **7 o más puntos**, comienza inmediatamente un Juicio.

### Cartas verdes

- **Coartada:** elimina todas las acusaciones acumuladas por quien la juega.
- **Casamiento:** existen exactamente dos cartas. Cada carta se asigna a un solo jugador vivo que todavía no tenga una carta de Casamiento. Después de aparecer una vez, no regresa al mazo al reciclar el descarte tras la Noche.

### Carta azul

- **Asilo / Protección:** permanece frente al jugador y lo protege de nuevas acusaciones y de ataques de las Brujas durante la Noche.

### Carta negra

- **Conspiración:** existe una sola carta y nunca se reparte en las manos iniciales. Permanece en el mazo; al robarla, cada jugador vivo elige una carta de Juicio oculta del jugador que está a su izquierda. Todas las transferencias se aplican simultáneamente. Después de la Noche, Conspiración vuelve al mazo para el siguiente ciclo.

La pantalla indica de quién se está tomando la carta y pide confirmar la selección. Después de la transferencia, cada jugador ve privadamente qué carta recibió. Cuando termina la Conspiración, quien tenga el **Gato Negro** debe revelar una de sus cartas de Juicio; solo entonces se activa su efecto.

## 6. Acusaciones y Juicio

Cuando un jugador llega a 7 puntos de acusación:

1. Se elige y revela una de sus cartas de Juicio que continúe oculta.
2. Sus cartas y puntos de acusación se eliminan inmediatamente; el contador vuelve a **0**.
3. Si la carta revelada es **Bruja**, el jugador muere.
4. Si con esa revelación ya quedaron visibles todas sus cartas de Juicio, el jugador también muere.
5. Si continúa con vida, el turno puede seguir.

## 7. Cuándo comienza la Noche

La Noche **no** depende de robar una carta especial. Comienza automáticamente y una sola vez cuando un jugador roba la **última carta del mazo principal**.

Si esa última carta es Conspiración, primero se resuelven todas las transferencias privadas y después comienza la Noche. Si quedaba pendiente el segundo robo del turno, la aplicación conserva esa acción y la reanuda cuando termina la resolución nocturna, siempre que el jugador siga con vida.

## 8. Resolución de la Noche

La aplicación guía las decisiones en este orden:

1. **Selección de las Brujas:** los jugadores vivos que han sido Bruja eligen secretamente una víctima que no pertenezca a las Brujas.
2. **Protección del Alguacil:** si el Alguacil sigue con vida, protege secretamente a otro jugador.
3. **Confesión:** cada jugador vivo puede revelar voluntariamente una carta de Juicio o elegir no confesar.
4. **Ataque:** se resuelve la votación de las Brujas.

Una confesión válida protege al jugador durante esa Noche. Revelar una carta de Bruja al confesar provoca la muerte inmediata. El ataque nocturno falla si la víctima fue protegida por el Alguacil, confesó o tiene Asilo.

## 9. Casamiento y muerte compartida

La primera carta de Casamiento se coloca frente a un jugador, pero todavía no crea ningún vínculo. Cuando la segunda carta se asigna a otro jugador distinto, ambos quedan casados y se activa el vínculo mortal:

- Una sola carta asignada no produce muerte compartida.
- Si uno muere por revelar una Bruja, perder todas sus cartas de Juicio, un ataque nocturno o cualquier otro efecto, el otro muere inmediatamente.
- La muerte vinculada ocurre en el mismo momento y no puede evitarse con Asilo ni con la protección del Alguacil.
- El vínculo aparece públicamente en el tablero junto a los nombres de los jugadores.

## 10. Muerte, anuncio y últimas palabras

Cuando alguien muere:

1. Queda fuera de las decisiones de la partida y pasa a ser espectador.
2. Sus cartas de Juicio restantes se revelan.
3. La aplicación anuncia públicamente si fue Bruja en algún momento de la partida.
4. La pantalla abre una ventana de últimas palabras para el fallecido principal antes de pasarlo a modo espectador.

No compartas información privada después de morir, salvo el mensaje permitido por la pantalla de últimas palabras.

## 11. Fin y nueva partida

Cuando se cumple una condición de victoria, todos ven el equipo ganador. El anfitrión puede pulsar **Jugar otra vez** para:

- conservar la misma sala y los mismos jugadores;
- eliminar cartas, roles, vínculos, muertes, acusaciones y ganador anteriores;
- regresar al lobby y comenzar una partida nueva.

## 12. Consejos para jugar en familia

- Mantengan los teléfonos cargados y conectados a Internet.
- Usen nombres diferentes para reconocer fácilmente a cada jugador.
- Lean en voz alta los eventos del historial público, pero nunca las decisiones privadas.
- Antes de pasar el teléfono o alejarse de la mesa, oculta tu información privada.
- Si una decisión tiene contador, complétala antes de que termine; al vencer, el servidor aplica una opción automática válida.

## 13. Problemas comunes

### Un jugador aparece desconectado

Revisa su Internet y vuelve a abrir la misma pestaña. La presencia se actualiza automáticamente.

### La sala fue eliminada o ya no existe

Recarga la página. La aplicación descartará la sesión anterior y permitirá crear una sala o entrar con un código nuevo.

### La aplicación parece mostrar una versión anterior

Haz una recarga forzada:

- Windows o Android con teclado: `Ctrl + Shift + R`.
- iPhone o Android: cierra la pestaña y abre nuevamente el enlace que compartió el anfitrión.

### El código no funciona

Confirma que tiene seis caracteres y que la sala todavía existe. Los códigos no distinguen entre mayúsculas y minúsculas.

---

La aplicación es la autoridad final sobre las acciones legales, los objetivos disponibles y la resolución de efectos. Si la pantalla no permite una acción, revisa la fase actual, el turno, el estado del jugador y los efectos activos.
