const fs = require("node:fs");
const path = require("node:path");
const auth = require("firebase-tools/lib/auth");

const PROJECT_ID = "salem-1692-16b8b";
const SERVICE_ACCOUNT =
  "firebase-adminsdk-fbsvc@salem-1692-16b8b.iam.gserviceaccount.com";
const OUTPUT_DIRECTORY = path.resolve(process.cwd(), ".firebase-cli");
const OUTPUT_FILE = path.join(
  OUTPUT_DIRECTORY,
  "vercel-service-account.tmp.json",
);

async function main() {
  const account =
    auth.findAccountByEmail("pinaflamier@gmail.com") ??
    auth.getGlobalDefaultAccount();

  if (!account?.tokens?.refresh_token) {
    throw new Error("No se encontró una sesión activa de Firebase CLI.");
  }

  const token = await auth.getAccessToken(account.tokens.refresh_token, [
    "https://www.googleapis.com/auth/cloud-platform",
  ]);
  const accessToken = token?.access_token;

  if (!accessToken) {
    throw new Error("Firebase CLI no entregó un token de acceso.");
  }

  const encodedAccount = encodeURIComponent(SERVICE_ACCOUNT);
  const response = await fetch(
    `https://iam.googleapis.com/v1/projects/-/serviceAccounts/${encodedAccount}/keys`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        privateKeyType: "TYPE_GOOGLE_CREDENTIALS_FILE",
        keyAlgorithm: "KEY_ALG_RSA_2048",
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google IAM respondió ${response.status}: ${error}`);
  }

  const result = await response.json();
  const serviceAccountJson = Buffer.from(
    result.privateKeyData,
    "base64",
  ).toString("utf8");
  const parsed = JSON.parse(serviceAccountJson);

  if (
    parsed.project_id !== PROJECT_ID ||
    parsed.client_email !== SERVICE_ACCOUNT ||
    !parsed.private_key
  ) {
    throw new Error("La credencial generada no coincide con el proyecto esperado.");
  }

  fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, serviceAccountJson, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });

  const keyId = result.name?.split("/").at(-1) ?? "desconocido";
  process.stdout.write(`Clave creada: ${keyId}\nArchivo temporal: ${OUTPUT_FILE}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
