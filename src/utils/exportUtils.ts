import * as XLSX from 'xlsx';

/**
 * Export data to Excel file (.xlsx)
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
    return { wch: Math.min(Math.max(maxLength + 2, 10), 50) }; // Min 10, Max 50
  });
  worksheet['!cols'] = columnWidths;

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

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

