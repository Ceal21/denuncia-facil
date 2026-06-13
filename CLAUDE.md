# CLAUDE.md

Contexto del proyecto para Claude Code. Este archivo resume las decisiones
de arquitectura tomadas hasta ahora para el chatbot de denuncias policiales
(PNP - Comisaría Digital, Lima/Callao). Léelo antes de generar código para
mantener consistencia con las decisiones ya tomadas.

## Resumen del producto

App tipo "WhatsApp Web" donde cada chat representa una denuncia policial en
proceso. Dos tipos de usuario: **ciudadano** y **oficial**. Un asistente de
IA (Bedrock) guía al ciudadano en una conversación natural para completar
los campos requeridos por el formulario oficial de Comisaría Digital PNP,
y genera al final un resumen formateado para el oficial.

- Idioma de la interfaz y del asistente: **español (Perú)**.
- Cobertura geográfica v1: **Lima y Callao** (49 distritos).
- Prioridad: bajo costo mensual, sin sacrificar privacidad de datos
  sensibles (denuncias contienen DNI, direcciones, etc.).

## Frontend (mock)

Stack: **React 18 + Vite + CSS Modules**. Sin librerías de UI. Sin backend
real — todo el estado vive en memoria vía React Context (`useReducer`).

```
frontend/
├── src/
│   ├── context/AppContext.jsx   ← estado global + acciones
│   ├── data/mockData.js         ← seed data (chats, mensajes, usuarios)
│   ├── utils/aiEngine.js        ← motor de IA ficticio (stages + extracción)
│   ├── utils/helpers.js         ← formatTimestamp, calculateProgress, etc.
│   └── components/
│       ├── Login/               ← formulario ciudadano + OfficerLogin
│       ├── Citizen/             ← CitizenView, CitizenSidebar, CitizenChatArea
│       ├── Officer/             ← OfficerView, OfficerSidebar, OfficerChatArea
│       └── shared/              ← StatusBadge, TypingIndicator
```

### Rutas (hash routing, sin React Router)

- `/` → login ciudadano (formulario con DNI, apellidos, nombres, teléfono, correo)
- `/#/oficiales` → login oficial PNP (URL secreta, sin enlace desde la vista ciudadana)

### Usuarios mock

```js
MOCK_USERS = {
  citizen: { id: 'USR001', dni: '45678901', nombres: 'María Elena',
             apellido_paterno: 'López', apellido_materno: 'Fernández',
             phone: '987654321', email: 'maria.lopez@gmail.com' },
  officer: { id: 'OFF001', name: 'Carlos R.', badge: 'PNP-4421',
             officeDistrict: 'Miraflores',
             officeName: 'Comisaría de Miraflores' }
}
```

`loginCitizen(formData)`: si el DNI coincide con el usuario seed, carga sus
chats existentes; si no, crea un nuevo ciudadano con chats vacíos.

### Filtro de cola de oficiales

El sidebar del oficial filtra por `datos_hecho.distrito_hecho ===
currentUser.officeDistrict`. Casos en otros distritos son invisibles para
ese oficial.

### Chats seed

| Chat | Status | Ciudadano | Modalidad | Distrito hecho |
|------|--------|-----------|-----------|----------------|
| CHAT001 | pending | María López | robo agravado | San Isidro |
| CHAT003 | fiscalia (Carlos R.) | María López | hurto | Miraflores |
| CHAT004 | pending | Carlos Mendoza | robo agravado | Miraflores |
| CHAT005 | pending | Rosa Sánchez | hurto | Miraflores |
| CHAT006 | pending | Luis Vargas | estafa | Lince |
| CHAT007 | in_review (Carlos R.) | Ana Torres | robo agravado | Miraflores |

## Objetos Encontrados

Sub-vista del oficial accesible desde la navegación del sidebar (botón
"Obj. Encontrados"). Permite a un oficial registrar objetos hallados en su
comisaría y notifica automáticamente a los ciudadanos con denuncias que
incluyan ese tipo de objeto, sin importar el distrito.

### Flujo

1. Oficial abre "Objetos Encontrados" desde el sidebar.
2. Completa el formulario: tipo (ej: "Billetera/Cartera"), descripción.
   La comisaría se auto-rellena con el perfil del oficial.
3. Al registrar, el sistema busca en **todos** los chats cuya
   `draft_state.denuncia.especies` contenga un tipo coincidente.
4. Por cada coincidencia, envía un mensaje de tipo `ai_response` al chat
   del ciudadano con la ubicación del objeto y la comisaría.

### Matching (mock)

Normalización: lowercase + quitar tildes + trim. Coincidencia si:
- Los tipos son iguales, o uno contiene al otro.
- Alguna palabra del tipo hallado (≥ 4 chars) aparece en el tipo denunciado.

### Datos seed

`INITIAL_FOUND_ITEMS` (mockData.js): FOUND001 — Billetera/Cartera encontrada
en Comisaría de Lince por Roberto M. (ago 30 min), coincidió con CHAT003.
MSG003-25 en CHAT003 simula el mensaje de notificación enviado al ciudadano.

### Mock officer

`MOCK_USERS.officer` tiene `officeAddress` para auto-rellenar la dirección
en el mensaje de notificación y en el formulario.

### Backend futuro

Al registrar: PUT `/found-items` → Lambda → escanea GSI por `modalidad` +
`tipo` en `draft_state` → EventBridge event → Lambda de notificación →
escribe mensajes en DynamoDB → WebSocket push al ciudadano.

## Stack / Arquitectura AWS (producción futura)

```
Usuario -> CloudFront (S3 static site)
            -> API Gateway (REST) [throttling + WAF]
              -> Lambda (lógica del chatbot)
                -> AWS KMS CMK  (cifrado/descifrado de campos PII)
                -> Amazon Bedrock (vía VPC endpoint / PrivateLink)
                -> DynamoDB (single-table design, campos PII cifrados)
                -> AWS Location Service (geocoding)
```

- **Bedrock**: modelo Llama (familia 3.x), `temperature: 0` SIEMPRE en las
  tres llamadas del flujo (ver sección "Arquitectura de prompts").
  Tráfico vía VPC endpoint para mantener todo dentro de la red AWS.
- **DynamoDB**: on-demand, single table, diseño descrito abajo. Los campos
  PII se almacenan como texto cifrado (ver sección "Cifrado de datos").
- **AWS KMS**: Customer Managed Key (CMK) dedicado al proyecto. La Lambda
  es el único principal con `kms:Encrypt` y `kms:Decrypt`. Ningún otro
  servicio (ni CloudWatch Logs) tiene acceso al CMK.
- **AWS Location Service**: usado para geocodificar (a) la dirección del
  ciudadano y (b) la dirección de cada comisaría (dataset precargado).
- **Throttling/seguridad**: API Gateway throttling + usage plans, WAF con
  rate-based rules, Lambda con reserved concurrency, AWS Budgets con
  alertas.
- **Confirmación de envío**: el ciudadano debe escribir "sí"/"si"
  (match exacto tras normalizar - lowercase + quitar tildes) para pasar
  de `pending_confirmation` a `pending`. NO se usa un botón de submit.

## Esquema DynamoDB (single table: `ReportsTable`)

Los campos marcados con `(enc)` se almacenan como texto cifrado en Base64
producido por la AWS Encryption SDK en Lambda (ver sección "Cifrado de
datos"). El resto son texto plano y pueden usarse en condiciones/filtros
de DynamoDB directamente.

```
# Usuario
PK: USER#<userId>      SK: METADATA
  userType: "citizen" | "officer"
  name        (enc)
  phone       (enc)
  email       (enc)
  createdAt

# Metadata del chat/reporte
PK: CHAT#<chatId>       SK: METADATA
  status: "draft" | "pending_confirmation" | "pending" | "in_review"
          | "submitted" | "fiscalia" | "closed"
  citizenId: <id>
  officerId: null hasta que se reclama
  officerName: null hasta que se reclama   (enc)
  createdAt, updatedAt
  lastMessagePreview   (enc)
  contenido_formal     (enc) -- null hasta confirmación (Call 3)
  resumen_oficial      (enc) -- null hasta confirmación (Call 3)
  draft_state          (enc) -- JSON completo cifrado como blob
  GSI1PK: STATUS#PENDING  <- denuncias pendientes (sparse)
  GSI1SK: createdAt (timestamp de entrada a "pending")

# Mensajes dentro de un chat
PK: CHAT#<chatId>       SK: MSG#<ISO timestamp>#<msgId>
  senderId, senderType: "citizen" | "officer" | "ai" | "system"
  content      (enc)
  messageType: "text" | "ai_response" | "status_update"
               | "confirmation_prompt"
  metadata: { newStatus, previousStatus, actorName } -- solo para
            status_update; actorName (enc)

# Lista de chats por usuario (vista "inbox")
PK: USER#<userId>       SK: CHAT#<chatId>
  chatStatus, lastUpdated, unreadCount
  lastMessagePreview   (enc)
```

### Notas de acceso

- **Cola de oficiales (FIFO)**: query sobre GSI1, `GSI1PK = STATUS#PENDING`,
  ordenado por `GSI1SK` (createdAt) ascendente; filtrar por `officeDistrict`
  del oficial (campo en su perfil de usuario).
- **Tomar un caso**: `TransactWriteItems` con `ConditionExpression:
  status = "pending"`. Si falla, el reporte ya fue tomado por otro oficial.
- **Cambios de estado**: siempre en una sola transacción que actualiza (1)
  `CHAT#.../METADATA`, (2) los items `USER#.../CHAT#...` de citizen y
  officer, y (3) inserta un mensaje `status_update`.
- Drafts (`draft`, `pending_confirmation`) NUNCA aparecen en GSI1.

## Cifrado de datos sensibles

### Estrategia: cifrado en la capa de aplicación (client-side encryption)

El cifrado en reposo nativo de DynamoDB (SSE-S3/KMS) protege el disco pero
no protege frente a accesos con credenciales AWS comprometidas ni frente a
acceso directo a la tabla por otros roles. Por eso se usa **cifrado a nivel
de campo en Lambda** antes de escribir en DynamoDB: los datos sensibles
nunca llegan a la tabla en texto plano.

### Herramienta: AWS Encryption SDK para Python + KMS CMK

```
Lambda (plaintext PII)
  -> AWS Encryption SDK .encrypt(plaintext, encryption_context)
     -> KMS CMK: genera o reutiliza DEK (Data Encryption Key)
     -> cifra DEK con CMK → DEK cifrada
     -> cifra plaintext con DEK en memoria → ciphertext
     -> devuelve mensaje Encryption SDK (DEK cifrada + ciphertext)
  -> DynamoDB: almacena mensaje como string Base64
```

El SDK gestiona automáticamente el **cifrado de sobre (envelope
encryption)**. Los DEK se cachean en memoria dentro de la invocación
Lambda para no llamar a KMS en cada campo.

### Campos PII cifrados

| Ítem DynamoDB | Campos cifrados |
|---|---|
| `USER#.../METADATA` | `name`, `phone`, `email` |
| `CHAT#.../METADATA` | `officerName`, `lastMessagePreview`, `contenido_formal`, `resumen_oficial`, `draft_state` (blob completo) |
| `CHAT#.../MSG#...` | `content`, `metadata.actorName` |
| `USER#.../CHAT#...` | `lastMessagePreview` |

`draft_state` se cifra como un solo blob JSON serializado, no campo a
campo, porque siempre se lee y escribe completo.

El `dni` **no** se cifra: es el identificador de negocio del ciudadano y
puede ser necesario para correlación en investigación policial. Se trata
como dato semipúblico dentro del sistema (acceso solo para oficiales del
caso y sistemas autorizados), no como secreto.

### Encryption context (vinculación criptográfica)

Cada llamada al SDK incluye un `encryption_context` que liga el ciphertext
a su propietario. KMS registra este contexto en CloudTrail, lo que permite
auditar accesos por ciudadano/chat.

```python
# Para campos del usuario
ctx = {"userId": user_id, "field": field_name, "purpose": "pii"}

# Para campos del chat / mensajes
ctx = {"chatId": chat_id, "field": field_name, "purpose": "pii"}
```

Un ciphertext generado con `userId=USR001` no puede descifrarse
presentándolo como si perteneciera a `USR002`.

### Política del CMK

```json
{
  "Effect": "Allow",
  "Principal": { "AWS": "arn:aws:iam::<account>:role/LambdaExecutionRole" },
  "Action": ["kms:GenerateDataKey", "kms:Decrypt"],
  "Resource": "*"
}
```

Ningún otro rol (incluyendo el rol de administrador de la cuenta) tiene
`kms:Decrypt` sobre este CMK sin una modificación explícita de la política.
Esto protege los datos incluso si las credenciales de la cuenta raíz se ven
comprometidas.

### Rotación de claves

KMS soporta rotación automática anual del CMK. Los mensajes cifrados con
versiones anteriores del CMK siguen siendo descifrables (KMS guarda el
historial de versiones); solo los nuevos cifrados usan la nueva versión.

### Impacto en costos

KMS cobra $0.03 por cada 10 000 llamadas a la API. Con DEK caching dentro
de cada invocación Lambda, el número de llamadas a KMS es ~1–2 por
invocación (una para cifrar, una para descifrar), no una por campo. El
impacto en el costo estimado mensual es < $1.

### Lo que NO se cifra (y por qué)

| Campo | Razón |
|---|---|
| `status`, `chatId`, `userId` | Claves de acceso y GSI; cifrarlos rompería las queries |
| `createdAt`, `updatedAt` | Metadatos operativos sin PII |
| `messageType`, `senderType` | Enumeraciones sin PII |
| Mensajes de tipo `ai_response` / `status_update` | Generados por el sistema, sin texto del ciudadano; cifrarlos es opcional |
| `dni` | Identificador de negocio, accesible solo a roles autorizados |

## Esquema de datos de la denuncia (`draft_state`)

```json
{
  "datos_generales": {
    "dni": null,
    "apellido_paterno": null,
    "apellido_materno": null,
    "nombres": null,
    "telefono_celular": null,
    "correo": null
  },
  "datos_domicilio": {
    "departamento": null,
    "provincia": null,
    "distrito": null,
    "direccion": null,
    "ocupacion": null
  },
  "datos_hecho": {
    "fecha": null,
    "hora": null,
    "departamento_hecho": null,
    "provincia_hecho": null,
    "distrito_hecho": null,
    "direccion_hecho": null,
    "comisaria_nombre": null,
    "comisaria_direccion": null,
    "comisaria_confirmed": false,
    "descripcion_autor": null
  },
  "denuncia": {
    "modalidad": null,
    "especies": [
      { "tipo": "...", "numero": null, "descripcion": null }
    ],
    "items_check_complete": false
  }
}
```

### Campos requeridos (completeness check)

```javascript
const REQUIRED_FIELDS = {
  datos_generales: ['dni', 'apellido_paterno', 'apellido_materno', 'nombres'],
  // telefono_celular, correo: opcionales
  datos_domicilio: ['departamento', 'provincia', 'distrito', 'direccion'],
  // ocupacion: opcional
  datos_hecho: ['fecha', 'hora', 'departamento_hecho', 'provincia_hecho',
                 'distrito_hecho', 'direccion_hecho'],
  denuncia: ['modalidad']
  // + especies.length >= 1, cada item con 'tipo'
  // + items_check_complete === true
  // + datos_hecho.comisaria_confirmed === true
};
```

`descripcion` en `especies` y `descripcion_autor` NUNCA son requeridos.
La verificación es lógica pura en Lambda - sin llamadas a Bedrock.

## Arquitectura de prompts (Bedrock)

Tres llamadas separadas, todas con `temperature: 0` (y `top_p` bajo, ej.
0.5). NUNCA combinar conversación + extracción en una sola llamada.

### Call 1 - Guía conversacional (voz hacia el ciudadano)

Stages de conversación en orden:

1. `ask_dni` — pide DNI
2. `ask_name` — pide apellido paterno, materno y nombres
3. `ask_domicilio` — pide distrito y dirección de domicilio. Si el usuario
   da la dirección pero no el distrito, re-pregunta específicamente por el
   distrito (sin asumir).
4. `ask_incident_time` — pide fecha y hora del incidente. Si uno de los dos
   falta tras la respuesta, re-pregunta solo el campo faltante.
5. `ask_incident_place` — pide distrito y dirección del hecho. Mismo
   comportamiento de re-pregunta si falta el distrito.
6. `ask_items` — pide qué fue robado/perdido; detecta modalidad.
7. `ask_item_description` — (**nuevo**) después de cada ítem registrado,
   pide descripción (marca, modelo, color). Se repite por cada ítem nuevo.
   Solo avanza cuando `descripcion !== null`.
8. `ask_more_items` — pregunta si hay algo más; si responde negativamente
   marca `items_check_complete: true`.
9. `ask_perp_description` — (**nuevo, solo robo agravado**) pide descripción
   del autor: altura, complexión, ropa. Si el ciudadano no recuerda, acepta
   cualquier respuesta y avanza. No aplica para hurto ni estafa.
10. `confirm_comisaria` — muestra la comisaría asignada y pide confirmación.
11. `ready_for_confirmation` — muestra resumen completo y pide "sí"/"no".

- REGLA CRÍTICA: nunca asumir datos no confirmados explícitamente.
- Para fechas relativas ("ayer", "anoche"), calcula la fecha exacta y la
  muestra al ciudadano para confirmación explícita.

### Call 2 - Extracción silenciosa (JSON)

- Corre después de cada mensaje del ciudadano, antes de Call 1.
- Devuelve SOLO JSON con los campos identificados/actualizados.
- Detecta respuestas negativas a "¿algo más?" y marca
  `items_check_complete: true`.
- REGLA CRÍTICA: usar `null` ante cualquier duda. Nunca inferir
  departamento/provincia/distrito de una dirección parcial.

### Call 3 - Resumen para el oficial (post-confirmación)

- Corre una sola vez, en la transición `pending_confirmation -> pending`.
- Devuelve JSON: `{ "contenido_formal": "...", "resumen_oficial": "..." }`.
- `contenido_formal`: formato exacto del formulario oficial PNP.
- `resumen_oficial`: 3-5 oraciones para triage rápido. Puede incluir
  `descripcion_autor` si fue provista.
- REGLA CRÍTICA: sin juicios legales, sin inferencias, sin texto para
  campos vacíos.

## Confirmación de "matching" de comisaría

- Geocoding de la dirección del hecho vía AWS Location Service →
  `distrito` (Municipality), `lat`/`lng`.
- Lookup en dataset propio `comisarias.json` (bundled con la Lambda):
  - Filtrar comisarías por `distrito` (jurisdicción administrativa).
  - Si hay 1 sola → esa.
  - Si hay >1 → desempate por distancia haversine.
- El ciudadano DEBE confirmar la comisaría (`comisaria_confirmed: true`).

### Dataset de comisarías

- Generado desde deperu.com. Scripts: `scrape_comisarias.py`,
  `clean_comisarias.py`, `geocode_comisarias.py`.
- Formato final `comisarias.json` — ver versión anterior del CLAUDE.md.
- Cobertura: 49 distritos (43 Lima + 6 Callao), 125 comisarías.

## Seguridad y costos

- **Throttling**: API Gateway rate/burst limits + usage plans (Cognito).
  Lambda con reserved concurrency baja (5-10).
- **WAF**: rate-based rules sobre API Gateway.
- **Cifrado PII**: campos sensibles cifrados en Lambda antes de escribir
  a DynamoDB vía AWS Encryption SDK + KMS CMK dedicado (ver sección
  "Cifrado de datos sensibles"). El CMK solo es accesible por el rol
  de ejecución Lambda.
- **Límites de costo**: AWS Budgets con alertas en $5/$10/$20.
- **Privacidad**: tráfico a Bedrock vía VPC endpoint (PrivateLink).
  Logging de invocaciones deshabilitado o con acceso muy restringido.
  CloudWatch Logs no tiene acceso al CMK → los logs nunca exponen PII.
- **Costo estimado v1** (tráfico bajo): ~$13-41/mes total (incluye
  impacto marginal de KMS < $1/mes).

## Convenciones generales

- Todo el contenido visible al usuario en español de Perú, tono cercano
  y no burocrático.
- Nunca usar botones para acciones irreversibles — siempre texto explícito.
- Botón "Nueva denuncia" se deshabilita si el ciudadano ya tiene un chat
  con `status: "draft"` (solo puede haber un borrador activo a la vez).
- Cualquier dato mostrado al ciudadano para confirmación debe presentarse
  de forma explícita, nunca asumido silenciosamente.
- Nombres de oficiales en formato "Nombre Inicial." (ej: Carlos R.) —
  nunca rango + apellido completo en la UI.
- Acción de tomar un caso: "Tomar caso" (no "Reclamar denuncia").
- Mensaje de asignación: "Tu denuncia fue recibida por [nombre]. Estado: En revisión."
- Estados visibles (display): Pendiente, Asignada, Procesada, Fiscalía, Cerrada.
- Flujo de estados: pending → in_review (Tomar caso) → submitted (Marcar como procesada) → fiscalia (Enviar a Fiscalía) → [fin].
- `closed` se puede disparar desde `in_review` con motivo de cierre.
- "Mis casos" del oficial incluye: in_review, submitted, fiscalia.
