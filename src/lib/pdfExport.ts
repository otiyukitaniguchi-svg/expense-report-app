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
  p.meta { font-size: 14px; margin: 0 0 10px; color: #000; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th, td { border: 1.5px solid #333; padding: 8px 10px; text-align: left; overflow-wrap: break-word; }
  th { background: #cbd2db; font-weight: 700; }
  td.amount, th.amount { text-align: right; }
  td.nowrap, th.nowrap { white-space: nowrap; }
  tfoot td { font-weight: 700; background: #eef0f3; }
  .grand-total { margin-top: 16px; text-align: right; font-size: 19px; font-weight: 700; }
`

export function buildExpenseListHtml(rows: PdfListRow[], title: string): string {
  const total = rows.reduce((sum, r) => sum + r.amount, 0)
  const tableRows = rows
    .map(
      (r) => `
    <tr>
      <td class="nowrap">${escapeHtml(r.employeeName)}</td>
      <td>${escapeHtml(r.reportTitle)}</td>
      <td class="nowrap">${escapeHtml(r.date)}</td>
      <td class="nowrap">${escapeHtml(r.categoryName)}</td>
      <td class="nowrap">${escapeHtml(r.taxCategoryName)}</td>
      <td class="amount nowrap">${r.amount.toLocaleString()}</td>
      <td>${escapeHtml(r.payee)}</td>
      <td class="nowrap">${escapeHtml(r.invoiceNumber)}</td>
      <td>${escapeHtml(r.description)}</td>
    </tr>`
    )
    .join('')

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<style>
  @page { size: A4 portrait; margin: 10mm; }
  ${PDF_STYLE}
  th, td { padding: 6px 6px; font-size: 13px; }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">出力日: ${new Date().toLocaleDateString('ja-JP')} / 件数: ${rows.length}</p>
  <table>
    <thead>
      <tr>
        <th class="nowrap">申請者</th>
        <th>申請タイトル</th>
        <th class="nowrap">日付</th>
        <th class="nowrap">経費科目</th>
        <th class="nowrap">税区分</th>
        <th class="amount nowrap">金額</th>
        <th>支払先</th>
        <th class="nowrap">インボイス登録番号</th>
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

export interface SingleReportSlipItem {
  date: string
  categoryName: string
  payee: string
  description: string
  memo: string
  amount: number
}

export interface SingleReportSlip {
  employeeName: string
  departmentName: string
  statusLabel: string
  submittedAtLabel: string
  periodLabel: string
  items: SingleReportSlipItem[]
}

export function buildSingleReportSlipHtml(slip: SingleReportSlip): string {
  const total = slip.items.reduce((sum, i) => sum + i.amount, 0)

  const categoryTotals = new Map<string, number>()
  for (const i of slip.items) {
    categoryTotals.set(i.categoryName, (categoryTotals.get(i.categoryName) ?? 0) + i.amount)
  }

  const itemRows = slip.items
    .map(
      (i) => `
    <tr>
      <td class="center nowrap">${escapeHtml(slip.statusLabel)}</td>
      <td class="center nowrap">${escapeHtml(i.date)}</td>
      <td class="nowrap">${escapeHtml(i.categoryName)}</td>
      <td>${escapeHtml(i.payee || '-')}</td>
      <td>${escapeHtml(i.description || '-')}</td>
      <td>${escapeHtml(i.memo || '-')}</td>
      <td class="amount nowrap">¥ ${i.amount.toLocaleString()}</td>
    </tr>`
    )
    .join('')

  const categoryRows = Array.from(categoryTotals.entries())
    .map(
      ([name, amount]) => `
    <tr>
      <td>${escapeHtml(name)}</td>
      <td class="amount">¥ ${amount.toLocaleString()}</td>
    </tr>`
    )
    .join('')

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<style>
  @page { size: A4 landscape; margin: 9mm; }
  * { box-sizing: border-box; }
  body { font-family: "Yu Gothic", "Meiryo", sans-serif; font-size: 16px; color: #000; padding: 6px; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 10px; }
  h1 { font-size: 32px; font-weight: 800; margin: 0; letter-spacing: 0.05em; }
  .header-right { text-align: right; font-size: 16px; font-weight: 700; line-height: 1.6; }
  .meta { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #000; padding-bottom: 8px; margin-bottom: 14px; }
  .meta div { font-size: 17px; font-weight: 700; }
  .meta .name { font-size: 26px; font-weight: 800; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { border: 1.5px solid #000; padding: 7px 9px; font-size: 15px; font-weight: 600; text-align: left; overflow-wrap: break-word; }
  td.center, th.center { text-align: center; }
  th { background: #2b2b2b; color: #fff; font-weight: 800; font-size: 14px; }
  td.amount, th.amount { text-align: right; font-weight: 800; font-variant-numeric: tabular-nums; }
  td.nowrap, th.nowrap { white-space: nowrap; }
  tfoot td { font-weight: 800; background: #e2e2e2; font-size: 17px; }
  .tables-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
  .category-table { width: 55%; margin-bottom: 0; }
  .category-table th { background: #555; }
  .approval-table { width: 95mm; table-layout: fixed; margin-bottom: 0; }
  .approval-table th { background: #000; color: #fff; text-align: center; font-size: 14px; width: 25%; }
  .approval-table td { height: 34mm; vertical-align: top; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    <h1>経費精算</h1>
    <div class="header-right">
      <div>提出日：${escapeHtml(slip.submittedAtLabel)}</div>
      <div>対象期間：${escapeHtml(slip.periodLabel)}</div>
    </div>
  </div>

  <div class="meta">
    <div>グループ：${escapeHtml(slip.departmentName || '-')}</div>
    <div class="name">氏名：${escapeHtml(slip.employeeName)}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="center nowrap">状態</th>
        <th class="center nowrap">日付</th>
        <th class="nowrap">科目名</th>
        <th>支払先</th>
        <th>摘要</th>
        <th>備考</th>
        <th class="amount nowrap">計</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="6">合計</td>
        <td class="amount">¥ ${total.toLocaleString()}</td>
      </tr>
    </tfoot>
  </table>

  <div class="tables-row">
    <table class="category-table">
      <thead>
        <tr>
          <th>科目別</th>
          <th class="amount">計</th>
        </tr>
      </thead>
      <tbody>${categoryRows}</tbody>
    </table>

    <table class="approval-table">
      <thead>
        <tr>
          <th>承認</th>
          <th>確認者①</th>
          <th>確認者②</th>
          <th>申請</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>`
}

export interface PdfTransportationRow {
  date: string
  departure: string
  arrival: string
  distanceKm: number
  amount: number
  projectName: string
  memo: string
}

export function buildTransportationListHtml(
  rows: PdfTransportationRow[],
  employeeName: string,
  title: string
): string {
  const total = rows.reduce((sum, r) => sum + r.amount, 0)
  const tableRows = rows
    .map(
      (r) => `
    <tr>
      <td class="nowrap">${escapeHtml(r.date)}</td>
      <td>${escapeHtml(r.departure)}</td>
      <td>${escapeHtml(r.arrival)}</td>
      <td class="amount nowrap">${r.distanceKm}</td>
      <td class="amount nowrap">${r.amount.toLocaleString()}</td>
      <td>${escapeHtml(r.projectName)}</td>
      <td>${escapeHtml(r.memo)}</td>
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
  th, td { white-space: nowrap; }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">申請者: ${escapeHtml(employeeName)} / 出力日: ${new Date().toLocaleDateString('ja-JP')} / 件数: ${rows.length}</p>
  <table>
    <thead>
      <tr>
        <th class="nowrap">日付</th>
        <th>出発地</th>
        <th>到着地</th>
        <th class="amount nowrap">距離(km)</th>
        <th class="amount nowrap">金額</th>
        <th>案件名</th>
        <th>備考</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="4">合計</td>
        <td class="amount">${total.toLocaleString()}</td>
        <td colspan="2"></td>
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
