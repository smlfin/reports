// staff_report.js

// --- Configuration ---
const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1OOdGnJhw1k6U15Aybn_2JWex_qTShP6w7CXm0_auXnc8vFnvlabPZjK3lsjqkHgn6NgeKKPyu9qW/pub?gid=1720680457&single=true&output=csv';

// --- Global Data Storage ---
let allData = []; // Stores all parsed CSV rows
let headers = []; // Stores CSV headers
let allStaffNames = []; // Stores all unique staff names for search functionality

// --- Fixed Date Range for Data Validity ---
const dataStartDate = new Date('2025-04-01T00:00:00'); // April 1, 2025, 00:00:00 local time
const dataEndDate = new Date('2026-03-31T23:59:59');   // March 31, 2026, 23:59:59 local time

// --- DOM Elements ---
const companySelect = document.getElementById('company-select');
const staffSearchInput = document.getElementById('staff-search');
const staffSelect = document.getElementById('staff-select');
const monthSelect = document.getElementById('month-select');
const viewEntriesBtn = document.getElementById('view-entries-btn');

const totalInflowEl = document.getElementById('total-inflow');
const totalOutflowEl = document.getElementById('total-outflow');
const totalNetGrowthEl = document.getElementById('total-net-growth');

const monthlyTableBody = document.querySelector('#monthly-table tbody');
const detailedEntriesContainer = document.getElementById('detailed-entries-container');
const detailedTableHead = document.querySelector('#detailed-table thead tr');
const detailedTableBody = document.querySelector('#detailed-table tbody');

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
    // Trim each field after parsing
    return fields.map(field => field.trim());
}

// Robust Date Parsing Function (handles dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy)
function parseDate(dateString) {
    if (!dateString) return null;

    // Replace all common separators with / for easier splitting
    const normalizedDateString = dateString.replace(/[-.]/g, '/');
    const parts = normalizedDateString.split('/');

    if (parts.length === 3) {
        let day = parseInt(parts[0], 10);
        let month = parseInt(parts[1], 10); // Month is 1-indexed here
        let year = parseInt(parts[2], 10);

        // Basic validation (e.g., valid day, month, year ranges)
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
            // Create a Date object. Month in Date constructor is 0-indexed.
            const date = new Date(year, month - 1, day);
            
            // Validate if the created date matches the input parts (e.g., to catch 'Feb 30')
            // This ensures we don't get an invalid date from valid-looking parts
            if (date.getDate() === day && (date.getMonth() + 1) === month && date.getFullYear() === year) {
                return date;
            }
        }
    }
    return null; // Return null for invalid or unparseable dates
}

// Function to format numbers in Indian style (xx,xx,xxx)
function formatIndianNumber(num) {
    if (isNaN(num) || num === null) {
        return num; // Return as is if not a number or null
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

// NEW: Helper function to parse a numerical value from a string, handling empty/null and commas
function parseNumericalValue(valueString) {
    if (valueString === null || valueString === undefined || valueString === '') {
        return 0; // Treat empty/null values as 0 for calculations
    }
    // Remove all commas and then parse as float
    const cleanedValue = valueString.replace(/,/g, '');
    const parsedValue = parseFloat(cleanedValue);
    return isNaN(parsedValue) ? 0 : parsedValue; // Return 0 if parsing results in NaN
}

// --- Main Data Fetching and Initialization ---
async function init() {
    try {
        const response = await fetch(csvUrl);
        const csvText = await response.text();
        const rows = csvText.trim().split('\n');

        if (rows.length === 0) {
            console.error('No data found in CSV.');
            return;
        }

        // Ensure headers are trimmed to prevent matching issues
        headers = parseLine(rows[0]).map(header => header.trim());
        
        // Parse all data rows and convert date strings to Date objects immediately
        // Filter out rows with invalid dates or dates outside the data range (April 2025 - March 2026)
        allData = rows.slice(1).map(row => {
            const parsedRow = parseLine(row);
            const dateColIndex = headers.indexOf('DATE');
            
            // If the row has fewer columns than headers, pad with nulls to prevent issues
            while (parsedRow.length < headers.length) {
                parsedRow.push(null);
            }

            if (dateColIndex !== -1 && parsedRow[dateColIndex]) {
                const dateObj = parseDate(parsedRow[dateColIndex]);
                if (dateObj && dateObj >= dataStartDate && dateObj <= dataEndDate) {
                    parsedRow[dateColIndex] = dateObj; // Replace date string with Date object
                    return parsedRow;
                }
            }
            return null; // Invalid date or outside range, mark for removal
        }).filter(row => row !== null); // Remove null entries (invalid/out of range dates)

        populateFilters();
        generateReport(); // Generate initial report with all data
    } catch (error) {
        console.error('Error initializing report:', error);
        document.querySelector('.report-controls').innerHTML = '<p>Error loading data. Please try again later.</p>';
    }
}

// --- Filter Population ---
function populateFilters() {
    const companies = new Set();
    const staffNames = new Set();
    
    const companyColIndex = headers.indexOf('COMPANY NAME');
    const staffColIndex = headers.indexOf('STAFF NAME');

    allData.forEach(row => {
        if (companyColIndex !== -1 && row[companyColIndex]) companies.add(row[companyColIndex]);
        if (staffColIndex !== -1 && row[staffColIndex]) staffNames.add(row[staffColIndex]);
    });

    // Populate Company Select
    companySelect.innerHTML = '<option value="">All Companies</option>';
    Array.from(companies).sort().forEach(company => {
        const option = document.createElement('option');
        option.value = company;
        option.textContent = company;
        companySelect.appendChild(option);
    });

    // Store all staff names for search functionality
    allStaffNames = Array.from(staffNames).sort();
    filterStaffList(); // Populate staff select initially (all staff)

    // Populate Month Select based on current date and defined range (April 2025 - March 2026)
    monthSelect.innerHTML = '<option value="">All Months</option>';
    
    // Use the dataEndDate as the upper limit for months to display, not the current date
    let currentDateIterator = new Date(dataStartDate); // Start from April 2025
    while (currentDateIterator <= dataEndDate) { // Iterate up to dataEndDate
        const year = currentDateIterator.getFullYear();
        const month = (currentDateIterator.getMonth() + 1).toString().padStart(2, '0');
        const optionValue = `${year}-${month}`;
        const optionText = currentDateIterator.toLocaleString('en-IN', { year: 'numeric', month: 'long' });

        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionText;
        monthSelect.appendChild(option);

        // Move to the next month
        currentDateIterator.setMonth(currentDateIterator.getMonth() + 1);
    }
}

// --- Filter Staff Dropdown based on Search Input ---
function filterStaffList() {
    const searchTerm = staffSearchInput.value.toLowerCase();
    staffSelect.innerHTML = '<option value="">All Staff</option>'; // Always include 'All Staff' option

    const selectedCompany = companySelect.value;
    let relevantStaff = allStaffNames;

    if (selectedCompany) {
        const companyColIndex = headers.indexOf('COMPANY NAME');
        const staffColIndex = headers.indexOf('STAFF NAME');
        const staffInCompany = new Set();
        allData.forEach(row => {
            if (companyColIndex !== -1 && row[companyColIndex] === selectedCompany && staffColIndex !== -1 && row[staffColIndex]) {
                staffInCompany.add(row[staffColIndex]);
            }
        });
        relevantStaff = Array.from(staffInCompany).sort();
    }

    relevantStaff.filter(staff => staff.toLowerCase().includes(searchTerm))
                 .forEach(staff => {
                     const option = document.createElement('option');
                     option.value = staff;
                     option.textContent = staff;
                     staffSelect.appendChild(option);
                 });
    
    const exactMatchOption = relevantStaff.find(staff => staff.toLowerCase() === searchTerm);
    if (exactMatchOption && searchTerm !== '') { // Only pre-select if there's a search term
        staffSelect.value = exactMatchOption;
    } else {
        staffSelect.selectedIndex = 0; // Otherwise, default to 'All Staff'
    }

    generateReport(); // Re-generate report after staff list is filtered
}


// --- Filter Data based on selections ---
function getFilteredData() {
    const selectedCompany = companySelect.value;
    const selectedStaff = staffSelect.value;
    const selectedMonth = monthSelect.value; // YYYY-MM format

    const dateColIndex = headers.indexOf('DATE');
    const companyColIndex = headers.indexOf('COMPANY NAME');
    const staffColIndex = headers.indexOf('STAFF NAME');

    return allData.filter(row => {
        let matchCompany = true;
        let matchStaff = true;
        let matchMonth = true;
        
        // Date is already a Date object due to pre-processing in init()
        const rowDate = row[dateColIndex]; // This is now a Date object or null

        // Filter by company
        if (selectedCompany && companyColIndex !== -1) {
            matchCompany = (row[companyColIndex] === selectedCompany);
        }
        
        // Filter by staff
        if (selectedStaff && staffColIndex !== -1) {
            matchStaff = (row[staffColIndex] === selectedStaff);
        }
        
        // Filter by month (and implicitly by the overall dataStartDate/endDate as invalid/out-of-range rows were removed in init)
        if (selectedMonth && rowDate) { // Only filter by month if a specific month is selected and rowDate is valid
            const rowYearMonth = `${rowDate.getFullYear()}-${(rowDate.getMonth() + 1).toString().padStart(2, '0')}`;
            matchMonth = (rowYearMonth === selectedMonth);
        }
        return matchCompany && matchStaff && matchMonth;
    });
}

// --- Report Generation ---
function generateReport() {
    const filteredData = getFilteredData();

    // Hide detailed entries by default when report is generated/re-generated
    detailedEntriesContainer.style.display = 'none';

    // Calculate Till Date Summary
    let totalInflow = 0;
    let totalOutflow = 0;
    
    // Ensure header names are exactly as in the CSV, after trimming
    const infTotalColIndex = headers.indexOf('INF Total');
    const outTotalColIndex = headers.indexOf('OUT Total');

    filteredData.forEach(row => {
        if (infTotalColIndex !== -1) {
            totalInflow += parseNumericalValue(row[infTotalColIndex]);
        }
        if (outTotalColIndex !== -1) {
            totalOutflow += parseNumericalValue(row[outTotalColIndex]);
        }
    });

    const totalNetGrowth = totalInflow - totalOutflow;

    totalInflowEl.textContent = formatIndianNumber(totalInflow);
    totalOutflowEl.textContent = formatIndianNumber(totalOutflow);
    totalNetGrowthEl.textContent = formatIndianNumber(totalNetGrowth);

    // Calculate Monthly Breakup
    const monthlyData = {}; // Key: YYYY-MM, Value: { inflow: X, outflow: Y, net: Z }
    const dateColIndex = headers.indexOf('DATE');

    filteredData.forEach(row => {
        const date = row[dateColIndex]; // This is already a Date object
        if (!date) return; // Skip if date is null (already filtered out but safety check)

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

    // Render Monthly Breakup Table
    monthlyTableBody.innerHTML = ''; // Clear previous data
    const sortedMonths = Object.keys(monthlyData).sort();
    sortedMonths.forEach(monthKey => {
        const data = monthlyData[monthKey];
        const row = monthlyTableBody.insertRow();
        const monthName = new Date(monthKey + '-01').toLocaleString('en-IN', { year: 'numeric', month: 'long' });
        
        row.insertCell().textContent = monthName;
        row.insertCell().textContent = formatIndianNumber(data.inflow);
        row.insertCell().textContent = formatIndianNumber(data.outflow);
        row.insertCell().textContent = formatIndianNumber(data.net);
    });
    if (sortedMonths.length === 0) {
        monthlyTableBody.innerHTML = '<tr><td colspan="4">No monthly data available for the selected filters.</td></tr>';
    }
}

// --- Detailed Entries View ---
function viewDetailedEntries() {
    const filteredData = getFilteredData();

    // Show the detailed entries container
    detailedEntriesContainer.style.display = 'block';

    // Populate detailed table headers
    detailedTableHead.innerHTML = '';
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        detailedTableHead.appendChild(th);
    });

    // Populate detailed table body
    detailedTableBody.innerHTML = '';
    if (filteredData.length === 0) {
        detailedTableBody.innerHTML = '<tr><td colspan="' + headers.length + '">No entries found for the selected filters.</td></tr>';
        return;
    }

    filteredData.forEach(rowData => {
        const tr = detailedTableBody.insertRow();
        rowData.forEach((cellData, index) => {
            const td = tr.insertCell();
            let content = cellData;
            
            // Re-format Date objects to a display string if it's the DATE column
            if (headers[index] === 'DATE' && cellData instanceof Date) {
                content = cellData.toLocaleDateString('en-IN'); // e.g., 19/07/2025
            }
            // Apply Indian number formatting to relevant numerical columns
            else {
                // Ensure these header names exactly match the trimmed headers from CSV
                const numericalHeaders = [
                    'SML NCD INF', 'SML SD INF', 'SML GB INF', 'SML BDSL', 'VFL NCD INF', 'VFL SD INF', 'VFL GB INF',
                    'SNL FD INF', 'LLP INF', 'INF Total', 'SNL FD INF.1', 'VFL NCD OUT', 'VFL BD OUT', 'SML PURCHASE',
                    'SML NCD OUT', 'SML SD OUT', 'SML GB OUT', 'LLP OUT', 'OUT Total', 'Net'
                ];
                if (numericalHeaders.includes(headers[index])) { // No need to trim again here, as headers array is already trimmed
                    const numValue = parseNumericalValue(content); // Use the new helper for consistent parsing
                    if (!isNaN(numValue)) { // Only format if it's a valid number
                        content = formatIndianNumber(numValue);
                    }
                }
            }
            td.textContent = content;
        });
    });
}

// --- Event Listeners ---
companySelect.addEventListener('change', () => {
    filterStaffList(); // When company changes, re-filter staff list and then generate report
});

staffSelect.addEventListener('change', generateReport);
staffSearchInput.addEventListener('input', filterStaffList); // Listen for input on search box
monthSelect.addEventListener('change', generateReport);
viewEntriesBtn.addEventListener('click', viewDetailedEntries);

// --- Initialize the report when the page loads ---
document.addEventListener('DOMContentLoaded', init);