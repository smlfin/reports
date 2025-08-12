// fresh_old_report.js
// This code assumes the HTML structure provided above is present.

// --- Configuration ---
const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1OOdGnJhw1k6U15Aybn_2JWex_qTShP6w7CXm0_auXnc8vFnvlabPZjK3lsjqkHgn6NgeKKPyu9qW/pub?gid=1720680457&single=true&output=csv';

// --- Global Data Storage ---
let allData = []; // Stores all parsed CSV rows
let headers = []; // Stores CSV headers
let staffFreshCustomerMap = new Map(); // New: Declared globally to be accessible everywhere.

// Define all individual INF and OUT columns for Net calculation globally for reusability
const individualInfColumns = [
    'SML NCD INF', 'SML SD INF', 'SML GB INF', 'VFL NCD INF',
    'VFL SD INF', 'VFL GB INF', 'SNL FD INF', 'LLP INF'
];
const individualOutColumns = [
    'VFL NCD OUT', 'VFL BD OUT', 'SML PURCHASE', 'SML NCD OUT',
    'SML SD OUT', 'SML GB OUT', 'LLP OUT'
];

// --- Fixed Date Range for Data Validity (April 2025 - March 2026) ---
const dataStartDate = new Date('2025-04-01T00:00:00'); // April 1, 2025, 00:00:00 local time
const dataEndDate = new Date('2026-03-31T23:59:59');   // March 31, 2026, 23:59:59 local time

// --- DOM Elements ---
const monthSelect = document.getElementById('month-select');
const companySelect = document.getElementById('company-select');
const branchSelect = document.getElementById('branch-select');
const viewEntriesBtn = document.getElementById('view-entries-btn');

const freshInflowEl = document.getElementById('fresh-inflow');
const oldInflowEl = document.getElementById('old-inflow');
const freshNetEl = document.getElementById('fresh-net');
const oldNetEl = document.getElementById('old-net');
const totalFreshCustomersEl = document.getElementById('total-fresh-customers');
const totalOldCustomersEl = document.getElementById('total-old-customers');
const totalFreshStaffCustomersEl = document.getElementById('total-fresh-staff-customers'); // New element for Fresh Staff

const monthlyInflowTableBody = document.querySelector('#monthly-inflow-table tbody');
const monthlyNetTableBody = document.querySelector('#monthly-net-table tbody');
const monthlyFreshCustomerCountTableBody = document.querySelector('#monthly-fresh-customer-count-table tbody'); // New table
const monthlyFreshStaffCustomerCountTableBody = document.querySelector('#monthly-fresh-staff-customer-count-table tbody'); // New table

const companyFreshOldTableBody = document.querySelector('#company-fresh-old-table tbody');

const detailedEntriesContainer = document.getElementById('detailed-entries-container');
const detailedTableHead = document.querySelector('#detailed-table thead tr');
const detailedTableBody = document.querySelector('#detailed-table tbody');

// --- NEW/UPDATED DOM Elements for Modal ---
const staffPerformanceModal = document.getElementById('staff-performance-modal'); // The modal overlay
const staffFreshCustomerTableBody = document.querySelector('#staff-fresh-customer-table tbody'); // Still refers to the table inside the modal
const closeStaffModalButton = document.getElementById('close-staff-modal'); // The close button inside the staff modal

// New Modal for Customer Details
const customerDetailsModal = document.getElementById('customer-details-modal');
const customerDetailsStaffNameEl = document.getElementById('customer-details-staff-name');
const customerDetailsTableBody = document.querySelector('#customer-details-table tbody');
const closeCustomerModalButton = document.getElementById('close-customer-modal');


// --- Utility Functions ---

function parseLine(line) {
    const fields = [];
    let inQuote = false;
    let currentField = '';
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuote && i + 1 < line.length && line[i + 1] === '"') {
                currentField += '"'; i++;
            } else { inQuote = !inQuote; }
        } else if (char === ',' && !inQuote) {
            fields.push(currentField); currentField = '';
        } else { currentField += char; }
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

function formatIndianNumber(num) {
    if (isNaN(num) || num === null) { return num; }
    let parts = Math.round(num).toString().split('.'); // Ensure no decimals for display
    let integerPart = parts[0];
    let decimalPart = parts.length > 1 ? '.' + parts[1] : ''; // This part will rarely be used after Math.round
    let sign = '';
    if (integerPart.startsWith('-')) { sign = '-'; integerPart = integerPart.substring(1); }
    if (integerPart.length <= 3) { return sign + integerPart + decimalPart; }
    let lastThree = integerPart.substring(integerPart.length - 3);
    let otherNumbers = integerPart.substring(0, integerPart.length - 3);
    otherNumbers = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    return sign + otherNumbers + ',' + lastThree + decimalPart;
}

// Helper to sum values from specified columns for a row
function calculateSumOfColumns(row, headers, columnNames) {
    let sum = 0;
    columnNames.forEach(colName => {
        const colIndex = headers.indexOf(colName);
        if (colIndex !== -1 && row[colIndex] !== undefined && row[colIndex] !== null) {
            // Round to nearest integer during calculation
            sum += Math.round(parseFloat(String(row[colIndex]).replace(/,/g, '') || 0));
        }
    });
    return sum;
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

        headers = parseLine(rows[0]);
        const dateColIndex = headers.indexOf('DATE');
        
        allData = rows.slice(1).map(row => {
            const parsedRow = parseLine(row);
            if (dateColIndex !== -1 && parsedRow[dateColIndex]) {
                const dateObj = parseDate(parsedRow[dateColIndex]);
                // Store the Date object if valid and within the fixed range
                if (dateObj && dateObj >= dataStartDate && dateObj <= dataEndDate) {
                    parsedRow[dateColIndex] = dateObj;
                    return parsedRow;
                }
            }
            return null; // Invalid date or outside range
        }).filter(row => row !== null); // Remove null entries

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
    const branches = new Set();
    
    const companyColIndex = headers.indexOf('COMPANY NAME');
    const branchColIndex = headers.indexOf('BRANCH');

    allData.forEach(row => {
        if (companyColIndex !== -1) companies.add(row[companyColIndex]);
        if (branchColIndex !== -1) branches.add(row[branchColIndex]);
    });

    // Populate Month Select (similar to staff report, up to current month)
    monthSelect.innerHTML = '<option value="">All Months</option>';
    const today = new Date();
    let currentDateIterator = new Date(dataStartDate);
    while (currentDateIterator <= today && currentDateIterator <= dataEndDate) {
        const year = currentDateIterator.getFullYear();
        const month = (currentDateIterator.getMonth() + 1).toString().padStart(2, '0');
        const optionValue = `${year}-${month}`;
        const optionText = currentDateIterator.toLocaleString('en-IN', { year: 'numeric', month: 'long' });
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionText;
        monthSelect.appendChild(option);
        currentDateIterator.setMonth(currentDateIterator.getMonth() + 1);
    }

    // Populate Company Select
    companySelect.innerHTML = '<option value="">All Companies</option>';
    Array.from(companies).sort().forEach(company => {
        const option = document.createElement('option');
        option.value = company;
        option.textContent = company;
        companySelect.appendChild(option);
    });

    // Populate Branch Select
    branchSelect.innerHTML = '<option value="">All Branches</option>';
    Array.from(branches).sort().forEach(branch => {
        const option = document.createElement('option');
        option.value = branch;
        option.textContent = branch;
        branchSelect.appendChild(option);
    });
}

// --- Filter Data based on selections ---
function getFilteredData(ignoreMonthFilter = false) {
    const selectedMonth = monthSelect.value; // YYYY-MM
    const selectedCompany = companySelect.value;
    const selectedBranch = branchSelect.value;

    const dateColIndex = headers.indexOf('DATE');
    const companyColIndex = headers.indexOf('COMPANY NAME');
    const branchColIndex = headers.indexOf('BRANCH');

    return allData.filter(row => {
        let matchMonth = true;
        let matchCompany = true;
        let matchBranch = true;
        
        const rowDate = row[dateColIndex]; // Already a Date object or null

        if (!ignoreMonthFilter && selectedMonth && rowDate) {
            const rowYearMonth = `${rowDate.getFullYear()}-${(rowDate.getMonth() + 1).toString().padStart(2, '0')}`;
            matchMonth = (rowYearMonth === selectedMonth);
        }
        if (selectedCompany && companyColIndex !== -1) {
            matchCompany = (row[companyColIndex] === selectedCompany);
        }
        if (selectedBranch && branchColIndex !== -1) {
            matchBranch = (row[branchColIndex] === selectedBranch);
        }

        return matchMonth && matchCompany && matchBranch;
    });
}

// --- Report Generation ---
function generateReport() {
    // Data filtered by all controls (month, company, branch)
    const filteredDataForOverallAndCompany = getFilteredData(false); 
    // Data filtered only by company and branch, ignoring month for monthly trends
    const filteredDataForMonthlyTrends = getFilteredData(true); 
    
    // Re-initialize the staff map on every report generation
    staffFreshCustomerMap = new Map();

    // Hide detailed entries and all modals by default
    detailedEntriesContainer.style.display = 'none';
    staffPerformanceModal.style.display = 'none'; // Hide the staff modal overlay
    customerDetailsModal.style.display = 'none'; // Hide the new customer details modal overlay


    // Get column indices for calculations
    const freshOldColIndex = headers.indexOf('FRESH/OLD');
    const customerNameColIndex = headers.indexOf('CUSTOMER NAME');
    const companyNameColIndex = headers.indexOf('COMPANY NAME');
    const staffNameColIndex = headers.indexOf('STAFF NAME'); // New: Staff Name column

    // Check if critical columns exist
    if (freshOldColIndex === -1 || customerNameColIndex === -1 || companyNameColIndex === -1 || staffNameColIndex === -1) {
        console.error('One or more required columns (FRESH/OLD, CUSTOMER NAME, COMPANY NAME, STAFF NAME) are missing from the CSV.');
        document.getElementById('overall-contribution-section').innerHTML = '<p>Error: Missing critical data columns. Please ensure "FRESH/OLD", "CUSTOMER NAME", "COMPANY NAME", and "STAFF NAME" columns exist in the data source.</p>';
        document.getElementById('monthly-trends-section').innerHTML = '';
        document.getElementById('company-contribution-section').innerHTML = '';
        return;
    }

    // --- 1. Overall Contribution (Fresh vs. Old) & Customer Distribution ---
    let freshInflow = 0;
    let oldInflow = 0;
    let freshNet = 0;
    let oldNet = 0;
    const freshCustomers = new Set(); // For FRESH CUSTOMER and FRESH CUSTOMER/FRESH STAFF
    const oldCustomers = new Set();
    const freshStaffCustomers = new Set(); // For FRESH CUSTOMER/FRESH STAFF

    // For Staff Performance Drilldown
    // Key: Staff Name, Value: { customers: Set<string>, totalInflow: number, customerDetails: Map<string, number> }
    

    filteredDataForOverallAndCompany.forEach(row => {
        const rawCustomerType = String(row[freshOldColIndex]).trim().toUpperCase(); 
        
        const currentInflow = calculateSumOfColumns(row, headers, individualInfColumns);
        const currentOutflow = calculateSumOfColumns(row, headers, individualOutColumns);
        const currentNet = currentInflow - currentOutflow;
        const customerName = row[customerNameColIndex];
        const staffName = row[staffNameColIndex];

        // MODIFIED LOGIC: Treat 'FRESH CUSTOMER' and 'FRESH CUSTOMER/FRESH STAFF' as the same Fresh category
        if (rawCustomerType === 'FRESH CUSTOMER' || rawCustomerType === 'FRESH CUSTOMER/FRESH STAFF') {
            freshInflow += currentInflow;
            freshNet += currentNet;
            if (customerName) freshCustomers.add(customerName);

            // Separate count for fresh staff
            if (rawCustomerType === 'FRESH CUSTOMER/FRESH STAFF') {
                if (customerName) freshStaffCustomers.add(customerName);
            }

            // Add to staff map if a staff name exists
            if (staffName) {
                if (!staffFreshCustomerMap.has(staffName)) {
                    staffFreshCustomerMap.set(staffName, { customers: new Set(), totalInflow: 0, customerDetails: new Map() }); // Initialize
                }
                staffFreshCustomerMap.get(staffName).customers.add(customerName);
                staffFreshCustomerMap.get(staffName).totalInflow += currentInflow; // Accumulate inflow

                // Store customer details for drilldown
                const currentCustomerInflow = staffFreshCustomerMap.get(staffName).customerDetails.get(customerName) || 0;
                staffFreshCustomerMap.get(staffName).customerDetails.set(customerName, currentCustomerInflow + currentInflow);
            }
        } else if (rawCustomerType === 'OLD' || rawCustomerType === 'OLD CUSTOMER' || rawCustomerType === '' || rawCustomerType === 'FRESH CUSTOMER/MINIMUM AMT NIL') {
            oldInflow += currentInflow;
            oldNet += currentNet;
            if (customerName) oldCustomers.add(customerName);
        }
    });

    freshInflowEl.textContent = formatIndianNumber(freshInflow);
    oldInflowEl.textContent = formatIndianNumber(oldInflow);
    freshNetEl.textContent = formatIndianNumber(freshNet);
    oldNetEl.textContent = formatIndianNumber(oldNet);
    totalFreshCustomersEl.textContent = freshCustomers.size;
    totalOldCustomersEl.textContent = oldCustomers.size;
    totalFreshStaffCustomersEl.textContent = freshStaffCustomers.size; // Display new fresh staff count

    // --- Populate Staff Performance Drilldown Table ---
    staffFreshCustomerTableBody.innerHTML = '';
    if (staffFreshCustomerMap.size === 0) {
        staffFreshCustomerTableBody.innerHTML = '<tr><td colspan="4">No fresh customer data for staff with current filters.</td></tr>';
    } else {
        const staffDataArray = Array.from(staffFreshCustomerMap.entries()).map(([staffName, data]) => ({ 
            staffName: staffName,
            customerCount: data.customers.size, 
            totalInflow: data.totalInflow,
            customerDetails: data.customerDetails
        }));
        staffDataArray.sort((a, b) => b.customerCount - a.customerCount);

        staffDataArray.forEach(staffEntry => {
            const row = staffFreshCustomerTableBody.insertRow();
            row.insertCell().textContent = staffEntry.staffName;
            
            const countCell = row.insertCell();
            countCell.textContent = staffEntry.customerCount;
            countCell.classList.add('clickable-count');
            countCell.dataset.staffName = staffEntry.staffName;
            
            countCell.addEventListener('click', () => showCustomerDetailsDrilldown(staffEntry.staffName));

            row.insertCell().textContent = formatIndianNumber(staffEntry.totalInflow);
            const averageInflow = staffEntry.customerCount > 0 ? staffEntry.totalInflow / staffEntry.customerCount : 0;
            row.insertCell().textContent = formatIndianNumber(averageInflow);
        });
    }

    // --- 2. Monthly Trends (Inflow, Net, Fresh Customer Count, Fresh Staff Count) ---
    const monthlyData = {}; // Key: YYYY-MM, Value: { Fresh: {inflow, net, customers: Set, staffCustomers: Set}, Old: {inflow, net} }

    filteredDataForMonthlyTrends.forEach(row => { // Use data filtered only by company/branch
        const date = row[headers.indexOf('DATE')];
        if (!date) return;
        const yearMonth = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        
        const rawCustomerType = String(row[freshOldColIndex]).trim().toUpperCase(); 

        const currentInflow = calculateSumOfColumns(row, headers, individualInfColumns);
        const currentOutflow = calculateSumOfColumns(row, headers, individualOutColumns);
        const currentNet = currentInflow - currentOutflow;
        const customerName = row[customerNameColIndex];

        if (!monthlyData[yearMonth]) {
            monthlyData[yearMonth] = { 
                Fresh: { inflow: 0, net: 0, customers: new Set(), staffCustomers: new Set() }, 
                Old: { inflow: 0, net: 0 } 
            };
        }

        // MODIFIED LOGIC: Combine 'FRESH CUSTOMER' and 'FRESH CUSTOMER/FRESH STAFF' for monthly totals
        if (rawCustomerType === 'FRESH CUSTOMER' || rawCustomerType === 'FRESH CUSTOMER/FRESH STAFF') {
            monthlyData[yearMonth].Fresh.inflow += currentInflow;
            monthlyData[yearMonth].Fresh.net += currentNet;
            if (customerName) monthlyData[yearMonth].Fresh.customers.add(customerName);
            if (rawCustomerType === 'FRESH CUSTOMER/FRESH STAFF') {
                if (customerName) monthlyData[yearMonth].Fresh.staffCustomers.add(customerName);
            }
        } else if (rawCustomerType === 'OLD' || rawCustomerType === 'OLD CUSTOMER' || rawCustomerType === '' || rawCustomerType === 'FRESH CUSTOMER/MINIMUM AMT NIL') {
            monthlyData[yearMonth].Old.inflow += currentInflow;
            monthlyData[yearMonth].Old.net += currentNet;
        }
    });

    // Render Monthly Inflow Table
    monthlyInflowTableBody.innerHTML = '';
    monthlyNetTableBody.innerHTML = '';
    monthlyFreshCustomerCountTableBody.innerHTML = '';
    monthlyFreshStaffCustomerCountTableBody.innerHTML = '';

    const sortedMonths = Object.keys(monthlyData).sort();
    if (sortedMonths.length === 0) {
        monthlyInflowTableBody.innerHTML = '<tr><td colspan="4">No monthly inflow data.</td></tr>';
        monthlyNetTableBody.innerHTML = '<tr><td colspan="4">No monthly net data.</td></tr>';
        monthlyFreshCustomerCountTableBody.innerHTML = '<tr><td colspan="2">No monthly fresh customer count data.</td></tr>';
        monthlyFreshStaffCustomerCountTableBody.innerHTML = '<tr><td colspan="2">No monthly fresh staff customer count data.</td></tr>';
    } else {
        sortedMonths.forEach(monthKey => {
            const data = monthlyData[monthKey];
            const monthName = new Date(monthKey + '-01').toLocaleString('en-IN', { year: 'numeric', month: 'long' });

            // Inflow Row
            let inflowRow = monthlyInflowTableBody.insertRow();
            inflowRow.insertCell().textContent = monthName;
            inflowRow.insertCell().textContent = formatIndianNumber(data.Fresh.inflow);
            inflowRow.insertCell().textContent = formatIndianNumber(data.Old.inflow);
            inflowRow.insertCell().textContent = formatIndianNumber(data.Fresh.inflow + data.Old.inflow);

            // Net Growth Row
            let netRow = monthlyNetTableBody.insertRow();
            netRow.insertCell().textContent = monthName;
            netRow.insertCell().textContent = formatIndianNumber(data.Fresh.net);
            netRow.insertCell().textContent = formatIndianNumber(data.Old.net);
            netRow.insertCell().textContent = formatIndianNumber(data.Fresh.net + data.Old.net);

            // Fresh Customer Count Row
            let freshCustCountRow = monthlyFreshCustomerCountTableBody.insertRow();
            freshCustCountRow.insertCell().textContent = monthName;
            freshCustCountRow.insertCell().textContent = data.Fresh.customers.size;

            // Fresh Staff Customer Count Row
            let freshStaffCustCountRow = monthlyFreshStaffCustomerCountTableBody.insertRow();
            freshStaffCustCountRow.insertCell().textContent = monthName;
            freshStaffCustCountRow.insertCell().textContent = data.Fresh.staffCustomers.size;
        });
    }

    // --- 3. Company-wise Contribution by Customer Type ---
    const companyData = {}; // Key: CompanyName, Value: { Fresh: {inflow, net}, Old: {inflow, net} }
    filteredDataForOverallAndCompany.forEach(row => { // Use data filtered by all controls
        const companyName = row[companyNameColIndex];
        if (!companyName) return;
        
        const rawCustomerType = String(row[freshOldColIndex]).trim().toUpperCase(); 

        const currentInflow = calculateSumOfColumns(row, headers, individualInfColumns);
        const currentOutflow = calculateSumOfColumns(row, headers, individualOutColumns);
        const currentNet = currentInflow - currentOutflow;

        if (!companyData[companyName]) {
            companyData[companyName] = { Fresh: { inflow: 0, net: 0 }, Old: { inflow: 0, net: 0 } };
        }
        
        // MODIFIED LOGIC: Combine 'FRESH CUSTOMER' and 'FRESH CUSTOMER/FRESH STAFF' for company totals
        if (rawCustomerType === 'FRESH CUSTOMER' || rawCustomerType === 'FRESH CUSTOMER/FRESH STAFF') {
            companyData[companyName].Fresh.inflow += currentInflow;
            companyData[companyName].Fresh.net += currentNet;
        } else if (rawCustomerType === 'OLD' || rawCustomerType === 'OLD CUSTOMER' || rawCustomerType === '' || rawCustomerType === 'FRESH CUSTOMER/MINIMUM AMT NIL') {
            companyData[companyName].Old.inflow += currentInflow;
            companyData[companyName].Old.net += currentNet;
        }
    });

    companyFreshOldTableBody.innerHTML = '';
    const sortedCompanies = Object.keys(companyData).sort();
    if (sortedCompanies.length === 0) {
        companyFreshOldTableBody.innerHTML = '<tr><td colspan="7">No company data available for these filters.</td></tr>';
    } else {
        sortedCompanies.forEach(companyName => {
            const data = companyData[companyName];
            const row = companyFreshOldTableBody.insertRow();
            row.insertCell().textContent = companyName;
            row.insertCell().textContent = formatIndianNumber(data.Fresh.inflow);
            row.insertCell().textContent = formatIndianNumber(data.Fresh.net);
            row.insertCell().textContent = formatIndianNumber(data.Old.inflow);
            row.insertCell().textContent = formatIndianNumber(data.Old.net);
            row.insertCell().textContent = formatIndianNumber(data.Fresh.inflow + data.Old.inflow); // Total Inflow
            row.insertCell().textContent = formatIndianNumber(data.Fresh.net + data.Old.net);     // Total Net
        });
    }
}

// --- Detailed Entries View ---
function viewDetailedEntries() {
    const filteredData = getFilteredData(false); // Respect all filters
    detailedEntriesContainer.style.display = 'block';
    staffPerformanceModal.style.display = 'none'; // Hide staff modal when showing detailed entries
    customerDetailsModal.style.display = 'none'; // Hide customer details modal

    detailedTableHead.innerHTML = '';
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        detailedTableHead.appendChild(th);
    });

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
            
            if (headers[index] === 'DATE' && cellData instanceof Date) {
                content = cellData.toLocaleDateString('en-IN'); // e.g., 19/07/2025
            } else {
                // Keep 'INF Total' and 'OUT Total' here for display, even if not used in current Net calculation
                const numericalHeaders = [
                    'SML NCD INF', 'SML SD INF', 'SML GB INF', 'SML BDSL', 'VFL NCD INF', 'VFL SD INF', 'VFL GB INF',
                    'SNL FD INF', 'LLP INF', 'INF Total', 'VFL NCD OUT', 'VFL BD OUT', 'SML PURCHASE',
                    'SML NCD OUT', 'SML SD OUT', 'SML GB OUT', 'LLP OUT', 'Net' 
                ];
                if (numericalHeaders.includes(headers[index].trim())) {
                    // Apply rounding for display to match user's request for no decimals
                    const numValue = Math.round(parseFloat(String(content).replace(/,/g, ''))); 
                    if (!isNaN(numValue)) {
                        content = formatIndianNumber(numValue);
                    }
                }
            }
            td.textContent = content;
        });
    });
}

// --- Drilldown Function for Staff Performance (UPDATED for modal) ---
function showStaffPerformanceDrilldown() {
    // Ensure detailed entries and other modals are hidden
    detailedEntriesContainer.style.display = 'none'; 
    customerDetailsModal.style.display = 'none';

    // Show the staff performance modal overlay using flex to enable centering
    staffPerformanceModal.style.display = 'flex';
}

// --- Function to close the staff performance modal ---
function closeStaffPerformanceModal() {
    staffPerformanceModal.style.display = 'none';
}

// --- NEW Drilldown Function for Customer Details ---
function showCustomerDetailsDrilldown(staffName) {
    // Hide staff performance modal
    staffPerformanceModal.style.display = 'none';
    detailedEntriesContainer.style.display = 'none';

    customerDetailsStaffNameEl.textContent = `Customer Details for Staff: ${staffName}`;
    customerDetailsTableBody.innerHTML = '';

    const staffData = staffFreshCustomerMap.get(staffName);

    if (!staffData || staffData.customerDetails.size === 0) {
        customerDetailsTableBody.innerHTML = '<tr><td colspan="2">No fresh customer details found for this staff member.</td></tr>';
    } else {
        // Convert map to array and sort by customer name
        const sortedCustomers = Array.from(staffData.customerDetails.entries()).sort((a, b) => a[0].localeCompare(b[0]));

        sortedCustomers.forEach(([customerName, totalInflow]) => {
            const row = customerDetailsTableBody.insertRow();
            row.insertCell().textContent = customerName;
            row.insertCell().textContent = formatIndianNumber(totalInflow);
        });
    }

    // Show the new customer details modal
    customerDetailsModal.style.display = 'flex';
}

// --- NEW Function to close the customer details modal ---
function closeCustomerDetailsModal() {
    customerDetailsModal.style.display = 'none';
}


// --- Event Listeners ---
monthSelect.addEventListener('change', generateReport);
companySelect.addEventListener('change', generateReport);
branchSelect.addEventListener('change', generateReport);
viewEntriesBtn.addEventListener('click', viewDetailedEntries);
totalFreshCustomersEl.addEventListener('click', showStaffPerformanceDrilldown);
totalFreshStaffCustomersEl.addEventListener('click', showStaffPerformanceDrilldown);

// --- NEW Event Listeners for the modals ---
closeStaffModalButton.addEventListener('click', closeStaffPerformanceModal);
closeCustomerModalButton.addEventListener('click', closeCustomerDetailsModal);

// Optional: Close modals if user clicks outside the modal content
window.addEventListener('click', (event) => {
    if (event.target === staffPerformanceModal) {
        closeStaffPerformanceModal();
    }
    if (event.target === customerDetailsModal) {
        closeCustomerDetailsModal();
    }
});

// --- Initialize the report when the page loads ---
document.addEventListener('DOMContentLoaded', init);