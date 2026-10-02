import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

export function applyGlobalPrefix(app: INestApplication): void {
  app.setGlobalPrefix('v1');
}

/**
 * The guide at the top of the published document (/api/docs on the test
 * portal) — written for the developers of the resident app.
 */
const GUIDE = `
The core API: buildings, properties, residents and everything built on them.
The answers of the resident routes (\`/me/*\`) and the brand configuration are
TypeScript types in \`@inova/shared\` (\`MyProperty\`, \`MyPropertyDetail\`,
\`BuildingContacts\`, \`OccupantRecord\`, \`PetRecord\`, \`MyLinkRequest\`, \`MyDevice\`,
\`BrandConfig\`, \`ApiError\`) — import them rather than copying.

**Test portal:** \`https://test-portal.whitenova.tech/api/v1\`. Signing in
happens at auth-service — its own document at \`/auth/docs\` explains it and
lists the test accounts.

## Every call

\`\`\`
Authorization: Bearer <accessToken from auth-service>
X-Tenant-Id:   <memberships[0].t from the same session>
\`\`\`

The organisation in \`X-Tenant-Id\` must be the one the token was issued for;
anything else is 403. On 401 the access token has expired: refresh it at
auth-service and repeat the call once.

## What the resident app reads

| Screen | Call |
| --- | --- |
| Start: the properties to choose from | \`GET /me/properties\` |
| «Моята сграда», the profile | \`GET /me/properties/{id}\` — building, bank account, household, pets |
| «Контакти» | \`GET /me/properties/{id}/contacts\` |
| Add a household member / a pet | \`POST /me/properties/{id}/occupants\`, \`POST /me/properties/{id}/pets\` |
| «Добави моя имот» | \`POST /me/link-requests\`, \`GET /me/link-requests\`, \`POST /me/link-requests/{id}/withdraw\` |
| Notifications later reach this phone | \`PUT /me/devices\` after sign-in and on every start; \`DELETE /me/devices/{id}\` before sign-out |
| Theme, locales, support | \`GET /brands/{key}/config\` — public, no token |

Show owner-only actions only when \`ownerActions\` is true; the server refuses
them to tenants and occupants anyway. A property the resident does not live in
answers 404, exactly like one that does not exist.

## Conventions

- Days are \`YYYY-MM-DD\` (\`validFrom\`, \`validTo\`); \`validTo\` is the last day
  that counts, \`null\` while it lasts. Moments are ISO timestamps in UTC.
- Ids are UUIDs.
- Every error has the body \`ApiError\`: \`{ statusCode, message, error }\`;
  \`message\` lists the broken fields on a 400.

The staff routes (buildings, imports, requests, roles) are documented here too;
their answers are described as the admin screens need them.
`;

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('inova Core API')
    .setDescription(GUIDE.trim())
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config);
}
