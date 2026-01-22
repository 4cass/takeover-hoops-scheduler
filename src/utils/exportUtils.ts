import * as XLSX from 'xlsx';

/**
 * Apply styling to Excel worksheet
 */
function applyWorksheetStyles(worksheet: XLSX.WorkSheet, headers: string[], dataRowCount: number) {
  // Define styles
  const headerStyle = {
    fill: { fgColor: { rgb: '242833' } },
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12 },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } }
    }
  };

  const dataStyle = {
    font: { sz: 11 },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'CCCCCC' } },
      bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
      left: { style: 'thin', color: { rgb: 'CCCCCC' } },
      right: { style: 'thin', color: { rgb: 'CCCCCC' } }
    }
  };

  const alternateRowStyle = {
    ...dataStyle,
    fill: { fgColor: { rgb: 'F8F9FA' } }
  };

  // Apply header styles
  headers.forEach((_, colIndex) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIndex });
    if (worksheet[cellRef]) {
      worksheet[cellRef].s = headerStyle;
    }
  });

  // Apply data styles with alternating row colors
  for (let rowIndex = 1; rowIndex <= dataRowCount; rowIndex++) {
    headers.forEach((_, colIndex) => {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
      if (worksheet[cellRef]) {
        worksheet[cellRef].s = rowIndex % 2 === 0 ? alternateRowStyle : dataStyle;
      }
    });
  }

  // Set row heights
  worksheet['!rows'] = [
    { hpt: 25 }, // Header row height
    ...Array(dataRowCount).fill({ hpt: 20 }) // Data row heights
  ];

  return worksheet;
}

/**
 * Export data to Excel file (.xlsx) with styling
 */
export function exportToExcel(
  data: any[],
  filename: string,
  headers: string[],
  getRowData: (item: any) => string[]
) {
  if (!data || data.length === 0) {
    return;
  }

  // Prepare data for Excel
  const worksheetData = [
    headers, // Header row
    ...data.map(item => getRowData(item))
  ];

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Set column widths (auto-width based on content)
  const columnWidths = headers.map((header, colIndex) => {
    const maxLength = Math.max(
      header.length,
      ...data.map(item => {
        const cellValue = getRowData(item)[colIndex];
        return cellValue ? String(cellValue).length : 0;
      })
    );
    return { wch: Math.min(Math.max(maxLength + 3, 12), 50) }; // Min 12, Max 50
  });
  worksheet['!cols'] = columnWidths;

  // Apply styling
  applyWorksheetStyles(worksheet, headers, data.length);

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Players Report');

  // Generate Excel file and download
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${formatDate(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.xlsx`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Legacy CSV export (kept for backward compatibility)
 * @deprecated Use exportToExcel instead
 */
export function exportToCSV(
  data: any[],
  filename: string,
  headers: string[],
  getRowData: (item: any) => string[]
) {
  // Redirect to Excel export
  exportToExcel(data, filename, headers, getRowData);
}

/**
 * Format date for export
 */
function formatDate(date: Date, formatStr: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return formatStr
    .replace('yyyy', String(year))
    .replace('MM', month)
    .replace('dd', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

// Use formatDate instead of format to avoid conflict
export function format(date: Date, formatStr: string): string {
  return formatDate(date, formatStr);
}

