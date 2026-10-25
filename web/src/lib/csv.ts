// CSV that opens correctly in Excel and cannot run formulas: cells that start with = + - @ are prefixed with an apostrophe.
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export function toCsv(headers: string[], rows: unknown[][]): string {
  return '\ufeff' + [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
export const rupees = (paise: number | string | null | undefined) => (paise === null || paise === undefined ? '' : (Number(paise) / 100).toFixed(2))
