// staff_report.js

// --- Configuration ---
const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1OOdGnJhw1k6U15Aybn_2JWex_qTShP6w7CXm0_auXnc8vFnvlabPZjK3lsjqkHgn6NgeKKPyu9qW/pub?gid=1720680457&single=true&output=csv';

// --- Global Data Storage ---
let allData = [];
let headers = [];
let allStaffNames = [];
let freshCustomerDetailsMap = new Map();
let myChart = null;
let myCumulativeChart = null;

// --- Current Date ---
const currentDate = new Date();
// Max date is end of the current day
const maxDataEndDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 23, 59, 59);


// --- DOM Elements (Declared globally, assigned in init()) ---
let reportContainer = null; // Changed to let and null
let companySelect = null; // Changed to let and null
let staffSearchInput = null; // Changed to let and null
let staffSelect = null; // Changed to let and null
let monthSelect = null; // kept for backward compat with date-range clear logic
let fySelect = null;
let monthFromSelect = null;
let monthToSelect = null;
// NEW: Date Range Inputs
let startDateInput = null; // Changed to let and null
let endDateInput = null; // Changed to let and null

let totalInflowEl = null; // Changed to let and null
let totalOutflowEl = null; // Changed to let and null
let totalNetGrowthEl = null; // Changed to let and null
let freshCustomerListEl = null; // Changed to let and null

let churnRateEl = null; // Changed to let and null
let repeatBusinessListEl = null; // Changed to let and null

let monthlyTableBody = null; // Changed to let and null
let companyBreakdownTableBody = null; // Changed to let and null
let productBreakdownTableBody = null; // Changed to let and null
let detailedEntriesContainer = null; // Changed to let and null
let backToReportBtn = null; // Changed to let and null
let detailedTitleEl = null; // Changed to let and null
let detailedTableBody = null; // Changed to let and null
let showCustomerNameCheckbox = null; // Changed to let and null
let performanceChartCanvas = null; // Changed to let and null
let cumulativePerformanceChartCanvas = null; // Changed to let and null


// --- Utility Functions ---
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

// Helper to format a Date object into YYYY-MM-DD string for input[type=date]
function formatDateToInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatIndianNumber(num) {
    if (isNaN(num) || num === null) return num;
    let parts = num.toFixed(0).toString().split('.');
    let integerPart = parts[0];
    let decimalPart = parts.length > 1 ? '.' + parts[1] : '';
    let sign = '';
    if (integerPart.startsWith('-')) {
        sign = '-';
        integerPart = integerPart.substring(1);
    }
    if (integerPart.length <= 3) return sign + integerPart + decimalPart;
    let lastThree = integerPart.substring(integerPart.length - 3);
    let otherNumbers = integerPart.substring(0, integerPart.length - 3);
    otherNumbers = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    return sign + otherNumbers + ',' + lastThree + decimalPart;
}

function parseNumericalValue(valueString) {
    if (valueString === null || valueString === undefined || valueString === '') {
        return 0;
    }
    const cleanedValue = String(valueString).replace(/,/g, '');
    const parsedValue = parseFloat(cleanedValue);
    return isNaN(parsedValue) ? 0 : parsedValue;
}

function getValueFromRow(row, headers, columnName) {
    const colIndex = headers.indexOf(columnName);
    if (colIndex !== -1 && row[colIndex] !== undefined && row[colIndex] !== null) {
        return parseNumericalValue(row[colIndex]);
    }
    return 0;
}

function isFreshCustomer(customerType) {
    const freshTypes = ['FRESH CUSTOMER', 'FRESH CUSTOMER/STAFF', 'FRESH STAFF'];
    return freshTypes.includes(String(customerType).trim().toUpperCase());
}

// Corrected Utility function to parse Company/Product from the special header names (Fixes the <OUT> issue)
function parseCompanyAndProductFromHeader(header) {
    const parts = header.trim().split(/\s+/); // Split by space
    let company = null;
    let product = null;
    let type = null; // INF or OUT

    if (parts.length >= 3) {
        // Example: SML NCD INF, VFL GB OUT
        company = parts[0];
        product = parts.slice(1, parts.length - 1).join(' '); // Join all middle parts for product
        type = parts[parts.length - 1]; // Last part is INF/OUT
        
    } else if (parts.length === 2 && (parts[1] === 'INF' || parts[1] === 'OUT')) {
        // MODIFIED LOGIC: Handles simple two-word headers like LLP INF or LLP OUT
        // Product is set to the company name (first word) to avoid 'INF' or 'OUT' as a product.
        company = parts[0];
        product = parts[0]; 
        type = parts[1];
        
    } else if (parts.length === 2 && parts[1] === 'PURCHASE') {
        // Example: SML PURCHASE
        company = parts[0];
        product = parts[1]; // Product is 'PURCHASE'
        type = 'OUT';
        
    } else {
        // Handle other headers that don't fit the pattern (e.g., 'DATE', 'INF Total', etc.)
        return { company: null, product: null, type: null };
    }

    return { company, product, type };
}

// Utility function to get all relevant Inflow/Outflow column headers
function getInflowOutflowHeaders() {
    const infOutHeaders = [];
    headers.forEach(header => {
        const { company, type } = parseCompanyAndProductFromHeader(header);
        // Only include headers that successfully parse into a Company and an INF/OUT type
        if (company && (type === 'INF' || type === 'OUT')) {
            infOutHeaders.push(header);
        }
    });
    return infOutHeaders;
}

/**
 * Maps the short product code (e.g., 'BD', 'FD') to its full display name.
 * @param {string} productCode - The short product code.
 * @returns {string} The full product display name.
 */
function mapProductToDisplayName(productCode) {
    if (!productCode) return 'No Product Specified';

    const code = productCode.toUpperCase();
    
    switch (code) {
        case 'BD':
        case 'SD':
            return 'Subdebt';
        case 'FD':
            return 'Fixed Deposit';
        case 'GB':
            return 'Golden Bond';
        case 'LLP':
            return 'LLP';
        case 'NCD':
            return 'NCD';
        case 'PURCHASE':
            return 'Purchase'; // Assuming 'PURCHASE' is an outflow type, keep it separate
        default:
            return productCode; // Return original if not in the map
    }
}


// --- New Collapse Function ---
/**
 * Toggles the collapsed state of the content next to the header element.
 * @param {HTMLElement} headerElement - The clickable header element (e.g., h3).
 */
function toggleCollapse(headerElement) {
    const content = headerElement.nextElementSibling; // collapsible-content is the next sibling
    
    headerElement.classList.toggle('collapsed');
    content.classList.toggle('collapsed');
}


// --- Main Data Fetching and Initialization ---
async function init() {
    try {
        // NEW: DOM Element Assignments (Guaranteed to run after DOM is loaded)
        reportContainer = document.getElementById('report-container');
        companySelect = document.getElementById('company-select');
        staffSearchInput = document.getElementById('staff-search');
        staffSelect = document.getElementById('staff-select');
        fySelect = document.getElementById('fy-select');
        monthFromSelect = document.getElementById('month-from-select');
        monthToSelect = document.getElementById('month-to-select');
        monthSelect = null; // no longer in DOM
        startDateInput = document.getElementById('start-date');
        endDateInput = document.getElementById('end-date');

        totalInflowEl = document.getElementById('total-inflow');
        totalOutflowEl = document.getElementById('total-outflow');
        totalNetGrowthEl = document.getElementById('total-net-growth');
        freshCustomerListEl = document.getElementById('fresh-customer-list');

        churnRateEl = document.getElementById('churn-rate');
        repeatBusinessListEl = document.getElementById('repeat-business-list');

        monthlyTableBody = document.querySelector('#monthly-table tbody');
        companyBreakdownTableBody = document.querySelector('#company-breakdown-table tbody');
        productBreakdownTableBody = document.querySelector('#product-breakdown-table tbody');
        detailedEntriesContainer = document.getElementById('detailed-entries-container');
        backToReportBtn = document.getElementById('back-to-report-btn');
        detailedTitleEl = document.getElementById('detailed-title');
        detailedTableBody = document.querySelector('#detailed-table tbody');
        showCustomerNameCheckbox = document.getElementById('show-customer-name');
        performanceChartCanvas = document.getElementById('performance-chart');
        cumulativePerformanceChartCanvas = document.getElementById('cumulative-performance-chart');


        // --- Event Listeners (Moved here from the end of the file for reliability) ---
        companySelect.addEventListener('change', () => {
            filterStaffList();
            generateReport();
        });

        staffSearchInput.addEventListener('input', () => {
            filterStaffList();
            staffSelect.style.display = staffSearchInput.value ? 'block' : 'none';
        });

        staffSearchInput.addEventListener('focus', () => {
            staffSelect.style.display = 'block';
        });

        staffSelect.addEventListener('change', () => {
            staffSearchInput.value = staffSelect.value;
            staffSelect.style.display = 'none';
            generateReport();
        });

        fySelect.addEventListener('change', () => {
            populateMonthRangeSelectors();
            clearDateRange();
            generateReport();
        });

        monthFromSelect.addEventListener('change', () => {
            syncToMonth();
            clearDateRange();
            generateReport();
        });

        monthToSelect.addEventListener('change', () => {
            clearDateRange();
            generateReport();
        });

        // NEW: Event listeners for date range inputs (mutually exclusive with month range)
        startDateInput.addEventListener('change', () => {
            if (startDateInput.value || endDateInput.value) {
                // Reset month range to full FY to signal "no month filter active"
                populateMonthRangeSelectors();
            }
            generateReport();
        });

        endDateInput.addEventListener('change', () => {
            if (startDateInput.value || endDateInput.value) {
                populateMonthRangeSelectors();
            }
            generateReport();
        });

        backToReportBtn.addEventListener('click', showMainReport);

        showCustomerNameCheckbox.addEventListener('change', (e) => {
            document.querySelectorAll('.customer-name-column').forEach(cell => {
                if (e.target.checked) {
                    cell.classList.remove('hidden');
                } else {
                    cell.classList.add('hidden');
                }
            });
        });
        // --- End Event Listeners ---

        const response = await fetch(csvUrl);
        const csvText = await response.text();
        const rows = csvText.trim().split('\n');

        if (rows.length === 0) {
            console.error('No data found in CSV.');
            return;
        }

        headers = parseLine(rows[0]).map(header => header.trim());
        allData = rows.slice(1).map(row => {
            const parsedRow = parseLine(row);
            const dateColIndex = headers.indexOf('DATE');
            while (parsedRow.length < headers.length) {
                parsedRow.push(null);
            }
            if (dateColIndex !== -1 && parsedRow[dateColIndex]) {
                const dateObj = parseDate(parsedRow[dateColIndex]);
                if (dateObj && dateObj <= maxDataEndDate) {
                    parsedRow[dateColIndex] = dateObj;
                    return parsedRow;
                }
            }
            return null;
        }).filter(row => row !== null);

        populateFilters();
    } catch (error) {
        console.error('Error initializing report:', error);
        document.querySelector('.report-controls').innerHTML = '<p>Error loading data. Please try again later.</p>';
    }
}

// --- FY Helper Functions ---
function getFYLabel(startYear) {
    return `FY ${startYear}-${String(startYear + 1).slice(-2)}`;
}

function getFYStartYear(date) {
    return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
}

function getFYMonths(fyStartYear) {
    const months = [];
    for (let i = 0; i < 12; i++) {
        const month = (3 + i) % 12; // April=3 ... March=2
        const year = i < 9 ? fyStartYear : fyStartYear + 1;
        const value = `${year}-${String(month + 1).padStart(2, '0')}`;
        const label = new Date(year, month, 1).toLocaleString('en-IN', { year: 'numeric', month: 'long' });
        if (new Date(year, month, 1) <= currentDate) {
            months.push({ value, label });
        }
    }
    return months;
}

function populateMonthRangeSelectors() {
    const fyStartYear = parseInt(fySelect.value);
    const fyMonths = getFYMonths(fyStartYear);

    monthFromSelect.innerHTML = '';
    monthToSelect.innerHTML = '';

    fyMonths.forEach(m => {
        const optFrom = document.createElement('option');
        optFrom.value = m.value;
        optFrom.textContent = m.label;
        monthFromSelect.appendChild(optFrom);

        const optTo = document.createElement('option');
        optTo.value = m.value;
        optTo.textContent = m.label;
        monthToSelect.appendChild(optTo);
    });

    if (fyMonths.length > 0) {
        monthFromSelect.value = fyMonths[0].value;
        monthToSelect.value = fyMonths[fyMonths.length - 1].value;
    }
}

function syncToMonth() {
    const fromVal = monthFromSelect.value;
    Array.from(monthToSelect.options).forEach(opt => {
        opt.disabled = opt.value < fromVal;
    });
    if (monthToSelect.value < fromVal) {
        monthToSelect.value = fromVal;
    }
}

function clearDateRange() {
    if (startDateInput) startDateInput.value = '';
    if (endDateInput) endDateInput.value = '';
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

    companySelect.innerHTML = '<option value="">All Companies</option>';
    Array.from(companies).sort().forEach(company => {
        const option = document.createElement('option');
        option.value = company;
        option.textContent = company;
        companySelect.appendChild(option);
    });

    allStaffNames = Array.from(staffNames).sort();
    filterStaffList();

    // Find earliest date in data to build FY list
    const dateColIndex2 = headers.indexOf('DATE');
    let earliestDate = currentDate;
    allData.forEach(row => {
        const d = row[dateColIndex2];
        if (d && d < earliestDate) earliestDate = d;
    });

    // Build FY selector
    const firstFYStart = getFYStartYear(earliestDate);
    const currentFYStart = getFYStartYear(currentDate);

    fySelect.innerHTML = '';
    for (let fy = firstFYStart; fy <= currentFYStart; fy++) {
        const option = document.createElement('option');
        option.value = fy;
        option.textContent = getFYLabel(fy);
        fySelect.appendChild(option);
    }
    fySelect.value = currentFYStart;

    populateMonthRangeSelectors();

    // Set min/max for date inputs
    const maxDate = formatDateToInput(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()));
    startDateInput.max = maxDate;
    endDateInput.max = maxDate;
}

function filterStaffList() {
    // ... (rest of filterStaffList remains the same)
    const searchTerm = staffSearchInput.value.toLowerCase();
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

    const filteredStaff = relevantStaff.filter(staff => staff.toLowerCase().includes(searchTerm));

    staffSelect.innerHTML = '<option value="">Select Staff</option>';
    filteredStaff.forEach(staff => {
        const option = document.createElement('option');
        option.value = staff;
        option.textContent = staff;
        staffSelect.appendChild(option);
    });
}

// --- Report Generation ---
function generateReport() {
    const selectedStaff = staffSelect.value;
    if (!selectedStaff) {
        reportContainer.classList.add('hidden');
        detailedEntriesContainer.classList.add('hidden');
        return;
    }

    reportContainer.classList.remove('hidden');
    detailedEntriesContainer.classList.add('hidden');

    const fromVal = monthFromSelect ? monthFromSelect.value : '';
    const toVal = monthToSelect ? monthToSelect.value : '';

    // NEW: Date Range variables
    const startDateVal = startDateInput.value;
    const endDateVal = endDateInput.value;

    // Input Validation for Date Range
    if (startDateVal && endDateVal) {
        if (new Date(startDateVal) > new Date(endDateVal)) {
            alert('Start date cannot be after end date. Please correct the date range.');
            startDateInput.value = '';
            endDateInput.value = '';
            return;
        }
    }

    const staffColIndex = headers.indexOf('STAFF NAME');
    const freshOldColIndex = headers.indexOf('FRESH/OLD');
    const customerNameColIndex = headers.indexOf('CUSTOMER NAME');
    const dateColIndex = headers.indexOf('DATE');

    // Build the active date filter: date-range inputs take priority when set
    let filterStartDate = null;
    let filterEndDate = null;
    let isDateRangeActive = false;

    if (startDateVal || endDateVal) {
        isDateRangeActive = true;
        if (startDateVal) {
            const parts = startDateVal.split('-');
            filterStartDate = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0);
        }
        if (endDateVal) {
            const parts = endDateVal.split('-');
            filterEndDate = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59);
        }
        if (filterStartDate && !filterEndDate) filterEndDate = maxDataEndDate;
        if (!filterStartDate && filterEndDate) filterStartDate = new Date(0);
    } else if (fromVal && toVal) {
        // Use the From/To month range
        const [fy, fm] = fromVal.split('-').map(Number);
        const [ty, tm] = toVal.split('-').map(Number);
        filterStartDate = new Date(fy, fm - 1, 1, 0, 0, 0);
        filterEndDate = new Date(ty, tm, 0, 23, 59, 59); // last day of to-month
    }


    const filteredDataForOverall = allData.filter(row => {
        const rowStaff = row[staffColIndex];
        const rowDate = row[dateColIndex];

        let matchStaff = !selectedStaff || rowStaff === selectedStaff;
        if (!matchStaff) return false;

        // Apply date filter (From/To range or explicit date-range inputs)
        if (filterStartDate || filterEndDate) {
            if (filterStartDate && rowDate < filterStartDate) return false;
            if (filterEndDate && rowDate > filterEndDate) return false;
        }

        return true;
    });

    // Performance Summary (Still using aggregate columns for overall summary)
    let totalInflow = 0;
    let totalOutflow = 0;
    let totalNetGrowth = 0;
    const freshCustomerDetailsMap = new Map();
    const customerData = new Map();

    filteredDataForOverall.forEach(row => {
        const inflow = getValueFromRow(row, headers, 'INF Total');
        const outflow = getValueFromRow(row, headers, 'OUT Total');
        const net = getValueFromRow(row, headers, 'Net');
        const customerName = row[customerNameColIndex];

        totalInflow += inflow;
        totalOutflow += outflow;
        totalNetGrowth += net;

        if (customerName) {
            if (!customerData.has(customerName)) {
                customerData.set(customerName, { net: 0, transactions: 0 });
            }
            customerData.get(customerName).net += net;
            customerData.get(customerName).transactions++;
        }

        if (isFreshCustomer(row[freshOldColIndex]) && customerName) {
            freshCustomerDetailsMap.set(customerName, (freshCustomerDetailsMap.get(customerName) || 0) + inflow);
        }
    });

    totalInflowEl.textContent = formatIndianNumber(totalInflow);
    totalOutflowEl.textContent = formatIndianNumber(totalOutflow);
    totalNetGrowthEl.textContent = formatIndianNumber(totalNetGrowth);

    freshCustomerListEl.innerHTML = '';
    const sortedFreshCustomers = Array.from(freshCustomerDetailsMap.keys()).sort();
    if (sortedFreshCustomers.length > 0) {
        sortedFreshCustomers.forEach(customerName => {
            const li = document.createElement('li');
            li.textContent = `${customerName} (₹${formatIndianNumber(freshCustomerDetailsMap.get(customerName))})`;
            freshCustomerListEl.appendChild(li);
        });
    } else {
        freshCustomerListEl.innerHTML = '<li>No fresh customers found.</li>';
    }

    // Customer Loyalty & Retention
    let negativeNetCustomers = 0;
    let totalCustomers = 0;
    const repeatCustomers = [];
    customerData.forEach((data, customerName) => {
        totalCustomers++;
        if (data.net < 0) {
            negativeNetCustomers++;
        }
        if (data.transactions > 1) {
            repeatCustomers.push({ name: customerName, net: data.net });
        }
    });

    const churnRate = totalCustomers > 0 ? (negativeNetCustomers / totalCustomers * 100).toFixed(2) : '0.00';
    churnRateEl.textContent = `${churnRate}%`;

    repeatBusinessListEl.innerHTML = '';
    if (repeatCustomers.length > 0) {
        repeatCustomers.sort((a, b) => b.net - a.net).forEach(customer => {
            const li = document.createElement('li');
            li.textContent = `${customer.name} (Net: ₹${formatIndianNumber(customer.net)})`;
            repeatBusinessListEl.appendChild(li);
        });
    } else {
        repeatBusinessListEl.innerHTML = '<li>No repeat customers found.</li>';
    }

    // Monthly Breakup
    const monthlyData = {};
    filteredDataForOverall.forEach(row => {
        const date = row[headers.indexOf('DATE')];
        if (!date) return;
        const yearMonth = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        if (!monthlyData[yearMonth]) {
            // Note: This still uses aggregate columns for the Monthly Breakup Table
            // as the individual columns are too numerous for a clean monthly table.
            monthlyData[yearMonth] = { inflow: 0, outflow: 0, net: 0, entries: [] };
        }
        monthlyData[yearMonth].inflow += getValueFromRow(row, headers, 'INF Total');
        monthlyData[yearMonth].outflow += getValueFromRow(row, headers, 'OUT Total');
        monthlyData[yearMonth].net += getValueFromRow(row, headers, 'Net');
        monthlyData[yearMonth].entries.push(row);
    });

    renderMonthlyTable(monthlyData);
    
    // Using the refined calculation methods
    renderCompanyBreakdown(filteredDataForOverall);
    renderProductBreakdown(filteredDataForOverall);
    
    renderCharts(monthlyData);
}

function renderMonthlyTable(monthlyData) {
    monthlyTableBody.innerHTML = '';
    const sortedMonths = Object.keys(monthlyData).sort();

    sortedMonths.forEach(yearMonth => {
        const data = monthlyData[yearMonth];
        const date = new Date(yearMonth);
        const monthName = date.toLocaleString('en-IN', { year: 'numeric', month: 'long' });
        const netClass = data.net >= 0 ? 'positive' : 'negative';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${monthName}</td>
            <td>${formatIndianNumber(data.inflow)}</td>
            <td>${formatIndianNumber(data.outflow)}</td>
            <td class="${netClass}"><strong>${formatIndianNumber(data.net)}</strong></td>
            <td><button onclick="showDetailedEntries('${monthName}', '${yearMonth}')">View Entries</button></td>
        `;
        monthlyTableBody.appendChild(tr);
    });
}

// Company Breakdown: Uses column headers for accurate company-level flow
function renderCompanyBreakdown(data) {
    const companyData = {};
    const infOutHeaders = getInflowOutflowHeaders();

    data.forEach(row => {
        infOutHeaders.forEach(header => {
            const { company, type } = parseCompanyAndProductFromHeader(header);
            const value = getValueFromRow(row, headers, header);
            
            if (company && value !== 0) {
                if (!companyData[company]) {
                    companyData[company] = { inflow: 0, outflow: 0, net: 0 };
                }
                
                if (type === 'INF') {
                    companyData[company].inflow += value;
                } else if (type === 'OUT') {
                    companyData[company].outflow += value;
                }
                // Net is calculated later: inflow - outflow
            }
        });
    });

    companyBreakdownTableBody.innerHTML = '';
    Object.keys(companyData).sort().forEach(companyName => {
        const data = companyData[companyName];
        data.net = data.inflow - data.outflow; // Calculate Net Growth
        const netClass = data.net >= 0 ? 'positive' : 'negative';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${companyName}</td>
            <td>${formatIndianNumber(data.inflow)}</td>
            <td>${formatIndianNumber(data.outflow)}</td>
            <td class="${netClass}"><strong>${formatIndianNumber(data.net)}</strong></td>
        `;
        companyBreakdownTableBody.appendChild(tr);
    });
}

// Product Breakdown: Uses column headers AND the new display name mapping
function renderProductBreakdown(data) {
    const productData = {};
    const infOutHeaders = getInflowOutflowHeaders();

    data.forEach(row => {
        infOutHeaders.forEach(header => {
            const { product, type } = parseCompanyAndProductFromHeader(header);
            const value = getValueFromRow(row, headers, header);

            // Use the new mapping function to get the display name for grouping
            const productName = mapProductToDisplayName(product);
            
            if (product && value !== 0) {
                // Group by the mapped product name
                if (!productData[productName]) {
                    productData[productName] = { inflow: 0, outflow: 0, net: 0 };
                }
                
                if (type === 'INF') {
                    productData[productName].inflow += value;
                } else if (type === 'OUT') {
                    productData[productName].outflow += value;
                }
                // Net is calculated later: inflow - outflow
            }
        });
    });

    productBreakdownTableBody.innerHTML = '';
    Object.keys(productData).sort().forEach(productName => {
        const data = productData[productName];
        data.net = data.inflow - data.outflow; // Calculate Net Growth
        const netClass = data.net >= 0 ? 'positive' : 'negative';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${productName}</td>
            <td>${formatIndianNumber(data.inflow)}</td>
            <td>${formatIndianNumber(data.outflow)}</td>
            <td class="${netClass}"><strong>${formatIndianNumber(data.net)}</strong></td>
        `;
        productBreakdownTableBody.appendChild(tr);
    });
}

function renderCharts(monthlyData) {
    const sortedMonths = Object.keys(monthlyData).sort();
    const labels = sortedMonths.map(ym => new Date(ym).toLocaleString('en-IN', { month: 'short', year: 'numeric' }));
    const netData = sortedMonths.map(ym => monthlyData[ym].net);
    const inflowData = sortedMonths.map(ym => monthlyData[ym].inflow);
    const outflowData = sortedMonths.map(ym => -monthlyData[ym].outflow); // Show outflow as negative for stacked chart

    // Calculate cumulative net growth
    let cumulativeNet = 0;
    const cumulativeData = netData.map(net => {
        cumulativeNet += net;
        return cumulativeNet;
    });

    // Destroy existing charts if they exist
    if (myChart) myChart.destroy();
    if (myCumulativeChart) myCumulativeChart.destroy();

    // Historical Performance Trends (Bar Chart)
    myChart = new Chart(performanceChartCanvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Net Growth',
                    data: netData,
                    backgroundColor: netData.map(net => net >= 0 ? '#28a745' : '#dc3545'),
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Net Growth (in ₹)'
                    },
                    ticks: {
                        callback: function(value) {
                            return formatIndianNumber(value);
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += '₹' + formatIndianNumber(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });

    // Cumulative Performance Trends (Line Chart)
    myCumulativeChart = new Chart(cumulativePerformanceChartCanvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Cumulative Net Growth',
                data: cumulativeData,
                borderColor: '#007bff',
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Cumulative Net Growth (in ₹)'
                    },
                    ticks: {
                        callback: function(value) {
                            return formatIndianNumber(value);
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += '₹' + formatIndianNumber(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}


function showDetailedEntries(title, yearMonth) {
    const selectedStaff = staffSelect.value;
    const staffColIndex = headers.indexOf('STAFF NAME');
    const dateColIndex = headers.indexOf('DATE');

    // Filter by staff, and the specific month
    const entries = allData.filter(row => {
        const rowStaff = row[staffColIndex];
        const rowDate = row[dateColIndex];
        const rowYearMonth = rowDate ? `${rowDate.getFullYear()}-${(rowDate.getMonth() + 1).toString().padStart(2, '0')}` : null;
        return rowStaff === selectedStaff && rowYearMonth === yearMonth;
    });

    detailedTitleEl.textContent = `${selectedStaff} - ${title}`;
    renderDetailedTable(entries);

    reportContainer.classList.add('hidden');
    detailedEntriesContainer.classList.remove('hidden');
}

function renderDetailedTable(entries) {
    detailedTableBody.innerHTML = '';
    const dateColIndex = headers.indexOf('DATE');
    const infTotalColIndex = headers.indexOf('INF Total');
    const outTotalColIndex = headers.indexOf('OUT Total');
    const netColIndex = headers.indexOf('Net');
    const customerNameColIndex = headers.indexOf('CUSTOMER NAME');

    entries.forEach(entry => {
        const tr = document.createElement('tr');
        const netClass = getValueFromRow(entry, headers, 'Net') >= 0 ? 'positive' : 'negative';

        const date = entry[dateColIndex].toLocaleDateString('en-IN');
        const inflow = formatIndianNumber(getValueFromRow(entry, headers, 'INF Total'));
        const outflow = formatIndianNumber(getValueFromRow(entry, headers, 'OUT Total'));
        const net = formatIndianNumber(getValueFromRow(entry, headers, 'Net'));
        const customerName = entry[customerNameColIndex] || '-';

        tr.innerHTML = `
            <td>${date}</td>
            <td>${inflow}</td>
            <td>${outflow}</td>
            <td class="${netClass}">${net}</td>
            <td class="customer-name-column hidden">${customerName}</td>
        `;
        detailedTableBody.appendChild(tr);
    });

    // Manage visibility of customer name column based on checkbox
    const customerNameColumnHeader = document.querySelector('#detailed-table thead th:last-child');
    customerNameColumnHeader.classList.toggle('hidden', !showCustomerNameCheckbox.checked);

    document.querySelectorAll('.customer-name-column').forEach(cell => {
        cell.classList.toggle('hidden', !showCustomerNameCheckbox.checked);
    });
}

function showMainReport() {
    detailedEntriesContainer.classList.add('hidden');
    reportContainer.classList.remove('hidden');
}


// --- Initialize the report when the page loads ---
document.addEventListener('DOMContentLoaded', init);
