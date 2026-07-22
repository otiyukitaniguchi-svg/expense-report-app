export interface PdfListRow {
  employeeName: string
  reportTitle: string
  date: string
  categoryName: string
  taxCategoryName: string
  amount: number
  payee: string
  invoiceNumber: string
  description: string
}

export interface PdfReportSection {
  reportTitle: string
  employeeName: string
  items: {
    date: string
    categoryName: string
    taxCategoryName: string
    amount: number
    payee: string
    invoiceNumber: string
    description: string
  }[]
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const PDF_STYLE = `
  * { color: #000; }
  body { font-family: "Yu Gothic", "Meiryo", sans-serif; font-size: 15px; padding: 10px; }
  h1 { font-size: 22px; font-weight: 700; margin: 0 0 6px; }
  p.meta { font-size: 14px; margin: 0 0 10px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th, td { border: 1.5px solid #333; padding: 8px 10px; text-align: left; }
  th { background: #cbd2db; font-weight: 700; }
  td.amount, th.amount { text-align: right; }
  tfoot td { font-weight: 700; background: #eef0f3; }
  .grand-total { margin-top: 16px; text-align: right; font-size: 19px; font-weight: 700; }
`

export function buildExpenseListHtml(rows: PdfListRow[], title: string): string {
  const total = rows.reduce((sum, r) => sum + r.amount, 0)
  const tableRows = rows
    .map(
      (r) => `
    <tr>
      <td>${escapeHtml(r.employeeName)}</td>
      <td>${escapeHtml(r.reportTitle)}</td>
      <td>${escapeHtml(r.date)}</td>
      <td>${escapeHtml(r.categoryName)}</td>
      <td>${escapeHtml(r.taxCategoryName)}</td>
      <td class="amount">${r.amount.toLocaleString()}</td>
      <td>${escapeHtml(r.payee)}</td>
      <td>${escapeHtml(r.invoiceNumber)}</td>
      <td>${escapeHtml(r.description)}</td>
    </tr>`
    )
    .join('')

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<style>
  @page { size: A4 landscape; margin: 10mm; }
  ${PDF_STYLE}
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">出力日: ${new Date().toLocaleDateString('ja-JP')} / 件数: ${rows.length}</p>
  <table>
    <thead>
      <tr>
        <th>申請者</th>
        <th>申請タイトル</th>
        <th>日付</th>
        <th>経費科目</th>
        <th>税区分</th>
        <th class="amount">金額</th>
        <th>支払先</th>
        <th>インボイス登録番号</th>
        <th>摘要</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="5">合計</td>
        <td class="amount">${total.toLocaleString()}</td>
        <td colspan="3"></td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`
}

export function buildReportsPreviewHtml(sections: PdfReportSection[]): string {
  const grandTotal = sections.reduce(
    (sum, s) => sum + s.items.reduce((itemSum, i) => itemSum + i.amount, 0),
    0
  )

  const sectionsHtml = sections
    .map((section, index) => {
      const subtotal = section.items.reduce((sum, i) => sum + i.amount, 0)
      const rows = section.items
        .map(
          (i) => `
        <tr>
          <td>${escapeHtml(i.date)}</td>
          <td>${escapeHtml(i.categoryName)}</td>
          <td>${escapeHtml(i.taxCategoryName)}</td>
          <td class="amount">${i.amount.toLocaleString()}</td>
          <td>${escapeHtml(i.payee)}</td>
          <td>${escapeHtml(i.invoiceNumber)}</td>
          <td>${escapeHtml(i.description)}</td>
        </tr>`
        )
        .join('')

      return `
    <section class="report" style="${index > 0 ? 'page-break-before: always;' : ''}">
      <h1>${escapeHtml(section.reportTitle)}</h1>
      <p class="meta">申請者: ${escapeHtml(section.employeeName)}</p>
      <table>
        <thead>
          <tr>
            <th>日付</th>
            <th>経費科目</th>
            <th>税区分</th>
            <th class="amount">金額</th>
            <th>支払先</th>
            <th>インボイス登録番号</th>
            <th>摘要</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="3">小計</td>
            <td class="amount">${subtotal.toLocaleString()}</td>
            <td colspan="3"></td>
          </tr>
        </tfoot>
      </table>
    </section>`
    })
    .join('')

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<style>
  @page { size: A4 portrait; margin: 10mm; }
  ${PDF_STYLE}
</style>
</head>
<body>
  ${sectionsHtml}
  <p class="grand-total">合計金額: ${grandTotal.toLocaleString()} 円 (${sections.length}件)</p>
</body>
</html>`
}
