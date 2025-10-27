<<<<<<< HEAD
// resigned_staff_report.js

// --- Configuration ---
const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1OOdGnJhw1k6U15Aybn_2JWex_qTShP6w7CXm0_auXnc8vFnvlabPZjK3lsjqkHgn6NgeKKPyu9qW/pub?gid=1720680457&single=true&output=csv';

// --- Global Data Storage ---
let allData = []; // Stores all parsed CSV rows
let headers = []; // Stores CSV headers
let allCompanyNames = []; // Stores all unique company names for search functionality
let allResignedStaffNames = []; // Stores all unique resigned staff names for search functionality

// --- Fixed Date Range for Data Validity (April 2025 to Current Month) ---
const dataStartDate = new Date('2025-04-01T00:00:00'); // April 1, 2025, 00:00:00 local time
const currentDate = new Date(); // Current date and time
const dataEndDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59); // End of the current month

// --- DOM Elements ---
const monthSelect = document.getElementById('month-select');
const companySearchInput = document.getElementById('company-search');
const companySelect = document.getElementById('company-select');
const staffSearchInput = document.getElementById('staff-search');
const staffSelect = document.getElementById('staff-select');
const viewDetailedEntriesBtn = document.getElementById('view-detailed-entries-btn');

const overallTotalInflowEl = document.getElementById('overall-total-inflow');
const overallTotalOutflowEl = document.getElementById('overall-total-outflow');
const overallTotalNetGrowthEl = document.getElementById('overall-total-net-growth');

const companySummaryTableBody = document.querySelector('#company-summary-table tbody');
const noCompanyDataMessage = document.getElementById('no-company-data-message');

const monthlyTableBody = document.querySelector('#monthly-table tbody');
const noMonthlyDataMessage = document.getElementById('no-monthly-data-message');

const detailedEntriesContainer = document.getElementById('detailed-entries-container');
const detailedTableHead = document.querySelector('#detailed-table thead tr');
const detailedTableBody = document.querySelector('#detailed-table tbody');
const noDetailedDataMessage = document.getElementById('no-detailed-data-message');


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
        
        allData = rows.slice(1).map(row => {
            const parsedRow = parseLine(row);
            const dateColIndex = headers.indexOf('DATE');
            
            // Pad row with nulls if it has fewer columns than headers
            while (parsedRow.length < headers.length) {
                parsedRow.push(null);
            }

            if (dateColIndex !== -1 && parsedRow[dateColIndex]) {
                const dateObj = parseDate(parsedRow[dateColIndex]);
                // Filter rows based on the date range (April 2025 to end of current month)
                if (dateObj && dateObj >= dataStartDate && dateObj <= dataEndDate) {
                    parsedRow[dateColIndex] = dateObj; // Replace date string with Date object
                    return parsedRow;
                }
            }
            return null; // Invalid date or outside range, mark for removal
        }).filter(row => row !== null); // Remove null entries (invalid/out of range dates)

        populateFilters(); // Populate filters first
        generateReport(); // Then generate the report based on initial filter states
    } catch (error) {
        console.error('Error initializing report:', error);
        document.querySelector('.report-container').innerHTML = '<p>Error loading data. Please try again later.</p>';
    }
}

// --- Filter Population ---
function populateFilters() {
    const companies = new Set();
    const resignedStaff = new Set();
    
    const companyColIndex = headers.indexOf('COMPANY NAME');
    const staffNameColIndex = headers.indexOf('STAFF NAME');
    const statusColIndex = headers.indexOf('STATUS'); // Get index for STATUS column

    allData.forEach(row => {
        // Only consider staff who have a STATUS of 'RESIGNED'
        if (statusColIndex !== -1 && row[statusColIndex] && row[statusColIndex].toUpperCase() === 'RESIGNED') {
            if (companyColIndex !== -1 && row[companyColIndex]) companies.add(row[companyColIndex]);
            if (staffNameColIndex !== -1 && row[staffNameColIndex]) resignedStaff.add(row[staffNameColIndex]);
        }
    });

    allCompanyNames = Array.from(companies).sort();
    allResignedStaffNames = Array.from(resignedStaff).sort();

    filterCompanyList(); // Populate company select initially
    filterStaffList(); // Populate staff select initially

    // Populate Month Select from April 2025 to the current month
    monthSelect.innerHTML = '<option value="">All Months</option>';
    
    let currentMonthIterator = new Date(dataStartDate.getFullYear(), dataStartDate.getMonth(), 1); // Start from April 2025
    while (currentMonthIterator <= dataEndDate) { // Iterate up to the current month (inclusive of current month's start)
        const year = currentMonthIterator.getFullYear();
        const month = (currentMonthIterator.getMonth() + 1).toString().padStart(2, '0');
        const optionValue = `${year}-${month}`;
        const optionText = currentMonthIterator.toLocaleString('en-IN', { year: 'numeric', month: 'long' });

        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionText;
        monthSelect.appendChild(option);

        currentMonthIterator.setMonth(currentMonthIterator.getMonth() + 1);
    }
}

// --- Filter Company Dropdown based on Search Input ---
function filterCompanyList() {
    const searchTerm = companySearchInput.value.toLowerCase();
    companySelect.innerHTML = '<option value="">All Companies</option>';

    allCompanyNames.filter(company => company.toLowerCase().includes(searchTerm))
                 .forEach(company => {
                     const option = document.createElement('option');
                     option.value = company;
                     option.textContent = company;
                     companySelect.appendChild(option);
                 });
    
    const exactMatchOption = allCompanyNames.find(company => company.toLowerCase() === searchTerm);
    if (exactMatchOption && searchTerm !== '') {
        companySelect.value = exactMatchOption;
    } else {
        companySelect.selectedIndex = 0;
    }
    // Do NOT call generateReport() or filterStaffList() here directly. They will be called by event listeners.
}

// --- Filter Staff Dropdown based on Search Input and Company selection ---
function filterStaffList() {
    const searchTerm = staffSearchInput.value.toLowerCase();
    staffSelect.innerHTML = '<option value="">All Staff</option>';

    const selectedCompany = companySelect.value;
    let relevantStaff = allResignedStaffNames; // Start with all resigned staff names

    // Filter staff based on selected company first
    if (selectedCompany) {
        const companyColIndex = headers.indexOf('COMPANY NAME');
        const staffNameColIndex = headers.indexOf('STAFF NAME');
        const statusColIndex = headers.indexOf('STATUS'); // Get index for STATUS column
        const staffInCompany = new Set();
        allData.forEach(row => {
            if (statusColIndex !== -1 && row[statusColIndex] && row[statusColIndex].toUpperCase() === 'RESIGNED' &&
                companyColIndex !== -1 && row[companyColIndex] === selectedCompany &&
                staffNameColIndex !== -1 && row[staffNameColIndex]) {
                staffInCompany.add(row[staffNameColIndex]);
            }
        });
        relevantStaff = Array.from(staffInCompany).sort();
    }

    // Then filter by search term
    relevantStaff.filter(staff => staff.toLowerCase().includes(searchTerm))
                 .forEach(staff => {
                     const option = document.createElement('option');
                     option.value = staff;
                     option.textContent = staff;
                     staffSelect.appendChild(option);
                 });
    
    const exactMatchOption = relevantStaff.find(staff => staff.toLowerCase() === searchTerm);
    if (exactMatchOption && searchTerm !== '') {
        staffSelect.value = exactMatchOption;
    } else {
        staffSelect.selectedIndex = 0;
    }
    // Do NOT call generateReport() here directly. It will be called by the event listener.
}


// --- Filter Data based on selections, specifically for resigned staff ---
function getFilteredData() {
    const selectedCompany = companySelect.value;
    const selectedStaff = staffSelect.value;
    const selectedMonth = monthSelect.value; // YYYY-MM format

    const dateColIndex = headers.indexOf('DATE');
    const companyColIndex = headers.indexOf('COMPANY NAME');
    const staffNameColIndex = headers.indexOf('STAFF NAME');
    const statusColIndex = headers.indexOf('STATUS'); // Get index for STATUS column

    return allData.filter(row => {
        // Must be a resigned staff entry (checked via STATUS column)
        if (!(statusColIndex !== -1 && row[statusColIndex] && row[statusColIndex].toUpperCase() === 'RESIGNED')) {
            return false;
        }

        let matchCompany = true;
        let matchStaff = true;
        let matchMonth = true;
        
        const rowDate = row[dateColIndex];

        if (selectedCompany && companyColIndex !== -1) {
            matchCompany = (row[companyColIndex] === selectedCompany);
        }
        
        if (selectedStaff && staffNameColIndex !== -1) {
            matchStaff = (row[staffNameColIndex] === selectedStaff);
        }
        
        if (selectedMonth && rowDate) {
            const rowYearMonth = `${rowDate.getFullYear()}-${(rowDate.getMonth() + 1).toString().padStart(2, '0')}`;
            matchMonth = (rowYearMonth === selectedMonth);
        }
        return matchCompany && matchStaff && matchMonth;
    });
}

// --- Report Generation ---
function generateReport() {
    const filteredData = getFilteredData();
    const infTotalColIndex = headers.indexOf('INF Total');
    const outTotalColIndex = headers.indexOf('OUT Total');
    const dateColIndex = headers.indexOf('DATE');
    const companyColIndex = headers.indexOf('COMPANY NAME');
    const staffNameColIndex = headers.indexOf('STAFF NAME');
    const statusColIndex = headers.indexOf('STATUS');

    // Hide detailed entries by default when report is generated/re-generated
    detailedEntriesContainer.style.display = 'none';

    // --- Calculate Overall Resigned Staff Summary (April 2025 - Current Month) ---
    // This calculation should always be based on all 'resigned staff' data within the fixed date range
    let overallInflow = 0;
    let overallOutflow = 0;
    let distinctResignedStaffCount = new Set();

    allData.filter(row => (statusColIndex !== -1 && row[statusColIndex] && row[statusColIndex].toUpperCase() === 'RESIGNED'))
           .forEach(row => {
        if (infTotalColIndex !== -1) {
            overallInflow += parseNumericalValue(row[infTotalColIndex]);
        }
        if (outTotalColIndex !== -1) {
            overallOutflow += parseNumericalValue(row[outTotalColIndex]);
        }
        if (staffNameColIndex !== -1 && row[staffNameColIndex]) {
            distinctResignedStaffCount.add(row[staffNameColIndex]);
        }
    });
    const overallNetGrowth = overallInflow - overallOutflow;

    overallTotalInflowEl.textContent = formatIndianNumber(overallInflow);
    overallTotalOutflowEl.textContent = formatIndianNumber(overallOutflow);
    overallTotalNetGrowthEl.textContent = formatIndianNumber(overallNetGrowth);


    // --- Calculate Company-wise Summary for Resigned Staff ---
    const companySummary = {}; // Key: Company Name, Value: { inflow: X, outflow: Y, net: Z, staffCount: N }
    
    filteredData.forEach(row => {
        const companyName = row[companyColIndex];
        const staffName = row[staffNameColIndex];
        if (!companyName) return;

        if (!companySummary[companyName]) {
            companySummary[companyName] = { inflow: 0, outflow: 0, net: 0, staffNames: new Set() };
        }

        if (infTotalColIndex !== -1) {
            companySummary[companyName].inflow += parseNumericalValue(row[infTotalColIndex]);
        }
        if (outTotalColIndex !== -1) {
            companySummary[companyName].outflow += parseNumericalValue(row[outTotalColIndex]);
        }
        companySummary[companyName].net = companySummary[companyName].inflow - companySummary[companyName].outflow;
        if (staffName) {
            companySummary[companyName].staffNames.add(staffName);
        }
    });

    companySummaryTableBody.innerHTML = ''; // Clear previous data
    const sortedCompanies = Object.keys(companySummary).sort();
    if (sortedCompanies.length === 0) {
        noCompanyDataMessage.style.display = 'block';
    } else {
        noCompanyDataMessage.style.display = 'none';
        sortedCompanies.forEach(companyName => {
            const data = companySummary[companyName];
            const row = companySummaryTableBody.insertRow();
            row.insertCell().textContent = companyName;
            row.insertCell().textContent = formatIndianNumber(data.inflow);
            row.insertCell().textContent = formatIndianNumber(data.outflow);
            row.insertCell().textContent = formatIndianNumber(data.net);
            row.insertCell().textContent = data.staffNames.size; // Number of unique resigned staff in this company
        });
    }

    // --- Calculate Monthly Breakup for Resigned Staff (for selected company/staff or all) ---
    const monthlyData = {}; // Key: YYYY-MM, Value: { inflow: X, outflow: Y, net: Z }
    
    filteredData.forEach(row => {
        const date = row[dateColIndex];
        if (!date) return;

        const yearMonth = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;

        if (!monthlyData[yearMonth]) {
            monthlyData[yearMonth] = { inflow: 0, outflow: 0, net: 0 };
        }

        if (infTotalColIndex !== -1) {
            monthlyData[yearMonth].inflow += parseNumericalValue(row[infTotalColIndex]);
        }
        if (outTotalColIndex !== -1) {
            monthlyData[yearMonth].outflow += parseNumericalValue(row[outTotalColIndex]);
        }
        monthlyData[yearMonth].net = monthlyData[yearMonth].inflow - monthlyData[yearMonth].outflow;
    });

    monthlyTableBody.innerHTML = ''; // Clear previous data
    const sortedMonths = Object.keys(monthlyData).sort();
    if (sortedMonths.length === 0) {
        noMonthlyDataMessage.style.display = 'block';
    } else {
        noMonthlyDataMessage.style.display = 'none';
        sortedMonths.forEach(monthKey => {
            const data = monthlyData[monthKey];
            const row = monthlyTableBody.insertRow();
            const monthName = new Date(monthKey + '-01').toLocaleString('en-IN', { year: 'numeric', month: 'long' });
            
            row.insertCell().textContent = monthName;
            row.insertCell().textContent = formatIndianNumber(data.inflow);
            row.insertCell().textContent = formatIndianNumber(data.outflow);
            row.insertCell().textContent = formatIndianNumber(data.net);
        });
    }
}

// --- Detailed Entries View ---
function viewDetailedEntries() {
    const filteredData = getFilteredData();

    detailedEntriesContainer.style.display = 'block';

    detailedTableHead.innerHTML = '';
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        detailedTableHead.appendChild(th);
    });

    detailedTableBody.innerHTML = '';
    if (filteredData.length === 0) {
        noDetailedDataMessage.style.display = 'block';
        detailedTableBody.innerHTML = '<tr><td colspan="' + headers.length + '"></td></tr>';
        return;
    } else {
        noDetailedDataMessage.style.display = 'none';
    }

    filteredData.forEach(rowData => {
        const tr = detailedTableBody.insertRow();
        rowData.forEach((cellData, index) => {
            const td = tr.insertCell();
            let content = cellData;
            
            if (headers[index] === 'DATE' && cellData instanceof Date) {
                content = cellData.toLocaleDateString('en-IN');
            }
            else {
                const numericalHeaders = [
                    'SML NCD INF', 'SML SD INF', 'SML GB INF', 'SML BDSL', 'VFL NCD INF', 'VFL SD INF', 'VFL GB INF',
                    'SNL FD INF', 'LLP INF', 'INF Total', 'SNL FD INF.1', 'VFL NCD OUT', 'VFL BD OUT', 'SML PURCHASE',
                    'SML NCD OUT', 'SML SD OUT', 'SML GB OUT', 'LLP OUT', 'OUT Total', 'Net'
                ];
                if (numericalHeaders.includes(headers[index])) {
                    const numValue = parseNumericalValue(content);
                    if (!isNaN(numValue)) {
                        content = formatIndianNumber(numValue);
                    }
                }
            }
            td.textContent = content;
        });
    });
}

// --- Event Listeners ---
monthSelect.addEventListener('change', generateReport);
companySelect.addEventListener('change', () => {
    filterStaffList(); // Re-filter staff list first based on new company selection
    generateReport();  // Then generate report
});
companySearchInput.addEventListener('input', () => {
    filterCompanyList(); // Filter company dropdown
    filterStaffList();   // Re-filter staff list based on updated company filter
    generateReport();    // Then generate report
});
staffSelect.addEventListener('change', generateReport);
staffSearchInput.addEventListener('input', () => {
    filterStaffList();   // Filter staff dropdown
    generateReport();    // Then generate report
});
viewDetailedEntriesBtn.addEventListener('click', viewDetailedEntries);

// --- Initialize the report when the page loads ---
document.addEventListener('DOMContentLoaded', init);
=======
// resigned_staff_report.js

// --- Configuration ---
const csvUrl = 'https://docs.google.com/spreadsheets/d/1jYlHO8x40Ygbn05DL3tMZ5wHuoZgPjk2fbtEGoDXzko/export?format=csv&gid=1720680457';

// --- Global Data Storage ---
let allData = []; // Stores all parsed CSV rows
let headers = []; // Stores CSV headers
let allCompanyNames = []; // Stores all unique company names for search functionality
let allResignedStaffNames = []; // Stores all unique resigned staff names for search functionality

// --- Fixed Date Range for Data Validity (April 2025 to Current Month) ---
const dataStartDate = new Date('2025-04-01T00:00:00'); // April 1, 2025, 00:00:00 local time
const currentDate = new Date(); // Current date and time
const dataEndDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59); // End of the current month

// --- DOM Elements ---
const monthSelect = document.getElementById('month-select');
const companySearchInput = document.getElementById('company-search');
const companySelect = document.getElementById('company-select');
const staffSearchInput = document.getElementById('staff-search');
const staffSelect = document.getElementById('staff-select');
const viewDetailedEntriesBtn = document.getElementById('view-detailed-entries-btn');

const overallTotalInflowEl = document.getElementById('overall-total-inflow');
const overallTotalOutflowEl = document.getElementById('overall-total-outflow');
const overallTotalNetGrowthEl = document.getElementById('overall-total-net-growth');

const companySummaryTableBody = document.querySelector('#company-summary-table tbody');
const noCompanyDataMessage = document.getElementById('no-company-data-message');

const monthlyTableBody = document.querySelector('#monthly-table tbody');
const noMonthlyDataMessage = document.getElementById('no-monthly-data-message');

const detailedEntriesContainer = document.getElementById('detailed-entries-container');
const detailedTableHead = document.querySelector('#detailed-table thead tr');
const detailedTableBody = document.querySelector('#detailed-table tbody');
const noDetailedDataMessage = document.getElementById('no-detailed-data-message');


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
        
        allData = rows.slice(1).map(row => {
            const parsedRow = parseLine(row);
            const dateColIndex = headers.indexOf('DATE');
            
            // Pad row with nulls if it has fewer columns than headers
            while (parsedRow.length < headers.length) {
                parsedRow.push(null);
            }

            if (dateColIndex !== -1 && parsedRow[dateColIndex]) {
                const dateObj = parseDate(parsedRow[dateColIndex]);
                // Filter rows based on the date range (April 2025 to end of current month)
                if (dateObj && dateObj >= dataStartDate && dateObj <= dataEndDate) {
                    parsedRow[dateColIndex] = dateObj; // Replace date string with Date object
                    return parsedRow;
                }
            }
            return null; // Invalid date or outside range, mark for removal
        }).filter(row => row !== null); // Remove null entries (invalid/out of range dates)

        populateFilters(); // Populate filters first
        generateReport(); // Then generate the report based on initial filter states
    } catch (error) {
        console.error('Error initializing report:', error);
        document.querySelector('.report-container').innerHTML = '<p>Error loading data. Please try again later.</p>';
    }
}

// --- Filter Population ---
function populateFilters() {
    const companies = new Set();
    const resignedStaff = new Set();
    
    const companyColIndex = headers.indexOf('COMPANY NAME');
    const staffNameColIndex = headers.indexOf('STAFF NAME');
    const statusColIndex = headers.indexOf('STATUS'); // Get index for STATUS column

    allData.forEach(row => {
        // Only consider staff who have a STATUS of 'RESIGNED'
        if (statusColIndex !== -1 && row[statusColIndex] && row[statusColIndex].toUpperCase() === 'RESIGNED') {
            if (companyColIndex !== -1 && row[companyColIndex]) companies.add(row[companyColIndex]);
            if (staffNameColIndex !== -1 && row[staffNameColIndex]) resignedStaff.add(row[staffNameColIndex]);
        }
    });

    allCompanyNames = Array.from(companies).sort();
    allResignedStaffNames = Array.from(resignedStaff).sort();

    filterCompanyList(); // Populate company select initially
    filterStaffList(); // Populate staff select initially

    // Populate Month Select from April 2025 to the current month
    monthSelect.innerHTML = '<option value="">All Months</option>';
    
    let currentMonthIterator = new Date(dataStartDate.getFullYear(), dataStartDate.getMonth(), 1); // Start from April 2025
    while (currentMonthIterator <= dataEndDate) { // Iterate up to the current month (inclusive of current month's start)
        const year = currentMonthIterator.getFullYear();
        const month = (currentMonthIterator.getMonth() + 1).toString().padStart(2, '0');
        const optionValue = `${year}-${month}`;
        const optionText = currentMonthIterator.toLocaleString('en-IN', { year: 'numeric', month: 'long' });

        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionText;
        monthSelect.appendChild(option);

        currentMonthIterator.setMonth(currentMonthIterator.getMonth() + 1);
    }
}

// --- Filter Company Dropdown based on Search Input ---
function filterCompanyList() {
    const searchTerm = companySearchInput.value.toLowerCase();
    companySelect.innerHTML = '<option value="">All Companies</option>';

    allCompanyNames.filter(company => company.toLowerCase().includes(searchTerm))
                 .forEach(company => {
                     const option = document.createElement('option');
                     option.value = company;
                     option.textContent = company;
                     companySelect.appendChild(option);
                 });
    
    const exactMatchOption = allCompanyNames.find(company => company.toLowerCase() === searchTerm);
    if (exactMatchOption && searchTerm !== '') {
        companySelect.value = exactMatchOption;
    } else {
        companySelect.selectedIndex = 0;
    }
    // Do NOT call generateReport() or filterStaffList() here directly. They will be called by event listeners.
}

// --- Filter Staff Dropdown based on Search Input and Company selection ---
function filterStaffList() {
    const searchTerm = staffSearchInput.value.toLowerCase();
    staffSelect.innerHTML = '<option value="">All Staff</option>';

    const selectedCompany = companySelect.value;
    let relevantStaff = allResignedStaffNames; // Start with all resigned staff names

    // Filter staff based on selected company first
    if (selectedCompany) {
        const companyColIndex = headers.indexOf('COMPANY NAME');
        const staffNameColIndex = headers.indexOf('STAFF NAME');
        const statusColIndex = headers.indexOf('STATUS'); // Get index for STATUS column
        const staffInCompany = new Set();
        allData.forEach(row => {
            if (statusColIndex !== -1 && row[statusColIndex] && row[statusColIndex].toUpperCase() === 'RESIGNED' &&
                companyColIndex !== -1 && row[companyColIndex] === selectedCompany &&
                staffNameColIndex !== -1 && row[staffNameColIndex]) {
                staffInCompany.add(row[staffNameColIndex]);
            }
        });
        relevantStaff = Array.from(staffInCompany).sort();
    }

    // Then filter by search term
    relevantStaff.filter(staff => staff.toLowerCase().includes(searchTerm))
                 .forEach(staff => {
                     const option = document.createElement('option');
                     option.value = staff;
                     option.textContent = staff;
                     staffSelect.appendChild(option);
                 });
    
    const exactMatchOption = relevantStaff.find(staff => staff.toLowerCase() === searchTerm);
    if (exactMatchOption && searchTerm !== '') {
        staffSelect.value = exactMatchOption;
    } else {
        staffSelect.selectedIndex = 0;
    }
    // Do NOT call generateReport() here directly. It will be called by the event listener.
}


// --- Filter Data based on selections, specifically for resigned staff ---
function getFilteredData() {
    const selectedCompany = companySelect.value;
    const selectedStaff = staffSelect.value;
    const selectedMonth = monthSelect.value; // YYYY-MM format

    const dateColIndex = headers.indexOf('DATE');
    const companyColIndex = headers.indexOf('COMPANY NAME');
    const staffNameColIndex = headers.indexOf('STAFF NAME');
    const statusColIndex = headers.indexOf('STATUS'); // Get index for STATUS column

    return allData.filter(row => {
        // Must be a resigned staff entry (checked via STATUS column)
        if (!(statusColIndex !== -1 && row[statusColIndex] && row[statusColIndex].toUpperCase() === 'RESIGNED')) {
            return false;
        }

        let matchCompany = true;
        let matchStaff = true;
        let matchMonth = true;
        
        const rowDate = row[dateColIndex];

        if (selectedCompany && companyColIndex !== -1) {
            matchCompany = (row[companyColIndex] === selectedCompany);
        }
        
        if (selectedStaff && staffNameColIndex !== -1) {
            matchStaff = (row[staffNameColIndex] === selectedStaff);
        }
        
        if (selectedMonth && rowDate) {
            const rowYearMonth = `${rowDate.getFullYear()}-${(rowDate.getMonth() + 1).toString().padStart(2, '0')}`;
            matchMonth = (rowYearMonth === selectedMonth);
        }
        return matchCompany && matchStaff && matchMonth;
    });
}

// --- Report Generation ---
function generateReport() {
    const filteredData = getFilteredData();
    const infTotalColIndex = headers.indexOf('INF Total');
    const outTotalColIndex = headers.indexOf('OUT Total');
    const dateColIndex = headers.indexOf('DATE');
    const companyColIndex = headers.indexOf('COMPANY NAME');
    const staffNameColIndex = headers.indexOf('STAFF NAME');
    const statusColIndex = headers.indexOf('STATUS');

    // Hide detailed entries by default when report is generated/re-generated
    detailedEntriesContainer.style.display = 'none';

    // --- Calculate Overall Resigned Staff Summary (April 2025 - Current Month) ---
    // This calculation should always be based on all 'resigned staff' data within the fixed date range
    let overallInflow = 0;
    let overallOutflow = 0;
    let distinctResignedStaffCount = new Set();

    allData.filter(row => (statusColIndex !== -1 && row[statusColIndex] && row[statusColIndex].toUpperCase() === 'RESIGNED'))
           .forEach(row => {
        if (infTotalColIndex !== -1) {
            overallInflow += parseNumericalValue(row[infTotalColIndex]);
        }
        if (outTotalColIndex !== -1) {
            overallOutflow += parseNumericalValue(row[outTotalColIndex]);
        }
        if (staffNameColIndex !== -1 && row[staffNameColIndex]) {
            distinctResignedStaffCount.add(row[staffNameColIndex]);
        }
    });
    const overallNetGrowth = overallInflow - overallOutflow;

    overallTotalInflowEl.textContent = formatIndianNumber(overallInflow);
    overallTotalOutflowEl.textContent = formatIndianNumber(overallOutflow);
    overallTotalNetGrowthEl.textContent = formatIndianNumber(overallNetGrowth);


    // --- Calculate Company-wise Summary for Resigned Staff ---
    const companySummary = {}; // Key: Company Name, Value: { inflow: X, outflow: Y, net: Z, staffCount: N }
    
    filteredData.forEach(row => {
        const companyName = row[companyColIndex];
        const staffName = row[staffNameColIndex];
        if (!companyName) return;

        if (!companySummary[companyName]) {
            companySummary[companyName] = { inflow: 0, outflow: 0, net: 0, staffNames: new Set() };
        }

        if (infTotalColIndex !== -1) {
            companySummary[companyName].inflow += parseNumericalValue(row[infTotalColIndex]);
        }
        if (outTotalColIndex !== -1) {
            companySummary[companyName].outflow += parseNumericalValue(row[outTotalColIndex]);
        }
        companySummary[companyName].net = companySummary[companyName].inflow - companySummary[companyName].outflow;
        if (staffName) {
            companySummary[companyName].staffNames.add(staffName);
        }
    });

    companySummaryTableBody.innerHTML = ''; // Clear previous data
    const sortedCompanies = Object.keys(companySummary).sort();
    if (sortedCompanies.length === 0) {
        noCompanyDataMessage.style.display = 'block';
    } else {
        noCompanyDataMessage.style.display = 'none';
        sortedCompanies.forEach(companyName => {
            const data = companySummary[companyName];
            const row = companySummaryTableBody.insertRow();
            row.insertCell().textContent = companyName;
            row.insertCell().textContent = formatIndianNumber(data.inflow);
            row.insertCell().textContent = formatIndianNumber(data.outflow);
            row.insertCell().textContent = formatIndianNumber(data.net);
            row.insertCell().textContent = data.staffNames.size; // Number of unique resigned staff in this company
        });
    }

    // --- Calculate Monthly Breakup for Resigned Staff (for selected company/staff or all) ---
    const monthlyData = {}; // Key: YYYY-MM, Value: { inflow: X, outflow: Y, net: Z }
    
    filteredData.forEach(row => {
        const date = row[dateColIndex];
        if (!date) return;

        const yearMonth = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;

        if (!monthlyData[yearMonth]) {
            monthlyData[yearMonth] = { inflow: 0, outflow: 0, net: 0 };
        }

        if (infTotalColIndex !== -1) {
            monthlyData[yearMonth].inflow += parseNumericalValue(row[infTotalColIndex]);
        }
        if (outTotalColIndex !== -1) {
            monthlyData[yearMonth].outflow += parseNumericalValue(row[outTotalColIndex]);
        }
        monthlyData[yearMonth].net = monthlyData[yearMonth].inflow - monthlyData[yearMonth].outflow;
    });

    monthlyTableBody.innerHTML = ''; // Clear previous data
    const sortedMonths = Object.keys(monthlyData).sort();
    if (sortedMonths.length === 0) {
        noMonthlyDataMessage.style.display = 'block';
    } else {
        noMonthlyDataMessage.style.display = 'none';
        sortedMonths.forEach(monthKey => {
            const data = monthlyData[monthKey];
            const row = monthlyTableBody.insertRow();
            const monthName = new Date(monthKey + '-01').toLocaleString('en-IN', { year: 'numeric', month: 'long' });
            
            row.insertCell().textContent = monthName;
            row.insertCell().textContent = formatIndianNumber(data.inflow);
            row.insertCell().textContent = formatIndianNumber(data.outflow);
            row.insertCell().textContent = formatIndianNumber(data.net);
        });
    }
}

// --- Detailed Entries View ---
function viewDetailedEntries() {
    const filteredData = getFilteredData();

    detailedEntriesContainer.style.display = 'block';

    detailedTableHead.innerHTML = '';
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        detailedTableHead.appendChild(th);
    });

    detailedTableBody.innerHTML = '';
    if (filteredData.length === 0) {
        noDetailedDataMessage.style.display = 'block';
        detailedTableBody.innerHTML = '<tr><td colspan="' + headers.length + '"></td></tr>';
        return;
    } else {
        noDetailedDataMessage.style.display = 'none';
    }

    filteredData.forEach(rowData => {
        const tr = detailedTableBody.insertRow();
        rowData.forEach((cellData, index) => {
            const td = tr.insertCell();
            let content = cellData;
            
            if (headers[index] === 'DATE' && cellData instanceof Date) {
                content = cellData.toLocaleDateString('en-IN');
            }
            else {
                const numericalHeaders = [
                    'SML NCD INF', 'SML SD INF', 'SML GB INF', 'SML BDSL', 'VFL NCD INF', 'VFL SD INF', 'VFL GB INF',
                    'SNL FD INF', 'LLP INF', 'INF Total', 'SNL FD INF.1', 'VFL NCD OUT', 'VFL BD OUT', 'SML PURCHASE',
                    'SML NCD OUT', 'SML SD OUT', 'SML GB OUT', 'LLP OUT', 'OUT Total', 'Net'
                ];
                if (numericalHeaders.includes(headers[index])) {
                    const numValue = parseNumericalValue(content);
                    if (!isNaN(numValue)) {
                        content = formatIndianNumber(numValue);
                    }
                }
            }
            td.textContent = content;
        });
    });
}

// --- Event Listeners ---
monthSelect.addEventListener('change', generateReport);
companySelect.addEventListener('change', () => {
    filterStaffList(); // Re-filter staff list first based on new company selection
    generateReport();  // Then generate report
});
companySearchInput.addEventListener('input', () => {
    filterCompanyList(); // Filter company dropdown
    filterStaffList();   // Re-filter staff list based on updated company filter
    generateReport();    // Then generate report
});
staffSelect.addEventListener('change', generateReport);
staffSearchInput.addEventListener('input', () => {
    filterStaffList();   // Filter staff dropdown
    generateReport();    // Then generate report
});
viewDetailedEntriesBtn.addEventListener('click', viewDetailedEntries);

// --- Initialize the report when the page loads ---

document.addEventListener('DOMContentLoaded', init);
>>>>>>> 97062f67d6053ee66819e93d876f785ba5b20e00
