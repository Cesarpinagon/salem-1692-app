# Salem 1692 Web

Aplicacion multijugador con React, Vite, Tailwind CSS, Vercel Functions y Firebase. El cliente solo representa las decisiones que permite el motor; las reglas y el estado oficial se ejecutan en el backend dentro de una transaccion de Realtime Database.

## Jugar

- Aplicacion publica: [salem-1692-app.vercel.app](https://salem-1692-app.vercel.app)
- Instructivo completo: [Como jugar Salem 1692](docs/COMO_JUGAR.md)

## Arquitectura

```text
React UI
  -> src/services/gameService.js (acciones explicitas)
  -> /api en Vercel Functions (produccion)
     o Firebase Functions Emulator (desarrollo local)
  -> functions/src/game/engine.js (motor puro)
  -> transaccion por partida en Realtime Database
  -> vista publica + vista privada por jugador
  -> listeners React independientes
```

La rama `games/{gameId}/serverState` contiene el estado interno y nunca se puede leer o escribir desde un cliente. `public` contiene exclusivamente informacion compartida y `private/{playerId}` solo la informacion autorizada para ese usuario. `database.rules.json` impide toda escritura directa del cliente.

## Desarrollo local

Requisitos: Node.js 22 y Firebase CLI.

```bash
npm install
npm test
npm run lint
npm run build
```

Para las funciones:

```bash
cd functions
npm install
npm test
```

### Ejecutar todo localmente en Windows

```bash
npm run build
npm run emulators
```

El script detecta Eclipse Temurin Java automaticamente. Abre `http://127.0.0.1:5000` para jugar y `http://127.0.0.1:4000` para inspeccionar Auth, Functions y Realtime Database. Al cerrar con `Ctrl+C`, los datos locales se exportan a `.firebase-data/` para recuperarlos en el siguiente inicio.

### Jugar desde telefonos en la misma red Wi-Fi

Al iniciar, el script imprime una direccion similar a:

```text
Telefonos en la misma red: http://192.168.100.26:5000
```

Abre exactamente esa direccion en cada telefono. Un jugador crea la sala y comparte el codigo de seis caracteres; los otros eligen **Unirme**. Todos deben aparecer conectados antes de que el anfitrion pulse **Iniciar partida**.

Si un telefono no puede abrir la pagina, confirma que la red de Windows sea **Privada** y permite Node.js/Java cuando Windows Defender lo solicite. Si no aparece el aviso, abre PowerShell como Administrador y ejecuta:

```powershell
New-NetFirewallRule -DisplayName "Salem 1692 Firebase Emulators (Private LAN)" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 4000,5000,5001,9000,9099 -Profile Private -RemoteAddress LocalSubnet
```

Usa los emuladores solamente en una red domestica de confianza. No abras estos puertos en el router ni los expongas a Internet.

Copia `.env.example` a `.env.local` solo si la URL o region de tu proyecto difiere de los valores existentes.

## Configuracion Firebase obligatoria

1. Habilita Authentication > Sign-in method > Anonymous.
2. Crea Realtime Database en la misma region elegida para el proyecto.
3. Configura el proyecto activo con `firebase use <project-id>`.
4. Publica las reglas con `firebase deploy --only database`.

La aplicacion en produccion no despliega Cloud Functions de Firebase y no requiere el plan Blaze. Firebase se usa solamente para Authentication y Realtime Database dentro del plan gratuito; Vercel ejecuta las acciones protegidas del juego.

## Despliegue en Vercel

El archivo `vercel.json` configura Vite, la carpeta `dist` y el fallback de SPA. `.env.production` fuerza los servicios reales y evita publicar por accidente una compilacion conectada a tu computadora. En Vercel no habilites los emuladores locales. Si configuras variables desde el panel, usa:

```text
VITE_FIREBASE_DATABASE_URL=https://salem-1692-16b8b-default-rtdb.firebaseio.com
VITE_FIREBASE_FUNCTIONS_REGION=us-central1
VITE_USE_FIREBASE_EMULATORS=false
```

El backend necesita el secreto `FIREBASE_SERVICE_ACCOUNT_JSON`, con el contenido completo de una clave de cuenta de servicio generada desde **Firebase Console → Configuracion del proyecto → Cuentas de servicio → Firebase Admin SDK**. Agregalo como variable cifrada para Production en Vercel y nunca lo guardes en `.env`, Git ni archivos del frontend.

Para desplegar desde esta carpeta:

```bash
npx vercel
npx vercel --prod
```

La primera orden vincula o crea el proyecto de Vercel; la segunda publica la version de produccion. Los valores publicos de configuracion Firebase ya tienen defaults correctos en el cliente, por lo que el build de Vercel tampoco se conectara a los emuladores si no defines esas variables. Los endpoints estan en `api/` y validan el Firebase ID token antes de tocar el estado privado.

No uses reglas abiertas en desarrollo. Para pruebas locales, usa Firebase Emulator Suite conservando `database.rules.json`.

## Modelo de acciones

Toda accion incluye `actionId`, `expectedVersion`, `type` y `payload`. El backend autentica al jugador, comprueba pertenencia, vida, fase, turno, propiedad, objetivo y efectos; luego aplica el motor y aumenta `version` dentro de una transaccion. Un `actionId` repetido devuelve el mismo estado sin ejecutar de nuevo.

El servidor genera un ID interno y un codigo de invitacion independiente. Acciones implementadas: inicio, Black Cat, robo secuencial, juego de cartas, fin de turno, juicio, Conspiracy simultanea, seleccion de victima, proteccion del Alguacil, confesion o pase, ultimas palabras y timeout automatico.

## Seguridad y privacidad

- El navegador nunca recibe manos ni Tryal Cards ajenas.
- `hasEverBeenWitch`, selecciones nocturnas y protecciones se mantienen en la vista privada.
- El historial publico omite decisiones secretas; el log interno incluye hashes, version y payload para auditoria.
- Los jugadores muertos reciben solo acciones de espectador/ultimas palabras.
- La hora decisiva y los timeouts se determinan en backend.

## Pruebas

Las pruebas del motor cubren: host y cantidad de jugadores, mazo para hasta 12 jugadores, asignacion de roles, privacidad, idempotencia, conflicto de version, puntos exactos de acusacion, Conspiracy simultanea, reanudacion de robos interrumpidos, transferencia de Witch/Constable, juicio a 7 puntos, muerte centralizada, ambas victorias, proteccion nocturna, confesion y avance de ronda.

`npm run simulate` crea cuatro usuarios reales en Emulator Suite, inicia una sala y ejecuta decisiones legales hasta que existe un ganador. `npm run test:api` verifica autenticacion, creacion, union y arranque mediante los mismos endpoints usados en Vercel.

Las reglas exactas de cartas y personajes adicionales deben definirse antes de implementarse con: trigger, condiciones, objetivos, efecto, duracion, visibilidad, prioridad y cleanup.
