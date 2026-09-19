/**
 * Utilitários de Formatação de Data para o Copilot Protheus
 * Garante que datas sejam SEMPRE exibidas no formato dd/mm/yyyy.
 */

/**
 * Verifica se um valor ou coluna representa uma data.
 * @param {any} val
 * @param {string} [colKey]
 * @returns {boolean}
 */
export function isDateValue(val, colKey = '') {
  if (val === null || val === undefined) return false;
  if (val instanceof Date) return true;

  const s = String(val).trim();
  if (!s) return false;

  // YYYYMMDD (8 dígitos Protheus/Oracle)
  if (/^\d{8}$/.test(s)) {
    const y = parseInt(s.slice(0, 4), 10);
    const m = parseInt(s.slice(4, 6), 10);
    const d = parseInt(s.slice(6, 8), 10);
    if (y >= 1970 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return true;
  }

  // YYYY-MM-DD ou ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true;

  // DD/MM/YYYY ou DD/MM/YY
  if (/^\d{2}\/\d{2}\/\d{2,4}/.test(s)) return true;

  // Heurística pelo nome da coluna
  if (colKey) {
    const upper = String(colKey).toUpperCase();
    if (/DATA|VENCTO|EMISSAO|VENCIMENTO|\bDATE\b|^DT_|_DT$|_DATA$/i.test(upper)) {
      return true;
    }
  }

  return false;
}

/**
 * Formata qualquer valor de data no padrão estrito dd/mm/yyyy.
 * @param {any} val
 * @returns {string}
 */
export function formatDateBR(val) {
  if (val === null || val === undefined || val === '') return '—';

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '—';
    const d = String(val.getDate()).padStart(2, '0');
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const y = val.getFullYear();
    return `${d}/${m}/${y}`;
  }

  const s = String(val).trim();
  if (!s) return '—';

  // 1. YYYYMMDD (Protheus Oracle e.g. "20260918") -> "18/09/2026"
  if (/^\d{8}$/.test(s)) {
    const y = s.slice(0, 4);
    const m = s.slice(4, 6);
    const d = s.slice(6, 8);
    return `${d}/${m}/${y}`;
  }

  // 2. YYYY-MM-DD ou ISO (e.g. "2026-09-18" ou "2026-09-18T00:00:00")
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  // 3. DD/MM/YY -> DD/MM/YYYY (e.g. "18/09/26" -> "18/09/2026")
  const shortMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (shortMatch) {
    const yy = parseInt(shortMatch[3], 10);
    const yyyy = yy >= 70 ? `19${shortMatch[3]}` : `20${shortMatch[3]}`;
    return `${shortMatch[1]}/${shortMatch[2]}/${yyyy}`;
  }

  // 4. Já no formato DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    return s;
  }

  return s;
}
