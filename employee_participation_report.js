// employee_participation_report.js

// --- Configuration ---
const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1OOdGnJhw1k6U15Aybn_2JWex_qTShP6w7CXm0_auXnc8vFnvlabPZjK3lsjqkHgn6NgeKKPyu9qW/pub?gid=1720680457&single=true&output=csv';

// --- Global Data Storage ---
let allData = []; // Stores all parsed CSV rows
let headers = []; // Stores CSV headers
let allCompanyNames = []; // Stores all unique company names for search functionality
let allStaffNames = []; // Stores all unique staff names for search functionality

// --- Fixed Date Range for Data Validity (April 2025 - Current Month) ---
const dataStartDate = new Date('2025-04-01T00:00:00'); // April 1, 2025, 00:00:00 local time
const currentDate = new Date(); // Current date and time
const dataEndDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59); // End of the current month

// --- DOM Elements ---
const monthSelect = document.getElementById('month-select');
const companySearchInput = document.getElementById('company-search');
const companySelect = document.getElementById('company-select');
const staffSearchInput = document.getElementById('staff-search');
const staffSelect = document.getElementById('staff-select');
const viewDetailedBtn = document.getElementById('view-detailed-btn');

const participationSummaryTableBody = document.querySelector('#participation-summary-table tbody');
const noSummaryDataMessage = document.getElementById('no-summary-data-message');

const detailedEntriesContainer = document.getElementById('detailed-entries-container');
const detailedTableHead = document.querySelector('#detailed-table thead tr');
const detailedTableBody = document.querySelector('#detailed-table tbody');
const noDetailedDataMessage = document.getElementById('no-detailed-data-message');

// New DOM elements for employee drilldown modal
const employeeDrilldownModal = document.getElementById('employee-drilldown-modal');
const closeEmployeeDrilldownModalBtn = document.getElementById('close-employee-drilldown-modal');
const employeeDrilldownTitle = document.getElementById('employee-drilldown-title');
const employeeDrilldownTableBody = document.querySelector('#employee-drilldown-table tbody');
const noEmployeeDrilldownDataMessage = document.getElementById('no-employee-drilldown-data-message');


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


// Helper function to parse a numerical value from a string, handling empty/null and commas
function parseNumericalValue(valueString) {
    if (valueString === null || valueString === undefined || typeof valueString === 'boolean' || String(valueString).trim() === '') {
        return 0;
    }

    let strValue = String(valueString);
    let cleanedValue = strValue.replace(/,/g, '');

    const parsedValue = parseFloat(cleanedValue);

    return isNaN(parsedValue) ? 0 : parsedValue;
}

// Function to format numbers in Indian style (xx,xx,xxx)
function formatIndianNumber(num) {
    if (isNaN(num) || num === null || num === '') {
        return '';
    }

    let numStr = String(num);
    let parts = numStr.split('.');
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
        const staffNameColIndex = headers.indexOf('STAFF NAME');
        const companyColIndex = headers.indexOf('COMPANY NAME');

        allData = rows.slice(1).map(row => {
            const parsedRow = parseLine(row);
            
            // Pad row with nulls if it has fewer columns than headers
            while (parsedRow.length < headers.length) {
                parsedRow.push(null);
            }

            // Ensure DATE, STAFF NAME, COMPANY NAME are present and DATE is parsed and within range
            if (dateColIndex === -1 || !parsedRow[dateColIndex] || 
                staffNameColIndex === -1 || !parsedRow[staffNameColIndex] || 
                companyColIndex === -1 || !parsedRow[companyColIndex]) {
                return null; // Skip rows with critical missing data
            }

            const dateObj = parseDate(parsedRow[dateColIndex]);
            if (!dateObj || dateObj < dataStartDate || dateObj > dataEndDate) {
                return null; // Skip rows with invalid or out-of-range dates
            }
            parsedRow[dateColIndex] = dateObj; // Replace date string with Date object
            
            return parsedRow;
        }).filter(row => row !== null); // Remove null entries (invalid/out of range data)

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
    const staffNames = new Set();
    
    const companyColIndex = headers.indexOf('COMPANY NAME');
    const staffNameColIndex = headers.indexOf('STAFF NAME');

    allData.forEach(row => {
        if (companyColIndex !== -1 && row[companyColIndex]) companies.add(row[companyColIndex]);
        if (staffNameColIndex !== -1 && row[staffNameColIndex]) staffNames.add(row[staffNameColIndex]);
    });

    allCompanyNames = Array.from(companies).sort();
    allStaffNames = Array.from(staffNames).sort();

    // Populate Company Select
    populateCompanySelect(allCompanyNames);

    // Populate Staff Select (initially with all staff)
    populateStaffSelect(allStaffNames);

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

function populateStaffSelect(staffList) {
    staffSelect.innerHTML = '<option value="">All Staff</option>';
    staffList.forEach(staff => {
        const option = document.createElement('option');
        option.value = staff;
        option.textContent = staff;
        staffSelect.appendChild(option);
    });
}

// Helper to repopulate company select after search
function populateCompanySelect(companyList) {
    companySelect.innerHTML = '<option value="">All Companies</option>';
    companyList.forEach(company => {
        const option = document.createElement('option');
        option.value = company;
        option.textContent = company;
        companySelect.appendChild(option);
    });
}

// --- Filter Data ---
function getFilteredData() {
    const selectedMonth = monthSelect.value;
    const selectedCompany = companySelect.value;
    const selectedStaff = staffSelect.value;

    const companyColIndex = headers.indexOf('COMPANY NAME');
    const staffNameColIndex = headers.indexOf('STAFF NAME');
    const dateColIndex = headers.indexOf('DATE');

    return allData.filter(row => {
        // Filter by Month
        if (selectedMonth && dateColIndex !== -1) {
            const rowDate = row[dateColIndex];
            const rowMonth = `${rowDate.getFullYear()}-${String(rowDate.getMonth() + 1).padStart(2, '0')}`;
            if (rowMonth !== selectedMonth) return false;
        }

        // Filter by Company
        if (selectedCompany && companyColIndex !== -1 && row[companyColIndex] !== selectedCompany) {
            return false;
        }

        // Filter by Staff
        if (selectedStaff && staffNameColIndex !== -1 && row[staffNameColIndex] !== selectedStaff) {
            return false;
        }

        return true;
    });
}

// --- Generate Report ---
function generateReport() {
    const filteredData = getFilteredData();
    const staffNameColIndex = headers.indexOf('STAFF NAME');
    const companyColIndex = headers.indexOf('COMPANY NAME');
    const dateColIndex = headers.indexOf('DATE');
    const infTotalColIndex = headers.indexOf('INF Total');
    const outTotalColIndex = headers.indexOf('OUT Total');

    // Structure to hold month-company-employee data for summary table
    // { 'YYYY-MM': { 'CompanyA': { totalUnique: number, repeating: Set<staff_name>, new: Set<staff_name>, inflow: number, outflow: number, net: number } } }
    const monthlyCompanyParticipationSummary = {};
    
    // Tracker for counting unique month appearances for each staff-company pair within filteredData
    // Map: CompanyName -> Map: StaffName -> Set<MonthKey>
    const staffCompanyMonthlyPresence = new Map();

    // First pass: Aggregate data and track monthly presence for each staff-company pair within the filtered data
    filteredData.forEach(row => {
        const monthKey = `${row[dateColIndex].getFullYear()}-${String(row[dateColIndex].getMonth() + 1).padStart(2, '0')}`;
        const companyName = row[companyColIndex];
        const staffName = row[staffNameColIndex];
        const inflow = parseNumericalValue(row[infTotalColIndex]);
        const outflow = parseNumericalValue(row[outTotalColIndex]);

        if (!companyName || !staffName) return;

        // Populate the summary structure
        if (!monthlyCompanyParticipationSummary[monthKey]) {
            monthlyCompanyParticipationSummary[monthKey] = {};
        }
        if (!monthlyCompanyParticipationSummary[monthKey][companyName]) {
            monthlyCompanyParticipationSummary[monthKey][companyName] = {
                uniqueEmployees: new Set(),
                repeatingEmployees: new Set(), // These will be filled in the second pass
                newEmployees: new Set(),       // These will be filled in the second pass
                totalInflow: 0,
                totalOutflow: 0,
                totalNet: 0
            };
        }

        const currentSummary = monthlyCompanyParticipationSummary[monthKey][companyName];
        currentSummary.uniqueEmployees.add(staffName); // Add to unique employees for this month-company
        currentSummary.totalInflow += inflow;
        currentSummary.totalOutflow += outflow;
        currentSummary.totalNet += (inflow - outflow);

        // Populate staffCompanyMonthlyPresence tracker
        if (!staffCompanyMonthlyPresence.has(companyName)) {
            staffCompanyMonthlyPresence.set(companyName, new Map());
        }
        if (!staffCompanyMonthlyPresence.get(companyName).has(staffName)) {
            staffCompanyMonthlyPresence.get(companyName).set(staffName, new Set());
        }
        staffCompanyMonthlyPresence.get(companyName).get(staffName).add(monthKey);
    });

    // Second pass: Determine "New" vs "Repeating" based on staffCompanyMonthlyPresence
    Object.keys(monthlyCompanyParticipationSummary).forEach(monthKey => {
        Object.keys(monthlyCompanyParticipationSummary[monthKey]).forEach(companyName => {
            const summary = monthlyCompanyParticipationSummary[monthKey][companyName];
            
            // Iterate over all unique employees identified for this month-company
            summary.uniqueEmployees.forEach(staffName => {
                const monthsParticipated = staffCompanyMonthlyPresence.get(companyName)?.get(staffName);
                if (monthsParticipated) {
                    // An employee is "Repeating" if they have participated in more than one month
                    // within the filtered data for this specific company.
                    // If they have only appeared in *this* month for *this company* within the filtered data, they are "New".
                    if (monthsParticipated.size > 1) {
                        summary.repeatingEmployees.add(staffName);
                    } else if (monthsParticipated.size === 1 && monthsParticipated.has(monthKey)) {
                        // This ensures that if an employee only appears once (in this month) within the entire filtered dataset,
                        // they are considered "New".
                        summary.newEmployees.add(staffName);
                    }
                }
            });
        });
    });

    renderParticipationSummaryTable(monthlyCompanyParticipationSummary);

    // Hide detailed entries if they were open from a previous view
    detailedEntriesContainer.style.display = 'none';
    noDetailedDataMessage.style.display = 'none';
}

function renderParticipationSummaryTable(monthlyCompanyParticipationSummary) {
    participationSummaryTableBody.innerHTML = '';
    const monthKeys = Object.keys(monthlyCompanyParticipationSummary).sort();

    if (monthKeys.length === 0) {
        noSummaryDataMessage.style.display = 'block';
        return;
    } else {
        noSummaryDataMessage.style.display = 'none';
    }

    monthKeys.forEach(monthKey => {
        const monthDate = new Date(monthKey);
        const monthName = monthDate.toLocaleString('en-US', { year: 'numeric', month: 'long' });
        const companiesForMonth = Object.keys(monthlyCompanyParticipationSummary[monthKey]).sort();

        companiesForMonth.forEach(companyName => {
            const data = monthlyCompanyParticipationSummary[monthKey][companyName];
            const totalUnique = data.uniqueEmployees.size; // This is the total unique employees for THIS month-company
            const repeatingCount = data.repeatingEmployees.size;
            const newCount = data.newEmployees.size;

            const repeatingPercentage = totalUnique > 0 ? ((repeatingCount / totalUnique) * 100).toFixed(2) : '0.00';
            const newPercentage = totalUnique > 0 ? ((newCount / totalUnique) * 100).toFixed(2) : '0.00';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${monthName}</td>
                <td>${companyName}</td>
                <td>${totalUnique}</td>
                <td class="staff-name-cell" data-company="${companyName}" data-month="${monthKey}" data-type="repeating">${repeatingCount} (${repeatingPercentage}%)</td>
                <td class="staff-name-cell" data-company="${companyName}" data-month="${monthKey}" data-type="new">${newCount} (${newPercentage}%)</td>
                <td>${formatIndianNumber(data.totalInflow)}</td>
                <td>${formatIndianNumber(data.totalOutflow)}</td>
                <td>${formatIndianNumber(data.totalNet)}</td>
            `;
            participationSummaryTableBody.appendChild(tr);

            // Add event listeners for the drilldown
            const repeatingCell = tr.querySelector(`td[data-type="repeating"]`);
            if (repeatingCell && repeatingCount > 0) {
                repeatingCell.addEventListener('click', (event) => {
                    const comp = event.target.dataset.company;
                    const month = event.target.dataset.month;
                    showEmployeeDrilldownModal(comp, month, 'repeating', data.repeatingEmployees);
                });
            }

            const newCell = tr.querySelector(`td[data-type="new"]`);
            if (newCell && newCount > 0) {
                newCell.addEventListener('click', (event) => {
                    const comp = event.target.dataset.company;
                    const month = event.target.dataset.month;
                    showEmployeeDrilldownModal(comp, month, 'new', data.newEmployees);
                });
            }
        });
    });
}


// --- Detailed Entries ---
function viewDetailedEntries() {
    const filteredData = getFilteredData(); // This is already filtered by current selections
    detailedTableHead.innerHTML = ''; // Clear previous headers
    detailedTableBody.innerHTML = ''; // Clear previous data

    if (filteredData.length === 0) {
        detailedEntriesContainer.style.display = 'block';
        noDetailedDataMessage.style.display = 'block';
        return;
    } else {
        noDetailedDataMessage.style.display = 'none';
    }

    const staffNameColIndex = headers.indexOf('STAFF NAME');
    const companyColIndex = headers.indexOf('COMPANY NAME');
    const dateColIndex = headers.indexOf('DATE');
    const monthKeyColIndex = headers.indexOf('MONTH_KEY_INTERNAL'); // Internal column for month key

    // Create a temporary structure to track monthly participation for each staff-company pair within *this filtered data*
    const staffCompanyMonthlyPresenceForDetailed = new Map(); // Map: CompanyName -> Map: StaffName -> Set<MonthKey>

    // Populate the tracker
    filteredData.forEach(row => {
        const monthKey = `${row[dateColIndex].getFullYear()}-${String(row[dateColIndex].getMonth() + 1).padStart(2, '0')}`;
        const companyName = row[companyColIndex];
        const staffName = row[staffNameColIndex];

        if (!staffCompanyMonthlyPresenceForDetailed.has(companyName)) {
            staffCompanyMonthlyPresenceForDetailed.set(companyName, new Map());
        }
        if (!staffCompanyMonthlyPresenceForDetailed.get(companyName).has(staffName)) {
            staffCompanyMonthlyPresenceForDetailed.get(companyName).set(staffName, new Set());
        }
        staffCompanyMonthlyPresenceForDetailed.get(companyName).get(staffName).add(monthKey);
    });

    // Create table header (all original headers plus 'Participation Type')
    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        detailedTableHead.appendChild(th);
    });
    // Add column for 'Participation Type' (New/Repeating)
    const participationTypeTh = document.createElement('th');
    participationTypeTh.textContent = 'Participation Type';
    detailedTableHead.appendChild(participationTypeTh);

    // Sort filteredData by date to ensure consistency
    filteredData.sort((a, b) => a[dateColIndex] - b[dateColIndex]);

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

        // Determine Participation Type for this specific detailed entry
        const staffName = rowData[staffNameColIndex];
        const companyName = rowData[companyColIndex];
        const currentEntryMonthKey = `${rowData[dateColIndex].getFullYear()}-${String(rowData[dateColIndex].getMonth() + 1).padStart(2, '0')}`;

        let participationType = '';
        const monthsParticipatedByStaffCompany = staffCompanyMonthlyPresenceForDetailed.get(companyName)?.get(staffName);

        if (monthsParticipatedByStaffCompany) {
            // If this staff-company pair appeared in more than one month in the filtered data
            if (monthsParticipatedByStaffCompany.size > 1) {
                participationType = 'Repeating';
            } else if (monthsParticipatedByStaffCompany.size === 1 && monthsParticipatedByStaffCompany.has(currentEntryMonthKey)) {
                // If they only appeared once (in this month) in the filtered data
                participationType = 'New';
            }
        } else {
            participationType = 'N/A'; // Should not happen if data is consistent
        }
        
        const participationTypeTd = document.createElement('td');
        participationTypeTd.textContent = participationType;
        tr.appendChild(participationTypeTd);
        
        detailedTableBody.appendChild(tr);
    });

    detailedEntriesContainer.style.display = 'block';
    detailedEntriesContainer.scrollIntoView({ behavior: 'smooth' });
}


// --- Employee Drilldown Modal ---
// The employeeSet parameter is added here to pass the specific set of employees (new or repeating)
function showEmployeeDrilldownModal(companyName, monthKey, type, employeeSet) {
    employeeDrilldownModal.style.display = 'flex';
    employeeDrilldownTableBody.innerHTML = '';
    noEmployeeDrilldownDataMessage.style.display = 'none';

    employeeDrilldownTitle.textContent = `Participation Details for ${type === 'repeating' ? 'Repeating' : 'New'} Employees in ${companyName} (${new Date(monthKey).toLocaleString('en-US', { year: 'numeric', month: 'long' })})`;

    const staffNameColIndex = headers.indexOf('STAFF NAME');
    const companyColIndex = headers.indexOf('COMPANY NAME');
    const dateColIndex = headers.indexOf('DATE');
    const infTotalColIndex = headers.indexOf('INF Total');
    const outTotalColIndex = headers.indexOf('OUT Total');

    const drilldownData = {}; // staffName: { [monthKey]: {inflow, outflow, net} }

    Array.from(employeeSet).sort().forEach(staffMember => { // Iterate only over the relevant employee set
        drilldownData[staffMember] = {}; // Initialize for each relevant staff member
        
        // Collect all entries for this specific staff member across ALL months for the selected company
        // This should use `allData` to show full participation history for the staff in that company
        allData.filter(row => 
            row[staffNameColIndex] === staffMember && 
            row[companyColIndex] === companyName
        ).sort((a, b) => a[dateColIndex] - b[dateColIndex]) // Sort by date for proper monthly display
        .forEach(row => {
            const rowMonthKey = `${row[dateColIndex].getFullYear()}-${String(row[dateColIndex].getMonth() + 1).padStart(2, '0')}`;
            const inflow = parseNumericalValue(row[infTotalColIndex]);
            const outflow = parseNumericalValue(row[outTotalColIndex]);

            if (!drilldownData[staffMember][rowMonthKey]) {
                drilldownData[staffMember][rowMonthKey] = { inflow: 0, outflow: 0, net: 0 };
            }
            drilldownData[staffMember][rowMonthKey].inflow += inflow;
            drilldownData[staffMember][rowMonthKey].outflow += outflow;
            drilldownData[staffMember][rowMonthKey].net += (inflow - outflow);
        });
    });

    let hasData = false;
    for (const staffMember in drilldownData) {
        if (Object.keys(drilldownData[staffMember]).length > 0) {
            hasData = true;
            const staffRow = employeeDrilldownTableBody.insertRow();
            staffRow.classList.add('drilldown-staff-row'); // Add class for styling if needed

            // Staff Name Cell
            const staffNameCell = staffRow.insertCell();
            staffNameCell.textContent = staffMember;
            staffNameCell.classList.add('staff-name-header'); // Class for styling
            // No rowSpan needed here, as we're nesting a table for months

            // Monthly Breakdown Cell (contains a nested table)
            const monthlyBreakdownCell = staffRow.insertCell();
            monthlyBreakdownCell.colSpan = 3; // Span across month, inflow, outflow, net columns in the main table

            const nestedTable = document.createElement('table');
            nestedTable.classList.add('nested-monthly-breakdown'); // Class for styling
            nestedTable.innerHTML = `
                <thead>
                    <tr>
                        <th>Month</th>
                        <th>Inflow</th>
                        <th>Outflow</th>
                        <th>Net</th>
                    </tr>
                </thead>
                <tbody>
                </tbody>
            `;
            const nestedTbody = nestedTable.querySelector('tbody');

            Object.keys(drilldownData[staffMember]).sort().forEach(month => {
                const monthData = drilldownData[staffMember][month];
                const monthRow = nestedTbody.insertRow();
                monthRow.insertCell().textContent = new Date(month + '-01').toLocaleString('en-US', { year: 'numeric', month: 'long' });
                monthRow.insertCell().textContent = formatIndianNumber(monthData.inflow);
                monthRow.insertCell().textContent = formatIndianNumber(monthData.outflow);
                monthRow.insertCell().textContent = formatIndianNumber(monthData.net);
            });
            monthlyBreakdownCell.appendChild(nestedTable);
        }
    }

    if (!hasData) {
        noEmployeeDrilldownDataMessage.style.display = 'block';
        noEmployeeDrilldownDataMessage.textContent = `No ${type} employee participation data found for ${companyName} in ${new Date(monthKey).toLocaleString('en-US', { year: 'numeric', month: 'long' })}.`;
    }
}


// --- Event Listeners ---
monthSelect.addEventListener('change', generateReport);
companySelect.addEventListener('change', generateReport);
staffSelect.addEventListener('change', generateReport); // Regenerate report when staff selection changes
companySearchInput.addEventListener('input', () => {
    const searchText = companySearchInput.value.toLowerCase();
    const filteredCompanies = allCompanyNames.filter(company => 
        company.toLowerCase().includes(searchText)
    );
    populateCompanySelect(filteredCompanies);
    // Do not call generateReport here directly. Let the change event on companySelect handle it.
    // If the search filters down to a single company and user expects auto-select,
    // you might add `companySelect.value = filteredCompanies.length === 1 ? filteredCompanies[0] : '';`
    // but then a `change` event on companySelect should be triggered.
    // For now, let's keep it simple: user selects from filtered list.
});
staffSearchInput.addEventListener('input', () => {
    const searchText = staffSearchInput.value.toLowerCase();
    const filteredStaff = allStaffNames.filter(staff =>
        staff.toLowerCase().includes(searchText)
    );
    populateStaffSelect(filteredStaff);
    // Same as companySearchInput, avoid direct generateReport.
});
viewDetailedBtn.addEventListener('click', viewDetailedEntries);

// Event listeners for the new employee drilldown modal
closeEmployeeDrilldownModalBtn.addEventListener('click', () => {
    employeeDrilldownModal.style.display = 'none';
});

window.addEventListener('click', (event) => {
    if (event.target === employeeDrilldownModal) {
        employeeDrilldownModal.style.display = 'none';
    }
});


// --- Initialize the report when the page loads ---
document.addEventListener('DOMContentLoaded', init);