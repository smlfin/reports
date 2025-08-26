// company_target_achievement.js

// --- Configuration ---
const csvUrl = 'https://docs.google.com/spreadsheets/d/1jYlHO8x40Ygbn05DL3tMZ5wHuoZgPjk2fbtEGoDXzko/export?format=csv&gid=1720680457';

// Hardcoded targets based on the provided image
const companyTargets = {
    "SML": 25000000,
    "VFL": 10000000,
    "BRD": 7500000,
    "SNL": 7500000,
};

// --- Global Data Storage ---
let allData = [];
let headers = [];

// --- Fixed Date Range for Data Validity (April 2025 to Current Month) ---
const dataStartDate = new Date('2025-04-01T00:00:00');
const currentDate = new Date();
const dataEndDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

// --- DOM Elements ---
const monthSelect = document.getElementById('month-select');
const viewDetailedEntriesBtn = document.getElementById('view-detailed-entries-btn');

const overallTargetEl = document.getElementById('overall-target');
const overallAchievementEl = document.getElementById('overall-achievement');
const overallDifferenceEl = document.getElementById('overall-difference');

const companyTargetTableBody = document.getElementById('company-target-table-body');
const noDataMessage = document.getElementById('no-data-message');

const detailedEntriesContainer = document.getElementById('detailed-entries-container');
const detailedTableHead = document.querySelector('#detailed-table thead tr');
const detailedTableBody = document.querySelector('#detailed-table tbody');
const noDetailedDataMessage = document.getElementById('no-detailed-data-message');

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
        const date = new Date(year, month - 1, day);
        if (date.getDate() === day && (date.getMonth() + 1) === month && date.getFullYear() === year) {
            return date;
        }
    }
    return null;
}

function formatIndianNumber(num) {
    if (isNaN(num) || num === null) return num;
    let parts = num.toString().split('.');
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
    if (valueString === null || valueString === undefined || valueString === '') return 0;
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
            document.querySelector('.report-container').innerHTML = '<p>Error loading data. No data found.</p>';
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
                if (dateObj && dateObj >= dataStartDate && dateObj <= dataEndDate) {
                    parsedRow[dateColIndex] = dateObj;
                    return parsedRow;
                }
            }
            return null;
        }).filter(row => row !== null);

        populateMonthFilter();
        generateReport();
    } catch (error) {
        console.error('Error initializing report:', error);
        document.querySelector('.report-container').innerHTML = '<p>Error loading data. Please try again later.</p>';
    }
}

// --- Filter Population ---
function populateMonthFilter() {
    monthSelect.innerHTML = '<option value="">All Months</option>';
    
    let currentMonthIterator = new Date(dataStartDate.getFullYear(), dataStartDate.getMonth(), 1);
    while (currentMonthIterator <= currentDate) {
        const year = currentMonthIterator.getFullYear();
        const month = (currentMonthIterator.getMonth() + 1).toString().padStart(2, '0');
        const optionValue = `${year}-${month}`;
        const optionText = currentMonthIterator.toLocaleString('en-IN', { year: 'numeric', month: 'long' });

        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionText;
        monthSelect.appendChild(option);

        currentMonthIterator.setMonth(currentMonthIterator.getMonth() + 1);
    }
}

// --- Filter Data based on selections ---
function getFilteredData() {
    const selectedMonth = monthSelect.value;
    const dateColIndex = headers.indexOf('DATE');

    return allData.filter(row => {
        let matchMonth = true;
        const rowDate = row[dateColIndex];
        
        if (selectedMonth && rowDate) {
            const rowYearMonth = `${rowDate.getFullYear()}-${(rowDate.getMonth() + 1).toString().padStart(2, '0')}`;
            matchMonth = (rowYearMonth === selectedMonth);
        }
        return matchMonth;
    });
}

// --- Report Generation ---
function generateReport() {
    const filteredData = getFilteredData();
    const companyColIndex = headers.indexOf('COMPANY NAME');
    const infTotalColIndex = headers.indexOf('INF Total');
    
    detailedEntriesContainer.style.display = 'none';

    const companyAchievements = {};
    for (const company in companyTargets) {
        companyAchievements[company] = { target: companyTargets[company], achievement: 0 };
    }

    filteredData.forEach(row => {
        const companyName = row[companyColIndex];
        if (companyAchievements[companyName] && infTotalColIndex !== -1) {
            companyAchievements[companyName].achievement += parseNumericalValue(row[infTotalColIndex]);
        }
    });

    let overallTarget = 0;
    let overallAchievement = 0;

    companyTargetTableBody.innerHTML = '';
    const sortedCompanies = Object.keys(companyAchievements).sort();

    if (sortedCompanies.length === 0) {
        noDataMessage.style.display = 'block';
    } else {
        noDataMessage.style.display = 'none';
        sortedCompanies.forEach(companyName => {
            const data = companyAchievements[companyName];
            const achievementPercentage = (data.achievement / data.target) * 100;
            const difference = data.achievement - data.target;

            overallTarget += data.target;
            overallAchievement += data.achievement;
            
            const row = companyTargetTableBody.insertRow();
            row.insertCell().textContent = companyName;
            row.insertCell().textContent = formatIndianNumber(data.target);
            row.insertCell().textContent = formatIndianNumber(data.achievement);
            row.insertCell().textContent = `${achievementPercentage.toFixed(2)}%`;
            
            const differenceCell = row.insertCell();
            differenceCell.textContent = formatIndianNumber(difference);
            if (difference < 0) {
                differenceCell.classList.add('negative-difference');
            } else {
                differenceCell.classList.add('positive-difference');
            }
        });
    }

    // Update overall summary
    const overallDifference = overallAchievement - overallTarget;
    overallTargetEl.textContent = formatIndianNumber(overallTarget);
    overallAchievementEl.textContent = formatIndianNumber(overallAchievement);
    overallDifferenceEl.textContent = formatIndianNumber(overallDifference);
    
    overallDifferenceEl.className = '';
    if (overallDifference < 0) {
        overallDifferenceEl.classList.add('negative-difference');
    } else {
        overallDifferenceEl.classList.add('positive-difference');
    }
}

// --- Detailed Entries View ---
function viewDetailedEntries() {
    const filteredData = getFilteredData();

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
                    'SML NCD INF', 'SML SD INF', 'SML GB INF', 'SML BRD', 'VFL NCD INF', 'VFL SD INF', 'VFL GB INF',
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
monthSelect.addEventListener('change', generateReport);
viewDetailedEntriesBtn.addEventListener('click', viewDetailedEntries);

// --- Initialize the report when the page loads ---

document.addEventListener('DOMContentLoaded', init);
