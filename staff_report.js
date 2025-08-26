// staff_report.js

// --- Configuration ---
const csvUrl = 'https://docs.google.com/spreadsheets/d/1jYlHO8x40Ygbn05DL3tMZ5wHuoZgPjk2fbtEGoDXzko/export?format=csv&gid=1720680457';

// --- Global Data Storage ---
let allData = [];
let headers = [];
let allStaffNames = [];
let freshCustomerDetailsMap = new Map();
let myChart = null;
let myCumulativeChart = null;

// --- Fixed Date Range for Data Validity ---
const dataStartDate = new Date('2025-04-01T00:00:00');
const dataEndDate = new Date('2026-03-31T23:59:59');

// --- DOM Elements ---
const reportContainer = document.getElementById('report-container');
const companySelect = document.getElementById('company-select');
const staffSearchInput = document.getElementById('staff-search');
const staffSelect = document.getElementById('staff-select');
const monthSelect = document.getElementById('month-select');

const totalInflowEl = document.getElementById('total-inflow');
const totalOutflowEl = document.getElementById('total-outflow');
const totalNetGrowthEl = document.getElementById('total-net-growth');
const freshCustomerListEl = document.getElementById('fresh-customer-list');

const churnRateEl = document.getElementById('churn-rate');
const repeatBusinessListEl = document.getElementById('repeat-business-list');

const monthlyTableBody = document.querySelector('#monthly-table tbody');
const companyBreakdownTableBody = document.querySelector('#company-breakdown-table tbody');
const productBreakdownTableBody = document.querySelector('#product-breakdown-table tbody'); // NEW: Product breakdown table body
const detailedEntriesContainer = document.getElementById('detailed-entries-container');
const backToReportBtn = document.getElementById('back-to-report-btn');
const detailedTitleEl = document.getElementById('detailed-title');
const detailedTableBody = document.querySelector('#detailed-table tbody');
const showCustomerNameCheckbox = document.getElementById('show-customer-name');
const performanceChartCanvas = document.getElementById('performance-chart');
const cumulativePerformanceChartCanvas = document.getElementById('cumulative-performance-chart');


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

        populateFilters();
    } catch (error) {
        console.error('Error initializing report:', error);
        document.querySelector('.report-controls').innerHTML = '<p>Error loading data. Please try again later.</p>';
    }
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

    monthSelect.innerHTML = '<option value="">All Months</option>';
    let currentDateIterator = new Date(dataStartDate);
    while (currentDateIterator <= dataEndDate) {
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
}

function filterStaffList() {
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

    const selectedMonth = monthSelect.value;

    const staffColIndex = headers.indexOf('STAFF NAME');
    const freshOldColIndex = headers.indexOf('FRESH/OLD');
    const customerNameColIndex = headers.indexOf('CUSTOMER NAME');


    const filteredDataForOverall = allData.filter(row => {
        const rowStaff = row[staffColIndex];
        const rowDate = row[headers.indexOf('DATE')];
        let matchStaff = !selectedStaff || rowStaff === selectedStaff;
        let matchMonth = !selectedMonth || (rowDate && `${rowDate.getFullYear()}-${(rowDate.getMonth() + 1).toString().padStart(2, '0')}` === selectedMonth);
        return matchStaff && matchMonth;
    });

    // Performance Summary
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
                customerData.set(customerName, {
                    net: 0,
                    transactions: 0
                });
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
            monthlyData[yearMonth] = {
                inflow: 0,
                outflow: 0,
                net: 0,
                entries: []
            };
        }

        monthlyData[yearMonth].inflow += getValueFromRow(row, headers, 'INF Total');
        monthlyData[yearMonth].outflow += getValueFromRow(row, headers, 'OUT Total');
        monthlyData[yearMonth].net += getValueFromRow(row, headers, 'Net');
        monthlyData[yearMonth].entries.push(row);
    });

    monthlyTableBody.innerHTML = '';
    const sortedMonths = Object.keys(monthlyData).sort();
    sortedMonths.forEach(monthKey => {
        const data = monthlyData[monthKey];
        const monthName = new Date(monthKey + '-01').toLocaleString('en-IN', {
            year: 'numeric',
            month: 'long'
        });

        const row = monthlyTableBody.insertRow();
        row.insertCell().textContent = monthName;

        const inflowCell = row.insertCell();
        inflowCell.textContent = formatIndianNumber(data.inflow);
        inflowCell.classList.add('clickable');
        inflowCell.addEventListener('click', () => displayDetailedEntries(data.entries, 'Inflow', monthName));

        const outflowCell = row.insertCell();
        outflowCell.textContent = formatIndianNumber(data.outflow);
        outflowCell.classList.add('clickable');
        outflowCell.addEventListener('click', () => displayDetailedEntries(data.entries, 'Outflow', monthName));

        const netCell = row.insertCell();
        netCell.textContent = formatIndianNumber(data.net);
        netCell.classList.add('clickable');
        netCell.addEventListener('click', () => displayDetailedEntries(data.entries, 'Net', monthName));
    });

    // NEW: Product/Company-Wise Breakdown Logic
    const productBreakdownData = new Map();

    filteredDataForOverall.forEach(row => {
        headers.forEach((header, index) => {
            const headerParts = header.split(' ');
            if (headerParts.length >= 2) {
                const company = headerParts[0];
                const product = headerParts[1];
                const type = headerParts[2];
                const key = `${company} ${product}`;

                if (type === 'INF' || type === 'OUT' || type === 'NET') {
                    const value = parseNumericalValue(row[index]);
                    if (!productBreakdownData.has(key)) {
                        productBreakdownData.set(key, {
                            company: company,
                            product: product,
                            inflow: 0,
                            outflow: 0,
                            net: 0
                        });
                    }
                    const currentData = productBreakdownData.get(key);
                    if (type === 'INF') {
                        currentData.inflow += value;
                    } else if (type === 'OUT') {
                        currentData.outflow += value;
                    } else if (type === 'NET') {
                        currentData.net += value;
                    }
                }
            }
        });
    });

    productBreakdownTableBody.innerHTML = '';
    const sortedProducts = Array.from(productBreakdownData.keys()).sort();
    sortedProducts.forEach(key => {
        const data = productBreakdownData.get(key);
        const row = productBreakdownTableBody.insertRow();
        row.insertCell().textContent = data.company;
        row.insertCell().textContent = data.product;
        row.insertCell().textContent = formatIndianNumber(data.inflow);
        row.insertCell().textContent = formatIndianNumber(data.outflow);
        row.insertCell().textContent = formatIndianNumber(data.net);
    });

    // Calculate cumulative data
    let cumulativeNet = 0;
    const cumulativeData = sortedMonths.map(monthKey => {
        cumulativeNet += monthlyData[monthKey].net;
        return cumulativeNet;
    });

    // Generate the charts
    generateCumulativePerformanceChart(cumulativeData, sortedMonths);
    generatePerformanceChart(monthlyData, sortedMonths);
}

function generatePerformanceChart(monthlyData, sortedMonths) {
    if (myChart) {
        myChart.destroy();
    }

    const labels = sortedMonths.map(monthKey => new Date(monthKey + '-01').toLocaleString('en-IN', {
        month: 'short',
        year: 'numeric'
    }));
    const inflowData = sortedMonths.map(monthKey => monthlyData[monthKey].inflow);
    const outflowData = sortedMonths.map(monthKey => monthlyData[monthKey].outflow);
    const netGrowthData = sortedMonths.map(monthKey => monthlyData[monthKey].net);

    myChart = new Chart(performanceChartCanvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Inflow',
                data: inflowData,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }, {
                label: 'Outflow',
                data: outflowData,
                borderColor: 'rgb(255, 99, 132)',
                tension: 0.1
            }, {
                label: 'Net Growth',
                data: netGrowthData,
                borderColor: 'rgb(54, 162, 235)',
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
                        text: 'Amount (₹)'
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
                                label += `₹${formatIndianNumber(context.parsed.y)}`;
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

function generateCumulativePerformanceChart(cumulativeData, sortedMonths) {
    if (myCumulativeChart) {
        myCumulativeChart.destroy();
    }

    const labels = sortedMonths.map(monthKey => new Date(monthKey + '-01').toLocaleString('en-IN', {
        month: 'short',
        year: 'numeric'
    }));

    myCumulativeChart = new Chart(cumulativePerformanceChartCanvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Cumulative Net Growth',
                data: cumulativeData,
                borderColor: 'rgb(153, 102, 255)',
                tension: 0.1,
                fill: false
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Cumulative Net Growth (₹)'
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
                                label += `₹${formatIndianNumber(context.parsed.y)}`;
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}


function displayDetailedEntries(entries, type, monthName) {
    reportContainer.classList.add('hidden');
    detailedEntriesContainer.classList.remove('hidden');

    detailedTitleEl.textContent = `${type} for ${monthName}`;
    detailedTableBody.innerHTML = '';

    entries.forEach(entry => {
        const tr = detailedTableBody.insertRow();
        tr.insertCell().textContent = entry[headers.indexOf('DATE')].toLocaleDateString('en-IN');
        tr.insertCell().textContent = formatIndianNumber(getValueFromRow(entry, headers, 'INF Total'));
        tr.insertCell().textContent = formatIndianNumber(getValueFromRow(entry, headers, 'OUT Total'));
        tr.insertCell().textContent = formatIndianNumber(getValueFromRow(entry, headers, 'Net'));

        const customerNameCell = tr.insertCell();
        customerNameCell.classList.add('customer-name-column');
        customerNameCell.classList.add('hidden');
        customerNameCell.textContent = entry[headers.indexOf('CUSTOMER NAME')];
    });

    if (showCustomerNameCheckbox.checked) {
        document.querySelectorAll('.customer-name-column').forEach(cell => cell.classList.remove('hidden'));
    }
}

function showMainReport() {
    detailedEntriesContainer.classList.add('hidden');
    reportContainer.classList.remove('hidden');
}


// --- Event Listeners ---
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

monthSelect.addEventListener('change', generateReport);
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

document.addEventListener('DOMContentLoaded', init);

