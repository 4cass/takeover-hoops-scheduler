import XLSX from 'xlsx-js-style';

/**
 * Export data to Excel file (.xlsx) with professional styling
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

  // Create worksheet data with styling
  const worksheetData: any[][] = [];

  // Add title row
  const titleRow = [{ 
    v: 'TAKEOVER BASKETBALL - PLAYERS REPORT', 
    t: 's',
    s: {
      font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '242833' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    }
  }];
  worksheetData.push(titleRow);

  // Add date row
  const dateRow = [{
    v: `Generated: ${formatDate(new Date(), 'MM/dd/yyyy HH:mm')}`,
    t: 's',
    s: {
      font: { italic: true, sz: 10, color: { rgb: '666666' } },
      alignment: { horizontal: 'center' }
    }
  }];
  worksheetData.push(dateRow);

  // Add empty row for spacing
  worksheetData.push([]);

  // Add header row with styling
  const headerRow = headers.map(header => ({
    v: header,
    t: 's',
    s: {
      font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '79E58F' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: '242833' } },
        bottom: { style: 'thin', color: { rgb: '242833' } },
        left: { style: 'thin', color: { rgb: '242833' } },
        right: { style: 'thin', color: { rgb: '242833' } }
      }
    }
  }));
  worksheetData.push(headerRow);

  // Add data rows with alternating colors
  data.forEach((item, rowIndex) => {
    const rowData = getRowData(item);
    const isEvenRow = rowIndex % 2 === 0;
    
    const styledRow = rowData.map((cellValue, colIndex) => {
      // Special styling for Remaining Balance column (index 3)
      const isBalanceColumn = colIndex === 3;
      
      return {
        v: cellValue,
        t: 's',
        s: {
          font: { 
            sz: 10, 
            color: { rgb: isBalanceColumn ? '242833' : '333333' },
            bold: isBalanceColumn
          },
          fill: { fgColor: { rgb: isEvenRow ? 'F8F9FA' : 'FFFFFF' } },
          alignment: { 
            horizontal: isBalanceColumn ? 'right' : (colIndex < 4 ? 'center' : 'left'), 
            vertical: 'center' 
          },
          border: {
            top: { style: 'thin', color: { rgb: 'E0E0E0' } },
            bottom: { style: 'thin', color: { rgb: 'E0E0E0' } },
            left: { style: 'thin', color: { rgb: 'E0E0E0' } },
            right: { style: 'thin', color: { rgb: 'E0E0E0' } }
          }
        }
      };
    });
    worksheetData.push(styledRow);
  });

  // Add summary footer
  worksheetData.push([]); // Empty row
  const totalPlayers = [{
    v: `Total Players: ${data.length}`,
    t: 's',
    s: {
      font: { bold: true, sz: 11, color: { rgb: '242833' } },
      fill: { fgColor: { rgb: 'E8E8E8' } },
      alignment: { horizontal: 'left' },
      border: {
        top: { style: 'medium', color: { rgb: '242833' } },
        bottom: { style: 'medium', color: { rgb: '242833' } },
        left: { style: 'medium', color: { rgb: '242833' } },
        right: { style: 'medium', color: { rgb: '242833' } }
      }
    }
  }];
  worksheetData.push(totalPlayers);

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Set column widths
  const columnWidths = headers.map((header, colIndex) => {
    const maxLength = Math.max(
      header.length,
      ...data.map(item => {
        const cellValue = getRowData(item)[colIndex];
        return cellValue ? String(cellValue).length : 0;
      })
    );
    return { wch: Math.min(Math.max(maxLength + 4, 14), 45) };
  });
  worksheet['!cols'] = columnWidths;

  // Merge title and date cells across all columns
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }, // Title row merge
    { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } }, // Date row merge
    { s: { r: worksheetData.length - 1, c: 0 }, e: { r: worksheetData.length - 1, c: 2 } } // Footer merge
  ];

  // Set row heights
  worksheet['!rows'] = [
    { hpt: 30 }, // Title row
    { hpt: 18 }, // Date row
    { hpt: 10 }, // Spacer row
    { hpt: 25 }, // Header row
    ...Array(data.length).fill({ hpt: 22 }), // Data rows
    { hpt: 10 }, // Spacer
    { hpt: 22 }  // Footer
  ];

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
