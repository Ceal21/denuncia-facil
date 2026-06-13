export function formatDateSeparator(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (msgDay.getTime() === today.getTime()) return 'Hoy';
  if (msgDay.getTime() === yesterday.getTime()) return 'Ayer';
  return date.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatTimestamp(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffH < 24) return `hace ${diffH} h`;
  if (diffD === 1) return 'ayer';
  if (diffD < 7) return date.toLocaleDateString('es-PE', { weekday: 'long' });
  return date.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
}

export function formatTime(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

export function normalizeText(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

export function matchesFoundItem(especies, foundTipo) {
  const ft = normalizeText(foundTipo);
  if (!ft) return false;
  return especies.some((especie) => {
    const et = normalizeText(especie.tipo || '');
    if (!et) return false;
    if (ft === et || ft.includes(et) || et.includes(ft)) return true;
    const ftWords = ft.split(/[\s/,]+/).filter((w) => w.length >= 4);
    return ftWords.some((w) => et.includes(w));
  });
}

const ELECTRONIC_KEYWORDS = ['celular', 'telefono', 'laptop', 'computad', 'tablet', 'ipad', 'consola', 'camara', 'electronico'];

function isElectronicDevice(tipo) {
  const norm = normalizeText(tipo);
  return ELECTRONIC_KEYWORDS.some((kw) => norm.includes(kw));
}

export function buildFoundItemMessage(tipo, descripcion, officer) {
  if (isElectronicDevice(tipo)) {
    return `Se encontró **${tipo}** que podría ser tuyo/a: ${descripcion}. Al tratarse de un dispositivo electrónico, dirígete a la **División de Alta Tecnología PNP** ubicada en **Av. España N° 323 (Cercado de Lima)**. Teléfono y WhatsApp: **+51 942 492 245**.`;
  }
  const location = officer.officeAddress
    ? `**${officer.officeName}** (${officer.officeAddress})`
    : `**${officer.officeName}**`;
  return `Se encontró **${tipo}** que podría ser tuyo/a: ${descripcion}. Se encuentra en ${location}. Por favor acércate a verificar si es el tuyo.`;
}

const REQUIRED = {
  datos_generales: ['dni', 'apellido_paterno', 'apellido_materno', 'nombres'],
  datos_domicilio: ['departamento', 'provincia', 'distrito', 'direccion'],
  datos_hecho: ['fecha', 'hora', 'departamento_hecho', 'provincia_hecho', 'distrito_hecho', 'direccion_hecho'],
  denuncia: ['modalidad'],
};

export function calculateProgress(draftState) {
  if (!draftState) return 0;
  let filled = 0;
  let total = 0;

  Object.entries(REQUIRED).forEach(([section, fields]) => {
    fields.forEach((field) => {
      total++;
      if (draftState[section]?.[field]) filled++;
    });
  });

  total += 3;
  if (draftState.denuncia?.especies?.length > 0) filled++;
  if (draftState.denuncia?.items_check_complete) filled++;
  if (draftState.datos_hecho?.comisaria_confirmed) filled++;

  return Math.round((filled / total) * 100);
}

export function getStatusLabel(status) {
  const labels = {
    draft: 'Borrador',
    pending_confirmation: 'Pendiente confirmación',
    pending: 'Pendiente',
    in_review: 'Asignada',
    submitted: 'Procesada',
    fiscalia: 'Fiscalía',
    closed: 'Cerrada',
  };
  return labels[status] || status;
}

export function getStatusColor(status) {
  const colors = {
    draft: 'var(--status-draft)',
    pending_confirmation: 'var(--status-pending-confirm)',
    pending: 'var(--status-pending)',
    in_review: 'var(--status-in-review)',
    submitted: 'var(--status-submitted)',
    fiscalia: 'var(--status-fiscalia)',
    closed: 'var(--status-closed)',
  };
  return colors[status] || 'var(--status-draft)';
}

export function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function generateId(prefix = 'MSG') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
