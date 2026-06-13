# Referencia Técnica — Comisaría Digital PNP

Sistema de denuncias policiales digitales para Lima y Callao (49 distritos).
Chatbot conversacional guiado por IA que reemplaza el formulario manual de la
Comisaría Digital PNP.

> Los diagramas C4 de arquitectura AWS se encuentran en [`c4-architecture.md`](./c4-architecture.md).

---

## Tabla de contenidos

1. [Visión general del producto](#1-visión-general-del-producto)
2. [Frontend](#2-frontend)
3. [Backend — API REST](#3-backend--api-rest)
4. [Backend — Lambda Chatbot](#4-backend--lambda-chatbot)
5. [Modelo de datos — DynamoDB](#5-modelo-de-datos--dynamodb)
6. [Integración con Bedrock](#6-integración-con-bedrock)
7. [Resolución de comisaría](#7-resolución-de-comisaría)
8. [Cifrado de datos PII](#8-cifrado-de-datos-pii)
9. [Máquina de estados del chat](#9-máquina-de-estados-del-chat)
10. [Seguridad y costos](#10-seguridad-y-costos)
11. [Infraestructura y despliegue](#11-infraestructura-y-despliegue)

---

## 1. Visión general del producto

### Qué hace

App estilo "WhatsApp Web" donde cada conversación representa una denuncia
policial en proceso. El asistente de IA guía al ciudadano con preguntas en
lenguaje natural hasta completar todos los campos requeridos por el formulario
oficial PNP. Al finalizar, genera un resumen estructurado para el oficial.

### Usuarios

| Rol | Acceso | Capacidades |
|---|---|---|
| **Ciudadano** | URL pública `/` | Inicia denuncia, responde al asistente, confirma y hace seguimiento |
| **Oficial PNP** | URL secreta `/#/oficiales` | Revisa cola de denuncias de su distrito, toma casos, cambia estados, registra objetos encontrados |

### Cobertura geográfica v1

49 distritos: 43 de Lima + 6 de Callao. 125 comisarías.

### Principios de diseño

- **Sin botones para acciones irreversibles** — siempre texto explícito del usuario.
- **Nunca asumir datos no confirmados** — el asistente vuelve a preguntar si falta un campo.
- **Sin PII en texto plano en DynamoDB** — cifrado a nivel de campo antes de escribir.
- **`temperature: 0` en todas las llamadas Bedrock** — respuestas deterministas.

---

## 2. Frontend

### Stack

| Pieza | Decisión |
|---|---|
| Framework | React 18 + Vite |
| Estilos | CSS Modules (sin librerías de UI) |
| Estado | React Context + `useReducer` |
| Routing | Hash routing manual (sin React Router) |
| Backend (actual) | Mock en memoria |

### Rutas

| Hash | Vista |
|---|---|
| `/` | Login ciudadano (DNI + apellidos + nombres + teléfono + correo) |
| `/#/oficiales` | Login oficial PNP (URL no enlazada desde la vista ciudadana) |

### Estructura de componentes

```
src/
├── context/
│   └── AppContext.jsx        ← estado global + todas las acciones
├── data/
│   └── mockData.js           ← seed de chats, mensajes, usuarios, objetos encontrados
├── utils/
│   ├── aiEngine.js           ← motor de IA ficticio: stages, extracción, respuestas
│   └── helpers.js            ← formatTimestamp, getInitials, normalizeText, matchesFoundItem
└── components/
    ├── Login/
    │   ├── Login.jsx          ← formulario ciudadano
    │   └── OfficerLogin.jsx   ← login oficial (clic en tarjeta → acceso directo al mock)
    ├── Citizen/
    │   ├── CitizenView.jsx    ← layout principal ciudadano
    │   ├── CitizenSidebar.jsx ← lista de chats del ciudadano + botón nueva denuncia
    │   └── CitizenChatArea.jsx← conversación + input de texto
    ├── Officer/
    │   ├── OfficerView.jsx    ← layout principal oficial + navegación Denuncias / Obj. Encontrados
    │   ├── OfficerSidebar.jsx ← cola de denuncias (queue/mis casos) + buscador por DNI o N° caso
    │   ├── OfficerChatArea.jsx← conversación + acciones (Tomar caso, cambiar estado, cerrar)
    │   └── ObjetosEncontrados.jsx ← formulario de registro + lista de objetos encontrados
    └── shared/
        ├── StatusBadge.jsx    ← pill de estado con color semántico
        └── TypingIndicator.jsx← animación de "escribiendo..."
```

### Estado global (`AppContext`)

El reducer maneja los siguientes tipos de acción:

| Acción | Efecto |
|---|---|
| `LOGIN` | Establece `currentUser` |
| `LOGOUT` | Reinicia todo el estado al seed inicial |
| `SELECT_CHAT` | Cambia `selectedChatId` y limpia `unreadCount` del usuario activo |
| `ADD_MESSAGE` | Agrega mensaje al chat y actualiza `lastMessagePreview` |
| `UPDATE_CHAT` | Actualiza campos arbitrarios de un chat (status, draft_state, etc.) |
| `SET_TYPING` | Agrega o quita un chatId de `typingChats` |
| `CREATE_NEW_CHAT` | Crea chat nuevo con mensaje de bienvenida |
| `CLAIM_CHAT` | Asigna oficial al chat, cambia status a `in_review`, agrega mensaje de sistema |
| `REGISTER_FOUND_ITEM` | Agrega objeto encontrado y despacha mensajes de notificación a chats coincidentes |

### Buscador de denuncias (oficial)

El `OfficerSidebar` incluye un campo de búsqueda que opera sobre **todos los
chats** (sin filtro de distrito). Coincide con subcadena en:
- `chatId` (ej. `CHAT007`)
- `draft_state.datos_generales.dni` (ej. `45678901`)

Cuando hay consulta activa, los tabs "Denuncias / Mis casos" se ocultan y se
muestra el conteo de resultados. El ícono `×` limpia la búsqueda.

### Motor de IA ficticio (`aiEngine.js`)

Simula en el frontend el flujo de conversación real que en producción corre en
Lambda + Bedrock. Implementa los mismos stages y extrae datos del texto con
heurísticas de expresiones regulares.

---

## 3. Backend — API REST

### Base URL

```
https://api.comisariadigital.gob.pe/v1
```

Servida por API Gateway (REST). Autenticación vía `Authorization: Bearer
<cognito-jwt>` en cada solicitud excepto en el endpoint de login.

### Endpoints

#### Autenticación

```
POST /auth/citizen
POST /auth/officer
POST /auth/refresh
```

**POST /auth/citizen** — Login o registro de ciudadano

Request:
```json
{
  "dni": "45678901",
  "apellido_paterno": "López",
  "apellido_materno": "Fernández",
  "nombres": "María Elena",
  "telefono": "987654321",
  "email": "maria.lopez@gmail.com"
}
```

Response `200`:
```json
{
  "token": "<jwt>",
  "refreshToken": "<refresh-jwt>",
  "userId": "USR001",
  "name": "María Elena",
  "userType": "citizen"
}
```

**POST /auth/officer** — Login de oficial PNP

Request:
```json
{ "badgeId": "PNP-4421", "password": "<hash>" }
```

Response `200`:
```json
{
  "token": "<jwt>",
  "refreshToken": "<refresh-jwt>",
  "officerId": "OFF001",
  "name": "Carlos R.",
  "badge": "PNP-4421",
  "officeDistrict": "Miraflores",
  "officeName": "Comisaría de Miraflores",
  "officeAddress": "Av. José Larco 1302, Miraflores",
  "userType": "officer"
}
```

---

#### Chats (ciudadano)

```
GET    /chats                     ← lista de chats del ciudadano autenticado
POST   /chats                     ← crear nueva denuncia
GET    /chats/{chatId}            ← metadata del chat
GET    /chats/{chatId}/messages   ← mensajes del chat (paginado)
POST   /chats/{chatId}/messages   ← enviar mensaje (ciudadano)
```

**GET /chats** — Devuelve la lista de chats del ciudadano, ordenados por `updatedAt` descendente.

Response `200`:
```json
{
  "chats": [
    {
      "chatId": "CHAT001",
      "status": "pending",
      "lastMessagePreview": "Un oficial revisará tu denuncia...",
      "updatedAt": "2026-06-13T18:00:00Z",
      "unreadCount": 0,
      "modalidad": "robo agravado",
      "distrito_hecho": "San Isidro"
    }
  ]
}
```

**POST /chats** — Crea un chat nuevo en estado `draft`. Responde con el mensaje de bienvenida del asistente.

Response `201`:
```json
{
  "chatId": "CHAT009",
  "status": "draft",
  "messages": [
    {
      "id": "AI-xxxx",
      "senderType": "ai",
      "content": "¡Hola, María Elena! Soy el asistente...",
      "timestamp": "2026-06-13T18:01:00Z",
      "messageType": "ai_response"
    }
  ]
}
```

**POST /chats/{chatId}/messages** — Procesa un mensaje del ciudadano. Lambda corre Call 2
(extracción) y Call 1 (respuesta conversacional) y devuelve la respuesta del
asistente. Si la denuncia queda lista, incluye el `confirmation_prompt`.

Request:
```json
{ "content": "Fue ayer a las 3 de la tarde en el Parque El Olivar" }
```

Response `200`:
```json
{
  "messages": [
    {
      "id": "AI-yyyy",
      "senderType": "ai",
      "content": "Entendido. ¿La dirección exacta sería Parque El Olivar, Av. El Rosario?",
      "timestamp": "2026-06-13T18:02:00Z",
      "messageType": "ai_response"
    }
  ],
  "draft_state_updated": true
}
```

---

#### Cola de oficiales

```
GET  /officer/queue               ← denuncias pending del distrito del oficial
GET  /officer/cases               ← in_review + submitted + fiscalia del oficial
POST /chats/{chatId}/claim        ← tomar un caso (in_review)
PUT  /chats/{chatId}/status       ← cambiar estado (submitted, fiscalia, closed)
POST /chats/{chatId}/messages     ← enviar mensaje como oficial
GET  /chats/{chatId}/summary      ← contenido_formal + resumen_oficial
```

**GET /officer/queue** — Devuelve chats `pending` cuyo `distrito_hecho` coincide con
`officeDistrict` del oficial, ordenados FIFO por `createdAt`.

**POST /chats/{chatId}/claim**

Request: (sin body)

Response `200`:
```json
{ "status": "in_review", "officerId": "OFF001", "officerName": "Carlos R." }
```

Response `409` si ya fue tomado por otro oficial:
```json
{ "error": "CHAT_ALREADY_CLAIMED", "message": "Este caso ya fue tomado." }
```

**PUT /chats/{chatId}/status**

Request:
```json
{
  "status": "closed",
  "reason": "El denunciante no pudo identificar a los autores ni proporcionar más datos."
}
```

Estados válidos para esta operación: `submitted`, `fiscalia`, `closed`.

---

#### Objetos encontrados

```
GET  /found-items                 ← lista de objetos encontrados (todos los distritos)
POST /found-items                 ← registrar objeto encontrado
```

**POST /found-items**

Request:
```json
{
  "tipo": "Billetera/Cartera",
  "descripcion": "Billetera de cuero marrón con iniciales M.L."
}
```

Response `201`:
```json
{
  "id": "FND-xxxx",
  "tipo": "Billetera/Cartera",
  "descripcion": "Billetera de cuero marrón con iniciales M.L.",
  "comisaria_nombre": "Comisaría de Miraflores",
  "comisaria_distrito": "Miraflores",
  "comisaria_direccion": "Av. José Larco 1302, Miraflores",
  "registradoAt": "2026-06-13T18:05:00Z",
  "matched_chats": ["CHAT003"]
}
```

La Lambda busca en todos los chats activos (status ∈ `{draft, pending_confirmation,
pending, in_review}`) cuyo `draft_state.denuncia.especies` contenga un tipo
coincidente y envía un mensaje de notificación a cada ciudadano afectado.

---

#### Búsqueda (oficial)

```
GET /officer/search?q={query}
```

Busca en todos los chats por DNI o por `chatId` (subcadena, case-insensitive).
Sin filtro de distrito. Devuelve hasta 50 resultados ordenados por `updatedAt`
descendente.

---

### Códigos de error comunes

| Código HTTP | `error` | Descripción |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Campo requerido faltante o formato inválido |
| 401 | `UNAUTHORIZED` | Token ausente, inválido o expirado |
| 403 | `FORBIDDEN` | El usuario no tiene permiso sobre este recurso |
| 404 | `NOT_FOUND` | Chat o recurso no encontrado |
| 409 | `CHAT_ALREADY_CLAIMED` | Race condition al tomar un caso |
| 429 | `RATE_LIMITED` | Límite de solicitudes excedido |
| 500 | `INTERNAL_ERROR` | Error inesperado en Lambda |

---

## 4. Backend — Lambda Chatbot

### Punto de entrada: `MessageRouter`

Función Lambda única (`handler.py`). Enruta según el tipo de evento recibido
desde API Gateway:

```
evento.path + evento.httpMethod
├── POST /chats/{chatId}/messages + citizenToken  → ConversationEngine + DataExtractor
├── POST /chats/{chatId}/claim                    → StatusService.claim()
├── PUT  /chats/{chatId}/status                   → StatusService.update()
├── POST /found-items                             → FoundItemsService.register()
└── GET  /officer/search                          → SearchService.query()
```

### Componentes internos

#### `DataExtractor` (Call 2)

Corre **antes** de `ConversationEngine`. Recibe el mensaje del ciudadano y el
`draft_state` actual. Llama a Bedrock con un prompt de extracción estructurada
y devuelve un JSON parcial con los campos detectados. Actualiza el
`draft_state` en DynamoDB (cifrado) solo si hubo cambios.

No toca campos que ya están en el estado — solo agrega o corrige.

#### `ConversationEngine` (Call 1)

Recibe el `draft_state` actualizado por `DataExtractor`. Determina el stage
actual de la conversación y llama a Bedrock para generar la próxima respuesta
en lenguaje natural. Detecta si todos los campos requeridos están completos
para pasar al stage `ready_for_confirmation`.

#### `SummaryGenerator` (Call 3)

Se ejecuta una sola vez en la transición `pending_confirmation → pending`
(cuando el ciudadano escribe "sí"). Recibe el `draft_state` final y genera:
- `contenido_formal`: texto con el formato exacto del formulario oficial PNP.
- `resumen_oficial`: 3–5 oraciones para triage rápido del oficial.

Ambos campos se cifran y se escriben en `CHAT#.../METADATA`.

#### `ComisariaResolver`

Invocado cuando el stage llega a `confirm_comisaria`. Pasos:
1. Llama a `AWS Location Service` con la dirección del hecho para obtener `lat`, `lng` y `municipality` (distrito).
2. Carga `comisarias.json` (bundled en el paquete Lambda, ~125 entradas).
3. Filtra comisarías por `distrito`.
4. Si hay más de una, desempata por distancia haversine al punto geocodificado.
5. Devuelve `comisaria_nombre` y `comisaria_direccion` para mostrar al ciudadano.

#### `EncryptionService`

Wrapper sobre el AWS Encryption SDK para Python. Expone:
- `encrypt(plaintext, context) → str (base64)`
- `decrypt(ciphertext, context) → str`

Cachea el DEK en memoria dentro de la invocación Lambda para minimizar
llamadas a KMS (máximo 1–2 por invocación, no una por campo).

#### `StatusService`

Gestiona todas las transiciones de estado de un chat usando
`TransactWriteItems` de DynamoDB para garantizar consistencia:

1. Actualiza `CHAT#.../METADATA` (`status`, `officerId`, `officerName`, `updatedAt`).
2. Actualiza `USER#.../CHAT#...` del ciudadano y del oficial (cache de inbox).
3. Inserta un mensaje `status_update` en `CHAT#.../MSG#...`.

La operación `claim` incluye `ConditionExpression: status = "pending"` para
prevenir race conditions cuando dos oficiales intentan tomar el mismo caso.

#### `FoundItemsService`

Al registrar un objeto encontrado:
1. Hace `Query` sobre todos los chats con `status ∈ {draft, pending_confirmation, pending, in_review}`.
2. Para cada chat activo, descifra `draft_state` y compara `denuncia.especies[*].tipo` con el tipo del objeto encontrado usando normalización (lowercase + quitar tildes) y matching por subcontención de palabras ≥ 4 caracteres.
3. Por cada coincidencia, inserta un mensaje `ai_response` en el chat del ciudadano con la ubicación del objeto.

---

## 5. Modelo de datos — DynamoDB

**Tabla**: `ReportsTable` (single-table design, on-demand)

Los campos marcados `(enc)` se almacenan como Base64 producido por el
AWS Encryption SDK. El resto son texto plano y pueden usarse en filtros.

### Patrones de acceso y ítems

#### Usuario

```
PK: USER#<userId>   SK: METADATA
─────────────────────────────────
userType: "citizen" | "officer"
name         (enc)
phone        (enc)
email        (enc)
dni                          ← ciudadano; semipúblico dentro del sistema
badge                        ← oficial
officeDistrict               ← oficial
officeName                   ← oficial
createdAt
```

#### Metadata del chat

```
PK: CHAT#<chatId>   SK: METADATA
──────────────────────────────────────────────────
status: draft | pending_confirmation | pending
        in_review | submitted | fiscalia | closed
citizenId
officerId                    ← null hasta que se reclama
officerName      (enc)       ← null hasta que se reclama
createdAt
updatedAt
lastMessagePreview  (enc)
contenido_formal    (enc)    ← null hasta Call 3
resumen_oficial     (enc)    ← null hasta Call 3
draft_state         (enc)    ← JSON completo como blob cifrado

GSI1PK: STATUS#PENDING       ← sparse; solo chats en pending
GSI1SK: <createdAt>          ← ordena la cola FIFO
```

#### Mensajes

```
PK: CHAT#<chatId>   SK: MSG#<ISO-timestamp>#<msgId>
────────────────────────────────────────────────────
senderId
senderType: citizen | officer | ai | system
content      (enc)
messageType: text | ai_response | status_update | confirmation_prompt
metadata: { newStatus, previousStatus, actorName (enc) }   ← solo en status_update
```

#### Cache de inbox por usuario

```
PK: USER#<userId>   SK: CHAT#<chatId>
──────────────────────────────────────
chatStatus
lastUpdated
unreadCount
lastMessagePreview  (enc)
```

### Accesos clave

| Operación | Mecanismo DynamoDB |
|---|---|
| Lista de chats del ciudadano | `Query PK=USER#<id>, SK begins_with CHAT#` |
| Cola de oficiales (FIFO) | `Query GSI1PK=STATUS#PENDING` ordenado por `GSI1SK` asc |
| Mensajes de un chat | `Query PK=CHAT#<id>, SK begins_with MSG#` |
| Tomar caso sin race condition | `TransactWriteItems` con `ConditionExpression: status = "pending"` |
| Búsqueda por DNI | `Scan` con `FilterExpression` sobre el campo dni (no cifrado) |

### `draft_state` — esquema completo

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
      { "tipo": "Celular", "numero": null, "descripcion": "iPhone 14 Pro, negro" }
    ],
    "items_check_complete": false
  }
}
```

**Campos requeridos para completeness check** (lógica pura, sin Bedrock):

```python
REQUIRED = {
    "datos_generales": ["dni", "apellido_paterno", "apellido_materno", "nombres"],
    "datos_domicilio": ["departamento", "provincia", "distrito", "direccion"],
    "datos_hecho":     ["fecha", "hora", "departamento_hecho", "provincia_hecho",
                        "distrito_hecho", "direccion_hecho"],
    "denuncia":        ["modalidad"],
}
# + especies.length >= 1, con tipo no nulo en cada ítem
# + items_check_complete == True
# + datos_hecho.comisaria_confirmed == True
```

---

## 6. Integración con Bedrock

**Modelo**: Llama 3.x (familia más reciente disponible en la región).
**`temperature: 0`, `top_p: 0.5`** en las tres llamadas. Tráfico vía VPC
endpoint (PrivateLink) — sin salir a internet público.

### Call 1 — Guía conversacional

**Propósito**: generar la siguiente respuesta en lenguaje natural para el ciudadano.

**Input al prompt**:
- Stage actual de la conversación.
- `draft_state` completo (campos ya recopilados).
- Último mensaje del ciudadano.
- Fecha y hora actual (para calcular fechas relativas como "ayer").

**Stages en orden**:

| Stage | Pregunta al ciudadano |
|---|---|
| `ask_dni` | DNI |
| `ask_name` | Apellido paterno, materno, nombres |
| `ask_domicilio` | Distrito y dirección de domicilio |
| `ask_incident_time` | Fecha y hora del hecho |
| `ask_incident_place` | Distrito y dirección del hecho |
| `ask_items` | Qué fue robado/perdido; detecta modalidad |
| `ask_item_description` | Descripción del ítem (marca, modelo, color) |
| `ask_more_items` | ¿Hay algo más? → marca `items_check_complete: true` si no |
| `ask_perp_description` | Solo en robo agravado: altura, complexión, ropa del autor |
| `confirm_comisaria` | Muestra comisaría asignada y pide confirmación |
| `ready_for_confirmation` | Muestra resumen completo y solicita "sí"/"no" |

**Reglas críticas del prompt**:
- Nunca asumir departamento/provincia de una dirección parcial.
- Si falta solo el distrito o solo la hora, volver a preguntar ese campo específico.
- Para fechas relativas ("ayer", "anoche"), calcular la fecha exacta y mostrarla al ciudadano para confirmación explícita.

### Call 2 — Extracción de datos (JSON)

**Propósito**: extraer campos estructurados del mensaje del ciudadano y
devolver solo los campos detectados con certeza.

**Output esperado** (solo campos presentes en el mensaje):
```json
{
  "datos_generales": { "dni": "45678901" },
  "datos_hecho": { "fecha": "2026-06-12", "hora": "15:00" }
}
```

**Reglas críticas del prompt**:
- Devolver `null` ante cualquier duda.
- Nunca inferir campos no mencionados explícitamente.
- Detectar negativa a "¿algo más?" y marcar `items_check_complete: true`.
- No modificar campos que ya tienen valor en el estado previo.

### Call 3 — Resumen para el oficial

**Propósito**: generar el documento de denuncia y el resumen para triage.

**Output**:
```json
{
  "contenido_formal": "DENUNCIA POLICIAL\n\nDenunciante: María Elena López...",
  "resumen_oficial": "Ciudadana reporta robo agravado en Parque El Olivar..."
}
```

**Reglas críticas del prompt**:
- Sin juicios legales ni inferencias.
- Sin completar campos que estén en `null`.
- Incluir `descripcion_autor` en `resumen_oficial` si fue provista.
- `contenido_formal` debe seguir el formato exacto del formulario oficial PNP.

### Confirmación de envío

El ciudadano debe escribir `"sí"` o `"si"` (match exacto tras normalizar:
lowercase + quitar tildes). No se usa un botón. Si escribe otra cosa, el
asistente reitera la solicitud de confirmación.

---

## 7. Resolución de comisaría

### Flujo

```
dirección del hecho (texto libre)
    ↓
AWS Location Service — SearchPlaceIndexForText
    ↓
{ lat, lng, municipality (distrito) }
    ↓
comisarias.json — filtrar por distrito
    ↓
Si hay 1  → esa comisaría
Si hay >1 → desempate por distancia haversine(lat, lng, com.lat, com.lng)
    ↓
{ comisaria_nombre, comisaria_direccion }
    ↓
Mostrar al ciudadano para confirmación explícita
```

### Dataset `comisarias.json`

Generado con tres scripts:
- `scrape_comisarias.py` — extrae datos de deperu.com.
- `clean_comisarias.py` — normaliza nombres y distritos.
- `geocode_comisarias.py` — agrega `lat`/`lng` vía Location Service.

Bundled en el paquete Lambda. Estructura de cada entrada:

```json
{
  "id": "COM042",
  "nombre": "Comisaría de Miraflores",
  "distrito": "Miraflores",
  "direccion": "Av. José Larco 1302, Miraflores",
  "lat": -12.1219,
  "lng": -77.0294
}
```

---

## 8. Cifrado de datos PII

### Estrategia: cifrado a nivel de campo en Lambda

DynamoDB SSE-KMS protege el disco pero no el acceso con credenciales AWS
comprometidas. El cifrado a nivel de campo en Lambda garantiza que los datos
PII **nunca llegan a DynamoDB en texto plano**, incluso para un atacante con
acceso directo a la tabla.

### Herramienta

**AWS Encryption SDK para Python** + **KMS CMK dedicado** (Customer Managed
Key exclusivo del proyecto).

```
Lambda (PII en plaintext)
  → SDK.encrypt(plaintext, encryption_context)
      → KMS: GenerateDataKey → DEK en claro + DEK cifrada con CMK
      → cifra plaintext con DEK en memoria (AES-GCM)
      → devuelve mensaje SDK (DEK cifrada + ciphertext)
  → DynamoDB: almacena como string Base64
```

El SDK gestiona **envelope encryption** automáticamente. Los DEK se cachean
en memoria por invocación: máximo 1–2 llamadas a KMS por invocación,
independientemente del número de campos cifrados.

### Campos cifrados por ítem

| Ítem | Campos cifrados |
|---|---|
| `USER#.../METADATA` | `name`, `phone`, `email` |
| `CHAT#.../METADATA` | `officerName`, `lastMessagePreview`, `contenido_formal`, `resumen_oficial`, `draft_state` (blob JSON completo) |
| `CHAT#.../MSG#...` | `content`, `metadata.actorName` |
| `USER#.../CHAT#...` | `lastMessagePreview` |

`draft_state` se cifra como un único blob JSON serializado porque siempre se
lee y escribe completo.

### Encryption context

Cada cifrado incluye contexto que vincula criptográficamente el ciphertext a
su propietario. KMS registra este contexto en CloudTrail.

```python
# Campos de usuario
ctx = {"userId": user_id, "field": field_name, "purpose": "pii"}

# Campos de chat o mensaje
ctx = {"chatId": chat_id, "field": field_name, "purpose": "pii"}
```

Un ciphertext de `userId=USR001` no puede descifrarse presentándolo como de
`USR002` — el SDK rechazará la operación.

### Política del CMK

```json
{
  "Effect": "Allow",
  "Principal": { "AWS": "arn:aws:iam::<account>:role/LambdaExecutionRole" },
  "Action": ["kms:GenerateDataKey", "kms:Decrypt"],
  "Resource": "*"
}
```

Ningún otro principal (incluido el administrador de la cuenta) tiene
`kms:Decrypt` sin modificar explícitamente esta política.

### Lo que NO se cifra (y por qué)

| Campo | Razón |
|---|---|
| `status`, `chatId`, `userId` | Claves de acceso y GSI; cifrarlos rompería las queries |
| `createdAt`, `updatedAt` | Metadatos operativos sin PII |
| `messageType`, `senderType` | Enumeraciones sin PII |
| `dni` | Identificador de negocio; necesario para búsqueda y correlación policial |
| Mensajes `ai_response` / `status_update` | Generados por el sistema, sin texto del ciudadano |

---

## 9. Máquina de estados del chat

```
draft
  │  (ciudadano confirma: "sí")
  ↓
pending_confirmation
  │  (ciudadano escribe "sí"/"si" — match exacto normalizado)
  ↓
pending  ──────────────────────────────────────────────────┐
  │  (oficial: Tomar caso)                                  │
  ↓                                                         │
in_review ────────────────────────────────────────────┐    │
  │  (oficial: Marcar como procesada)                  │    │  closed
  ↓                                                    │    │  (desde in_review
submitted                                             closed  con motivo)
  │  (oficial: Enviar a Fiscalía)
  ↓
fiscalia
  [fin]
```

### Display por estado

| Status interno | Label visible | Color |
|---|---|---|
| `pending` | Pendiente | Naranja |
| `in_review` | Asignada | Morado |
| `submitted` | Procesada | Verde |
| `fiscalia` | Fiscalía | Azul |
| `closed` | Cerrada | Gris |

### GSI1 (cola de oficiales)

Solo los chats con `status = "pending"` tienen `GSI1PK = STATUS#PENDING` (sparse index).
Al pasar a otro estado, se elimina el atributo `GSI1PK` del ítem para que
desaparezca de la cola automáticamente.

### Mensaje automático al ciudadano en cada transición

| Transición | Mensaje |
|---|---|
| `pending_confirmation → pending` | "Denuncia enviada exitosamente. Tu número de caso es #CHATXXX." |
| `pending → in_review` | "Tu denuncia fue recibida por Carlos R. Estado: En revisión." |
| `in_review → submitted` | "Tu denuncia fue marcada como procesada por Carlos R." |
| `in_review → closed` | "Tu denuncia fue cerrada por Carlos R." |
| `submitted → fiscalia` | "Oficio enviado a la Fiscalía, código: OF-2026-NNNNN" |

---

## 10. Seguridad y costos

### Capas de seguridad

| Capa | Mecanismo |
|---|---|
| Red | CloudFront + WAF con rate-based rules por IP |
| API | API Gateway throttling + usage plans |
| Autenticación | Amazon Cognito (JWT). URL de oficiales no enlazada públicamente |
| Autorización | Lambda valida que el `citizenId`/`officerId` del token coincide con el recurso |
| Datos en tránsito | HTTPS en todos los saltos; Bedrock/DynamoDB/KMS vía VPC endpoint (sin internet) |
| Datos en reposo | Cifrado a nivel de campo (AWS Encryption SDK + KMS CMK) |
| Compute | Lambda con reserved concurrency baja (5–10 instancias) |
| Observabilidad | CloudWatch Logs sin acceso al CMK → los logs nunca exponen PII |
| Auditoría | CloudTrail registra cada operación KMS con encryption context por ciudadano |

### Estimación de costos (tráfico bajo, v1)

| Servicio | Escenario | Costo estimado/mes |
|---|---|---|
| CloudFront + S3 | < 1 GB transferencia | < $1 |
| API Gateway | 10 000 requests | ~$0.04 |
| Lambda | 10 000 invocaciones × 500 ms × 256 MB | ~$0.03 |
| DynamoDB on-demand | 50 000 R/W | ~$0.25 |
| Amazon Bedrock (Llama) | 3 calls × 10 000 turnos × ~2 000 tokens | ~$6–30 |
| AWS Location Service | 10 000 geocodificaciones | ~$4 |
| KMS | ~20 000 API calls (con DEK caching) | ~$0.06 |
| Cognito | < 50 000 MAU | Gratis (Free Tier) |
| **Total estimado** | | **~$13–41 / mes** |

AWS Budgets con alertas en $5 / $10 / $20 para detección temprana de anomalías.

---

## 11. Infraestructura y despliegue

### Infraestructura como código

Recomendado: **AWS CDK (Python)** o **Terraform**. Recursos a definir:

- S3 bucket (SPA) + CloudFront distribution + OAC
- WAF WebACL con rate-based rule (500 req/5 min por IP)
- API Gateway REST API + stages + usage plans
- Cognito User Pool (ciudadanos) + User Pool (oficiales, con atributo `badge`)
- Lambda function (Python 3.12, VPC, reserved concurrency 10)
- DynamoDB table (`ReportsTable`) + GSI1 (`STATUS#PENDING`)
- KMS CMK con política restringida al rol Lambda
- VPC con subnets privadas + VPC endpoints para DynamoDB, KMS, Bedrock, Location
- IAM role para Lambda con least-privilege

### Pipeline CI/CD

```
git push main
  → GitHub Actions
      → Tests unitarios (pytest)
      → Build frontend (npm run build)
      → Deploy S3 + invalidar CloudFront cache
      → Deploy Lambda (zip + publish)
      → Smoke test (curl /health)
```

### Variables de entorno Lambda

```
TABLE_NAME=ReportsTable
KMS_KEY_ID=arn:aws:kms:<region>:<account>:key/<id>
BEDROCK_MODEL_ID=us.meta.llama3-...
LOCATION_INDEX_NAME=ComisariaDigitalPlaceIndex
COMISARIAS_FILE_PATH=/var/task/comisarias.json
```

### Consideraciones de despliegue de la SPA

El frontend se construye con `npm run build` y se sube a S3. CloudFront sirve
todos los paths desconocidos redirigiendo a `index.html` (regla de error 403/404
→ `index.html`, status 200) para soportar el hash routing.

La URL `/#/oficiales` no debe aparecer en ningún enlace público ni en el
`robots.txt`. No es un mecanismo de seguridad suficiente por sí solo — la
autenticación real la provee Cognito.
