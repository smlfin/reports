// company_report_branch_performance.js

// --- Configuration ---
const csvUrl = 'https://docs.google.com/spreadsheets/d/1jYlHO8x40Ygbn05DL3tMZ5wHuoZgPjk2fbtEGoDXzko/export?format=csv&gid=1720680457';

// --- Global Data Storage ---
let allData = []; // Stores all parsed CSV rows (legacy/unused after rawData introduced)
let headers = []; // Stores CSV headers
let allCompanyNames = []; // Stores all unique company names for filter search
let isModalOpen = false; // To track modal state
let rawData = []; // Stores data after initial parsing but before filtering

// --- Fixed Date Range for Data Validity (April 2025 - Current Month) ---
const dataStartDate = new Date('2025-04-01T00:00:00'); // April 1, 2025, 00:00:00 local time
const currentDate = new Date(); // Current date and time
const dataEndDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59); // End of the current month

// --- DOM Elements ---
const companySearchInput = document.getElementById('company-search');
const companySelect = document.getElementById('company-select');
const monthSelect = document.getElementById('month-select');
// NEW: Date Range Inputs
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');

const viewDetailedBtn = document.getElementById('view-detailed-btn');
const detailedEntriesContainer = document.getElementById('detailed-entries-container');
const detailedTableHead = document.querySelector('#detailed-table thead tr');
const detailedTableBody = document.querySelector('#detailed-table tbody');
const noDetailedDataMessage = document.getElementById('no-detailed-data-message');
const noCompanySelectedMessage = document.getElementById('no-company-selected-message');
const branchPerformanceSummarySection = document.getElementById('branch-performance-summary-section');
const branchPerformanceTableBody = document.querySelector('#branch-performance-table tbody');
const noSummaryDataMessage = document.getElementById('no-summary-data-message');
const totalInflowEl = document.getElementById('total-inflow');
const totalOutflowEl = document.getElementById('total-outflow');
const totalNetEl = document.getElementById('total-net');

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
            // New Date(year, monthIndex, day)
            const date = new Date(year, month - 1, day);
            
            // Check for date validity after construction
            if (date.getDate() === day && (date.getMonth() + 1) === month && date.getFullYear() === year) {
                // Set time to end of day to include all transactions on that day
                date.setHours(23, 59, 59, 999);
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


// --- Filtering Logic ---

/**
 * Filters the raw data based on the selected company, month, or date range.
 * @param {Array<Array<any>>} data - The raw data array (with Date objects at DATE index).
 * @returns {Array<Array<any>>} The filtered data.
 */
function getFilteredData(data) {
    const companyName = companySelect.value;
    const monthKey = monthSelect.value; // Format: YYYY-MM
    let customStartDate = startDateInput.value ? new Date(startDateInput.value) : null;
    let customEndDate = endDateInput.value ? new Date(endDateInput.value) : null;

    // Adjust customEndDate to the end of the day for inclusive filtering
    if (customEndDate) {
        // Set time to 23:59:59.999 for the selected end date
        customEndDate.setHours(23, 59, 59, 999);
    }
    
    // Determine the final date range to use for filtering
    let filterStartDate = customStartDate || dataStartDate;
    let filterEndDate = customEndDate || dataEndDate;

    // If only month is selected, set date range to that month
    if (monthKey && !customStartDate && !customEndDate) {
        const [year, month] = monthKey.split('-');
        // Start of the selected month
        filterStartDate = new Date(parseInt(year), parseInt(month) - 1, 1, 0, 0, 0);
        // End of the selected month
        filterEndDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
    }
    
    // Validate date range: if start is after end, use the default range and warn
    if (filterStartDate > filterEndDate) {
        console.warn("Start date is after end date. Using default range.");
        filterStartDate = dataStartDate;
        filterEndDate = dataEndDate;
    }

    const dateColIndex = headers.indexOf('DATE');
    const companyColIndex = headers.indexOf('COMPANY NAME');
    
    if (dateColIndex === -1 || companyColIndex === -1) {
        console.error("Required columns (DATE or COMPANY NAME) not found.");
        return [];
    }

    let filtered = data.filter(row => {
        const rowDate = row[dateColIndex];
        const rowCompany = row[companyColIndex];

        // 1. Date filter (Always applies based on determined range)
        const isDateMatch = rowDate >= filterStartDate && rowDate <= filterEndDate;
        if (!isDateMatch) return false;

        // 2. Company filter (Applies if a company is selected)
        const isCompanyMatch = !companyName || rowCompany === companyName;
        
        return isCompanyMatch;
    });

    return filtered;
}


// --- Main Report Generation and Aggregation ---

// Function to aggregate data by branch
function aggregateByBranch(data) {
    const branchColIndex = headers.indexOf('BRANCH');
    const inflowColIndex = headers.indexOf('INF TOTAL');
    const outflowColIndex = headers.indexOf('OUT TOTAL');

    const aggregated = {};
    let totalInflow = 0;
    let totalOutflow = 0;
    
    if (branchColIndex === -1 || inflowColIndex === -1 || outflowColIndex === -1) {
        console.error("Required columns (BRANCH, INF TOTAL, OUT TOTAL) not found for aggregation.");
        return { data: [], totalInflow: 0, totalOutflow: 0, totalNet: 0 };
    }

    data.forEach(row => {
        const branchName = row[branchColIndex];
        const inflow = parseNumericalValue(row[inflowColIndex]);
        const outflow = parseNumericalValue(row[outflowColIndex]);
        const net = inflow - outflow;

        if (!aggregated[branchName]) {
            aggregated[branchName] = {
                branch: branchName,
                inflow: 0,
                outflow: 0,
                net: 0,
                detailedEntries: []
            };
        }

        aggregated[branchName].inflow += inflow;
        aggregated[branchName].outflow += outflow;
        aggregated[branchName].net += net;
        aggregated[branchName].detailedEntries.push(row);

        totalInflow += inflow;
        totalOutflow += outflow;
    });

    const branchList = Object.values(aggregated).sort((a, b) => b.net - a.net);
    
    return {
        data: branchList,
        totalInflow: totalInflow,
        totalOutflow: totalOutflow,
        totalNet: totalInflow - totalOutflow
    };
}

// Function to generate the branch performance report
function generateReport() {
    // 1. Filter the data based on current selections
    const currentFilteredData = getFilteredData(rawData);

    // 2. Aggregate the data
    const { data: branchData, totalInflow, totalOutflow, totalNet } = aggregateByBranch(currentFilteredData);

    // 3. Update Summary Cards
    totalInflowEl.textContent = formatIndianNumber(totalInflow);
    totalOutflowEl.textContent = formatIndianNumber(totalOutflow);
    totalNetEl.textContent = formatIndianNumber(totalNet);
    totalNetEl.classList.remove('positive', 'negative');
    totalNetEl.classList.add(totalNet >= 0 ? 'positive' : 'negative');
    
    // 4. Render Branch Performance Table
    branchPerformanceTableBody.innerHTML = '';
    
    if (branchData.length === 0) {
        noSummaryDataMessage.style.display = 'block';
        return;
    } else {
        noSummaryDataMessage.style.display = 'none';
    }

    branchData.forEach(branch => {
        const tr = document.createElement('tr');
        const netClass = branch.net >= 0 ? 'positive' : 'negative';

        tr.innerHTML = `
            <td>${branch.branch}</td>
            <td>${formatIndianNumber(branch.inflow)}</td>
            <td>${formatIndianNumber(branch.outflow)}</td>
            <td class="${netClass}"><strong>${formatIndianNumber(branch.net)}</strong></td>
            <td><button class="view-details-btn" data-branch="${branch.branch}" data-inflow="${branch.inflow}" data-outflow="${branch.outflow}">View Details</button></td>
        `;
        branchPerformanceTableBody.appendChild(tr);
    });

    // 5. Add event listeners for View Details buttons
    document.querySelectorAll('.view-details-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const branchName = e.target.getAttribute('data-branch');
            const branchInfo = branchData.find(b => b.branch === branchName);
            if (branchInfo) {
                showEmployeeDetailsModal(branchName, branchInfo.detailedEntries);
            }
        });
    });

    // Hide detailed entries view after new report generation
    detailedEntriesContainer.style.display = 'none';
}


// Function to populate initial filters (Company and Month)
function populateFilters() {
    const companyColIndex = headers.indexOf('COMPANY NAME');
    const dateColIndex = headers.indexOf('DATE');

    if (companyColIndex === -1 || dateColIndex === -1) {
        console.error("Required columns (COMPANY NAME or DATE) not found for populating filters.");
        return;
    }

    const uniqueCompanies = new Set();
    const uniqueMonths = new Set();
    
    rawData.forEach(row => {
        uniqueCompanies.add(row[companyColIndex]);
        const date = row[dateColIndex];
        if (date) {
            // Format: YYYY-MM
            uniqueMonths.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
        }
    });

    // Populate Company Select
    const sortedCompanies = Array.from(uniqueCompanies).sort();
    companySelect.innerHTML = '<option value="">All Companies</option>';
    sortedCompanies.forEach(company => {
        const option = document.createElement('option');
        option.value = company;
        option.textContent = company;
        companySelect.appendChild(option);
    });

    // Populate Month Select
    // Sort months for chronological order
    const sortedMonths = Array.from(uniqueMonths).sort();
    monthSelect.innerHTML = '<option value="">All Months</option>';
    sortedMonths.forEach(monthKey => {
        const [year, month] = monthKey.split('-');
        const monthName = new Date(year, month - 1).toLocaleString('en-us', { month: 'long', year: 'numeric' });
        const option = document.createElement('option');
        option.value = monthKey;
        option.textContent = monthName;
        monthSelect.appendChild(option);
    });
    
    // NEW: Set default date range to the data validity range
    startDateInput.value = formatDateToInput(dataStartDate);
    endDateInput.value = formatDateToInput(dataEndDate);
}


// Function to show employee details modal (Simplified implementation for context)
function showEmployeeDetailsModal(branchName, entries) {
    // This is a simplified function. The full report would aggregate by employee and month.
    
    employeeModalTitle.textContent = `Employee Participation for ${branchName}`;
    employeeDetailsTableBody.innerHTML = '';
    
    // Simple placeholder logic: just list unique employee names and total net in the period
    const employeeSummary = {};
    const employeeColIndex = headers.indexOf('STAFF NAME');
    const netColIndex = headers.indexOf('NET');

    if (employeeColIndex === -1 || netColIndex === -1) {
        console.error("Required columns (STAFF NAME or NET) not found for employee details.");
        return;
    }
    
    entries.forEach(entry => {
        const employeeName = entry[employeeColIndex];
        const netValue = parseNumericalValue(entry[netColIndex]);

        if (!employeeSummary[employeeName]) {
            employeeSummary[employeeName] = 0;
        }
        employeeSummary[employeeName] += netValue;
    });

    let hasData = false;
    Object.keys(employeeSummary).sort().forEach(name => {
        const net = employeeSummary[name];
        const tr = document.createElement('tr');
        const netClass = net >= 0 ? 'positive' : 'negative';

        tr.innerHTML = `
            <td>${name}</td>
            <td>-</td>
            <td>-</td>
            <td class="${netClass}"><strong>${formatIndianNumber(net)}</strong></td>
        `; // Inflow/Outflow set to '-' for simplified view
        employeeDetailsTableBody.appendChild(tr);
        hasData = true;
    });

    noEmployeeDataMessage.style.display = hasData ? 'none' : 'block';
    
    employeeDetailsModal.style.display = 'block';
    isModalOpen = true;
}


// --- Main Data Fetching and Initialization ---
async function init() {
    try {
        const response = await fetch(csvUrl);
        const csvText = await response.text();
        const rows = csvText.trim().split('\n');
        
        if (rows.length <= 1) { // Check for headers only
            console.error('No data found in CSV.');
            document.querySelector('.report-container').innerHTML = '<p>Error loading data. No data found.</p>';
            return;
        }
        
        headers = parseLine(rows[0]).map(header => header.trim());
        const dateColIndex = headers.indexOf('DATE');
        
        if (dateColIndex === -1) {
            console.error("The 'DATE' column is missing from the CSV data.");
            document.querySelector('.report-container').innerHTML = '<p>Error: Required "DATE" column missing from data source.</p>';
            return;
        }

        // Store all valid data in rawData, replacing date string with Date object
        rawData = rows.slice(1).map(row => {
            const parsedRow = parseLine(row);
            // Pad row with nulls if it has fewer columns than headers
            while (parsedRow.length < headers.length) {
                parsedRow.push(null);
            }
            
            // Parse date
            const dateObj = parseDate(parsedRow[dateColIndex]);
            
            // Only keep rows with a valid date and within the fixed validity range
            if (!dateObj || dateObj < dataStartDate || dateObj > dataEndDate) return null;
            
            parsedRow[dateColIndex] = dateObj; // Replace date string with Date object
            return parsedRow;
        }).filter(row => row !== null); // Remove null entries (invalid/out of range dates)
        
        // If no valid data is left after initial range filtering
        if (rawData.length === 0) {
            console.warn('No valid data found within the data validity range.');
        }

        populateFilters(); // Populate filters including the new default dates
        
        // Add event listeners
        companySelect.addEventListener('change', generateReport);
        
        monthSelect.addEventListener('change', () => {
            // Clear date range if a month is selected, or vice-versa, for simple UX
            startDateInput.value = '';
            endDateInput.value = '';
            generateReport();
        });

        startDateInput.addEventListener('change', () => {
            // Clear month selection if a date is manually selected
            if (startDateInput.value || endDateInput.value) {
                monthSelect.value = '';
            }
            generateReport();
        });
        
        endDateInput.addEventListener('change', () => {
            // Clear month selection if a date is manually selected
            if (startDateInput.value || endDateInput.value) {
                monthSelect.value = '';
            }
            generateReport();
        });

        closeEmployeeModalBtn.addEventListener('click', () => {
            employeeDetailsModal.style.display = 'none';
            isModalOpen = false;
        });
        
        // Initial report generation
        generateReport();

    } catch (error) {
        console.error('Error fetching or processing CSV data:', error);
        document.querySelector('.report-container').innerHTML = '<p>Error loading data. Please check the console for details.</p>';
    }
}

// Ensure init() is called when the page loads
document.addEventListener('DOMContentLoaded', init);


// --- Additional listener for modal closing via click outside or ESC key ---
window.addEventListener('click', (event) => {
    if (event.target === employeeDetailsModal) {
        employeeDetailsModal.style.display = 'none';
        isModalOpen = false;
    }
});

window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isModalOpen) {
        employeeDetailsModal.style.display = 'none';
        isModalOpen = false;
    }
});