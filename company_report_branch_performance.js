// company_report_branch_performance.js

// --- Configuration ---
const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1OOdGnJhw1k6U15Aybn_2JWex_qTShP6w7CXm0_auXnc8vFnvlabPZjK3lsjqkHgn6NgeKKPyu9qW/pub?gid=1720680457&single=true&output=csv';

// --- Global Data Storage ---
let allData = []; // Stores all parsed CSV rows
let headers = []; // Stores CSV headers
let allCompanyNames = []; // Stores all unique company names for filter search

// --- Fixed Date Range for Data Validity (April 2025 - Current Month) ---
const dataStartDate = new Date('2025-04-01T00:00:00'); // April 1, 2025, 00:00:00 local time
const currentDate = new Date(); // Current date and time
const dataEndDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59); // End of the current month

// --- DOM Elements ---
const companySearchInput = document.getElementById('company-search');
const companySelect = document.getElementById('company-select');
const monthSelect = document.getElementById('month-select');
const viewDetailedBtn = document.getElementById('view-detailed-btn');

const noCompanySelectedMessage = document.getElementById('no-company-selected-message');
const branchPerformanceSummarySection = document.getElementById('branch-performance-summary-section');
const branchPerformanceTableBody = document.querySelector('#branch-performance-table tbody');
const noSummaryDataMessage = document.getElementById('no-summary-data-message');

const detailedEntriesContainer = document.getElementById('detailed-entries-container');
const detailedTableHead = document.querySelector('#detailed-table thead tr');
const detailedTableBody = document.querySelector('#detailed-table tbody');
const noDetailedDataMessage = document.getElementById('no-detailed-data-message');

// New DOM Elements for Employee Details Modal
const employeeDetailsModal = document.getElementById('employee-details-modal');
const closeEmployeeModalBtn = document.getElementById('close-employee-modal');
const employeeModalTitle = document.getElementById('employee-modal-title');
const employeeDetailsTable = document.getElementById('employee-details-table'); // Get the entire table
const employeeDetailsTableHead = document.querySelector('#employee-details-table thead tr');
const employeeDetailsTableBody = document.querySelector('#employee-details-table tbody');
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
        // No initial report generation, wait for company selection
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
    const selectedMonth = monthSelect.value; // Get the selected month value

    if (!selectedCompany) {
        noCompanySelectedMessage.style.display = 'block';
        branchPerformanceSummarySection.style.display = 'none';
        detailedEntriesContainer.style.display = 'none'; // Hide detailed entries if company is unselected
        return;
    } else {
        noCompanySelectedMessage.style.display = 'none';
        branchPerformanceSummarySection.style.display = 'block';
    }

    const filteredData = getFilteredData();
    const branchColIndex = headers.indexOf('BRANCH');
    const inflowColIndex = headers.indexOf('INF Total');
    const outflowColIndex = headers.indexOf('OUT Total');
    const dateColIndex = headers.indexOf('DATE');

    let branchPerformance;

    if (selectedMonth === '') { // "All Months" is selected
        // Structure: { 'BranchA': { inflow: X, outflow: Y, net: Z } }
        branchPerformance = {}; 
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
        renderBranchPerformanceTable(branchPerformance, true); // Pass true for 'all months' view
    } else {
        // Structure: { 'YYYY-MM': { 'BranchA': { inflow: X, outflow: Y, net: Z } } }
        branchPerformance = {};
        filteredData.forEach(row => {
            const monthKey = `${row[dateColIndex].getFullYear()}-${String(row[dateColIndex].getMonth() + 1).padStart(2, '0')}`;
            const branchName = branchColIndex !== -1 && row[branchColIndex] ? row[branchColIndex] : 'Unassigned Branch';
            const inflow = parseNumericalValue(row[inflowColIndex]);
            const outflow = parseNumericalValue(row[outflowColIndex]);

            if (!branchPerformance[monthKey]) {
                branchPerformance[monthKey] = {};
            }
            if (!branchPerformance[monthKey][branchName]) {
                branchPerformance[monthKey][branchName] = { inflow: 0, outflow: 0, net: 0 };
            }

            branchPerformance[monthKey][branchName].inflow += inflow;
            branchPerformance[monthKey][branchName].outflow += outflow;
            branchPerformance[monthKey][branchName].net += (inflow - outflow);
        });
        renderBranchPerformanceTable(branchPerformance, false); // Pass false for 'monthly' view
    }

    // Hide detailed entries if they were open from a previous view
    detailedEntriesContainer.style.display = 'none';
    noDetailedDataMessage.style.display = 'none';
}

function renderBranchPerformanceTable(data, isAllMonthsView) {
    branchPerformanceTableBody.innerHTML = '';
    
    let totalInflow = 0;
    let totalOutflow = 0;
    let totalNet = 0;

    if (Object.keys(data).length === 0) {
        noSummaryDataMessage.style.display = 'block';
        return;
    } else {
        noSummaryDataMessage.style.display = 'none';
    }

    if (isAllMonthsView) {
        const branchNames = Object.keys(data).sort();
        branchNames.forEach(branchName => {
            const branchData = data[branchName];
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>All Months</td>
                <td class="branch-name-cell" data-month="" data-branch="${branchName}">${branchName}</td>
                <td>${formatIndianNumber(branchData.inflow)}</td>
                <td>${formatIndianNumber(branchData.outflow)}</td>
                <td>${formatIndianNumber(branchData.net)}</td>
            `;
            branchPerformanceTableBody.appendChild(tr);

            // Add event listener to the branch name cell
            tr.querySelector('.branch-name-cell').addEventListener('click', (event) => {
                const clickedMonthKey = monthSelect.value; // This will be "" if "All Months"
                const clickedBranchName = event.target.dataset.branch;
                showEmployeeDetailsModal(clickedMonthKey, clickedBranchName);
            });

            totalInflow += branchData.inflow;
            totalOutflow += branchData.outflow;
            totalNet += branchData.net;
        });
    } else {
        const monthKeys = Object.keys(data).sort();
        monthKeys.forEach(monthKey => {
            const monthDate = new Date(monthKey);
            const monthName = monthDate.toLocaleString('en-US', { year: 'numeric', month: 'long' });
            const branchesForMonth = Object.keys(data[monthKey]).sort();

            branchesForMonth.forEach(branchName => {
                const branchData = data[monthKey][branchName];
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${monthName}</td>
                    <td class="branch-name-cell" data-month="${monthKey}" data-branch="${branchName}">${branchName}</td>
                    <td>${formatIndianNumber(branchData.inflow)}</td>
                    <td>${formatIndianNumber(branchData.outflow)}</td>
                    <td>${formatIndianNumber(branchData.net)}</td>
                `;
                branchPerformanceTableBody.appendChild(tr);
                
                // Add event listener to the branch name cell
                tr.querySelector('.branch-name-cell').addEventListener('click', (event) => {
                    const clickedMonthKey = event.target.dataset.month;
                    const clickedBranchName = event.target.dataset.branch;
                    showEmployeeDetailsModal(clickedMonthKey, clickedBranchName);
                });

                totalInflow += branchData.inflow;
                totalOutflow += branchData.outflow;
                totalNet += branchData.net;
            });
        });
    }

    // Add the Total row
    const totalTr = document.createElement('tr');
    totalTr.classList.add('total-row'); // Add a class for potential styling
    totalTr.innerHTML = `
        <td colspan="2"><strong>Total</strong></td>
        <td><strong>${formatIndianNumber(totalInflow)}</strong></td>
        <td><strong>${formatIndianNumber(totalOutflow)}</strong></td>
        <td><strong>${formatIndianNumber(totalNet)}</strong></td>
    `;
    branchPerformanceTableBody.appendChild(totalTr);
}

// --- Detailed Entries ---
function viewDetailedEntries() {
    const filteredData = getFilteredData();
    detailedTableHead.innerHTML = ''; // Clear previous headers
    detailedTableBody.innerHTML = ''; // Clear previous data

    if (filteredData.length === 0) {
        detailedEntriesContainer.style.display = 'block';
        noDetailedDataMessage.style.display = 'block';
        return;
    } else {
        noDetailedDataMessage.style.display = 'none';
    }

    // Create table header (all original headers)
    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        detailedTableHead.appendChild(th);
    });

    // Create table body
    filteredData.forEach(rowData => {
        const tr = document.createElement('tr');
        headers.forEach((header, index) => {
            const td = document.createElement('td');
            let content = rowData[index] !== null && rowData[index] !== undefined ? String(rowData[index]) : '';

            // Format date columns
            if (header === 'DATE') {
                const dateObj = rowData[index];
                if (dateObj instanceof Date && !isNaN(dateObj)) {
                    content = dateObj.toLocaleDateString('en-GB'); // dd/mm/yyyy
                }
            }
            // Format numerical columns
            else {
                const numericalHeaders = [
                    'SML NCD INF', 'SML SD INF', ' SML GB INF ', 'SML BDSL', 'VFL NCD INF', 'VFL SD INF', 'VFL GB INF',
                    'SNL FD INF', 'LLP INF', 'INF Total', 'SNL FD INF.1', 'VFL NCD OUT', 'VFL BD OUT', 'SML PURCHASE ',
                    ' SML NCD OUT ', 'SML SD OUT', ' SML GB OUT ', 'LLP OUT', 'OUT Total', 'Net'
                ];
                if (numericalHeaders.includes(header.trim())) { // Trim header for accurate comparison
                    const numValue = parseFloat(content.replace(/,/g, ''));
                    if (!isNaN(numValue)) {
                        content = formatIndianNumber(numValue);
                    }
                }
            }
            td.textContent = content;
            tr.appendChild(td);
        });
        detailedTableBody.appendChild(tr);
    });

    detailedEntriesContainer.style.display = 'block';
    detailedEntriesContainer.scrollIntoView({ behavior: 'smooth' });
}

// --- Show Employee Details Modal ---
function showEmployeeDetailsModal(monthKey, branchName) {
    const selectedCompany = companySelect.value;
    const dateColIndex = headers.indexOf('DATE');
    const branchColIndex = headers.indexOf('BRANCH');
    const employeeColIndex = headers.indexOf('STAFF NAME');
    const inflowColIndex = headers.indexOf('INF Total');
    const outflowColIndex = headers.indexOf('OUT Total');
    const statusColIndex = headers.indexOf('STATUS'); // Get index for STATUS column

    if (!selectedCompany || !branchName || employeeColIndex === -1) {
        console.error("Missing data to show employee details or 'STAFF NAME' column not found.");
        employeeModalTitle.textContent = `Employee Participation Details for ${branchName}`;
        employeeDetailsTableHead.innerHTML = '';
        employeeDetailsTableBody.innerHTML = '';
        noEmployeeDataMessage.style.display = 'block';
        noEmployeeDataMessage.textContent = "Error: 'STAFF NAME' column not found in data or other essential data missing.";
        employeeDetailsModal.style.display = 'flex';
        return;
    }

    employeeDetailsTableHead.innerHTML = ''; // Clear previous headers
    employeeDetailsTableBody.innerHTML = ''; // Clear previous data
    noEmployeeDataMessage.style.display = 'none';

    let modalTitleMonthPart = monthKey === '' ? 'All Months' : new Date(monthKey).toLocaleString('en-US', { year: 'numeric', month: 'long' });
    employeeModalTitle.textContent = `Employee Participation Details for ${branchName} - ${modalTitleMonthPart}`;

    // Filter data relevant to the selected company and branch
    const relevantData = allData.filter(row => {
        const rowCompanyName = headers.indexOf('COMPANY NAME') !== -1 ? row[headers.indexOf('COMPANY NAME')] : null;
        const rowBranchName = branchColIndex !== -1 && row[branchColIndex] ? row[branchColIndex] : 'Unassigned Branch';
        const rowDate = row[dateColIndex];

        if (rowCompanyName !== selectedCompany || rowBranchName !== branchName) {
            return false;
        }

        // Apply month filter if a specific month is selected
        if (monthKey !== '') {
            const rowMonthKey = `${rowDate.getFullYear()}-${String(rowDate.getMonth() + 1).padStart(2, '0')}`;
            if (rowMonthKey !== monthKey) return false;
        }
        return true;
    });

    const employeePerformance = {};
    const uniqueMonths = new Set(); // To store all unique months for dynamic headers

    relevantData.forEach(row => {
        const employeeName = employeeColIndex !== -1 && row[employeeColIndex] ? row[employeeColIndex] : 'Unassigned Employee';
        const inflow = parseNumericalValue(row[inflowColIndex]);
        const outflow = parseNumericalValue(row[outflowColIndex]);
        const net = inflow - outflow;
        const month = row[dateColIndex];
        const monthKeyFormatted = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
        uniqueMonths.add(monthKeyFormatted);
        const status = statusColIndex !== -1 && row[statusColIndex] ? String(row[statusColIndex]).toUpperCase() : ''; // Get status

        if (!employeePerformance[employeeName]) {
            employeePerformance[employeeName] = { 
                monthlyData: {}, 
                totalInflow: 0, 
                totalOutflow: 0, 
                totalNet: 0,
                isResigned: false // Initialize isResigned flag
            };
        }

        if (!employeePerformance[employeeName].monthlyData[monthKeyFormatted]) {
            employeePerformance[employeeName].monthlyData[monthKeyFormatted] = { inflow: 0, outflow: 0, net: 0 };
        }

        employeePerformance[employeeName].monthlyData[monthKeyFormatted].inflow += inflow;
        employeePerformance[employeeName].monthlyData[monthKeyFormatted].outflow += outflow;
        employeePerformance[employeeName].monthlyData[monthKeyFormatted].net += net;

        employeePerformance[employeeName].totalInflow += inflow;
        employeePerformance[employeeName].totalOutflow += outflow;
        employeePerformance[employeeName].totalNet += net;

        if (status === 'RESIGNED') { // Check if the current row indicates resignation
            employeePerformance[employeeName].isResigned = true; // Set flag if resigned
        }
    });

    const sortedMonths = Array.from(uniqueMonths).sort();
    const employeeNames = Object.keys(employeePerformance).sort();

    if (employeeNames.length === 0) {
        noEmployeeDataMessage.style.display = 'block';
        noEmployeeDataMessage.textContent = "No employee data available for this branch and period.";
        employeeDetailsTable.style.display = 'none'; // Hide table if no data
    } else {
        employeeDetailsTable.style.display = 'table'; // Show table
        // Create table headers dynamically
        let headerRow = `<th>Employee Name</th>`;
        sortedMonths.forEach(monthKey => {
            const monthDate = new Date(monthKey);
            headerRow += `<th>${monthDate.toLocaleString('en-US', { year: 'numeric', month: 'short' })}</th>`;
        });
        headerRow += `<th>Total</th>`;
        employeeDetailsTableHead.innerHTML = headerRow;

        // Populate table body
        employeeNames.forEach(employeeName => {
            const employeeData = employeePerformance[employeeName];
            const tr = document.createElement('tr');
            if (employeeData.isResigned) { // Add class if employee is resigned
                tr.classList.add('resigned-employee');
            }
            let rowContent = `<td>${employeeName}</td>`;

            sortedMonths.forEach(monthKey => {
                const monthInfo = employeeData.monthlyData[monthKey];
                const netValue = monthInfo ? formatIndianNumber(monthInfo.net) : '-'; // Show '-' if no data for month
                rowContent += `<td>${netValue}</td>`;
            });

            rowContent += `<td><strong>${formatIndianNumber(employeeData.totalNet)}</strong></td>`;
            tr.innerHTML = rowContent;
            employeeDetailsTableBody.appendChild(tr);
        });
    }

    employeeDetailsModal.style.display = 'flex'; // Use flex to center the modal
}


// --- Event Listeners ---
companySelect.addEventListener('change', generateReport);
monthSelect.addEventListener('change', generateReport);
companySearchInput.addEventListener('input', () => {
    const searchText = companySearchInput.value.toLowerCase();
    const filteredCompanies = allCompanyNames.filter(company => 
        company.toLowerCase().includes(searchText)
    );
    populateCompanySelect(filteredCompanies);
    // Do not generate report here, wait for selection from dropdown
});
viewDetailedBtn.addEventListener('click', viewDetailedEntries);

// Event listeners for the new modal
closeEmployeeModalBtn.addEventListener('click', () => {
    employeeDetailsModal.style.display = 'none';
});

// Close modal when clicking outside of it
window.addEventListener('click', (event) => {
    if (event.target === employeeDetailsModal) {
        employeeDetailsModal.style.display = 'none';
    }
});


// --- Initialize the report when the page loads ---
document.addEventListener('DOMContentLoaded', init);