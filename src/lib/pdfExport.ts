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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

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
  body { font-family: "Yu Gothic", "Meiryo", sans-serif; font-size: 12px; padding: 24px; }
  h1 { font-size: 16px; margin-bottom: 4px; }
  p.meta { color: #555; margin-top: 0; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  th { background: #f3f4f6; }
  td.amount, th.amount { text-align: right; }
  tfoot td { font-weight: bold; }
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
