import { normalizeText } from './helpers';

const COMISARIAS = {
  'San Isidro': { nombre: 'Comisaría de San Isidro', direccion: 'Av. Dos de Mayo 1099, San Isidro', telefono: '01 422-3141' },
  'Miraflores': { nombre: 'Comisaría de Miraflores', direccion: 'Av. José Larco 1302, Miraflores', telefono: '01 243-2723' },
  'Barranco': { nombre: 'Comisaría de Barranco', direccion: 'Jr. Ayacucho 320, Barranco', telefono: '01 247-0820' },
  'Surco': { nombre: 'Comisaría de Santiago de Surco', direccion: 'Jr. Monte Hermoso 111, Surco', telefono: '01 271-4949' },
  'La Molina': { nombre: 'Comisaría de La Molina', direccion: 'Av. La Molina 1151, La Molina', telefono: '01 349-0611' },
  'San Borja': { nombre: 'Comisaría de San Borja', direccion: 'Av. Primavera 454, San Borja', telefono: '01 475-4150' },
  'Magdalena': { nombre: 'Comisaría de Magdalena del Mar', direccion: 'Jr. Andrés Reyes 408, Magdalena', telefono: '01 263-1044' },
  'Lince': { nombre: 'Comisaría de Lince', direccion: 'Jr. Enrique León García 450, Lince', telefono: '01 471-3550' },
  'Chorrillos': { nombre: 'Comisaría de Chorrillos', direccion: 'Av. Huaylas 900, Chorrillos', telefono: '01 467-4040' },
  'Callao': { nombre: 'Comisaría del Callao', direccion: 'Jr. Constitución 340, Callao', telefono: '01 429-1444' },
};

const DISTRITOS = [
  'miraflores', 'san isidro', 'barranco', 'surco', 'la molina', 'san borja',
  'magdalena', 'lince', 'jesus maria', 'pueblo libre', 'brena', 'lima',
  'la victoria', 'san luis', 'ate', 'santa anita', 'el agustino',
  'san juan de lurigancho', 'rimac', 'san martin de porres', 'independencia',
  'los olivos', 'comas', 'carabayllo', 'puente piedra', 'chorrillos',
  'villa el salvador', 'villa maria del triunfo', 'lurin', 'pachacamac',
  'callao', 'bellavista', 'la perla', 'la punta', 'ventanilla',
];

function capitalizeDistrict(d) {
  return d.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function findDistrict(text) {
  const norm = normalizeText(text);
  const found = DISTRITOS.find((d) => norm.includes(d));
  return found ? capitalizeDistrict(found) : null;
}

function extractTime(msg) {
  const isPM = /pm|tarde|noche/i.test(msg);
  const isAM = /am|ma[ñn]ana/i.test(msg);
  let hour = null;
  let minutes = '00';

  const colonTime = msg.match(/\b(\d{1,2}):(\d{2})\b/);
  const explicitTime = msg.match(/\b(\d{1,2})(?::(\d{2}))?\s*(?:am|pm|de\s+la\s+tarde|de\s+la\s+noche|de\s+la\s+ma[ñn]ana|tarde|noche|ma[ñn]ana)\b/i);
  const lasTime = msg.match(/\blas?\s+(\d{1,2})\b/i);
  const bareNumber = msg.match(/\b(\d{1,2})\b/);

  if (colonTime) {
    hour = parseInt(colonTime[1]);
    minutes = colonTime[2];
  } else if (explicitTime) {
    hour = parseInt(explicitTime[1]);
    if (explicitTime[2]) minutes = explicitTime[2];
    if (isPM && hour < 12) hour += 12;
    if (isAM && hour === 12) hour = 0;
  } else if (lasTime) {
    hour = parseInt(lasTime[1]);
    if (isPM && hour < 12) hour += 12;
  } else if (bareNumber) {
    hour = parseInt(bareNumber[1]);
    // 1–6 without AM context → assume PM
    if (!isAM && hour >= 1 && hour <= 6) hour += 12;
  }

  return hour !== null ? `${String(hour).padStart(2, '0')}:${minutes}` : null;
}

function extractDate(msg) {
  const now = new Date();
  if (/anteayer|ante\s*ayer/i.test(msg)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 2);
    return d.toISOString().split('T')[0];
  }
  if (/ayer/i.test(msg)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }
  if (/hoy/i.test(msg)) {
    return now.toISOString().split('T')[0];
  }
  const haceMatch = msg.match(/hace\s+(\d+)\s+d[ií]as?/i);
  if (haceMatch) {
    const d = new Date(now);
    d.setDate(d.getDate() - parseInt(haceMatch[1]));
    return d.toISOString().split('T')[0];
  }
  return null;
}

export function determineConversationStage(draftState) {
  const g = draftState?.datos_generales;
  const d = draftState?.datos_domicilio;
  const h = draftState?.datos_hecho;
  const den = draftState?.denuncia;

  if (!g?.dni) return 'ask_dni';
  if (!g?.nombres || !g?.apellido_paterno) return 'ask_name';
  // Incident first — domicilio is deferred to near the end (bureaucratic, not urgent)
  if (!h?.distrito_hecho || !h?.direccion_hecho) return 'ask_incident_place';
  if (!h?.fecha || !h?.hora) return 'ask_incident_time';
  if (!den?.modalidad || den?.especies?.length === 0) return 'ask_items';
  const lastEspecie = den?.especies?.[den.especies.length - 1];
  if (lastEspecie && lastEspecie.descripcion === null) return 'ask_item_description';
  if (!den?.items_check_complete) return 'ask_more_items';
  if (den?.modalidad === 'robo agravado' && h?.descripcion_autor === null) return 'ask_perp_description';
  if (!d?.distrito || !d?.direccion) return 'ask_domicilio';
  if (!h?.comisaria_confirmed) return 'confirm_comisaria';
  return 'ready_for_confirmation';
}

export function extractDataFromMessage(message, stage, currentDraft) {
  const draft = JSON.parse(JSON.stringify(currentDraft));
  const msg = message.trim();
  const norm = normalizeText(msg);

  // Detect robbery keywords in any message — upgrades modalidad from hurto/null to robo agravado
  if (
    draft.denuncia.modalidad !== 'robo agravado' &&
    draft.denuncia.modalidad !== 'pérdida de objeto' &&
    /\b(robo|robaron|rob[oó]|arrebat|asalt|arma|violencia|jalaron|jal[oó])\b/i.test(msg)
  ) {
    draft.denuncia.modalidad = 'robo agravado';
  }

  switch (stage) {
    case 'ask_dni': {
      const match = msg.match(/\b(\d{8})\b/);
      if (match) draft.datos_generales.dni = match[1];
      break;
    }

    case 'ask_name': {
      const parts = msg.trim().split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        draft.datos_generales.apellido_paterno = parts[0];
        if (parts.length >= 3) {
          draft.datos_generales.apellido_materno = parts[1];
          draft.datos_generales.nombres = parts.slice(2).join(' ');
        } else {
          draft.datos_generales.nombres = parts[1];
        }
      }
      break;
    }

    case 'ask_domicilio': {
      draft.datos_domicilio.departamento = 'Lima';
      draft.datos_domicilio.provincia = 'Lima';
      const dist = findDistrict(msg);
      if (dist) draft.datos_domicilio.distrito = dist;
      // Always store what the user said so we don't lose the address text
      if (!draft.datos_domicilio.direccion || dist) {
        draft.datos_domicilio.direccion = msg;
      }
      break;
    }

    case 'ask_incident_time': {
      const hora = extractTime(msg);
      if (hora) draft.datos_hecho.hora = hora;

      const fecha = extractDate(msg);
      if (fecha) draft.datos_hecho.fecha = fecha;

      draft.datos_hecho.departamento_hecho = 'Lima';
      draft.datos_hecho.provincia_hecho = 'Lima';
      break;
    }

    case 'ask_incident_place': {
      const dist = findDistrict(msg);
      if (dist) draft.datos_hecho.distrito_hecho = dist;
      // Only store as address if the message contains more than the district name
      // (street keyword, landmark, or number signals an actual address)
      const hasAddressContent = /\b(av(enida)?|jr|jir[oó]n|calle|ca\.|psje|pasaje|parque|plaza|cdra|cuadra|esquina|frente|cerca|altura|km|\d+)\b/i.test(msg);
      if (hasAddressContent) {
        draft.datos_hecho.direccion_hecho = msg;
      }
      draft.datos_hecho.departamento_hecho = 'Lima';
      draft.datos_hecho.provincia_hecho = 'Lima';
      break;
    }

    case 'ask_items': {
      // Don't overwrite modalidad if already set (e.g. 'pérdida de objeto' for loss reports)
      if (!draft.denuncia.modalidad) {
        let modalidad = 'hurto';
        if (/robo|arrebat|asalt|arma|violencia/i.test(msg)) modalidad = 'robo agravado';
        else if (/estafa|enga[ñn]|timad|fraude/i.test(msg)) modalidad = 'estafa';
        else if (/hurto|sustra/i.test(msg)) modalidad = 'hurto';
        draft.denuncia.modalidad = modalidad;
      }

      const especie = { tipo: 'Objeto', numero: null, descripcion: null };
      if (/celular|tel[eé]fono|iphone|samsung|xiaomi|huawei/i.test(msg)) especie.tipo = 'Celular';
      else if (/billetera|cartera|bolso|mochila/i.test(msg)) especie.tipo = 'Billetera/Cartera';
      else if (/laptop|computad|tablet|ipad/i.test(msg)) especie.tipo = 'Equipo electrónico';
      else if (/dinero|efectivo|soles?|d[oó]lares?/i.test(msg)) especie.tipo = 'Efectivo';
      else if (/joya|collar|anillo|reloj|aro|cadena/i.test(msg)) especie.tipo = 'Joyas/Accesorios';
      draft.denuncia.especies = [especie];
      break;
    }

    case 'ask_item_description': {
      const idx = draft.denuncia.especies.length - 1;
      if (idx >= 0) draft.denuncia.especies[idx].descripcion = msg;
      break;
    }

    case 'ask_more_items': {
      if (/\b(no|nada|ninguno|todo|es todo|eso es todo|solo eso|nada m[aá]s|con eso|ya est[aá]|fue todo|eso nomas|eso nomás)\b/i.test(norm)) {
        draft.denuncia.items_check_complete = true;
      } else {
        const especie = { tipo: 'Objeto', numero: null, descripcion: null };
        if (/celular|tel[eé]fono|iphone/i.test(msg)) especie.tipo = 'Celular';
        else if (/billetera|cartera|bolso/i.test(msg)) especie.tipo = 'Billetera/Cartera';
        else if (/dinero|efectivo/i.test(msg)) especie.tipo = 'Efectivo';
        draft.denuncia.especies.push(especie);
      }
      break;
    }

    case 'ask_perp_description': {
      // Store the user's answer verbatim — even "no sé" or "no lo vi" counts as answered
      draft.datos_hecho.descripcion_autor = msg;
      break;
    }

    case 'confirm_comisaria': {
      const isYes = /\b(s[ií]|ok|bien|correcto|claro|acepto|de acuerdo|confirm|afirm|exacto)\b/i.test(norm);
      if (isYes) {
        draft.datos_hecho.comisaria_confirmed = true;
        const distHecho = draft.datos_hecho.distrito_hecho || '';
        const comisaria = COMISARIAS[distHecho] || {
          nombre: `Comisaría de ${distHecho || 'Lima'}`,
          direccion: `${distHecho || 'Lima'}, Lima`,
        };
        draft.datos_hecho.comisaria_nombre = comisaria.nombre;
        draft.datos_hecho.comisaria_direccion = comisaria.direccion;
      } else {
        // User is correcting — try to extract a new district from the message
        const newDistrict = findDistrict(msg);
        if (newDistrict) {
          draft.datos_hecho.distrito_hecho = newDistrict;
          // keep existing direccion_hecho; only the district changed
        } else {
          // No district found — clear location so ask_incident_place is triggered
          draft.datos_hecho.distrito_hecho = null;
          draft.datos_hecho.direccion_hecho = null;
        }
        draft.datos_hecho.comisaria_nombre = null;
        draft.datos_hecho.comisaria_direccion = null;
        draft.datos_hecho.comisaria_confirmed = false;
      }
      break;
    }

    default:
      break;
  }

  return draft;
}

export function generateAIResponse(chatId, userMessage, updatedDraft) {
  const stage = determineConversationStage(updatedDraft);
  const g = updatedDraft.datos_generales;
  const d = updatedDraft.datos_domicilio;
  const h = updatedDraft.datos_hecho;
  const den = updatedDraft.denuncia;

  let text = '';
  let readyForConfirmation = false;

  switch (stage) {
    case 'ask_dni':
      text = '¡Hola! Soy el asistente virtual de la Denuncia Fácil. Voy a ayudarte a registrar tu denuncia de manera rápida y segura.\n\nPara empezar, ¿me podrías indicar tu número de **DNI**?';
      break;

    case 'ask_name':
      text = `DNI **${g.dni}** registrado correctamente.\n\nAhora necesito tu nombre completo. Por favor indícame en este orden: **apellido paterno, apellido materno y nombres**.`;
      break;

    case 'ask_domicilio': {
      const nombre = g.nombres || 'vecino/a';
      // direccion set but distrito still missing → ask specifically for the district
      if (d?.direccion && !d?.distrito) {
        text = `¿En qué **distrito** de Lima o Callao queda esa dirección? (por ejemplo: Miraflores, San Isidro, Surco, Callao...)`;
      } else {
        text = `Ya casi terminamos, ${nombre}. Para el informe formal necesito tu **dirección de domicilio**. ¿En qué distrito de Lima o Callao vives y cuál es tu dirección?`;
      }
      break;
    }

    case 'ask_incident_place': {
      if (h?.distrito_hecho && !h?.direccion_hecho) {
        text = `Anotado en **${h.distrito_hecho}**. ¿Recuerdas la dirección exacta o alguna referencia cercana? Por ejemplo: nombre de la calle, avenida, parque o local próximo.`;
      } else if (h?.direccion_hecho && !h?.distrito_hecho) {
        text = `Entendido. ¿En qué **distrito** de Lima o Callao ocurrió eso? (por ejemplo: Miraflores, San Borja, Callao...)`;
      } else {
        text = `¿En qué **distrito** de Lima o Callao ocurrió el hurto o robo? ¿Recuerdas una dirección o zona aproximada?`;
      }
      break;
    }

    case 'ask_incident_time': {
      const lugar = h?.distrito_hecho ? ` en **${h.distrito_hecho}**` : '';
      if (h?.fecha && !h?.hora) {
        const fechaStr = new Date(h.fecha + 'T12:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
        text = `Registré la fecha: **${fechaStr}**. ¿A qué **hora** ocurrió aproximadamente? (por ejemplo: "3pm", "15:30", "8 de la mañana")`;
      } else if (!h?.fecha && h?.hora) {
        text = `Registré la hora: **${h.hora}**. ¿En qué **fecha** ocurrió? (por ejemplo: "ayer", "anteayer", "hace 3 días")`;
      } else {
        text = `Anotado${lugar}. ¿**Cuándo ocurrió**? ¿Fue hoy, ayer, o en qué fecha? ¿A qué hora aproximadamente?`;
      }
      break;
    }

    case 'ask_items':
      text = `Entendido. ¿Qué fue lo que **te robaron o perdiste**? Descríbeme los artículos — si recuerdas marca, modelo o color, eso ayuda mucho al registro.`;
      break;

    case 'ask_item_description': {
      const item = den.especies[den.especies.length - 1];
      const tipo = item?.tipo || 'artículo';
      text = `Anotado: **${tipo}**. ¿Puedes describírmelo con más detalle? Por ejemplo: marca, modelo, color, número de serie si lo recuerdas.\n\nCuanto más información, más fácil será identificarlo si aparece.`;
      break;
    }

    case 'ask_more_items': {
      const lastItem = den.especies[den.especies.length - 1];
      text = `Registrado: **${lastItem?.descripcion || lastItem?.tipo || 'artículo'}**.\n\n¿Hay **algo más** que te hayan robado, o con eso estaría completo?`;
      break;
    }

    case 'ask_perp_description':
      text = `Una cosa más que puede ser muy útil para la investigación: ¿puedes describir a la persona que te robó?\n\n¿Era **hombre o mujer**? ¿Qué edad aparentaba? ¿Cómo era su **altura y complexión**? ¿Recuerdas qué **ropa** llevaba o algún rasgo físico llamativo?\n\nSi no pudiste verle bien o no recuerdas algún detalle, cuéntame lo que puedas.`;
      break;

    case 'confirm_comisaria': {
      const distHecho = h.distrito_hecho || 'tu distrito';
      const comisaria = COMISARIAS[distHecho] || {
        nombre: `Comisaría de ${distHecho}`,
        direccion: `${distHecho}, Lima`,
      };
      text = `Basándome en el lugar del hecho, la comisaría que corresponde a tu denuncia es:\n\n🏛 **${comisaria.nombre}**\n📍 ${comisaria.direccion}\n\n¿Confirmas que deseas radicar tu denuncia en esta comisaría?`;
      break;
    }

    case 'ready_for_confirmation': {
      const nombre = `${g.nombres || ''} ${g.apellido_paterno || ''}`.trim();
      const fechaStr = h.fecha
        ? new Date(h.fecha + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })
        : '—';
      const itemsList = den.especies
        .map((e, i) => `${i + 1}. ${e.tipo}: ${e.descripcion || '(sin descripción)'}`)
        .join('\n');
      const perpLine = h.descripcion_autor
        ? `\n\n👤 **Descripción del autor:** ${h.descripcion_autor}`
        : '';

      text = `Perfecto, ya tengo todo lo necesario para tu denuncia. Aquí está el **resumen**:\n\n👤 **${nombre}** — DNI ${g.dni}\n🏠 Domicilio: ${d.direccion}, ${d.distrito}\n📅 Hecho: ${fechaStr} a las ${h.hora}\n📍 Lugar: ${h.direccion_hecho}, ${h.distrito_hecho}\n⚖️ Tipo: ${den.modalidad}\n🏛 Comisaría: ${h.comisaria_nombre}\n\n📋 **Artículos denunciados:**\n${itemsList}${perpLine}\n\n---\nEscribe **sí** para **confirmar y enviar** tu denuncia, o dime si necesitas corregir algo.`;
      readyForConfirmation = true;
      break;
    }

    default:
      text = 'Entendido. ¿Hay algo más en lo que pueda ayudarte con tu denuncia?';
  }

  return { text, readyForConfirmation };
}

export function generateNextStepsMessage(draftState) {
  const distHecho = draftState?.datos_hecho?.distrito_hecho || '';
  const comisaria = COMISARIAS[distHecho] || null;
  const phoneClause = comisaria?.telefono
    ? `, si tuviera más consultas puede comunicarse con **${comisaria.nombre}** al **${comisaria.telefono}**`
    : '';
  return `Su denuncia ha sido registrada correctamente. Un oficial la revisará a la brevedad y, de ser el caso, se generará un oficio para su correspondiente envío a la Fiscalía del Ministerio Público. Este proceso puede tomar algunos días, por favor sea paciente${phoneClause}.`;
}
