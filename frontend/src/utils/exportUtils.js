import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

function getUserWatermarkCSS() {
  try {
    const userStr = localStorage.getItem('gobites_user')
    if (userStr) {
      const userObj = JSON.parse(userStr)
      if (userObj.role !== 'owner' && userObj.name) {
        return `
          body::before {
            content: "${userObj.name} - Printed";
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-30deg);
            font-size: 5rem;
            font-weight: 800;
            color: rgba(0, 0, 0, 0.035) !important;
            pointer-events: none;
            white-space: nowrap;
            z-index: 999999;
            user-select: none;
            font-family: sans-serif;
          }
        `
      }
    }
  } catch (err) {
    console.error('Failed to parse user for watermark:', err)
  }
  return ''
}

/**
 * Export data to Excel (.xlsx)
 * @param {Array} data - Array of plain objects
 * @param {Array} columns - Array of { header, key } descriptors
 * @param {string} filename - File name without extension
 */
export function exportToExcel(data, columns, filename = 'export') {
  const rows = data.map(row =>
    columns.reduce((acc, col) => {
      acc[col.header] = row[col.key] ?? ''
      return acc
    }, {})
  )
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()

  // Auto column widths
  const colWidths = columns.map(col => ({
    wch: Math.max(col.header.length, 14)
  }))
  ws['!cols'] = colWidths

  XLSX.utils.book_append_sheet(wb, ws, 'Data')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

export function exportToPDF(data, columns, filename = 'export', title = 'Report') {
  const printWindow = window.open('', '_blank')

  // Generate table headers
  const headers = columns.map(c => `<th>${c.header}</th>`).join('')

  // Generate table rows
  const rows = data.map(row => {
    const cells = columns.map(c => {
      const val = row[c.key] ?? '—'
      return `<td>${val}</td>`
    }).join('')
    return `<tr>${cells}</tr>`
  }).join('')

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en" dir="ltr">
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Inter:wght@400;600;700&display=swap');
          
          * {
            box-sizing: border-box;
          }

          body {
            font-family: 'Cairo', 'Inter', sans-serif;
            color: #2E1E14;
            background-color: #ffffff;
            margin: 0;
            padding: 30px;
            direction: ltr;
          }
          
          .header-container {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #C9A84C;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          
          .logo-side {
            display: flex;
            align-items: center;
            gap: 15px;
          }

          .logo-side img {
            height: 60px;
            object-fit: contain;
          }

          .brand-title {
            font-size: 22px;
            font-weight: 700;
            color: #8B5E3C;
            margin: 0;
          }
          
          .info-side {
            text-align: right;
          }
          
          .report-title {
            margin: 0;
            font-size: 20px;
            color: #8B5E3C;
            font-weight: 700;
          }
          
          .meta-text {
            margin: 5px 0 0 0;
            font-size: 13px;
            color: #7A6858;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            text-align: left;
          }
          
          th {
            background-color: #FAF6F0;
            color: #8B5E3C;
            border-bottom: 2px solid #C9A84C;
            padding: 10px 12px;
            font-size: 11px;
            font-weight: 700;
            white-space: normal;
          }
          
          td {
            padding: 10px 12px;
            border-bottom: 1px solid #E5DEC9;
            font-size: 11px;
            color: #3D2819;
            white-space: normal;
            word-break: break-word;
          }
          
          tr:nth-child(even) {
            background-color: #FDFBF7;
          }
          
          .footer {
            margin-top: 50px;
            text-align: center;
            font-size: 11px;
            color: #7A6858;
            border-top: 1px solid #E5DEC9;
            padding-top: 15px;
          }
          
          .no-print-bar {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-bottom: 20px;
          }

          .action-btn {
            background-color: #fcfaf7;
            color: #8B5E3C;
            border: 1px solid #E5DEC9;
            border-radius: 6px;
            padding: 8px 16px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            font-family: inherit;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s ease;
          }

          .action-btn:hover {
            background-color: #FAF6F0;
            border-color: #C9A84C;
            color: #8B5E3C;
            transform: translateY(-1px);
          }

          .action-btn svg {
            stroke: currentColor;
          }
          
          @media print {
            body {
              padding: 0;
            }
            .no-print-bar {
              display: none !important;
            }
            @page {
              size: auto;
              margin: 15mm 10mm 15mm 10mm;
            }
            ${getUserWatermarkCSS()}
          }
        </style>
      </head>
      <body>
        <div class="no-print-bar">
          <button class="action-btn" onclick="window.print()">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Save PDF
          </button>
          <button class="action-btn" onclick="window.print()">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print
          </button>
        </div>

        <div class="header-container">
          <div class="logo-side">
            <img src="/logo-black.png" alt="GoBites Logo" />
          </div>
          <div class="info-side">
            <h1 class="report-title">${title}</h1>
            <p class="meta-text">Report Date: ${currentDate}</p>
            <p class="meta-text">Total Records: ${data.length}</p>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>${headers}</tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        
        <div class="footer">
          This report was generated automatically by the GoBites Management System
        </div>
        
        <script>
          window.addEventListener('load', () => {
            // Give a short delay to ensure everything, including logo, is rendered
            setTimeout(() => {
              window.print();
            }, 600);
          });
        </script>
      </body>
    </html>
  `)
  printWindow.document.close()
}

export function exportCustomerOrdersPDF(customer, orders) {
  const printWindow = window.open('', '_blank')

  const columns = [
    { header: 'Order #', key: 'order_number' },
    { header: 'Date', key: 'order_date' },
    { header: 'Items count', key: 'items_count' },
    { header: 'Subtotal', key: 'subtotal_fmt' },
    { header: 'Discount', key: 'discount_fmt' },
    { header: 'Delivery', key: 'delivery_fmt' },
    { header: 'Total', key: 'total_fmt' },
    { header: 'Payment', key: 'payment_method' },
    { header: 'Status', key: 'status' }
  ]

  const headers = columns.map(c => `<th>${c.header}</th>`).join('')

  const rows = orders.map(o => {
    const subtotal_fmt = (+o.subtotal || 0).toFixed(2) + ' JD'
    const discount_fmt = (+o.discount || 0).toFixed(2) + ' JD'
    const delivery_fmt = (+o.delivery_fee || 0).toFixed(2) + ' JD'
    const total_fmt = (+o.total_amount || 0).toFixed(2) + ' JD'
    const items_count = o.items?.length || 0

    const rowObj = {
      order_number: o.order_number,
      order_date: o.order_date,
      items_count,
      subtotal_fmt,
      discount_fmt,
      delivery_fmt,
      total_fmt,
      payment_method: o.payment_method,
      status: o.status
    }

    const cells = columns.map(c => `<td>${rowObj[c.key] ?? '—'}</td>`).join('')
    return `<tr>${cells}</tr>`
  }).join('')

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  const totalSpent = orders.reduce((sum, o) => sum + (+o.total_amount || 0), 0).toFixed(2) + ' JD'

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en" dir="ltr">
      <head>
        <meta charset="utf-8">
        <title>Order History - ${customer.name}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Inter:wght@400;600;700&display=swap');
          
          * { box-sizing: border-box; }
          body {
            font-family: 'Cairo', 'Inter', sans-serif;
            color: #2E1E14;
            background-color: #ffffff;
            margin: 0;
            padding: 30px;
            direction: ltr;
          }
          .header-container {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #C9A84C;
            padding-bottom: 20px;
            margin-bottom: 20px;
          }
          .logo-side img {
            height: 60px;
            object-fit: contain;
          }
          .info-side { text-align: right; }
          .report-title { margin: 0; font-size: 20px; color: #8B5E3C; font-weight: 700; }
          .meta-text { margin: 5px 0 0 0; font-size: 13px; color: #7A6858; }
          
          .customer-details-card {
            background-color: #FAF6F0;
            border: 1px solid #E5DEC9;
            border-radius: 8px;
            padding: 15px 20px;
            margin-bottom: 30px;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
          }
          .detail-group h4 { margin: 0 0 5px 0; color: #8B5E3C; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
          .detail-group p { margin: 0; font-size: 14px; font-weight: 600; }

          table { width: 100%; border-collapse: collapse; margin-top: 10px; text-align: left; }
          th {
            background-color: #FAF6F0;
            color: #8B5E3C;
            border-bottom: 2px solid #C9A84C;
            padding: 10px 12px;
            font-size: 11px;
            font-weight: 700;
            white-space: normal;
          }
          td {
            padding: 10px 12px;
            border-bottom: 1px solid #E5DEC9;
            font-size: 11px;
            color: #3D2819;
            white-space: normal;
            word-break: break-word;
          }
          tr:nth-child(even) { background-color: #FDFBF7; }
          
          .no-print-bar {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-bottom: 20px;
          }

          .action-btn {
            background-color: #fcfaf7;
            color: #8B5E3C;
            border: 1px solid #E5DEC9;
            border-radius: 6px;
            padding: 8px 16px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            font-family: inherit;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s ease;
          }

          .action-btn:hover {
            background-color: #FAF6F0;
            border-color: #C9A84C;
            color: #8B5E3C;
            transform: translateY(-1px);
          }

          .action-btn svg {
            stroke: currentColor;
          }

          @media print {
            body { padding: 0; }
            .no-print-bar { display: none !important; }
            @page { size: auto; margin: 15mm 10mm 15mm 10mm; }
            ${getUserWatermarkCSS()}
          }
        </style>
      </head>
      <body>
        <div class="no-print-bar">
          <button class="action-btn" onclick="window.print()">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Save PDF
          </button>
          <button class="action-btn" onclick="window.print()">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print
          </button>
        </div>

        <div class="header-container">
          <div class="logo-side"><img src="/logo-black.png" alt="GoBites Logo" /></div>
          <div class="info-side">
            <h1 class="report-title">Customer Order History</h1>
            <p class="meta-text">Report Date: ${currentDate}</p>
          </div>
        </div>

        <div class="customer-details-card">
          <div class="detail-group">
            <h4>Customer Name</h4>
            <p>${customer.name}</p>
          </div>
          <div class="detail-group">
            <h4>Phone Number</h4>
            <p>${customer.phone || '—'}</p>
          </div>
          <div class="detail-group">
            <h4>Location</h4>
            <p>${customer.area || '—'}${customer.customer_type ? `, ${customer.customer_type}` : ''}</p>
          </div>
          <div class="detail-group">
            <h4>Total Orders</h4>
            <p>${orders.length} order(s)</p>
          </div>
          <div class="detail-group">
            <h4>Total Purchases</h4>
            <p style="color: #8B5E3C; font-weight: 700;">${totalSpent}</p>
          </div>
          <div class="detail-group">
            <h4>Source Channel</h4>
            <p>${customer.source || '—'}</p>
          </div>
        </div>
        
        <table>
          <thead><tr>${headers}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
        
        <div class="footer">This report was generated automatically by the GoBites Management System</div>
        
        <script>
          window.addEventListener('load', () => {
            setTimeout(() => { window.print(); }, 600);
          });
        </script>
      </body>
    </html>
  `)
  printWindow.document.close()
}
