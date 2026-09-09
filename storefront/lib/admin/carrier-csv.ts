export interface CarrierRow { orderNumber: string; trackingNumber: string }
/** RFC 4180-style parser: newlines inside quoted optional columns are preserved. */
export function parseCarrierCsv(input: string): CarrierRow[] {
  if (input.length > 1_000_000) throw new Error('CSV is too large (maximum 1 MB)');
  const text = input.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let row: string[] = [], field = '', quoted = false, closed = false;
  const finishField = () => { row.push(field); field = ''; closed = false; };
  const finishRow = () => { finishField(); if (row.some(v => v.trim())) records.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closed = true; }
      } else field += ch;
    } else if (ch === ',') finishField();
    else if (ch === '\r' || ch === '\n') { finishRow(); if (ch === '\r' && text[i + 1] === '\n') i++; }
    else if (ch === '"' && !field && !closed) quoted = true;
    else { if (closed || ch === '"') throw new Error('Malformed CSV quoting'); field += ch; }
  }
  if (quoted) throw new Error('Unterminated CSV quote');
  if (field || row.length || closed) finishRow();
  const header = records.shift()?.map(v => v.trim().toLowerCase()) ?? [];
  if (new Set(header).size !== header.length || !header.includes('order_number') || !header.includes('tracking_number')) throw new Error('CSV requires unique order_number and tracking_number columns');
  if (!records.length || records.length > 500) throw new Error('CSV must contain between 1 and 500 rows');
  const seenOrders = new Set<string>(), seenTracking = new Set<string>();
  return records.map((cells, index) => {
    if (cells.length !== header.length) throw new Error(`Row ${index + 2}: wrong number of columns`);
    const orderNumber = cells[header.indexOf('order_number')].trim();
    const trackingNumber = cells[header.indexOf('tracking_number')].trim();
    if (/[\u0000-\u001f\u007f]/.test(orderNumber + trackingNumber)) throw new Error(`Row ${index + 2}: control characters are not allowed`);
    if (!orderNumber || orderNumber.length > 100 || !trackingNumber || trackingNumber.length > 200) throw new Error(`Row ${index + 2}: invalid order or tracking number`);
    if (seenOrders.has(orderNumber) || seenTracking.has(trackingNumber)) throw new Error(`Row ${index + 2}: duplicate order or tracking number`);
    seenOrders.add(orderNumber); seenTracking.add(trackingNumber);
    return { orderNumber, trackingNumber };
  });
}
