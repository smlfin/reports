// company_inflow_outflow.js

// --- Configuration ---
const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1OOdGnJhw1k6U15Aybn_2JWex_qTShP6w7CXm0_auXnc8vFnvlabPZjK3lsjqkHgn6NgeKKPyu9qW/pub?gid=1720680457&single=true&output=csv';

// --- Global Data Storage ---
let allData = []; // Stores all parsed CSV rows
let headers = []; // Stores CSV headers
let allCompanyNames = []; // Stores all unique company names for search functionality

// --- Dynamic Date Range (driven by FY selector) ---
const currentDate = new Date(); // Current date and time

// Derive earliest possible data start: April of the year when this app was first deployed.
// We build the FY list dynamically so no hard-coded single start date is needed here.
// The dataStartDate used in filtering is computed per FY selection.

// --- DOM Elements ---
const fySelect = document.getElementById('fy-select');
const monthFromSelect = document.getElementById('month-from-select');
const monthToSelect = document.getElementById('month-to-select');
const companySearchInput = document.getElementById('company-search');
const companySelect = document.getElementById('company-select');
const viewDetailedEntriesBtn = document.getElementById('view-detailed-entries-btn');
// NEW COMPARISON ELEMENTS
const compareToPrevMonthCheckbox = document.getElementById('compare-to-prev-month');
const comparisonSummaryEl = document.getElementById('comparison-summary');
const summaryDateRangeEl = document.getElementById('summary-date-range');
const comparisonDateRangeEl = document.getElementById('comparison-date-range');
const comparisonTotalInflowEl = document.getElementById('comparison-total-inflow');
const comparisonTotalOutflowEl = document.getElementById('comparison-total-outflow');
const comparisonTotalNetGrowthEl = document.getElementById('comparison-total-net-growth');
const comparisonHeaders = document.querySelectorAll('.comparison-header');


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


// --- Utility Functions (parseLine, parseDate, formatIndianNumber, parseNumericalValue remain unchanged) ---

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
    const cleanedValue = String(valueString).replace(/,/g, ''); // Ensure it's a string before replace
    const parsedValue = parseFloat(cleanedValue);
    return isNaN(parsedValue) ? 0 : parsedValue;
}

// --- Main Data Fetching and Initialization (init and populateFilters remain mostly unchanged) ---
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

        // Dynamic header index lookup
        const dateColIndex = headers.indexOf('DATE');

        allData = rows.slice(1).map(row => {
            const parsedRow = parseLine(row);

            // Pad row with nulls if it has fewer columns than headers
            while (parsedRow.length < headers.length) {
                parsedRow.push(null);
            }

            if (dateColIndex !== -1 && parsedRow[dateColIndex]) {
                const dateObj = parseDate(parsedRow[dateColIndex]);
                // Accept any row with a valid date; the FY/month selectors control the visible range
                if (dateObj) {
                    parsedRow[dateColIndex] = dateObj;
                    return parsedRow;
                }
            }
            return null; // Invalid date or outside range, mark for removal
        }).filter(row => row !== null); // Remove null entries (invalid/out of range dates)

        populateFilters();
        generateReport(); // Generate initial report
    } catch (error) {
        console.error('Error initializing report:', error);
        document.querySelector('.report-container').innerHTML = '<p>Error loading data. Please try again later.</p>';
    }
}

// --- Helper: Get FY label from a year (April YYYY - March YYYY+1) ---
function getFYLabel(startYear) {
    return `FY ${startYear}-${String(startYear + 1).slice(-2)}`;
}

// --- Helper: Get FY start year from a Date ---
function getFYStartYear(date) {
    return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
}

// --- Helper: Get months in a FY as array of {value:'YYYY-MM', label:'Month YYYY'} ---
function getFYMonths(fyStartYear) {
    const months = [];
    for (let i = 0; i < 12; i++) {
        const month = (3 + i) % 12; // April=3, May=4, ..., March=2
        const year = i < 9 ? fyStartYear : fyStartYear + 1; // Apr–Dec = start year, Jan–Mar = start+1
        const value = `${year}-${String(month + 1).padStart(2, '0')}`;
        const label = new Date(year, month, 1).toLocaleString('en-IN', { year: 'numeric', month: 'long' });
        // Only include months up to the current month
        const monthDate = new Date(year, month, 1);
        if (monthDate <= currentDate) {
            months.push({ value, label, year, month });
        }
    }
    return months;
}

// --- Filter Population ---
function populateFilters() {
    const companies = new Set();
    const companyColIndex = headers.indexOf('COMPANY NAME');

    allData.forEach(row => {
        if (companyColIndex !== -1 && row[companyColIndex]) {
            companies.add(row[companyColIndex]);
        }
    });

    allCompanyNames = Array.from(companies).sort();
    filterCompanyList();

    // Build FY list: find earliest date in data, list all FYs from then to current FY
    const dateColIndex = headers.indexOf('DATE');
    let earliestDate = currentDate;
    allData.forEach(row => {
        const d = row[dateColIndex];
        if (d && d < earliestDate) earliestDate = d;
    });

    const firstFYStart = getFYStartYear(earliestDate);
    const currentFYStart = getFYStartYear(currentDate);

    fySelect.innerHTML = '';
    for (let fy = firstFYStart; fy <= currentFYStart; fy++) {
        const option = document.createElement('option');
        option.value = fy;
        option.textContent = getFYLabel(fy);
        fySelect.appendChild(option);
    }
    // Default to current FY
    fySelect.value = currentFYStart;

    populateMonthRangeSelectors(true);
}

// --- Populate From/To month selectors based on selected FY ---
function populateMonthRangeSelectors(isInit = false) {
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

    // Default: From = April of selected FY, To = latest available month in FY
    if (fyMonths.length > 0) {
        monthFromSelect.value = fyMonths[0].value;
        monthToSelect.value = fyMonths[fyMonths.length - 1].value;
    }
}

// --- Ensure To month is never before From month ---
function syncToMonth() {
    const fromVal = monthFromSelect.value;
    const toVal = monthToSelect.value;
    if (toVal < fromVal) {
        monthToSelect.value = fromVal;
    }
    // Disable "to" options that are before "from"
    Array.from(monthToSelect.options).forEach(opt => {
        opt.disabled = opt.value < fromVal;
    });
}

// --- Filter Company Dropdown based on Search Input (Unchanged) ---
function filterCompanyList() {
    const searchTerm = companySearchInput.value.toLowerCase();
    companySelect.innerHTML = '<option value="">All Companies</option>'; // Always include 'All Companies' option

    allCompanyNames.filter(company => company.toLowerCase().includes(searchTerm))
                 .forEach(company => {
                     const option = document.createElement('option');
                     const isSelected = company.toLowerCase() === searchTerm; // Check for exact match
                     const companyOption = document.createElement('option');
                     companyOption.value = company;
                     companyOption.textContent = company;
                     if (isSelected) companyOption.selected = true; // Select exact match if found
                     companySelect.appendChild(companyOption);
                 });
    
    // Only call generateReport if the company list itself was filtered (not just initial load)
    if (document.activeElement === companySearchInput) {
        generateReport(); 
    }
}


// --- Calculate Report and Comparison Dates from From/To range ---
function getComparisonDates() {
    const fromVal = monthFromSelect.value;
    const toVal = monthToSelect.value;

    if (!fromVal || !toVal) return { reportStart: null, reportEnd: null, comparisonStart: null, comparisonEnd: null };

    const [fromYear, fromMonth] = fromVal.split('-').map(Number);
    const [toYear, toMonth] = toVal.split('-').map(Number);

    const reportStart = new Date(fromYear, fromMonth - 1, 1, 0, 0, 0);

    // End: if "to month" is current month, cap at today; else last day of to-month
    let reportEnd;
    const isCurrentMonth = (toYear === currentDate.getFullYear() && toMonth === currentDate.getMonth() + 1);
    if (isCurrentMonth) {
        reportEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 23, 59, 59);
    } else {
        const lastDay = new Date(toYear, toMonth, 0).getDate();
        reportEnd = new Date(toYear, toMonth - 1, lastDay, 23, 59, 59);
    }

    // Comparison: shift the entire range back by one month
    const compFromYear = fromMonth === 1 ? fromYear - 1 : fromYear;
    const compFromMonth = fromMonth === 1 ? 12 : fromMonth - 1;
    const compToYear = toMonth === 1 ? toYear - 1 : toYear;
    const compToMonth = toMonth === 1 ? 12 : toMonth - 1;

    const comparisonStart = new Date(compFromYear, compFromMonth - 1, 1, 0, 0, 0);

    const compLastDay = new Date(compToYear, compToMonth, 0).getDate();
    const compEndDay = isCurrentMonth ? Math.min(currentDate.getDate(), compLastDay) : compLastDay;
    const comparisonEnd = new Date(compToYear, compToMonth - 1, compEndDay, 23, 59, 59);

    return { reportStart, reportEnd, comparisonStart, comparisonEnd };
}

// --- OLD getComparisonDates STUB (replaced above) ---
function _getComparisonDates_UNUSED(selectedMonth) {
    const dateColIndex = headers.indexOf('DATE');
    const selectedCompany = companySelect.value;
    let maxDay = new Date().getDate(); // Default to current day
    let currentMonthStart = null;
    let currentMonthEnd = null;

    if (selectedMonth) {
        // Calculate the last day of the month for the selected YYYY-MM
        const parts = selectedMonth.split('-');
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // 0-indexed month
        const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

        currentMonthStart = new Date(year, month, 1, 0, 0, 0);

        // Filter the data to find the latest date in the selected period (month/company)
        let latestDateInSelection = currentMonthStart;
        allData.filter(row => {
            let rowDate = row[dateColIndex];
            if (!rowDate) return false;
            
            // Check if date is in selected month
            const rowYearMonth = `${rowDate.getFullYear()}-${(rowDate.getMonth() + 1).toString().padStart(2, '0')}`;
            let inSelectedMonth = (rowYearMonth === selectedMonth);

            // Check if company matches (if one is selected)
            let matchCompany = true;
            if (selectedCompany && headers.indexOf('COMPANY NAME') !== -1) {
                matchCompany = (row[headers.indexOf('COMPANY NAME')] === selectedCompany);
            }

            return inSelectedMonth && matchCompany;

        }).forEach(row => {
            if (row[dateColIndex] > latestDateInSelection) {
                latestDateInSelection = row[dateColIndex];
            }
        });

        // The end date for the main report is the latest day in the data, or the current day if the selected month is the current month.
        if (selectedMonth === `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`) {
            // If current month is selected, use the current day of the month
            maxDay = currentDate.getDate();
        } else {
            // Otherwise, use the latest day from the available data for that month
            maxDay = latestDateInSelection.getDate();
        }

        currentMonthEnd = new Date(year, month, maxDay, 23, 59, 59);

    } else {
        // If 'All Months' selected, the end date is the current date
        currentMonthStart = dataStartDate;
        currentMonthEnd = currentDate;
    }

    // Now calculate the comparison period (Previous Month, up to maxDay)
    const prevMonthEnd = new Date(currentMonthEnd.getTime());
    
    if (selectedMonth) {
        // Go back one month, keeping the same day (maxDay)
        prevMonthEnd.setMonth(prevMonthEnd.getMonth() - 1);
        // Handle case where previous month has fewer days (e.g., March 31 -> February 31 becomes March 3)
        // Set to 1st of the previous month's actual month, then set day.
        // Simple way: setting day 'maxDay' will auto-handle overflow, but we must ensure we are in the actual previous month.
        // Go back two months from current month end, set day to 1, then forward one month.
        const prevMonthYear = new Date(currentMonthStart.getTime());
        prevMonthYear.setDate(1); // Set day to 1 to avoid month overflow issues
        prevMonthYear.setMonth(prevMonthYear.getMonth() - 1);
        
        const prevMonthMaxDay = Math.min(maxDay, new Date(prevMonthYear.getFullYear(), prevMonthYear.getMonth() + 1, 0).getDate());

        const comparisonEnd = new Date(prevMonthYear.getFullYear(), prevMonthYear.getMonth(), prevMonthMaxDay, 23, 59, 59);
        const comparisonStart = new Date(prevMonthYear.getFullYear(), prevMonthYear.getMonth(), 1, 0, 0, 0);

        return {
            reportStart: currentMonthStart,
            reportEnd: currentMonthEnd,
            comparisonStart: comparisonStart,
            comparisonEnd: comparisonEnd
        };

    } else {
        // If 'All Months' is selected, comparison is disabled.
         return {
            reportStart: currentMonthStart,
            reportEnd: currentMonthEnd,
            comparisonStart: null,
            comparisonEnd: null
        };
    }
}


// --- Filter Data based on selections ---
function getFilteredData(dateRange) {
    const selectedCompany = companySelect.value;
    const dateColIndex = headers.indexOf('DATE');
    const companyColIndex = headers.indexOf('COMPANY NAME');

    const startDate = dateRange.start;
    const endDate = dateRange.end;

    if (!startDate || !endDate) return [];

    return allData.filter(row => {
        let matchCompany = true;
        let matchDate = false;

        const rowDate = row[dateColIndex];

        if (selectedCompany && companyColIndex !== -1) {
            matchCompany = (row[companyColIndex] === selectedCompany);
        }

        if (rowDate) {
            matchDate = (rowDate >= startDate && rowDate <= endDate);
        }
        return matchCompany && matchDate;
    });
}


// --- Core Report Calculation Function ---
function calculateReportFigures(data) {
    const infTotalColIndex = headers.indexOf('INF Total');
    const outTotalColIndex = headers.indexOf('OUT Total');
    const companyColIndex = headers.indexOf('COMPANY NAME');

    let totalInflow = 0;
    let totalOutflow = 0;
    const companySummary = {};
    const monthlyData = {};
    
    data.forEach(row => {
        const inflow = parseNumericalValue(row[infTotalColIndex]);
        const outflow = parseNumericalValue(row[outTotalColIndex]);

        totalInflow += inflow;
        totalOutflow += outflow;

        // Company-wise Summary
        if (companyColIndex !== -1) {
            const companyName = row[companyColIndex];
            if (companyName) {
                if (!companySummary[companyName]) {
                    companySummary[companyName] = { inflow: 0, outflow: 0, net: 0 };
                }
                companySummary[companyName].inflow += inflow;
                companySummary[companyName].outflow += outflow;
            }
        }

        // Monthly Breakup
        const date = row[headers.indexOf('DATE')];
        if (date) {
            const yearMonth = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            if (!monthlyData[yearMonth]) {
                monthlyData[yearMonth] = { inflow: 0, outflow: 0, net: 0 };
            }
            monthlyData[yearMonth].inflow += inflow;
            monthlyData[yearMonth].outflow += outflow;
        }
    });

    const totalNetGrowth = totalInflow - totalOutflow;

    // Finalize Net calculations
    Object.keys(companySummary).forEach(name => {
        companySummary[name].net = companySummary[name].inflow - companySummary[name].outflow;
    });
    Object.keys(monthlyData).forEach(month => {
        monthlyData[month].net = monthlyData[month].inflow - monthlyData[month].outflow;
    });

    return { totalInflow, totalOutflow, totalNetGrowth, companySummary, monthlyData };
}


// --- Report Generation ---
function generateReport() {
    const isComparisonEnabled = compareToPrevMonthCheckbox.checked;

    // 1. Determine Date Ranges
    const dateRanges = getComparisonDates();

    const reportRange = { start: dateRanges.reportStart, end: dateRanges.reportEnd };
    const comparisonRange = { start: dateRanges.comparisonStart, end: dateRanges.comparisonEnd };

    if (!reportRange.start || !reportRange.end) return;

    // 2. Filter Data and Calculate Main Report Figures
    const mainData = getFilteredData(reportRange);
    const mainReport = calculateReportFigures(mainData);

    // 3. Filter Data and Calculate Comparison Figures (if enabled and possible)
    let comparisonReport = { totalInflow: 0, totalOutflow: 0, totalNetGrowth: 0, companySummary: {}, monthlyData: {} };
    let canCompare = isComparisonEnabled && comparisonRange.start !== null;

    if (canCompare) {
        const comparisonData = getFilteredData(comparisonRange);
        comparisonReport = calculateReportFigures(comparisonData);
    }

    // 4. Update UI Visibility for Comparison
    comparisonSummaryEl.style.display = canCompare ? 'block' : 'none';
    comparisonHeaders.forEach(th => th.style.display = canCompare ? 'table-cell' : 'none');

    // 5. Update Date Range Labels
    const fromLabel = reportRange.start.toLocaleString('en-IN', { year: 'numeric', month: 'long' });
    const toLabel = reportRange.end.toLocaleString('en-IN', { year: 'numeric', month: 'long' });
    const endDay = reportRange.end.getDate();
    const isSingleMonth = (monthFromSelect.value === monthToSelect.value);

    if (isSingleMonth) {
        summaryDateRangeEl.textContent = `${fromLabel} (1st - ${endDay}th)`;
    } else {
        summaryDateRangeEl.textContent = `${fromLabel} to ${toLabel}`;
    }

    if (canCompare) {
        const compFromLabel = comparisonRange.start.toLocaleString('en-IN', { year: 'numeric', month: 'long' });
        const compToLabel = comparisonRange.end.toLocaleString('en-IN', { year: 'numeric', month: 'long' });
        const compEndDay = comparisonRange.end.getDate();
        const isCompSingleMonth = (comparisonRange.start.getMonth() === comparisonRange.end.getMonth() &&
                                   comparisonRange.start.getFullYear() === comparisonRange.end.getFullYear());
        if (isCompSingleMonth) {
            comparisonDateRangeEl.textContent = `${compFromLabel} (1st - ${compEndDay}th)`;
        } else {
            comparisonDateRangeEl.textContent = `${compFromLabel} to ${compToLabel}`;
        }
    }


    // 6. Populate Overall Summary (Main Report)
    overallTotalInflowEl.textContent = formatIndianNumber(mainReport.totalInflow);
    overallTotalOutflowEl.textContent = formatIndianNumber(mainReport.totalOutflow);
    overallTotalNetGrowthEl.textContent = formatIndianNumber(mainReport.totalNetGrowth);

    // 7. Populate Comparison Summary (If Enabled)
    if (canCompare) {
        comparisonTotalInflowEl.textContent = formatIndianNumber(comparisonReport.totalInflow);
        comparisonTotalOutflowEl.textContent = formatIndianNumber(comparisonReport.totalOutflow);
        comparisonTotalNetGrowthEl.textContent = formatIndianNumber(comparisonReport.totalNetGrowth);
    }

    // 8. Populate Company-wise Summary
    // Use the union of company names from both reports
    const allCompanyNamesInReport = new Set([
        ...Object.keys(mainReport.companySummary),
        ...Object.keys(comparisonReport.companySummary)
    ]);
    const sortedCompanies = Array.from(allCompanyNamesInReport).sort();

    companySummaryTableBody.innerHTML = '';
    const totalNetGrowthForContribution = mainReport.totalNetGrowth; // Use main report's net for contribution base

    if (sortedCompanies.length === 0) {
        noCompanyDataMessage.style.display = 'block';
    } else {
        noCompanyDataMessage.style.display = 'none';
        sortedCompanies.forEach(companyName => {
            const mainData = mainReport.companySummary[companyName] || { inflow: 0, outflow: 0, net: 0 };
            const compData = comparisonReport.companySummary[companyName] || { inflow: 0, outflow: 0, net: 0 };

            let contribution = 0;
            if (totalNetGrowthForContribution !== 0) {
                 contribution = (mainData.net / totalNetGrowthForContribution) * 100;
            }
            if (isNaN(contribution) || !isFinite(contribution)) {
                contribution = 0;
            }

            const row = companySummaryTableBody.insertRow();
            row.insertCell().textContent = companyName;
            row.insertCell().textContent = formatIndianNumber(mainData.inflow);
            row.insertCell().textContent = formatIndianNumber(mainData.outflow);
            row.insertCell().textContent = formatIndianNumber(mainData.net);
            row.insertCell().textContent = `${contribution.toFixed(2)}%`;

            // Comparison columns
            if (canCompare) {
                row.insertCell().textContent = formatIndianNumber(compData.inflow);
                row.insertCell().textContent = formatIndianNumber(compData.net);
            }
        });
    }

    // 9. Populate Monthly Breakup
    const allMonthsInReport = new Set(Object.keys(mainReport.monthlyData));
    const sortedMonths = Array.from(allMonthsInReport).sort();

    monthlyTableBody.innerHTML = '';
    if (sortedMonths.length === 0) {
        noMonthlyDataMessage.style.display = 'block';
    } else {
        noMonthlyDataMessage.style.display = 'none';
        sortedMonths.forEach(monthKey => {
            const mainData = mainReport.monthlyData[monthKey] || { inflow: 0, outflow: 0, net: 0 };

            // Only show months that belong to the main report range
            if (!mainReport.monthlyData[monthKey]) return;
            
            const monthName = new Date(monthKey + '-01').toLocaleString('en-IN', { year: 'numeric', month: 'long' });
            
            const row = monthlyTableBody.insertRow();
            row.insertCell().textContent = monthName;
            row.insertCell().textContent = formatIndianNumber(mainData.inflow);
            row.insertCell().textContent = formatIndianNumber(mainData.outflow);
            row.insertCell().textContent = formatIndianNumber(mainData.net);

            if (canCompare) {
                row.insertCell().textContent = '-';
                row.insertCell().textContent = '-';
            }
        });
    }

    // 10. Hide detailed entries on report re-generation
    detailedEntriesContainer.style.display = 'none';
}


// --- Detailed Entries View (Unchanged, but uses the new getFilteredData) ---
function viewDetailedEntries() {
    const dateRanges = getComparisonDates();
    const filteredData = getFilteredData({ start: dateRanges.reportStart, end: dateRanges.reportEnd });

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
        detailedTableBody.innerHTML = '<tr><td colspan="' + headers.length + '"></td></tr>'; // Empty row to ensure table structure
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
fySelect.addEventListener('change', () => { populateMonthRangeSelectors(); generateReport(); });
monthFromSelect.addEventListener('change', () => { syncToMonth(); generateReport(); });
monthToSelect.addEventListener('change', generateReport);
companySelect.addEventListener('change', generateReport);
companySearchInput.addEventListener('input', filterCompanyList);
viewDetailedEntriesBtn.addEventListener('click', viewDetailedEntries);
// NEW EVENT LISTENER
compareToPrevMonthCheckbox.addEventListener('change', generateReport);

// --- Initialize the report when the page loads ---
document.addEventListener('DOMContentLoaded', init);
