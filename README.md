# Comisaría Digital PNP — Prototipo

Chatbot de denuncias policiales para Lima y Callao. Este repositorio contiene
un prototipo funcional del sistema: todo corre en el navegador, sin conexión a
servidores reales. Los datos se reinician cada vez que se recarga la página.

## Acceso rápido

Puedes probar el prototipo directamente en el navegador, sin instalar nada:

| Vista | URL |
|---|---|
| Ciudadano | [https://denuncia-facil.vercel.app/](https://denuncia-facil.vercel.app/) |
| Oficial PNP | [https://denuncia-facil.vercel.app/#/oficiales](https://denuncia-facil.vercel.app/#/oficiales) |

Si prefieres correrlo en tu propia computadora, sigue los pasos de instalación más abajo.

---

## Requisitos previos

Solo necesitas tener instalado **Node.js** en tu computadora.

- Descárgalo desde [nodejs.org](https://nodejs.org) (elige la versión **LTS**)
- Para verificar que está instalado, abre una terminal y escribe:
  ```
  node --version
  ```
  Debe mostrar un número de versión (por ejemplo `v20.11.1`).

---

## Cómo abrir el prototipo

1. Descarga o clona este repositorio en tu computadora.
2. Abre una terminal dentro de la carpeta del proyecto.
3. Entra a la carpeta `frontend`:
   ```
   cd frontend
   ```
4. Instala las dependencias (solo la primera vez):
   ```
   npm install
   ```
5. Inicia el prototipo:
   ```
   npm run dev
   ```
6. Abre tu navegador y entra a:
   ```
   http://localhost:5173
   ```

Listo. El prototipo está corriendo.

---

## Vista del ciudadano

### Cómo ingresar

En la pantalla principal verás un formulario de ingreso. Tienes dos opciones:

**Opción A — Usar el usuario de prueba (recomendado para ver casos existentes)**

Completa el formulario con estos datos:

| Campo | Valor |
|---|---|
| DNI | `45678901` |
| Apellido paterno | `López` |
| Apellido materno | `Fernández` |
| Nombres | `María Elena` |

Los campos de teléfono y correo son opcionales, puedes dejarlos vacíos.

Al ingresar con este DNI verás dos denuncias ya existentes en el historial.

**Opción B — Crear un ciudadano nuevo**

Escribe cualquier otro número de DNI (por ejemplo `12345678`) con cualquier
nombre. Ingresarás con un historial vacío y podrás iniciar una denuncia desde
cero.

---

### Qué puedes probar

#### Ver denuncias existentes (solo con el usuario de prueba)

Al ingresar con DNI `45678901` verás en el panel izquierdo:

| Caso | Estado | Detalle |
|---|---|---|
| CHAT001 | Pendiente | Robo de celular en Parque El Olivar, San Isidro |
| CHAT003 | Fiscalía | Hurto de billetera y celular en Parque Kennedy, Miraflores |

Haz clic en cada caso para leer la conversación completa y ver cómo quedó
registrada la denuncia.

#### Iniciar una nueva denuncia

Haz clic en el botón **"Nueva denuncia"** en la parte superior del panel
izquierdo. Se abrirá una conversación con el asistente de IA.

El asistente te irá preguntando los datos necesarios en orden. Solo escribe
tus respuestas como si fuera un chat normal. El flujo es:

1. Lugar del hecho (distrito y dirección)
2. Fecha y hora
3. Qué fue robado o perdido, con descripción
4. Si fue robo con violencia, una descripción del autor
5. Dirección de domicilio
6. Confirmación de la comisaría asignada
7. Resumen final — escribe **`sí`** para enviar la denuncia

> El botón "Nueva denuncia" se desactiva automáticamente si ya tienes una
> denuncia en borrador sin enviar.

---

## Vista del oficial PNP

### Cómo ingresar

La pantalla del oficial tiene una URL separada que no está enlazada desde la
vista ciudadana. Ábrela directamente en el navegador:

```
http://localhost:5173/#/oficiales
```

Haz clic en **"Ingresar como oficial"**. Ingresarás como:

| Dato | Valor |
|---|---|
| Nombre | Carlos R. |
| Placa | PNP-4421 |
| Comisaría | Comisaría de Miraflores |

---

### Qué puedes probar

#### Cola de denuncias pendientes (pestaña "Denuncias")

Verás las denuncias del distrito de Miraflores que están esperando ser
atendidas:

| Caso | Ciudadano | Tipo |
|---|---|---|
| CHAT004 | Carlos Alberto Mendoza | Robo agravado — laptop Dell |
| CHAT005 | Rosa María Sánchez | Hurto — celular y efectivo en el bus |

Haz clic en cualquiera para leer la conversación completa y el resumen
preparado para el oficial.

Para tomar un caso, haz clic en el botón **"Tomar caso"** dentro de la
conversación. El caso pasará a tus casos activos.

#### Mis casos (pestaña "Mis casos")

Aquí aparecen las denuncias que ya tienes asignadas:

| Caso | Ciudadano | Estado |
|---|---|---|
| CHAT007 | Ana Lucía Torres | Asignada (en revisión) |
| CHAT003 | María Elena López | Fiscalía |

Desde CHAT007 puedes cambiar el estado:
- **"Marcar como procesada"** — pasa a estado Procesada
- **"Enviar a Fiscalía"** — genera un código de oficio
- **"Cerrar caso"** — requiere escribir un motivo de cierre

#### Buscar cualquier denuncia

En la parte superior del panel izquierdo hay un buscador. Puedes buscar
por **DNI** o por **número de caso**, sin importar el distrito:

| Búsqueda | Resultado esperado |
|---|---|
| `45678901` | CHAT001 y CHAT003 (María Elena López) |
| `72345678` | CHAT004 (Carlos Mendoza) |
| `CHAT006` | Denuncia de estafa en Lince (Luis Vargas) |
| `CHAT007` | Caso de Ana Lucía Torres |

#### Registrar un objeto encontrado

Haz clic en **"Obj. Encontrados"** en la barra de navegación superior del
panel izquierdo.

Verás dos objetos ya registrados (una billetera y un celular Xiaomi). Puedes
registrar uno nuevo con el formulario:

1. Elige el tipo de objeto (por ejemplo: `Celular`, `Billetera/Cartera`)
2. Escribe una descripción
3. Haz clic en **"Registrar objeto"**

Si el tipo coincide con algún artículo reportado en una denuncia activa, el
sistema enviará automáticamente una notificación al ciudadano correspondiente.
Prueba registrando un objeto de tipo `Laptop` o `Equipo electrónico` y luego
revisa CHAT004 para ver el mensaje.

---

## Casos de prueba sugeridos

### Flujo completo ciudadano → oficial

1. Ingresa como ciudadano con DNI `45678901`.
2. Crea una nueva denuncia y completa toda la conversación hasta escribir `sí`.
3. Cierra la pestaña del ciudadano (o abre el panel del oficial en otra pestaña).
4. Ingresa como oficial en `http://localhost:5173/#/oficiales`.
5. La nueva denuncia aparecerá en la cola (si indicaste Miraflores como lugar del hecho).
6. Toma el caso y cambia su estado.

### Búsqueda de caso de otro distrito

1. Ingresa como oficial.
2. En el buscador escribe `CHAT001`.
3. Verás la denuncia de San Isidro (que normalmente no aparecería en la cola
   de Miraflores).
4. Puedes leer el caso completo sin restricciones.

### Notificación por objeto encontrado

1. Ingresa como oficial.
2. Ve a "Obj. Encontrados" y registra un objeto tipo `Celular`.
3. Abre CHAT005 en "Mis casos" o búscalo.
4. El sistema habrá enviado un mensaje automático a la ciudadana Rosa María
   notificándole sobre el objeto.

---

## Notas importantes

- **Los datos no se guardan.** Cada vez que recargues la página, el prototipo
  vuelve al estado inicial.
- **No hay backend real.** Toda la lógica corre en el navegador. En la versión
  de producción, el asistente de IA estará conectado a Amazon Bedrock (AWS).
- **El buscador del oficial** muestra casos de cualquier distrito, no solo de
  Miraflores. Esto es intencional para permitir consultas cruzadas.
- La URL `/#/oficiales` no debe compartirse públicamente. En producción, el
  acceso estará protegido con autenticación real.
