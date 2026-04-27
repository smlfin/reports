// performer_product_study.js

// --- Configuration ---
const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1OOdGnJhw1k6U15Aybn_2JWex_qTShP6w7CXm0_auXnc8vFnvlabPZjK3lsjqkHgn6NgeKKPyu9qW/pub?gid=1720680457&single=true&output=csv';

// --- Global Data Storage ---
let allData = [];
let headers = [];
let myProductChart = null;

// --- Current Date ---
const currentDate = new Date();

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
const fySelect = document.getElementById('fy-select');
const monthFromSelect = document.getElementById('month-from-select');
const monthToSelect = document.getElementById('month-to-select');

// --- Utility Functions ---
function parseLine(line) {
    const fields = [];
    let inQuote = false;
    let currentField = '';
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuote && i + 1 < line.length && line[i + 1] === '"') { currentField += '"'; i++; }
            else { inQuote = !inQuote; }
        } else if (char === ',' && !inQuote) {
            fields.push(currentField); currentField = '';
        } else { currentField += char; }
    }
    fields.push(currentField);
    return fields.map(f => f.trim());
}

function parseDate(dateString) {
    if (!dateString) return null;
    const parts = dateString.replace(/[-.]/g, '/').split('/');
    if (parts.length === 3) {
        const day = parseInt(parts[0], 10), month = parseInt(parts[1], 10), year = parseInt(parts[2], 10);
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
            const d = new Date(year, month - 1, day);
            if (d.getDate() === day && (d.getMonth() + 1) === month && d.getFullYear() === year) return d;
        }
    }
    return null;
}

function formatIndianNumber(num) {
    if (isNaN(num) || num === null) return '0';
    let parts = num.toFixed(0).toString().split('.');
    let intPart = parts[0];
    let sign = '';
    if (intPart.startsWith('-')) { sign = '-'; intPart = intPart.substring(1); }
    if (intPart.length <= 3) return sign + intPart;
    let last3 = intPart.substring(intPart.length - 3);
    let others = intPart.substring(0, intPart.length - 3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    return sign + others + ',' + last3;
}

function parseNumericalValue(v) {
    if (v === null || v === undefined || v === '') return 0;
    const p = parseFloat(String(v).replace(/,/g, ''));
    return isNaN(p) ? 0 : p;
}

function getValueFromRow(row, columnName) {
    const idx = headers.indexOf(columnName);
    return (idx !== -1 && row[idx] != null) ? parseNumericalValue(row[idx]) : 0;
}

function parseCompanyAndProductFromHeader(header) {
    const parts = header.trim().split(/\s+/);
    if (parts.length >= 3) {
        return { company: parts[0], product: parts.slice(1, parts.length - 1).join(' '), type: parts[parts.length - 1] };
    } else if (parts.length === 2 && (parts[1] === 'INF' || parts[1] === 'OUT')) {
        return { company: parts[0], product: parts[0], type: parts[1] };
    } else if (parts.length === 2 && parts[1] === 'PURCHASE') {
        return { company: parts[0], product: 'PURCHASE', type: 'OUT' };
    }
    return { company: null, product: null, type: null };
}

function getInflowOutflowHeaders() {
    return headers.filter(h => {
        const { company, type } = parseCompanyAndProductFromHeader(h);
        return company && (type === 'INF' || type === 'OUT');
    });
}

// CORRECT net: sum all INF columns minus sum all OUT columns (matches staff_report.js pattern)
function getRowNetFromColumns(row, infOutHeaders) {
    let inf = 0, out = 0;
    infOutHeaders.forEach(h => {
        const { type } = parseCompanyAndProductFromHeader(h);
        const v = getValueFromRow(row, h);
        if (type === 'INF') inf += v;
        else if (type === 'OUT') out += v;
    });
    return inf - out;
}

function getRowInflowFromColumns(row, infOutHeaders) {
    return infOutHeaders.filter(h => parseCompanyAndProductFromHeader(h).type === 'INF')
        .reduce((s, h) => s + getValueFromRow(row, h), 0);
}

function mapProductToDisplayName(productCode) {
    if (!productCode) return 'No Product Specified';
    switch (productCode.toUpperCase()) {
        case 'BD': case 'SD': return 'Subdebt/Bond';
        case 'FD': return 'Fixed Deposit';
        case 'GB': return 'Golden Bond';
        case 'LLP': return 'LLP';
        case 'NCD': return 'NCD';
        case 'PURCHASE': return 'Purchase/Outflow';
        default: return productCode;
    }
}

// --- FY Helpers ---
function getFYLabel(yr) { return `FY ${yr}-${String(yr + 1).slice(-2)}`; }
function getFYStartYear(date) { return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1; }

function getFYMonths(fyStart) {
    const months = [];
    for (let i = 0; i < 12; i++) {
        const month = (3 + i) % 12;
        const year = i < 9 ? fyStart : fyStart + 1;
        const value = `${year}-${String(month + 1).padStart(2, '0')}`;
        const label = new Date(year, month, 1).toLocaleString('en-IN', { year: 'numeric', month: 'long' });
        if (new Date(year, month, 1) <= currentDate) months.push({ value, label });
    }
    return months;
}

function populateMonthRangeSelectors() {
    const fyMonths = getFYMonths(parseInt(fySelect.value));
    monthFromSelect.innerHTML = '';
    monthToSelect.innerHTML = '';
    fyMonths.forEach(m => {
        monthFromSelect.appendChild(Object.assign(document.createElement('option'), { value: m.value, textContent: m.label }));
        monthToSelect.appendChild(Object.assign(document.createElement('option'), { value: m.value, textContent: m.label }));
    });
    if (fyMonths.length > 0) {
        monthFromSelect.value = fyMonths[0].value;
        monthToSelect.value = fyMonths[fyMonths.length - 1].value;
    }
}

function syncToMonth() {
    const fromVal = monthFromSelect.value;
    Array.from(monthToSelect.options).forEach(o => { o.disabled = o.value < fromVal; });
    if (monthToSelect.value < fromVal) monthToSelect.value = fromVal;
}

function getSelectedDateRange() {
    const fromVal = monthFromSelect.value, toVal = monthToSelect.value;
    if (!fromVal || !toVal) return { start: null, end: null };
    const [fy, fm] = fromVal.split('-').map(Number);
    const [ty, tm] = toVal.split('-').map(Number);
    return { start: new Date(fy, fm - 1, 1, 0, 0, 0), end: new Date(ty, tm, 0, 23, 59, 59) };
}

function getFilteredData() {
    const { start, end } = getSelectedDateRange();
    const dateIdx = headers.indexOf('DATE');
    return allData.filter(row => {
        const d = row[dateIdx];
        if (!d) return false;
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
    });
}

// --- Init ---
async function init() {
    try {
        const response = await fetch(csvUrl);
        const csvText = await response.text();
        const rows = csvText.trim().split('\n');
        if (rows.length === 0) return;

        headers = parseLine(rows[0]).map(h => h.trim());
        const dateIdx = headers.indexOf('DATE');
        const staffIdx = headers.indexOf('STAFF NAME');

        allData = rows.slice(1).map(row => {
            const parsed = parseLine(row);
            while (parsed.length < headers.length) parsed.push(null);
            const dateObj = dateIdx !== -1 ? parseDate(parsed[dateIdx]) : null;
            if (dateObj && staffIdx !== -1 && parsed[staffIdx]) {
                parsed[dateIdx] = dateObj;
                return parsed;
            }
            return null;
        }).filter(Boolean);

        // Build FY selector
        let earliest = currentDate;
        allData.forEach(row => { const d = row[dateIdx]; if (d && d < earliest) earliest = d; });

        const firstFY = getFYStartYear(earliest);
        const curFY = getFYStartYear(currentDate);
        fySelect.innerHTML = '';
        for (let fy = firstFY; fy <= curFY; fy++) {
            fySelect.appendChild(Object.assign(document.createElement('option'), { value: fy, textContent: getFYLabel(fy) }));
        }
        fySelect.value = curFY;
        populateMonthRangeSelectors();

        fySelect.addEventListener('change', () => { populateMonthRangeSelectors(); generateStudy(); });
        monthFromSelect.addEventListener('change', () => { syncToMonth(); generateStudy(); });
        monthToSelect.addEventListener('change', generateStudy);

        generateStudy();
    } catch (err) {
        console.error('Error initializing report:', err);
        reportContainer.innerHTML = '<p>Error loading data.</p>';
    }
}

// --- Core Analysis ---
function generateStudy() {
    const minNet = parseNumericalValue(minNetGrowthInput.value);
    const staffIdx = headers.indexOf('STAFF NAME');
    const infOutHeaders = getInflowOutflowHeaders();
    const filteredData = getFilteredData();

    // 1. Staff totals using CORRECT column-based net
    const staffPerf = {};
    filteredData.forEach(row => {
        const name = row[staffIdx];
        if (!name) return;
        if (!staffPerf[name]) staffPerf[name] = { net: 0, inflow: 0 };
        staffPerf[name].net += getRowNetFromColumns(row, infOutHeaders);
        staffPerf[name].inflow += getRowInflowFromColumns(row, infOutHeaders);
    });

    // 2. Identify performers
    const performers = Object.entries(staffPerf)
        .filter(([, d]) => d.net >= minNet)
        .sort((a, b) => b[1].net - a[1].net);

    const performerNames = new Set(performers.map(([n]) => n));
    const performerData = filteredData.filter(row => performerNames.has(row[staffIdx]));

    const totalInflow = performers.reduce((s, [, d]) => s + d.inflow, 0);
    const totalNet = performers.reduce((s, [, d]) => s + d.net, 0);

    targetNetGrowthEl.textContent = formatIndianNumber(minNet);
    performerCountEl.textContent = `(${performers.length} Staff)`;
    performerTotalInflowEl.textContent = `₹${formatIndianNumber(totalInflow)}`;
    performerTotalNetGrowthEl.textContent = `₹${formatIndianNumber(totalNet)}`;

    renderPerformerList(performers);
    renderPerformerProductBreakdown(performerData, totalNet, infOutHeaders);
    renderStaffBehaviourInsights(performerData, performerNames, infOutHeaders);

    reportContainer.classList.remove('hidden');
}

function renderPerformerList(performers) {
    performerTableBody.innerHTML = '';
    if (!performers.length) {
        performerTableBody.innerHTML = '<tr><td colspan="3">No staff meet the minimum Net Growth threshold.</td></tr>';
        return;
    }
    performers.forEach(([name, d]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${name}</td><td>₹${formatIndianNumber(d.inflow)}</td><td class="${d.net >= 0 ? 'positive' : 'negative'}">₹${formatIndianNumber(d.net)}</td>`;
        performerTableBody.appendChild(tr);
    });
}

function renderPerformerProductBreakdown(data, totalNet, infOutHeaders) {
    const productData = {};
    data.forEach(row => {
        infOutHeaders.forEach(h => {
            const { product, type } = parseCompanyAndProductFromHeader(h);
            const value = getValueFromRow(row, h);
            const pName = mapProductToDisplayName(product);
            if (product && value) {
                if (!productData[pName]) productData[pName] = { inflow: 0, outflow: 0, net: 0 };
                if (type === 'INF') productData[pName].inflow += value;
                else if (type === 'OUT') productData[pName].outflow += value;
            }
        });
    });

    Object.values(productData).forEach(d => { d.net = d.inflow - d.outflow; });

    productBreakdownTableBody.innerHTML = '';
    const sorted = Object.keys(productData).sort((a, b) => productData[b].net - productData[a].net);
    const chartLabels = [], chartData = [];

    sorted.forEach(pName => {
        const d = productData[pName];
        const nc = d.net >= 0 ? 'positive' : 'negative';
        const pct = totalNet > 0 ? (d.net / totalNet * 100).toFixed(2) : '0.00';
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${pName}</td><td>₹${formatIndianNumber(d.inflow)}</td><td>₹${formatIndianNumber(d.outflow)}</td><td class="${nc}"><strong>₹${formatIndianNumber(d.net)}</strong></td><td>${pct}%</td>`;
        productBreakdownTableBody.appendChild(tr);
        if (d.net > 0) { chartLabels.push(pName); chartData.push(d.net); }
    });

    renderProductBreakdownChart(chartLabels, chartData);
}

// --- Staff Behaviour Insights ---
function renderStaffBehaviourInsights(performerData, performerNames, infOutHeaders) {
    const staffIdx = headers.indexOf('STAFF NAME');
    const dateIdx = headers.indexOf('DATE');
    const custIdx = headers.indexOf('CUSTOMER NAME');
    const freshOldIdx = headers.indexOf('FRESH/OLD');
    const FRESH_TYPES = ['FRESH CUSTOMER', 'FRESH CUSTOMER/STAFF', 'FRESH STAFF'];

    const sb = {};
    performerNames.forEach(name => {
        sb[name] = { name, monthlyNet: {}, productNet: {}, companyNet: {}, customers: new Set(), freshCustomers: new Set(), totalInflow: 0, totalNet: 0, txCount: 0 };
    });

    performerData.forEach(row => {
        const name = row[staffIdx];
        const s = sb[name];
        if (!s) return;

        s.totalInflow += getRowInflowFromColumns(row, infOutHeaders);
        s.totalNet += getRowNetFromColumns(row, infOutHeaders);
        s.txCount++;

        const cust = row[custIdx];
        if (cust) {
            s.customers.add(cust);
            if (freshOldIdx !== -1 && FRESH_TYPES.includes(String(row[freshOldIdx] || '').trim().toUpperCase())) {
                s.freshCustomers.add(cust);
            }
        }

        const rowDate = row[dateIdx];
        if (rowDate) {
            const ym = `${rowDate.getFullYear()}-${String(rowDate.getMonth() + 1).padStart(2, '0')}`;
            s.monthlyNet[ym] = (s.monthlyNet[ym] || 0) + getRowNetFromColumns(row, infOutHeaders);
        }

        infOutHeaders.forEach(h => {
            const { company, product, type } = parseCompanyAndProductFromHeader(h);
            const val = getValueFromRow(row, h);
            if (!val) return;

            const pName = mapProductToDisplayName(product);
            if (!s.productNet[pName]) s.productNet[pName] = { inflow: 0, outflow: 0 };
            if (type === 'INF') s.productNet[pName].inflow += val;
            else if (type === 'OUT') s.productNet[pName].outflow += val;

            if (company) {
                if (!s.companyNet[company]) s.companyNet[company] = { inflow: 0, outflow: 0 };
                if (type === 'INF') s.companyNet[company].inflow += val;
                else if (type === 'OUT') s.companyNet[company].outflow += val;
            }
        });
    });

    Object.values(sb).forEach(s => {
        Object.values(s.productNet).forEach(p => { p.net = p.inflow - p.outflow; });
        Object.values(s.companyNet).forEach(c => { c.net = c.inflow - c.outflow; });
    });

    const container = document.getElementById('staff-behaviour-section');
    container.innerHTML = '';

    Object.values(sb).sort((a, b) => b.totalNet - a.totalNet).forEach(s => {
        const freshRate = s.customers.size > 0 ? ((s.freshCustomers.size / s.customers.size) * 100).toFixed(1) : '0.0';

        const sortedProducts = Object.entries(s.productNet).sort((a, b) => b[1].net - a[1].net);
        const dominantProduct = sortedProducts.length > 0 ? sortedProducts[0][0] : '—';

        // Monthly trend badges
        const months = Object.keys(s.monthlyNet).sort();
        const trendHtml = months.map((ym, i) => {
            const net = s.monthlyNet[ym];
            const prevNet = i > 0 ? s.monthlyNet[months[i - 1]] : null;
            const label = new Date(ym + '-01').toLocaleString('en-IN', { month: 'short', year: '2-digit' });
            const cls = net >= 0 ? 'positive' : 'negative';
            const arrow = prevNet === null ? '' : net >= prevNet ? ' ↑' : ' ↓';
            return `<span class="month-badge ${cls}" title="${label}: ₹${formatIndianNumber(net)}">${label}<br><small>₹${formatIndianNumber(net)}${arrow}</small></span>`;
        }).join('') || '<em>No monthly data</em>';

        // Product mini-table
        const productRows = sortedProducts.map(([pName, pd]) => {
            pd.net = pd.inflow - pd.outflow;
            return `<tr><td>${pName}</td><td>₹${formatIndianNumber(pd.inflow)}</td><td>₹${formatIndianNumber(pd.outflow)}</td><td class="${pd.net >= 0 ? 'positive' : 'negative'}">₹${formatIndianNumber(pd.net)}</td></tr>`;
        }).join('') || '<tr><td colspan="4">No data</td></tr>';

        // Company mini-table
        const companyRows = Object.entries(s.companyNet).sort((a, b) => b[1].net - a[1].net).map(([cName, cd]) => {
            cd.net = cd.inflow - cd.outflow;
            return `<tr><td>${cName}</td><td>₹${formatIndianNumber(cd.inflow)}</td><td>₹${formatIndianNumber(cd.outflow)}</td><td class="${cd.net >= 0 ? 'positive' : 'negative'}">₹${formatIndianNumber(cd.net)}</td></tr>`;
        }).join('') || '<tr><td colspan="4">No data</td></tr>';

        const cardId = `sbc-${s.name.replace(/\W+/g, '-')}`;
        const nc = s.totalNet >= 0 ? 'positive' : 'negative';

        const card = document.createElement('div');
        card.className = 'staff-behaviour-card';
        card.innerHTML = `
            <div class="behaviour-card-header" onclick="toggleBehaviourCard('${cardId}')">
                <div class="behaviour-card-title">
                    <span class="staff-name-badge">${s.name}</span>
                    <span class="behaviour-pill">🏆 ${dominantProduct}</span>
                    <span class="behaviour-pill">👥 ${s.customers.size} customers &nbsp;|&nbsp; 🌱 ${s.freshCustomers.size} fresh (${freshRate}%)</span>
                    <span class="behaviour-pill">📋 ${s.txCount} transactions</span>
                </div>
                <div class="behaviour-card-summary">
                    <span>Inflow: ₹${formatIndianNumber(s.totalInflow)}</span>
                    <span class="${nc}">Net: ₹${formatIndianNumber(s.totalNet)}</span>
                    <span class="collapse-icon">▼</span>
                </div>
            </div>
            <div class="behaviour-card-body collapsed" id="${cardId}">
                <div class="behaviour-section">
                    <h4>Monthly Performance Trend</h4>
                    <div class="month-trend-strip">${trendHtml}</div>
                </div>
                <div class="behaviour-two-col">
                    <div class="behaviour-section">
                        <h4>Product Breakdown</h4>
                        <table class="mini-table">
                            <thead><tr><th>Product</th><th>Inflow</th><th>Outflow</th><th>Net</th></tr></thead>
                            <tbody>${productRows}</tbody>
                        </table>
                    </div>
                    <div class="behaviour-section">
                        <h4>Company Breakdown</h4>
                        <table class="mini-table">
                            <thead><tr><th>Company</th><th>Inflow</th><th>Outflow</th><th>Net</th></tr></thead>
                            <tbody>${companyRows}</tbody>
                        </table>
                    </div>
                </div>
            </div>`;
        container.appendChild(card);
    });
}

function toggleBehaviourCard(id) {
    const body = document.getElementById(id);
    if (!body) return;
    body.classList.toggle('collapsed');
    const icon = body.previousElementSibling.querySelector('.collapse-icon');
    if (icon) icon.textContent = body.classList.contains('collapsed') ? '▼' : '▲';
}

function renderProductBreakdownChart(labels, data) {
    if (myProductChart) myProductChart.destroy();
    const colors = ['#007bff','#28a745','#ffc107','#dc3545','#6c757d','#17a2b8','#fd7e14','#e83e8c','#6f42c1','#20c997'];
    myProductChart = new Chart(productBreakdownChartCanvas, {
        type: 'doughnut',
        data: { labels, datasets: [{ label: 'Net Growth (₹)', data, backgroundColor: colors.slice(0, labels.length), hoverOffset: 4 }] },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Net Growth by Product Category (Top Performers)', font: { size: 16 } },
                tooltip: {
                    callbacks: {
                        label(ctx) {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(2) + '%' : '0%';
                            return `₹${formatIndianNumber(ctx.parsed)} (${pct})`;
                        }
                    }
                }
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', init);

// Expose for inline onclick
window.generateStudy = generateStudy;
window.toggleBehaviourCard = toggleBehaviourCard;
