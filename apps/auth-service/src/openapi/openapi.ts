import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

/** The routes live under /v1; the key set stays where JWT verifiers expect it. */
export function applyGlobalPrefix(app: INestApplication): void {
  app.setGlobalPrefix('v1', { exclude: ['.well-known/jwks.json'] });
}

/**
 * The guide at the top of the published document (/auth/docs on the test
 * portal) — written for the developers of the resident app and their coding
 * assistants: keep it true to what the test portal does.
 */
const GUIDE = `
Signing in for the inova apps. The shapes of every answer below are also
TypeScript types in \`@inova/shared\` (\`AuthSession\`, \`AuthProfile\`,
\`RecoveryStarted\`, \`ApiError\`) — import them rather than copying.

**Test portal:** auth \`https://test-portal.whitenova.tech/auth/v1\`, core API
\`https://test-portal.whitenova.tech/api/v1\` (its own document at \`/api/docs\`).

## The organisation (realm)

Every account belongs to one organisation; the same phone in two organisations
is two unrelated accounts. Name it on every sign-in call — \`login\`,
\`activate\`, \`resend-code\`, \`recovery\`, \`recovery/confirm\` — with
\`realm\` (the organisation key, e.g. \`demo\`) or \`brand\` (the app's brand key,
enough while the brand has one organisation). Without either, the server's
default organisation is used.

## Signing in and staying signed in

1. \`POST /auth/login\` with \`{ phone, password, realm }\` (or \`email\`). The
   answer is an \`AuthSession\`: an access token valid \`expiresIn\` seconds
   (15 minutes) and a refresh token.
2. Call the core API with \`Authorization: Bearer <accessToken>\` and
   \`X-Tenant-Id: <memberships[0].t>\`.
3. When the access token is about to expire, or a call answers 401, send
   \`POST /auth/refresh\` with the refresh token and **store both new tokens**.
   A refresh token works once: sending a spent one ends the whole session
   everywhere. Refresh once at a time — let parallel calls wait for it.
4. \`POST /auth/logout\` with the refresh token ends the session.

## The first time: activation

A manager creates the resident and an invite code goes out — by SMS to a
phone, by e-mail to an address.
\`POST /auth/activate\` with \`{ identifier: <phone>, code, realm }\` signs the
resident in with \`user.mustSetPassword: true\`; then \`POST /auth/password\`.
Five wrong codes cancel the code; \`POST /auth/resend-code\` sends a new one.
The screen never says how many tries are left.

## Forgotten password

\`POST /auth/recovery\` with \`{ email }\` (offered first) or \`{ phone }\` answers
\`202\` with \`expiresInMinutes\` — always, whether or not the account exists.
Then \`POST /auth/recovery/confirm\` with \`{ token }\` (from the e-mailed link)
or \`{ phone, code }\`, plus the new password, and \`204\` means done. Every
session of the account ends; sign in again.

**The e-mailed link** opens a page of this service:
\`https://<portal>/auth/v1/auth/reset#token=<token>\`. The token is in the
fragment (after \`#\`), so it never reaches a server log. On a phone the page
offers «Отвори в приложението», which opens the app at
\`inova://reset?token=<token>\` (the app's scheme); without the app the page
sets the password itself. The app's «нова парола» screen therefore:

1. handles the deep link \`inova://reset\` and reads \`token\` from it;
2. asks for the new password (at least 8 characters) twice;
3. sends \`POST /auth/recovery/confirm\` with \`{ token, password }\` — no
   \`realm\` needed, the token carries its organisation;
4. on \`204\` sends the resident to sign in; on \`401\` says the link has
   expired or was used already and offers «Забравена парола» again.

A link works once and for \`expiresInMinutes\` from the request; a phone code
likewise, and five wrong codes cancel it.

## Messages on the test portal

Every message the test portal sends lands in its mailbox at
\`https://test-portal.whitenova.tech/mail/\` — invite codes, recovery links
and codes, e-mail change codes. A text message appears there as an e-mail to
\`<number>@sms.test\` (\`359881000101@sms.test\` for \`+359881000101\`), its
text in the body. The mailbox asks for a password: user \`team\`, the password
from the team lead. It keeps the latest 500 messages. Delivery takes a few
seconds; refresh the mailbox.

Nothing reaches a real phone or inbox from the test portal, so any address or
number works for trying a flow. Production sends real e-mail and SMS instead.

## Errors

Every error has the body \`ApiError\`: \`{ statusCode, message, error }\`.
\`message\` lists the broken fields on a 400. A wrong password, an unknown
phone and an account of another organisation all get the same 401 — show
one message for all. 429: too many tries from this address, wait a minute.

## Test accounts (test portal)

Organisation \`demo\` (\`realm: "demo"\`), password \`demo-resident\`, sign in by phone:

| Phone | Who |
| --- | --- |
| \`+359881000101\` | Петър Николов — owner of бл. 12 ап. 1 and garage Г1, with a household member and a dog |
| \`+359881000102\` | Ралица Николова — co-owner of ап. 1 |
| \`+359881000103\` | Калин Тодоров — tenant of ап. 3: no owner-only actions |
| \`+359881000002\` | Георги Димитров — not activated: code \`735026\` (once; a reset of the test portal restores it) |

A reset of the test portal puts these accounts back as listed. Георги's code
is fixed by the seed; every other code — a resent invite, recovery, e-mail
change — is new each time and arrives in the mailbox (see «Messages on the
test portal»).

**Recovery by phone:** \`POST /auth/recovery\` with
\`{ phone: "+359881000101", realm: "demo" }\`; the code is in the mailbox,
addressed to \`359881000101@sms.test\`.

**Recovery by e-mail:** the sample residents have no e-mail address. Give one
first — signed in as the resident, \`POST /auth/me/email\` with
\`{ email, password }\`, then \`POST /auth/me/email/confirm\` with the
\`{ code }\` from the mailbox — and then \`POST /auth/recovery\` with
\`{ email, realm: "demo" }\`. The mailbox shows the e-mail with the link;
open it, or take the token after \`#token=\` to try the app's deep link.

Recovery and the other sign-in calls allow 5 tries a minute per network address on the
test portal; past that they answer 429.
`;

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('inova Auth Service')
    .setDescription(GUIDE.trim())
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config);
}
