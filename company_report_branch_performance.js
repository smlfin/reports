// company_report_branch_performance.js

// --- Configuration ---
const csvUrl = 'https://docs.google.com/spreadsheets/d/1jYlHO8x40Ygbn05DL3tMZ5wHuoZgPjk2fbtEGoDXzko/export?format=csv&gid=1720680457';

// --- Global Data Storage ---
let allData = []; // Stores all parsed CSV rows
let headers = []; // Stores CSV headers
let allCompanyNames = []; // Stores all unique company names for filter search
let isModalOpen = false; // To track modal state

// --- Fixed Date Range for Data Validity (April 2025 - Current Month) ---
const dataStartDate = new Date('2025-04-01T00:00:00'); // April 1, 2025, 00:00:00 local time
const currentDate = new Date(); // Current date and time
const dataEndDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59); // End of the current month

// --- DOM Elements ---
const companySearchInput = document.getElementById('company-search');
const companySelect = document.getElementById('company-select');
const monthSelect = document.getElementById('month-select');
const viewDetailedBtn = document.getElementById('view-detailed-btn');
const detailedEntriesContainer = document.getElementById('detailed-entries-container');
const detailedTableHead = document.querySelector('#detailed-table thead tr');
const detailedTableBody = document.querySelector('#detailed-table tbody');
const noDetailedDataMessage = document.getElementById('no-detailed-data-message');
const noCompanySelectedMessage = document.getElementById('no-company-selected-message');
const branchPerformanceSummarySection = document.getElementById('branch-performance-summary-section');
const branchPerformanceTableBody = document.querySelector('#branch-performance-table tbody');
const noSummaryDataMessage = document.getElementById('no-summary-data-message');

// New DOM Elements for Employee Details Modal
const employeeDetailsModal = document.getElementById('employee-details-modal');
const closeEmployeeModalBtn = document.getElementById('close-employee-modal');
const employeeModalTitle = document.getElementById('employee-modal-title');
const employeeDetailsTableBody = document.querySelector('#employee-details-table tbody');
const employeeDetailsTableHead = document.querySelector('#employee-details-table thead tr');
const noEmployeeDataMessage = document.getElementById('no-employee-data-message');


// --- Utility Functions ---

// Function to parse a single CSV line, handling quoted fields and escaped quotes
function parseLine(line) {
    const fields = [];
    let inQuote = false;
    let currentField = '';

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuote && i + 1 < line.length && line[i + 1] === '"') {
                currentField += '"';
                i++;
            } else {
                inQuote = !inQuote;
            }
        } else if (char === ',' && !inQuote) {
            fields.push(currentField);
            currentField = '';
        } else {
            currentField += char;
        }
    }
    fields.push(currentField);
    return fields.map(field => field.trim());
}

// Robust Date Parsing Function (handles dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy)
function parseDate(dateString) {
    if (!dateString) return null;

    const normalizedDateString = dateString.replace(/[-.]/g, '/');
    const parts = normalizedDateString.split('/');

    if (parts.length === 3) {
        let day = parseInt(parts[0], 10);
        let month = parseInt(parts[1], 10);
        let year = parseInt(parts[2], 10);

        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
            const date = new Date(year, month - 1, day);
            if (date.getDate() === day && (date.getMonth() + 1) === month && date.getFullYear() === year) {
                return date;
            }
        }
    }
    return null;
}

// Function to format numbers in Indian style (xx,xx,xxx)
function formatIndianNumber(num) {
    if (isNaN(num) || num === null) {
        return num;
    }

    let parts = num.toString().split('.');
    let integerPart = parts[0];
    let decimalPart = parts.length > 1 ? '.' + parts[1] : '';

    let sign = '';
    if (integerPart.startsWith('-')) {
        sign = '-';
        integerPart = integerPart.substring(1);
    }

    if (integerPart.length <= 3) {
        return sign + integerPart + decimalPart;
    }

    let lastThree = integerPart.substring(integerPart.length - 3);
    let otherNumbers = integerPart.substring(0, integerPart.length - 3);

    otherNumbers = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',');

    return sign + otherNumbers + ',' + lastThree + decimalPart;
}

// Helper function to parse a numerical value from a string, handling empty/null and commas
function parseNumericalValue(valueString) {
    if (valueString === null || valueString === undefined || valueString === '') {
        return 0;
    }
    const cleanedValue = String(valueString).replace(/,/g, '');
    const parsedValue = parseFloat(cleanedValue);
    return isNaN(parsedValue) ? 0 : parsedValue;
}


// --- Main Data Fetching and Initialization ---
async function init() {
    try {
        const response = await fetch(csvUrl);
        const csvText = await response.text();
        const rows = csvText.trim().split('\n');

        if (rows.length === 0) {
            console.error('No data found in CSV.');
            document.querySelector('.report-container').innerHTML = '<p>Error loading data. No data found.</p>';
            return;
        }

        headers = parseLine(rows[0]).map(header => header.trim());
        
        const dateColIndex = headers.indexOf('DATE');
        const companyColIndex = headers.indexOf('COMPANY NAME');

        allData = rows.slice(1).map(row => {
            const parsedRow = parseLine(row);
            
            // Pad row with nulls if it has fewer columns than headers
            while (parsedRow.length < headers.length) {
                parsedRow.push(null);
            }

            // Ensure DATE is parsed and within range
            if (dateColIndex === -1 || !parsedRow[dateColIndex]) return null;
            const dateObj = parseDate(parsedRow[dateColIndex]);
            if (!dateObj || dateObj < dataStartDate || dateObj > dataEndDate) return null;
            parsedRow[dateColIndex] = dateObj; // Replace date string with Date object
            
            return parsedRow;
        }).filter(row => row !== null); // Remove null entries (invalid/out of range dates)

        populateFilters(); // Populate filters first
        
        // Add event listeners
        companySelect.addEventListener('change', () => {
            generateReport();
        });
        monthSelect.addEventListener('change', generateReport);
        companySearchInput.addEventListener('input', () => {
            const searchText = companySearchInput.value.toLowerCase();
            const filteredCompanies = allCompanyNames.filter(company => company.toLowerCase().includes(searchText));
            populateCompanySelect(filteredCompanies);
            generateReport(); // Re-generate report after company list is filtered and a new one is selected
        });

        // Add event listener to the table body for showing employee details
        branchPerformanceTableBody.addEventListener('click', (event) => {
            const target = event.target.closest('td.branch-name-cell');
            if (target) {
                const branchName = target.dataset.branch;
                const month = target.dataset.month;
                if (branchName) {
                    showEmployeeDetailsModal(branchName, month);
                }
            }
        });
        
        closeEmployeeModalBtn.addEventListener('click', () => {
            employeeDetailsModal.style.display = 'none';
            isModalOpen = false;
        });

        window.addEventListener('click', (event) => {
            if (event.target === employeeDetailsModal) {
                employeeDetailsModal.style.display = 'none';
                isModalOpen = false;
            }
        });

    } catch (error) {
        console.error('Error initializing report:', error);
        document.querySelector('.report-container').innerHTML = '<p>Error loading data. Please try again later.</p>';
    }
}

// --- Filter Population ---
function populateFilters() {
    const companies = new Set();
    const companyColIndex = headers.indexOf('COMPANY NAME');

    allData.forEach(row => {
        if (companyColIndex !== -1 && row[companyColIndex]) companies.add(row[companyColIndex]);
    });

    allCompanyNames = Array.from(companies).sort();

    // Populate Company Select
    populateCompanySelect(allCompanyNames);

    // Populate Month Select
    monthSelect.innerHTML = '<option value="">All Months</option>';
    const startYear = dataStartDate.getFullYear();
    const startMonth = dataStartDate.getMonth();
    const endYear = dataEndDate.getFullYear();
    const endMonth = dataEndDate.getMonth();

    for (let year = startYear; year <= endYear; year++) {
        const currentMonth = (year === startYear) ? startMonth : 0;
        const lastMonth = (year === endYear) ? endMonth : 11;

        for (let month = currentMonth; month <= lastMonth; month++) {
            const date = new Date(year, month, 1);
            const monthName = date.toLocaleString('en-US', { year: 'numeric', month: 'long' });
            const optionValue = `${year}-${String(month + 1).padStart(2, '0')}`; // e.g., "2025-04"

            const option = document.createElement('option');
            option.value = optionValue;
            option.textContent = monthName;
            monthSelect.appendChild(option);
        }
    }
}

// Helper to repopulate company select after search
function populateCompanySelect(companyList) {
    companySelect.innerHTML = '<option value="">-- Select a Company --</option>';
    companyList.forEach(company => {
        const option = document.createElement('option');
        option.value = company;
        option.textContent = company;
        companySelect.appendChild(option);
    });
}

// --- Filter Data ---
function getFilteredData() {
    const selectedCompany = companySelect.value;
    const selectedMonth = monthSelect.value;

    if (!selectedCompany) {
        return []; // No company selected, return empty array
    }

    const companyColIndex = headers.indexOf('COMPANY NAME');
    const dateColIndex = headers.indexOf('DATE');

    return allData.filter(row => {
        // Filter by Company (must be selected)
        if (companyColIndex === -1 || row[companyColIndex] !== selectedCompany) {
            return false;
        }

        // Filter by Month (if selected)
        if (selectedMonth && dateColIndex !== -1) {
            const rowDate = row[dateColIndex];
            const rowMonth = `${rowDate.getFullYear()}-${String(rowDate.getMonth() + 1).padStart(2, '0')}`;
            if (rowMonth !== selectedMonth) return false;
        }

        return true;
    });
}

// --- Generate Report ---
function generateReport() {
    const selectedCompany = companySelect.value;
    const selectedMonth = monthSelect.value;

    if (!selectedCompany) {
        noCompanySelectedMessage.style.display = 'block';
        branchPerformanceSummarySection.style.display = 'none';
        return;
    } else {
        noCompanySelectedMessage.style.display = 'none';
        branchPerformanceSummarySection.style.display = 'block';
    }

    const filteredData = getFilteredData();
    const branchColIndex = headers.indexOf('BRANCH');
    const inflowColIndex = headers.indexOf('INF Total');
    const outflowColIndex = headers.indexOf('OUT Total');

    // Aggregate data by branch, regardless of whether a month is selected.
    // The getFilteredData() function handles the month-specific filtering.
    const branchPerformance = {};
    filteredData.forEach(row => {
        const branchName = branchColIndex !== -1 && row[branchColIndex] ? row[branchColIndex] : 'Unassigned Branch';
        const inflow = parseNumericalValue(row[inflowColIndex]);
        const outflow = parseNumericalValue(row[outflowColIndex]);

        if (!branchPerformance[branchName]) {
            branchPerformance[branchName] = { inflow: 0, outflow: 0, net: 0 };
        }
        branchPerformance[branchName].inflow += inflow;
        branchPerformance[branchName].outflow += outflow;
        branchPerformance[branchName].net += (inflow - outflow);
    });

    renderBranchPerformanceTable(branchPerformance, selectedMonth);

    // Hide detailed entries if they were open from a previous view
    detailedEntriesContainer.style.display = 'none';
    noDetailedDataMessage.style.display = 'none';
}


function renderBranchPerformanceTable(data, selectedMonth) {
    branchPerformanceTableBody.innerHTML = '';
    
    if (Object.keys(data).length === 0) {
        noSummaryDataMessage.style.display = 'block';
        return;
    } else {
        noSummaryDataMessage.style.display = 'none';
    }
    
    let totalInflow = 0;
    let totalOutflow = 0;
    let totalNet = 0;

    const branchNames = Object.keys(data).sort();
    
    branchNames.forEach(branchName => {
        const branchData = data[branchName];
        const tr = document.createElement('tr');
        const monthDisplay = selectedMonth ? selectedMonth : 'All Months';

        tr.innerHTML = `
            <td>${monthDisplay}</td>
            <td class="branch-name-cell" data-month="${selectedMonth}" data-branch="${branchName}">${branchName}</td>
            <td>${formatIndianNumber(branchData.inflow)}</td>
            <td>${formatIndianNumber(branchData.outflow)}</td>
            <td class="${branchData.net >= 0 ? 'positive' : 'negative'}">${formatIndianNumber(branchData.net)}</td>
        `;
        branchPerformanceTableBody.appendChild(tr);

        totalInflow += branchData.inflow;
        totalOutflow += branchData.outflow;
        totalNet += branchData.net;
    });

    // Render totals row
    const totalsRow = document.createElement('tr');
    totalsRow.classList.add('totals-row');
    totalsRow.innerHTML = `
        <td></td>
        <td>Total</td>
        <td>${formatIndianNumber(totalInflow)}</td>
        <td>${formatIndianNumber(totalOutflow)}</td>
        <td class="${totalNet >= 0 ? 'positive' : 'negative'}">${formatIndianNumber(totalNet)}</td>
    `;
    branchPerformanceTableBody.appendChild(totalsRow);
}

// --- Detailed Entries Section ---
function renderDetailedEntries(branchName, month) {
    const detailedData = getFilteredData().filter(row => {
        const branchColIndex = headers.indexOf('BRANCH');
        const rowBranchName = branchColIndex !== -1 && row[branchColIndex] ? row[branchColIndex] : 'Unassigned Branch';
        return rowBranchName === branchName;
    });

    if (detailedData.length === 0) {
        noDetailedDataMessage.style.display = 'block';
        detailedTableHead.style.display = 'none';
        detailedTableBody.innerHTML = '';
        return;
    } else {
        noDetailedDataMessage.style.display = 'none';
        detailedTableHead.style.display = 'table-row';
    }
    
    detailedTableBody.innerHTML = '';
    const relevantHeaders = ['DATE', 'COMPANY NAME', 'BRANCH', 'STAFF NAME', 'INF Total', 'OUT Total', 'STATUS'];
    const headerIndices = relevantHeaders.map(header => headers.indexOf(header));
    
    // Render detailed table headers
    detailedTableHead.innerHTML = relevantHeaders.map(header => `<th>${header}</th>`).join('');

    // Render detailed table rows
    const statusColIndex = headers.indexOf('STATUS'); // Get status index here
    detailedData.forEach(row => {
        const tr = document.createElement('tr');
        if (statusColIndex !== -1 && row[statusColIndex] === 'Resigned') {
            tr.classList.add('resigned-staff');
        }

        const cells = headerIndices.map(index => {
            const value = row[index];
            const cellValue = (headers[index] === 'DATE' && value instanceof Date) ? value.toLocaleDateString() : value;
            return `<td>${cellValue !== null ? cellValue : ''}</td>`;
        }).join('');
        tr.innerHTML = cells;
        detailedTableBody.appendChild(tr);
    });
}

// --- Employee Details Modal Functions (FIXED) ---
function showEmployeeDetailsModal(branchName, selectedMonth) {
    // Show the modal
    employeeDetailsModal.style.display = 'block';
    isModalOpen = true;

    // Use the already filtered data from the main report logic
    const branchFilteredData = getFilteredData().filter(row => {
        const branchColIndex = headers.indexOf('BRANCH');
        const rowBranchName = branchColIndex !== -1 && row[branchColIndex] ? row[branchColIndex] : 'Unassigned Branch';
        return rowBranchName === branchName;
    });

    const employeeColIndex = headers.indexOf('STAFF NAME');
    const inflowColIndex = headers.indexOf('INF Total');
    const outflowColIndex = headers.indexOf('OUT Total');
    const dateColIndex = headers.indexOf('DATE');

    if (branchFilteredData.length === 0 || employeeColIndex === -1 || inflowColIndex === -1 || outflowColIndex === -1) {
        noEmployeeDataMessage.style.display = 'block';
        employeeDetailsTableBody.innerHTML = '';
        employeeModalTitle.textContent = `Employees in ${branchName} - No Data`;
        return;
    } else {
        noEmployeeDataMessage.style.display = 'none';
        employeeModalTitle.textContent = `Employees in ${branchName} (${selectedMonth ? selectedMonth : 'All Months'})`;
    }

    // Aggregate data by employee and month
    const employeeData = {};
    const uniqueMonths = new Set();
    
    branchFilteredData.forEach(row => {
        const employeeName = row[employeeColIndex];
        const monthKey = row[dateColIndex].toLocaleString('en-US', { year: 'numeric', month: 'short' });
        uniqueMonths.add(monthKey);
        
        const inflow = parseNumericalValue(row[inflowColIndex]);
        const outflow = parseNumericalValue(row[outflowColIndex]);
        const net = inflow - outflow;

        if (!employeeData[employeeName]) {
            employeeData[employeeName] = { totalNet: 0, months: {} };
        }

        if (!employeeData[employeeName].months[monthKey]) {
            employeeData[employeeName].months[monthKey] = { net: 0 };
        }
        
        employeeData[employeeName].months[monthKey].net += net;
        employeeData[employeeName].totalNet += net;
    });

    // Sort months to ensure columns are in chronological order
    const sortedMonths = Array.from(uniqueMonths).sort((a, b) => new Date(a) - new Date(b));

    // Render the table headers dynamically
    let headerContent = '<th>Employee Name</th>';
    sortedMonths.forEach(month => {
        headerContent += `<th>${month} Net</th>`;
    });
    headerContent += '<th>Total Net</th>';
    employeeDetailsTableHead.innerHTML = headerContent;

    // Render the table body
    employeeDetailsTableBody.innerHTML = '';
    const employeeNames = Object.keys(employeeData).sort();
    
    employeeNames.forEach(name => {
        const employeeInfo = employeeData[name];
        const tr = document.createElement('tr');
        
        let rowContent = `<td>${name}</td>`;
        
        sortedMonths.forEach(month => {
            const monthInfo = employeeInfo.months[month];
            const netValue = monthInfo ? formatIndianNumber(monthInfo.net) : '-'; // Show '-' if no data for month
            const netClass = monthInfo && monthInfo.net >= 0 ? 'positive' : 'negative';
            rowContent += `<td class="${netClass}">${netValue}</td>`;
        });

        const totalNetClass = employeeInfo.totalNet >= 0 ? 'positive' : 'negative';
        rowContent += `<td class="${totalNetClass}"><strong>${formatIndianNumber(employeeInfo.totalNet)}</strong></td>`;
        
        tr.innerHTML = rowContent;
        employeeDetailsTableBody.appendChild(tr);
    });

    employeeDetailsModal.style.display = 'block';
}


// --- Initialize the report when the page loads ---
document.addEventListener('DOMContentLoaded', init);

