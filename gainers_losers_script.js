// gainers_losers_script.js

// --- Configuration ---
const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1OOdGnJhw1k6U15Aybn_2JWex_qTShP6w7CXm0_auXnc8vFnvlabPZjK3lsjqkHgn6NgeKKPyu9qW/pub?gid=1720680457&single=true&output=csv';

const companyShortNames = {
    'SML FINANCE LTD': 'SML',
    'BRD FINANCE LTD': 'BRD',
    'VANCHINAD FINANCE (P) LTD': 'VFL',
    'SANGEETH NIDHI LTD': 'SNL'
};

// --- Global Data Storage ---
let allData = []; // Stores all parsed CSV rows
let headers = []; // Stores CSV headers
let allCompanyNames = []; // Stores all unique company names for filter search

// --- Fixed Date Range for Data Validity (April 2025 - Current Month) ---
const dataStartDate = new Date('2025-04-01T00:00:00'); // April 1, 2025, 00:00:00 local time
const currentDate = new Date(); // Current date and time
const dataEndDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59); // End of the current month

// --- DOM Elements (moved into init for reliability) ---
let companySearchInput;
let companySelect;
let monthSelect;
let reportSection;
let gainersTableBody;
let losersTableBody;
let allGainersTableBody;
let allLosersTableBody;
let noReportDataMessage;
let allEmployeesReportHeader;
let allEmployeesReportSection;

// --- Utility Functions (reused from other scripts) ---

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

// Robust Date Parsing Function
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
        // Assign DOM elements inside init()
        companySearchInput = document.getElementById('company-search');
        companySelect = document.getElementById('company-select');
        monthSelect = document.getElementById('month-select');
        reportSection = document.getElementById('gainers-losers-report-section');
        gainersTableBody = document.querySelector('#gainers-table tbody');
        losersTableBody = document.querySelector('#losers-table tbody');
        allGainersTableBody = document.querySelector('#all-gainers-table-body');
        allLosersTableBody = document.querySelector('#all-losers-table-body');
        noReportDataMessage = document.getElementById('no-report-data-message');
        allEmployeesReportHeader = document.querySelector('.collapsible-header');
        allEmployeesReportSection = document.getElementById('all-employees-report-section');

        // Add event listeners inside init()
        companySelect.addEventListener('change', generateReport);
        monthSelect.addEventListener('change', generateReport);
        companySearchInput.addEventListener('input', () => {
            const searchText = companySearchInput.value.toLowerCase();
            const filteredCompanies = allCompanyNames.filter(company => 
                company.toLowerCase().includes(searchText)
            );
            populateCompanySelect(filteredCompanies);
        });
        allEmployeesReportHeader.addEventListener('click', () => {
            allEmployeesReportSection.classList.toggle('expanded');
        });

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

        populateFilters();
        generateReport();
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
    populateCompanySelect(allCompanyNames);

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
            const optionValue = `${year}-${String(month + 1).padStart(2, '0')}`;
            const option = document.createElement('option');
            option.value = optionValue;
            option.textContent = monthName;
            monthSelect.appendChild(option);
        }
    }
}

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
    const companyColIndex = headers.indexOf('COMPANY NAME');
    const dateColIndex = headers.indexOf('DATE');

    return allData.filter(row => {
        if (selectedCompany && (companyColIndex === -1 || row[companyColIndex] !== selectedCompany)) {
            return false;
        }
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
    const filteredData = getFilteredData();
    const employeeColIndex = headers.indexOf('STAFF NAME');
    const netColIndex = headers.indexOf('Net');
    const statusColIndex = headers.indexOf('STATUS');
    const companyColIndex = headers.indexOf('COMPANY NAME');

    if (filteredData.length === 0 || employeeColIndex === -1 || netColIndex === -1 || companyColIndex === -1) {
        reportSection.style.display = 'none';
        allEmployeesReportSection.style.display = 'none';
        noReportDataMessage.style.display = 'block';
        return;
    } else {
        reportSection.style.display = 'block';
        allEmployeesReportSection.style.display = 'block';
        noReportDataMessage.style.display = 'none';
    }

    const employeeNetPerformance = {};

    filteredData.forEach(row => {
        const employeeName = row[employeeColIndex];
        const netValue = parseNumericalValue(row[netColIndex]);
        const status = statusColIndex !== -1 ? String(row[statusColIndex]).toUpperCase() : '';
        const companyName = row[companyColIndex];

        if (employeeName) {
            if (!employeeNetPerformance[employeeName]) {
                employeeNetPerformance[employeeName] = { net: 0, isResigned: false, company: companyName };
            }
            employeeNetPerformance[employeeName].net += netValue;
            if (status === 'RESIGNED') {
                employeeNetPerformance[employeeName].isResigned = true;
            }
        }
    });

    const employeesWithPerformance = Object.keys(employeeNetPerformance).map(name => ({
        name: name,
        net: employeeNetPerformance[name].net,
        isResigned: employeeNetPerformance[name].isResigned,
        company: employeeNetPerformance[name].company
    }));

    // Filter and sort for Top 10 Gainers and Losers
    const gainers = employeesWithPerformance.filter(emp => emp.net > 0)
                                            .sort((a, b) => b.net - a.net)
                                            .slice(0, 10)
                                            .map((emp, index) => ({...emp, rank: index + 1}));
    
    const losers = employeesWithPerformance.filter(emp => emp.net < 0)
                                           .sort((a, b) => a.net - b.net)
                                           .slice(0, 10)
                                           .map((emp, index) => ({...emp, rank: index + 1}));

    // Filter and sort for All Gainers and Losers
    const allGainers = employeesWithPerformance.filter(emp => emp.net > 0)
                                               .sort((a, b) => b.net - a.net)
                                               .map((emp, index) => ({...emp, rank: index + 1}));
    
    const allLosers = employeesWithPerformance.filter(emp => emp.net < 0)
                                              .sort((a, b) => a.net - b.net)
                                              .map((emp, index) => ({...emp, rank: index + 1}));

    // Render all tables
    renderTable(gainers, gainersTableBody, true);
    renderTable(losers, losersTableBody, true);
    renderFullTable(allGainers, allGainersTableBody);
    renderFullTable(allLosers, allLosersTableBody);
}

function renderTable(employeeList, tableBody, showRank) {
    tableBody.innerHTML = '';
    employeeList.forEach(employee => {
        const tr = document.createElement('tr');
        if (employee.isResigned) {
            tr.classList.add('resigned-employee');
        }
        
        let rankCell = showRank ? `<td>${employee.rank}</td>` : '';
        let companyShortName = companyShortNames[employee.company] || employee.company;
        let companyCell = `<td>${companyShortName}</td>`;

        tr.innerHTML = `
            ${rankCell}
            <td>${employee.name}</td>
            ${companyCell}
            <td>${formatIndianNumber(employee.net)}</td>
        `;
        tableBody.appendChild(tr);
    });
}

function renderFullTable(employeeList, tableBody) {
    tableBody.innerHTML = '';
    employeeList.forEach(employee => {
        const tr = document.createElement('tr');
        if (employee.isResigned) {
            tr.classList.add('resigned-employee');
        }
        let companyShortName = companyShortNames[employee.company] || employee.company;
        tr.innerHTML = `
            <td>${employee.rank}</td>
            <td>${employee.name}</td>
            <td>${companyShortName}</td>
            <td>${formatIndianNumber(employee.net)}</td>
        `;
        tableBody.appendChild(tr);
    });
}

// --- Initialize the report when the page loads ---
document.addEventListener('DOMContentLoaded', init);