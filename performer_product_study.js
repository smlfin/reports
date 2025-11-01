// performer_product_study.js

// --- Configuration ---
const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1OOdGnJhw1k6U15Aybn_2JWex_qTShP6w7CXm0_auXnc8vFnvlabPZjK3lsjqkHgn6NgeKKPyu9qW/pub?gid=1720680457&single=true&output=csv';

// --- Global Data Storage ---
let allData = [];
let headers = [];
let myProductChart = null;

// --- DOM Elements ---
const reportContainer = document.getElementById('report-container');
const minNetGrowthInput = document.getElementById('min-net-growth');
const performerTableBody = document.querySelector('#performer-table tbody');
const productBreakdownTableBody = document.querySelector('#product-breakdown-table tbody');
const performerCountEl = document.getElementById('performer-count');
const targetNetGrowthEl = document.getElementById('target-net-growth');
const performerTotalInflowEl = document.getElementById('performer-total-inflow');
const performerTotalNetGrowthEl = document.getElementById('performer-total-net-growth');
const productBreakdownChartCanvas = document.getElementById('product-breakdown-chart');

// --- Utility Functions (Adapted from staff_report.js) ---

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
    if (isNaN(num) || num === null) return '0';
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

function getValueFromRow(row, columnName) {
    const colIndex = headers.indexOf(columnName);
    if (colIndex !== -1 && row[colIndex] !== undefined && row[colIndex] !== null) {
        return parseNumericalValue(row[colIndex]);
    }
    return 0;
}

function parseCompanyAndProductFromHeader(header) {
    const parts = header.trim().split(/\s+/); 
    let company = null;
    let product = null;
    let type = null;

    if (parts.length >= 3) {
        company = parts[0];
        product = parts.slice(1, parts.length - 1).join(' ');
        type = parts[parts.length - 1];
        
    } else if (parts.length === 2 && (parts[1] === 'INF' || parts[1] === 'OUT')) {
        company = parts[0];
        product = parts[0]; 
        type = parts[1];
        
    } else if (parts.length === 2 && parts[1] === 'PURCHASE') {
        company = parts[0];
        product = parts[1];
        type = 'OUT';
        
    } else {
        return { company: null, product: null, type: null };
    }

    return { company, product, type };
}

function getInflowOutflowHeaders() {
    const infOutHeaders = [];
    headers.forEach(header => {
        const { company, type } = parseCompanyAndProductFromHeader(header);
        if (company && (type === 'INF' || type === 'OUT')) {
            infOutHeaders.push(header);
        }
    });
    return infOutHeaders;
}

function mapProductToDisplayName(productCode) {
    if (!productCode) return 'No Product Specified';

    const code = productCode.toUpperCase();
    
    switch (code) {
        case 'BD':
        case 'SD':
            return 'Subdebt/Bond';
        case 'FD':
            return 'Fixed Deposit';
        case 'GB':
            return 'Golden Bond';
        case 'LLP':
            return 'LLP';
        case 'NCD':
            return 'NCD';
        case 'PURCHASE':
            return 'Purchase/Outflow'; 
        default:
            return productCode;
    }
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
        const dateColIndex = headers.indexOf('DATE');
        const staffColIndex = headers.indexOf('STAFF NAME');

        // Filter out rows with invalid or missing date/staff, and normalize data types
        allData = rows.slice(1).map(row => {
            const parsedRow = parseLine(row);
            while (parsedRow.length < headers.length) {
                parsedRow.push(null);
            }

            const dateObj = (dateColIndex !== -1) ? parseDate(parsedRow[dateColIndex]) : null;
            
            // Only keep rows that have a valid date and staff name
            if (dateObj && staffColIndex !== -1 && parsedRow[staffColIndex]) {
                parsedRow[dateColIndex] = dateObj;
                return parsedRow;
            }
            return null;
        }).filter(row => row !== null);

        // Run analysis once data is loaded
        generateStudy();

    } catch (error) {
        console.error('Error initializing report:', error);
        reportContainer.innerHTML = '<p>Error loading data. Please check the data source and try again.</p>';
    }
}


// --- Core Analysis Function ---
function generateStudy() {
    const minNetGrowth = parseNumericalValue(minNetGrowthInput.value);
    const staffColIndex = headers.indexOf('STAFF NAME');

    // 1. Calculate Total Net Growth for ALL staff
    const staffPerformance = {};
    allData.forEach(row => {
        const staffName = row[staffColIndex];
        const net = getValueFromRow(row, 'Net');

        if (staffName) {
            staffPerformance[staffName] = (staffPerformance[staffName] || 0) + net;
        }
    });

    // 2. Identify Performers
    const performers = Object.entries(staffPerformance)
        .filter(([, net]) => net >= minNetGrowth)
        .sort((a, b) => b[1] - a[1]); // Sort by net growth descending
    
    const performerNames = new Set(performers.map(([name]) => name));

    // 3. Filter data for Performers ONLY
    const performerData = allData.filter(row => performerNames.has(row[staffColIndex]));
    
    // 4. Calculate Total Performer Inflow/Net for summary cards
    let totalPerformerInflow = performerData.reduce((sum, row) => sum + getValueFromRow(row, 'INF Total'), 0);
    let totalPerformerNetGrowth = performerData.reduce((sum, row) => sum + getValueFromRow(row, 'Net'), 0);
    
    // Update Summary Section
    targetNetGrowthEl.textContent = formatIndianNumber(minNetGrowth);
    performerCountEl.textContent = `(${performers.length} Staff)`;
    performerTotalInflowEl.textContent = `₹${formatIndianNumber(totalPerformerInflow)}`;
    performerTotalNetGrowthEl.textContent = `₹${formatIndianNumber(totalPerformerNetGrowth)}`;
    
    // 5. Render Performers List
    renderPerformerList(performers);

    // 6. Calculate and Render Product Breakdown for Performers
    renderPerformerProductBreakdown(performerData, totalPerformerNetGrowth);
    
    reportContainer.classList.remove('hidden');
}


function renderPerformerList(performers) {
    performerTableBody.innerHTML = '';
    if (performers.length === 0) {
        performerTableBody.innerHTML = '<tr><td colspan="2">No staff meet the minimum Net Growth threshold.</td></tr>';
        return;
    }

    performers.forEach(([name, net]) => {
        const netClass = net >= 0 ? 'positive' : 'negative';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${name}</td>
            <td class="${netClass}">₹${formatIndianNumber(net)}</td>
        `;
        performerTableBody.appendChild(tr);
    });
}


function renderPerformerProductBreakdown(data, totalPerformerNetGrowth) {
    const productData = {};
    const infOutHeaders = getInflowOutflowHeaders();

    // Aggregate Product data across all performer transactions
    data.forEach(row => {
        infOutHeaders.forEach(header => {
            const { product, type } = parseCompanyAndProductFromHeader(header);
            const value = getValueFromRow(row, header);

            const productName = mapProductToDisplayName(product);
            
            if (product && value !== 0) {
                if (!productData[productName]) {
                    productData[productName] = { inflow: 0, outflow: 0, net: 0 };
                }
                
                if (type === 'INF') {
                    productData[productName].inflow += value;
                } else if (type === 'OUT') {
                    productData[productName].outflow += value;
                }
            }
        });
    });

    productBreakdownTableBody.innerHTML = '';
    const sortedProducts = Object.keys(productData).sort((a, b) => {
        return productData[b].net - productData[a].net; // Sort by Net Growth descending
    });

    const chartLabels = [];
    const chartData = [];
    const chartColors = [];

    sortedProducts.forEach(productName => {
        const data = productData[productName];
        data.net = data.inflow - data.outflow; // Calculate Net Growth
        const netClass = data.net >= 0 ? 'positive' : 'negative';
        
        // Calculate percentage contribution to performers' total net growth
        const netPercent = totalPerformerNetGrowth > 0 ? (data.net / totalPerformerNetGrowth * 100).toFixed(2) : '0.00';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${productName}</td>
            <td>${formatIndianNumber(data.inflow)}</td>
            <td>${formatIndianNumber(data.outflow)}</td>
            <td class="${netClass}"><strong>${formatIndianNumber(data.net)}</strong></td>
            <td>${netPercent}%</td>
        `;
        productBreakdownTableBody.appendChild(tr);

        // Prepare data for chart
        if (data.net > 0) {
            chartLabels.push(productName);
            chartData.push(data.net);
            chartColors.push(netClass === 'positive' ? '#28a745' : '#007bff'); // Use a generic color for chart
        }
    });

    // Render Chart
    renderProductBreakdownChart(chartLabels, chartData);
}

function renderProductBreakdownChart(labels, data) {
    if (myProductChart) myProductChart.destroy();

    const backgroundColors = [
        '#007bff', '#28a745', '#ffc107', '#dc3545', '#6c757d', 
        '#17a2b8', '#fd7e14', '#e83e8c', '#6f42c1', '#20c997'
    ];

    // Pie chart for visualization of common high-net-growth products
    myProductChart = new Chart(productBreakdownChartCanvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Net Growth Contribution (in ₹)',
                data: data,
                backgroundColor: backgroundColors.slice(0, labels.length),
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Net Growth Contribution by Product Category (Top Performers)',
                    font: { size: 16 }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(2) + '%' : '0.00%';
                            
                            return `₹${formatIndianNumber(value)} (${percentage})`;
                        }
                    }
                }
            }
        }
    });
}


// --- Initialize the report when the page loads ---
document.addEventListener('DOMContentLoaded', init);