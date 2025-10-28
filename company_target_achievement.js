// company_target_achievement.js

// --- Configuration ---
// Your fixed URL for the CSV data
const csvUrl = 'https://docs.google.com/spreadsheets/d/1jYlHO8x40Ygbn05DL3tMZ5wHuoZgPjk2fbtEGoDXzko/export?format=csv&gid=1720680457';

// --- COMPANY MONTHLY TARGETS (Fixed monthly targets) ---
const COMPANY_MONTHLY_TARGETS = {
    "SANGEETH NIDHI LTD": 7500000,
    "BRD FINANCE LTD": 7500000,
    "VANCHINAD FINANCE LTD": 10000000,
    "SML FINANCE LTD": 25000000,
    "AYUR BATHANIYA": 2500000,
    "SANGEETH PHOTOSTAT": 1500000
};

// --- Global Data Storage ---
let headers = []; 
let rawData = []; 

// --- Fixed Date Range for Data Validity (April 2025 - Current Month) ---
const dataStartDate = new Date('2025-04-01T00:00:00');
const currentDate = new Date();
const dataEndDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999); 

// --- DOM Elements ---
const companySelect = document.getElementById('company-select');
const monthSelect = document.getElementById('month-select');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');

// SUMMARY ELEMENTS
const overallTargetEl = document.getElementById('overall-target');
const overallAchievementEl = document.getElementById('overall-achievement');
const overallDeviationEl = document.getElementById('overall-deviation');
const targetStatusEl = document.getElementById('target-status');

// MONTHLY TABLE ELEMENTS
const monthlyTargetTableBody = document.querySelector('#monthly-target-table tbody');
const noMonthlyDataMessage = document.getElementById('no-monthly-data-message');
const employeeDetailsModal = document.getElementById('employee-details-modal');


// --- Utility Functions (All utility functions remain robust and unchanged) ---

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
                date.setHours(23, 59, 59, 999);
                return date;
            }
        }
    }
    return null;
}

function formatDateToInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatIndianNumber(num) {
    if (isNaN(num) || num === null || num === undefined) {
        return '0';
    }

    let parts = Math.round(num).toString().split('.');
    let integerPart = parts[0];
    let sign = '';
    if (integerPart.startsWith('-')) {
        sign = '-';
        integerPart = integerPart.substring(1);
    }

    if (integerPart.length <= 3) {
        return sign + integerPart;
    }

    let lastThree = integerPart.substring(integerPart.length - 3);
    let otherNumbers = integerPart.substring(0, integerPart.length - 3);

    otherNumbers = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',');

    return sign + otherNumbers + ',' + lastThree;
}

function parseNumericalValue(valueString) {
    if (valueString === null || valueString === undefined || valueString === '') {
        return 0;
    }
    const cleanedValue = String(valueString).replace(/,/g, '');
    const parsedValue = parseFloat(cleanedValue);
    return isNaN(parsedValue) ? 0 : parsedValue;
}


// --- Filtering Logic ---

function getFilteredData(data) {
    const companyName = companySelect.value;
    const monthKey = monthSelect.value;
    let customStartDate = startDateInput.value ? new Date(startDateInput.value) : null;
    let customEndDate = endDateInput.value ? new Date(endDateInput.value) : null;

    if (customEndDate) {
        customEndDate.setHours(23, 59, 59, 999);
    }
    
    let filterStartDate = customStartDate || dataStartDate;
    let filterEndDate = customEndDate || dataEndDate;

    if (monthKey && !customStartDate && !customEndDate) {
        const [year, month] = monthKey.split('-');
        filterStartDate = new Date(parseInt(year), parseInt(month) - 1, 1, 0, 0, 0);
        filterEndDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
    }
    
    if (filterStartDate > filterEndDate) {
        filterStartDate = dataStartDate;
        filterEndDate = dataEndDate;
    }

    const dateColIndex = headers.indexOf('DATE');
    const companyColIndex = headers.indexOf('COMPANY NAME');
    
    if (dateColIndex === -1 || companyColIndex === -1) {
        // This should not be reached if init() runs properly, but kept as a safeguard
        return [];
    }

    return data.filter(row => {
        const rowDate = row[dateColIndex];
        const rowCompany = row[companyColIndex];

        const isDateMatch = rowDate >= filterStartDate && rowDate <= filterEndDate;
        const isCompanyMatch = !companyName || rowCompany === companyName;
        
        return isDateMatch && isCompanyMatch;
    });
}


// --- Core Aggregation Logic ---

function aggregateByMonth(data) {
    const companyName = companySelect.value;
    
    // Look up using normalized (UPPERCASE) headers
    const inflowColIndex = headers.indexOf('INF TOTAL');
    const outflowColIndex = headers.indexOf('OUT TOTAL');
    const companyColIndex = headers.indexOf('COMPANY NAME');
    const dateColIndex = headers.indexOf('DATE');

    const monthlyData = {};
    let totalNet = 0;
    let overallTarget = 0;

    // Critical check: This must pass for the report to run.
    if (inflowColIndex === -1 || outflowColIndex === -1 || companyColIndex === -1 || dateColIndex === -1) {
        console.error("Aggregation Failed: Required column index missing.");
        return { monthlyData: {}, totalNet: 0, overallTarget: 0 };
    }

    const allTargetCompanies = Object.keys(COMPANY_MONTHLY_TARGETS);
    const companiesToInclude = companyName ? [companyName] : allTargetCompanies;

    const rangeStartDate = startDateInput.value ? new Date(startDateInput.value) : dataStartDate;
    const rangeEndDate = endDateInput.value ? new Date(endDateInput.value) : dataEndDate;
    
    if (rangeEndDate) {
        rangeEndDate.setHours(23, 59, 59, 999);
    }
    
    // 1. Pre-calculate targets for every month in the range
    let currentDateIterator = new Date(rangeStartDate.getFullYear(), rangeStartDate.getMonth(), 1);
    
    while (currentDateIterator <= rangeEndDate) {
        const yearMonthKey = `${currentDateIterator.getFullYear()}-${String(currentDateIterator.getMonth() + 1).padStart(2, '0')}`;
        
        let monthlyTarget = 0;
        companiesToInclude.forEach(company => {
            if (COMPANY_MONTHLY_TARGETS[company]) {
                monthlyTarget += COMPANY_MONTHLY_TARGETS[company];
            }
        });
        
        if (!monthlyData[yearMonthKey]) {
            monthlyData[yearMonthKey] = {
                month: yearMonthKey,
                achievement: 0, 
                target: monthlyTarget
            };
            overallTarget += monthlyTarget;
        }

        currentDateIterator.setMonth(currentDateIterator.getMonth() + 1);
    }

    // 2. Aggregate the actual achievement (Net) from the filtered data
    data.forEach(row => {
        const rowDate = row[dateColIndex];
        const rowCompany = row[companyColIndex];
        
        // Calculate NET: INF Total - OUT Total
        const inflow = parseNumericalValue(row[inflowColIndex]);
        const outflow = parseNumericalValue(row[outflowColIndex]);
        const net = inflow - outflow;
        
        if (companiesToInclude.includes(rowCompany) && COMPANY_MONTHLY_TARGETS[rowCompany]) {
            const yearMonthKey = `${rowDate.getFullYear()}-${String(rowDate.getMonth() + 1).padStart(2, '0')}`;
            
            if (monthlyData[yearMonthKey]) {
                monthlyData[yearMonthKey].achievement += net;
                totalNet += net;
            }
        }
    });

    return { monthlyData, totalNet, overallTarget };
}

// --- Main Report Generation ---
function generateReport() {
    // Safety check for empty headers array (failed initialization)
    if (headers.length === 0) {
        console.warn("Headers not loaded. Cannot generate report.");
        return;
    }
    
    const currentFilteredData = getFilteredData(rawData);
    
    const { monthlyData, totalNet, overallTarget } = aggregateByMonth(currentFilteredData);

    // 3. Update Overall Summary Cards
    const overallDeviation = totalNet - overallTarget;
    const targetStatus = overallTarget !== 0 ? (totalNet / overallTarget) * 100 : (totalNet > 0 ? 9999 : 0); 
    
    overallTargetEl.textContent = formatIndianNumber(overallTarget);
    overallAchievementEl.textContent = formatIndianNumber(totalNet);
    overallDeviationEl.textContent = formatIndianNumber(overallDeviation);
    targetStatusEl.textContent = `${targetStatus.toFixed(2)}%`;

    overallDeviationEl.classList.remove('positive', 'negative');
    overallDeviationEl.classList.add(overallDeviation >= 0 ? 'positive' : 'negative');

    targetStatusEl.classList.remove('positive', 'negative');
    targetStatusEl.classList.add(targetStatus >= 100 ? 'positive' : 'negative');


    // 4. Render Monthly Target vs. Achievement Table
    monthlyTargetTableBody.innerHTML = '';
    const monthlyKeys = Object.keys(monthlyData).sort();

    if (monthlyKeys.length === 0) {
        noMonthlyDataMessage.style.display = 'block';
    } else {
        noMonthlyDataMessage.style.display = 'none';

        monthlyKeys.forEach(monthKey => {
            const data = monthlyData[monthKey];
            const monthName = new Date(monthKey + '-01').toLocaleString('en-IN', {
                year: 'numeric',
                month: 'long'
            });

            const deviation = data.achievement - data.target;
            const status = data.target !== 0 ? (data.achievement / data.target) * 100 : (data.achievement > 0 ? 9999 : 0);
            const deviationClass = deviation >= 0 ? 'positive' : 'negative';

            const row = monthlyTargetTableBody.insertRow();
            row.innerHTML = `
                <td>${monthName}</td>
                <td>${formatIndianNumber(data.target)}</td>
                <td>${formatIndianNumber(data.achievement)}</td>
                <td class="${deviationClass}">${formatIndianNumber(deviation)}</td>
                <td class="${status >= 100 ? 'positive' : 'negative'}">${status.toFixed(2)}%</td>
            `;
        });
    }
}


// --- Filter Population ---
function populateFilters() {
    const companyColIndex = headers.indexOf('COMPANY NAME');
    const dateColIndex = headers.indexOf('DATE');

    if (companyColIndex === -1 || dateColIndex === -1) return;

    const uniqueCompanies = new Set();
    const uniqueMonths = new Set();
    
    rawData.forEach(row => {
        const company = row[companyColIndex];
        const date = row[dateColIndex];
        if (COMPANY_MONTHLY_TARGETS[company]) { 
            uniqueCompanies.add(company);
        }
        if (date) {
            uniqueMonths.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
        }
    });

    const sortedCompanies = Array.from(uniqueCompanies).sort();
    companySelect.innerHTML = '<option value="">All Companies</option>';
    sortedCompanies.forEach(company => {
        const option = document.createElement('option');
        option.value = company;
        option.textContent = company;
        companySelect.appendChild(option);
    });

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
    
    startDateInput.value = formatDateToInput(dataStartDate);
    endDateInput.value = formatDateToInput(dataEndDate);
}


// --- Main Data Fetching and Initialization ---
async function init() {
    try {
        const response = await fetch(csvUrl);
        const csvText = await response.text();
        const rows = csvText.trim().split('\n');
        
        if (rows.length <= 1) return;
        
        // --- CRITICAL FIX: Normalize headers to UPPERCASE and trim whitespace ---
        headers = parseLine(rows[0]).map(header => header.trim().toUpperCase());
        // --------------------------------------------------------------------------
        
        const dateColIndex = headers.indexOf('DATE');
        const infTotalIndex = headers.indexOf('INF TOTAL');
        const outTotalIndex = headers.indexOf('OUT TOTAL');
        const companyNameIndex = headers.indexOf('COMPANY NAME');
        
        // Final check on all required columns
        if (dateColIndex === -1) {
            throw new Error("CSV header 'DATE' not found. This column is essential for monthly reporting and date filtering.");
        }
        if (infTotalIndex === -1 || outTotalIndex === -1 || companyNameIndex === -1) {
             throw new Error("One or more required headers ('COMPANY NAME', 'INF Total', 'OUT Total') are missing or misspelled.");
        }

        rawData = rows.slice(1).map(row => {
            const parsedRow = parseLine(row);
            while (parsedRow.length < headers.length) {
                parsedRow.push(null);
            }
            
            const dateObj = parseDate(parsedRow[dateColIndex]);
            
            if (!dateObj || dateObj < dataStartDate || dateObj > dataEndDate) return null;
            
            parsedRow[dateColIndex] = dateObj;
            return parsedRow;
        }).filter(row => row !== null);
        
        populateFilters();
        
        // --- Event Listeners ---
        companySelect.addEventListener('change', generateReport);
        monthSelect.addEventListener('change', () => { startDateInput.value = ''; endDateInput.value = ''; generateReport(); });
        startDateInput.addEventListener('change', () => { if (startDateInput.value || endDateInput.value) { monthSelect.value = ''; } generateReport(); });
        endDateInput.addEventListener('change', () => { if (startDateInput.value || endDateInput.value) { monthSelect.value = ''; } generateReport(); });

        const closeEmployeeModalBtn = document.getElementById('close-employee-modal');
        if (closeEmployeeModalBtn) {
            closeEmployeeModalBtn.addEventListener('click', () => {
                employeeDetailsModal.style.display = 'none';
            });
        }
        
        generateReport();

    } catch (error) {
        console.error('Error fetching or processing CSV data:', error);
        document.querySelector('.report-container').innerHTML = `
            <h1>Report Initialization Error</h1>
            <p>Error loading data: <strong>${error.message}</strong></p>
            <p>Please ensure your CSV file contains the following headers (case and spacing must match the CSV, though we try to normalize):</p>
            <ul>
                <li><strong>COMPANY NAME</strong></li>
                <li><strong>INF Total</strong></li>
                <li><strong>OUT Total</strong></li>
                <li><strong>DATE</strong> (Required for monthly reporting)</li>
            </ul>
        `;
    }
}

document.addEventListener('DOMContentLoaded', init);
