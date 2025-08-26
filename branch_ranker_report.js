// branch_ranker_report.js

// --- Configuration ---
const csvUrl = 'https://docs.google.com/spreadsheets/d/1jYlHO8x40Ygbn05DL3tMZ5wHuoZgPjk2fbtEGoDXzko/export?format=csv&gid=1720680457';

// --- Global Data Storage ---
let allData = []; // Stores all parsed CSV rows
let headers = []; // Stores CSV headers
let allCompanyNames = []; // Stores all unique company names for filter search
let aggregatedData = {}; // Stores pre-aggregated data for faster lookups

// --- Fixed Date Range for Data Validity (April 2025 - Current Month) ---
const dataStartDate = new Date('2025-04-01T00:00:00'); // April 1, 2025, 00:00:00 local time
const currentDate = new Date(); // Current date and time
const dataEndDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59); // End of the current month

// --- DOM Elements ---
const companySearchInput = document.getElementById('company-search');
const companySelect = document.getElementById('company-select');
const monthSelect = document.getElementById('month-select');
const rankFilterSelect = document.getElementById('rank-filter');
const branchRankerSummarySection = document.getElementById('branch-ranker-summary-section');
const branchRankerTable = document.querySelector('#branch-ranker-table');
const branchRankerTableHead = document.querySelector('#branch-ranker-table thead tr');
const branchRankerTableBody = document.querySelector('#branch-ranker-table tbody');
const noCompanySelectedMessage = document.getElementById('no-company-selected-message');
const noRankerDataMessage = document.getElementById('no-ranker-data-message');


// --- Utility Functions (Reused from company_report_branch_performance.js) ---

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
            
            while (parsedRow.length < headers.length) {
                parsedRow.push(null);
            }

            if (dateColIndex === -1 || !parsedRow[dateColIndex]) return null;
            const dateObj = parseDate(parsedRow[dateColIndex]);
            if (!dateObj || dateObj < dataStartDate || dateObj > dataEndDate) return null;
            parsedRow[dateColIndex] = dateObj;
            
            return parsedRow;
        }).filter(row => row !== null);

        // Pre-aggregate data for faster filtering
        preAggregateData();

        populateFilters();
        
        // Add event listeners
        companySelect.addEventListener('change', generateReport);
        monthSelect.addEventListener('change', generateReport);
        rankFilterSelect.addEventListener('change', generateReport);
        companySearchInput.addEventListener('input', () => {
            const searchText = companySearchInput.value.toLowerCase();
            const filteredCompanies = allCompanyNames.filter(company => company.toLowerCase().includes(searchText));
            populateCompanySelect(filteredCompanies);
            generateReport();
        });

        // Initial report generation
        generateReport();

    } catch (error) {
        console.error('Error initializing report:', error);
        document.querySelector('.report-container').innerHTML = '<p>Error loading data. Please try again later.</p>';
    }
}

// --- Pre-aggregation Function ---
function preAggregateData() {
    aggregatedData = {};
    const companyColIndex = headers.indexOf('COMPANY NAME');
    const branchColIndex = headers.indexOf('BRANCH');
    const dateColIndex = headers.indexOf('DATE');
    const inflowColIndex = headers.indexOf('INF Total');
    const outflowColIndex = headers.indexOf('OUT Total');

    allData.forEach(row => {
        const companyName = row[companyColIndex];
        const branchName = row[branchColIndex];
        const date = row[dateColIndex];
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const inflow = parseNumericalValue(row[inflowColIndex]);
        const outflow = parseNumericalValue(row[outflowColIndex]);
        const net = inflow - outflow;

        const key = `${companyName}|${branchName}`;

        if (!aggregatedData[key]) {
            aggregatedData[key] = {
                company: companyName,
                branch: branchName,
                monthlyData: {}
            };
        }
        
        if (!aggregatedData[key].monthlyData[monthKey]) {
            aggregatedData[key].monthlyData[monthKey] = { inflow: 0, outflow: 0, net: 0 };
        }

        aggregatedData[key].monthlyData[monthKey].inflow += inflow;
        aggregatedData[key].monthlyData[monthKey].outflow += outflow;
        aggregatedData[key].monthlyData[monthKey].net += net;
    });
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
    companySelect.innerHTML = '<option value="all">All Companies</option>';
    companyList.forEach(company => {
        const option = document.createElement('option');
        option.value = company;
        option.textContent = company;
        companySelect.appendChild(option);
    });
}


// --- Generate Report ---
function generateReport() {
    const selectedCompany = companySelect.value;
    const selectedMonth = monthSelect.value;
    const rankFilter = rankFilterSelect.value;

    // Correctly handle the visibility of the "no company selected" message
    if (selectedCompany === '') {
        noCompanySelectedMessage.style.display = 'block';
        branchRankerSummarySection.style.display = 'none';
        return;
    } else {
        noCompanySelectedMessage.style.display = 'none';
        branchRankerSummarySection.style.display = 'block';
    }

    let reportData = [];

    // Filter aggregated data based on selections
    for (const key in aggregatedData) {
        const branchData = aggregatedData[key];
        if (selectedCompany !== 'all' && branchData.company !== selectedCompany) {
            continue;
        }

        let totalInflow = 0;
        let totalOutflow = 0;
        let totalNet = 0;
        let prevMonthNet = 0;
        let hasPreviousMonthData = false;

        if (selectedMonth) {
            // Single month view
            const monthlyStats = branchData.monthlyData[selectedMonth];
            if (monthlyStats) {
                totalInflow = monthlyStats.inflow;
                totalOutflow = monthlyStats.outflow;
                totalNet = monthlyStats.net;

                // Calculate previous month net for growth/degrowth
                const [year, month] = selectedMonth.split('-').map(Number);
                const prevMonth = month - 1 === 0 ? 12 : month - 1;
                const prevYear = month - 1 === 0 ? year - 1 : year;
                const prevMonthKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
                
                const prevStats = branchData.monthlyData[prevMonthKey];
                if (prevStats) {
                    prevMonthNet = prevStats.net;
                    hasPreviousMonthData = true;
                }
            }
        } else {
            // All months view
            for (const monthKey in branchData.monthlyData) {
                totalInflow += branchData.monthlyData[monthKey].inflow;
                totalOutflow += branchData.monthlyData[monthKey].outflow;
                totalNet += branchData.monthlyData[monthKey].net;
            }
        }

        reportData.push({
            company: branchData.company,
            branch: branchData.branch,
            inflow: totalInflow,
            outflow: totalOutflow,
            net: totalNet,
            previousMonthNet: prevMonthNet,
            hasPreviousMonthData: hasPreviousMonthData
        });
    }

    // Apply the rank filter
    let filteredReportData = reportData;
    if (rankFilter === 'top5') {
        filteredReportData.sort((a, b) => b.net - a.net);
        filteredReportData = filteredReportData.slice(0, 5);
    } else if (rankFilter === 'bottom5') {
        filteredReportData.sort((a, b) => a.net - b.net);
        filteredReportData = filteredReportData.slice(0, 5);
    } else if (rankFilter === 'growth' && selectedMonth) {
        filteredReportData = filteredReportData.filter(d => d.hasPreviousMonthData && d.net > d.previousMonthNet);
        filteredReportData.sort((a, b) => (b.net - b.previousMonthNet) - (a.net - a.previousMonthNet));
    } else if (rankFilter === 'degrowth' && selectedMonth) {
        filteredReportData = filteredReportData.filter(d => d.hasPreviousMonthData && d.net < d.previousMonthNet);
        filteredReportData.sort((a, b) => (a.net - a.previousMonthNet) - (b.net - b.previousMonthNet));
    } else {
        filteredReportData.sort((a, b) => b.net - a.net);
    }

    renderBranchRankerTable(filteredReportData, selectedCompany === 'all');
}


function renderBranchRankerTable(data, isAllCompaniesView) {
    // Clear and set the table headers
    branchRankerTableHead.innerHTML = '';
    let headerHtml = '<th>Rank</th>';
    if (isAllCompaniesView) {
        headerHtml += '<th>Company</th>';
    }
    headerHtml += '<th>Branch</th><th>Total Inflow</th><th>Total Outflow</th><th>Net</th>';
    branchRankerTableHead.innerHTML = headerHtml;

    // Clear and populate the table body
    branchRankerTableBody.innerHTML = '';
    
    if (data.length === 0) {
        noRankerDataMessage.style.display = 'block';
        return;
    } else {
        noRankerDataMessage.style.display = 'none';
    }

    data.forEach((branchData, index) => {
        const tr = document.createElement('tr');
        const rank = index + 1;
        const netClass = branchData.net >= 0 ? 'positive' : 'negative';

        let rowHtml = `<td>${rank}</td>`;
        if (isAllCompaniesView) {
            rowHtml += `<td>${branchData.company}</td>`;
        }
        rowHtml += `
            <td>${branchData.branch}</td>
            <td>${formatIndianNumber(branchData.inflow)}</td>
            <td>${formatIndianNumber(branchData.outflow)}</td>
            <td class="${netClass}">${formatIndianNumber(branchData.net)}</td>
        `;
        
        tr.innerHTML = rowHtml;
        branchRankerTableBody.appendChild(tr);
    });
}

// --- Initialize the report when the page loads ---

document.addEventListener('DOMContentLoaded', init);
