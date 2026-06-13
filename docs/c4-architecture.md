# Arquitectura C4 — Comisaría Digital PNP

Diagramas C4 (Context → Container → Component) de los servicios AWS
involucrados en el chatbot de denuncias policiales para Lima y Callao.

---

## Nivel 1 — Contexto del sistema

```mermaid
%%{init: {"layout": "elk"}}%%
C4Context
    title Contexto del sistema: Comisaría Digital PNP

    Person(ciudadano, "Ciudadano", "Registra denuncias desde cualquier dispositivo con acceso web")
    Person(oficial, "Oficial PNP", "Revisa, toma y procesa denuncias. Registra objetos encontrados.")

    System_Boundary(b, "Comisaría Digital PNP") {
        System(app, "Comisaría Digital", "Chatbot de denuncias policiales vía web para Lima y Callao (49 distritos)")
    }

    System_Ext(fiscalia, "Fiscalía del Ministerio Público", "Recibe oficios de denuncias procesadas (código OF-YYYY-NNNNN)")

    Rel(ciudadano, app, "Registra denuncia y recibe notificaciones", "HTTPS")
    Rel(oficial, app, "Gestiona denuncias y registra objetos encontrados", "HTTPS")
    Rel(app, fiscalia, "Envía oficio al procesar una denuncia", "Referencia / futura integración")

    UpdateLayoutConfig($c4ShapeInRow="2", $c4BoundaryInRow="1")
```

---

## Nivel 2 — Contenedores AWS

```mermaid
%%{init: {"layout": "elk"}}%%
C4Container
    title Contenedores AWS: Comisaría Digital PNP

    Person(ciudadano, "Ciudadano")
    Person(oficial, "Oficial PNP")

    System_Boundary(aws, "AWS Cloud") {

        Container(s3cf, "S3 + CloudFront", "Static hosting / CDN", "Sirve la SPA React. Assets cacheados en edge locations.")
        Container(waf, "AWS WAF", "WAF + Shield", "Rate-based rules. Bloquea IPs abusivas. Protege API Gateway.")
        Container(apigw, "API Gateway", "REST API", "Throttling, burst limits, usage plans. Autenticación vía Cognito.")
        Container(cognito, "Amazon Cognito", "User Pools", "Gestión de sesiones de ciudadanos y oficiales PNP.")

        Container(lambda, "Lambda Chatbot", "Python 3.12, VPC", "Orquesta toda la lógica: IA, cifrado, validaciones, cambios de estado.")

        ContainerDb(dynamo, "DynamoDB ReportsTable", "NoSQL on-demand", "Single-table design. Campos PII almacenados como texto cifrado (enc).")
        Container(kms, "KMS CMK", "Customer Managed Key", "Cifrado de sobre (envelope encryption). Solo el rol Lambda tiene kms:Decrypt.")
        Container(bedrock, "Amazon Bedrock", "Llama 3.x, temperature=0", "3 llamadas por interacción del ciudadano: guía conversacional, extracción de datos y resumen para el oficial.")
        Container(location, "AWS Location Service", "Location API", "Geocodifica la dirección del hecho. Resuelve la comisaría más cercana por distrito y distancia haversine.")

    }

    Rel(ciudadano, s3cf, "Abre la app", "HTTPS")
    Rel(oficial, s3cf, "Abre la app", "HTTPS")
    Rel(s3cf, waf, "Peticiones API", "HTTPS")
    Rel(waf, apigw, "Tráfico filtrado", "HTTPS")
    Rel(apigw, cognito, "Valida token", "AWS SDK")
    Rel(apigw, lambda, "Invoca función", "AWS SDK (sync)")
    Rel(lambda, kms, "Encrypt / Decrypt campos PII", "VPC endpoint")
    Rel(lambda, dynamo, "Lee y escribe (datos cifrados)", "VPC endpoint")
    Rel(lambda, bedrock, "InvokeModel ×3 por turno", "VPC endpoint / PrivateLink")
    Rel(lambda, location, "SearchPlaceIndexForText", "VPC endpoint")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

---

## Nivel 3 — Componentes de Lambda Chatbot

```mermaid
%%{init: {"layout": "elk", "elk": {"direction": "RIGHT"}}}%%
C4Component
    title Componentes de Lambda Chatbot

    Container_Boundary(lambda, "Lambda Chatbot (Python 3.12)") {

        Component(router, "MessageRouter", "Python", "Punto de entrada. Enruta según tipo de evento: mensaje de ciudadano, acción de oficial u objeto encontrado.")

        Component(conv, "ConversationEngine", "Python", "Call 1 a Bedrock. Genera la respuesta conversacional guiada por stages (ask_dni → ready_for_confirmation).")
        Component(extractor, "DataExtractor", "Python", "Call 2 a Bedrock. Extrae campos estructurados del mensaje del ciudadano y actualiza draft_state.")
        Component(summary, "SummaryGenerator", "Python", "Call 3 a Bedrock. Genera contenido_formal y resumen_oficial en la transición pending_confirmation → pending.")

        Component(resolver, "ComisariaResolver", "Python", "Llama a Location Service para geocodificar la dirección del hecho. Selecciona comisaría por distrito y distancia haversine sobre comisarias.json.")
        Component(encryption, "EncryptionService", "AWS Encryption SDK", "Cifrado de sobre con KMS CMK. Cachea el DEK en memoria por invocación para minimizar llamadas a KMS.")
        Component(found, "FoundItemsService", "Python", "Registra objetos encontrados. Busca coincidencias de tipo en los draft_state de chats activos (status ∈ {draft, pending_confirmation, pending, in_review}) y despacha mensajes de notificación.")
        Component(status, "StatusService", "Python", "Gestiona transiciones de estado con TransactWriteItems. Usa ConditionExpression para prevenir race conditions al tomar un caso.")

    }

    ContainerDb(dynamo, "DynamoDB ReportsTable", "NoSQL")
    Container(kms, "KMS CMK", "AWS KMS")
    Container(bedrock, "Amazon Bedrock", "Llama 3.x")
    Container(location, "AWS Location Service", "Location API")

    Rel(router, conv, "Turno de ciudadano")
    Rel(router, extractor, "Turno de ciudadano")
    Rel(router, resolver, "Stage confirm_comisaria")
    Rel(router, summary, "Confirmación sí/no")
    Rel(router, found, "Registro de objeto encontrado")
    Rel(router, status, "Acción de oficial")

    Rel(conv, bedrock, "InvokeModel (Call 1)")
    Rel(extractor, bedrock, "InvokeModel (Call 2)")
    Rel(summary, bedrock, "InvokeModel (Call 3)")

    Rel(resolver, location, "SearchPlaceIndexForText")

    Rel(encryption, kms, "GenerateDataKey / Decrypt")

    Rel(extractor, encryption, "Cifra draft_state antes de escribir")
    Rel(summary, encryption, "Cifra contenido_formal y resumen_oficial")
    Rel(found, encryption, "Descifra draft_state para comparar tipos")
    Rel(status, encryption, "Cifra campos PII en mensajes de estado")

    Rel(extractor, dynamo, "UpdateItem draft_state (cifrado)")
    Rel(summary, dynamo, "UpdateItem contenido_formal, resumen_oficial (cifrados)")
    Rel(found, dynamo, "PutItem objeto encontrado / Query chats activos")
    Rel(status, dynamo, "TransactWriteItems — actualiza chat, inbox y mensaje de estado")
```

---

## Notas

| Servicio | Motivo de uso |
|---|---|
| **CloudFront + S3** | Distribución global de la SPA con bajo costo; sin servidor propio |
| **AWS WAF** | Rate-limiting por IP para prevenir abuso; protege frente a bots |
| **API Gateway** | Throttling configurable; usage plans por tipo de usuario |
| **Amazon Cognito** | Gestión de sesiones sin implementar auth propio |
| **Lambda** | Sin servidor; escala a cero cuando no hay tráfico |
| **DynamoDB on-demand** | Costo proporcional al uso; single-table optimizado para los patrones de acceso definidos |
| **KMS CMK** | Cifrado a nivel de campo en la capa de aplicación; los datos PII nunca llegan en claro a DynamoDB |
| **Amazon Bedrock** | Llama 3.x vía PrivateLink; tráfico sin salir a internet; `temperature=0` para determinismo |
| **AWS Location Service** | Geocoding sin depender de Google Maps; datos de localización no salen de AWS |
