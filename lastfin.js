const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRVBKJCF9DuJyGnYE_5syIJc3c0Lb4-jWo-CVwIp4ukSUlUdxaHR4FVD8ca_bUUlS4FaFlXVSLP7icY/pub?gid=0&single=true&output=csv';

let allData = []; // Full dataset (individual entries)
let aggregatedData = {}; // Grouped data (Month/Company summaries)

const summaryTableBody = document.querySelector('#summary-table tbody');
const companyFilter = document.getElementById('company-filter');
const monthFilter = document.getElementById('month-filter');
const grandInflowSpan = document.getElementById('grand-inflow');
const grandOutflowSpan = document.getElementById('grand-outflow');
const grandNetTotalSpan = document.getElementById('grand-net-total');

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
];

// Helper function to format numbers without currency or decimals
function formatNumber(num) {
    const roundedNum = Math.round(num); 
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(roundedNum);
}

// Function to safely parse a date and return "Month YYYY" string
function getMonthYear(dateString) {
    if (!dateString) return 'Invalid Date';

    // Normalize the string: uppercase, replace separators with space, collapse spaces
    const normalizedString = dateString.toUpperCase()
        .replace(/[\.\-\/\,]+/g, ' ') 
        .replace(/\s+/g, ' ') 
        .trim();
    
    let monthIndex = -1;
    let year = '';
    
    // --- Attempt 1: Find Month Name and 4-digit Year together ---
    let match = normalizedString.match(/([A-Z]{3,})\s+(\d{4})/);
    
    if (match && match.length === 3) {
        year = match[2];
        const monthPart = match[1];
        
        for (let i = 0; i < MONTH_NAMES.length; i++) {
            if (MONTH_NAMES[i].toUpperCase().startsWith(monthPart)) {
                monthIndex = i;
                break;
            }
        }
    } 
    
    // --- Attempt 2: Try to find the month name only (handles 'APRIL' or 'MAY') ---
    if (monthIndex === -1) {
        match = normalizedString.match(/([A-Z]{3,})/);
        if (match && match.length > 1) {
            const monthPart = match[1];

            for (let i = 0; i < MONTH_NAMES.length; i++) {
                if (MONTH_NAMES[i].toUpperCase().startsWith(monthPart)) {
                    monthIndex = i;
                    break;
                }
            }
            
            // If month found, and a year was not found in Attempt 1, infer the year.
            if (monthIndex !== -1) {
                // If the month is Jan, Feb, Mar (0, 1, 2) it's likely 2025. Otherwise, it's 2024.
                year = (monthIndex <= 2) ? '2025' : '2024'; 
            }
        }
    }

    // --- Attempt 3: Check for numeric date formats (e.g., 01/01/2025) ---
    if (monthIndex === -1 || !year) {
        const dateParts = dateString.split(/[\/\- ]/).filter(Boolean);
        if (dateParts.length === 3) {
            // Priority: DD/MM/YYYY 
            let tempMonthIndex = parseInt(dateParts[1]) - 1; 
            let tempYear = parseInt(dateParts[2]).toString();

            if (tempMonthIndex >= 0 && tempMonthIndex <= 11 && tempYear.length === 4) {
                monthIndex = tempMonthIndex;
                year = tempYear;
            }
        }
    }

    if (monthIndex !== -1 && year) {
        return `${MONTH_NAMES[monthIndex]} ${year}`;
    }
    
    return 'Invalid Date';
}


// Function to aggregate data by Month and Company
function aggregateData(data) {
    const aggregation = {};
    const companySet = new Set();
    const monthSet = new Set();

    data.forEach(row => {
        const monthYear = getMonthYear(row['DATE_COL']);
        const company = row['COMPANY_COL'] ? row['COMPANY_COL'].trim() : 'N/A';
        
        if (monthYear === 'Invalid Date') {
            return;
        }

        const key = `${monthYear}::${company}`;
        
        companySet.add(company);
        monthSet.add(monthYear);

        if (!aggregation[key]) {
            aggregation[key] = {
                'Month': monthYear,
                'Company Name': company,
                'Total Inflow': 0,
                'Total Outflow': 0,
                'NET': 0
            };
        }

        aggregation[key]['Total Inflow'] += row['INFLOW_COL'];
        aggregation[key]['Total Outflow'] += row['OUTFLOW_COL'];
        aggregation[key]['NET'] += row['NET_COL'];
    });

    // Sort the month names correctly (by date value, not alphabetically)
    const sortedMonths = [...monthSet].sort((a, b) => {
        const dateA = new Date(a.replace(' ', ' 1, '));
        const dateB = new Date(b.replace(' ', ' 1, '));
        return dateA - dateB;
    });

    // Populate filters
    populateFilters([...companySet].filter(Boolean).sort(), sortedMonths);
    
    return aggregation;
}

// Function to populate the Company Name and Month dropdown filters
function populateFilters(companies, months) {
    // Populate Company Filter
    companyFilter.innerHTML = '<option value="">All Companies</option>';
    companies.forEach(company => {
        const option = document.createElement('option');
        option.value = company;
        option.textContent = company;
        companyFilter.appendChild(option);
    });
    
    // Populate Month Filter
    monthFilter.innerHTML = '<option value="">All Months</option>';
    months.forEach(month => {
        const option = document.createElement('option');
        option.value = month;
        option.textContent = month;
        monthFilter.appendChild(option);
    });
}


// New function to normalize a header string for reliable comparison
function normalizeHeader(header) {
    return header.replace(/\s/g, '').toUpperCase().trim();
}

// Function to parse CSV data
function parseCSV(csv) {
    const lines = csv.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const normalizedCsvHeaders = headers.map(h => normalizeHeader(h));
    const data = [];
    
    // Define the required internal keys and their simplified target names
    const requiredHeaders = [
        { key: 'INFLOW_COL', target: normalizeHeader('Total Inflow') },
        { key: 'OUTFLOW_COL', target: normalizeHeader('Total Outflow') },
        { key: 'NET_COL', target: normalizeHeader('NET') },
        { key: 'DATE_COL', target: normalizeHeader('DATE') }, 
        { key: 'COMPANY_COL', target: normalizeHeader('COMPANY NAME') } 
    ];

    // 1. Map internal keys to the actual column index in the CSV
    const headerIndexMap = {};
    let missingCriticalHeader = false;

    requiredHeaders.forEach(req => {
        let index = normalizedCsvHeaders.indexOf(req.target);
        
        if (index === -1) {
            if (req.key === 'DATE_COL') {
                 index = normalizedCsvHeaders.indexOf(normalizeHeader('Date'));
            } else if (req.key === 'COMPANY_COL') {
                 index = normalizedCsvHeaders.indexOf(normalizeHeader('Company Name'));
            }
        }
        
        headerIndexMap[req.key] = index;

        if (index === -1 && (req.key === 'INFLOW_COL' || req.key === 'OUTFLOW_COL' || req.key === 'NET_COL' || req.key === 'DATE_COL')) {
            missingCriticalHeader = true; 
        }
    });

    if (missingCriticalHeader) {
        console.error("Missing critical headers. Actual CSV headers:", headers);
        alert("Data loading failed: CSV is missing one or more required financial columns (Total Inflow, Total Outflow, NET or Date). Please check capitalization and spaces in your CSV file.");
        return [];
    }

    // 2. Parse the data lines
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(','); 
        const row = {};

        if (values.length < headers.length) continue; 

        // 🟢 FINAL CLEANING LOGIC: Highly robust helper to clean up value string for numeric parsing
        const cleanValue = (val) => {
            let cleaned = (val || '').replace(/"/g, '').trim();
            
            if (cleaned === '') return '0';

            // Step 1: Detect negative numbers in parentheses: (12345)
            const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')');
            
            // Step 2: Aggressively remove currency symbols, spaces, and percent signs
            cleaned = cleaned.replace(/[$\u20AC\u00A3\u20B9\%]/g, ''); // Remove $ € £ ₹ %
            cleaned = cleaned.replace(/\s/g, ''); // Remove all spaces
            
            // Step 3: Handle the decimal/thousands separator conflict (Assuming US/UK format: comma is thousands, period is decimal)
            // Remove ALL commas (thousands separator)
            cleaned = cleaned.replace(/,/g, '');
            
            // If the number was negative (parentheses), remove the parentheses and prepend '-'
            if (isNegative) {
                cleaned = cleaned.slice(1, -1);
                return '-' + cleaned;
            }

            // If it was already negative (e.g., -12345), just return the cleaned string
            return cleaned;
        };
        

        // Extract values using the fixed index mapping and clean them
        row['INFLOW_COL'] = parseFloat(cleanValue(values[headerIndexMap['INFLOW_COL']])) || 0;
        row['OUTFLOW_COL'] = parseFloat(cleanValue(values[headerIndexMap['OUTFLOW_COL']])) || 0;
        row['NET_COL'] = parseFloat(cleanValue(values[headerIndexMap['NET_COL']])) || 0;
        
        row['DATE_COL'] = (values[headerIndexMap['DATE_COL']] || '').replace(/"/g, '');
        row['COMPANY_COL'] = headerIndexMap['COMPANY_COL'] !== -1 
                             ? ((values[headerIndexMap['COMPANY_COL']] || '').replace(/"/g, ''))
                             : 'N/A';
        
        data.push(row);
    }
    return data;
}

// Function to fetch and start the application
async function fetchData() {
    try {
        const response = await fetch(CSV_URL);
        const csvText = await response.text();
        allData = parseCSV(csvText);
        
        if (allData.length > 0) {
            aggregatedData = aggregateData(allData);
            filterData();
        }
    } catch (error) {
        console.error('Error fetching or parsing CSV:', error);
        alert('Failed to load data. Please check the console for details.');
    }
}


// Function to filter and display the aggregated data
window.filterData = function() {
    const selectedCompany = companyFilter.value;
    const selectedMonth = monthFilter.value;
    
    const dataArray = Object.values(aggregatedData);

    const filteredData = dataArray.filter(item => {
        const companyMatch = !selectedCompany || item['Company Name'] === selectedCompany;
        const monthMatch = !selectedMonth || item['Month'] === selectedMonth;

        return companyMatch && monthMatch;
    });

    renderTable(filteredData);
    updateGrandTotals(filteredData);
};

// Function to render the aggregated data in the HTML table
function renderTable(data) { 
    summaryTableBody.innerHTML = ''; 

    if (data.length === 0) {
        summaryTableBody.innerHTML = '<tr><td colspan="5">No summary data found matching the filters.</td></tr>';
        return;
    }

    data.forEach(row => {
        const tr = document.createElement('tr');
        
        const headersOrder = ['Month', 'Company Name', 'Total Inflow', 'Total Outflow', 'NET'];

        headersOrder.forEach(header => {
            const td = document.createElement('td');
            let value = row[header];
            
            // Format numeric fields
            if (['Total Inflow', 'Total Outflow', 'NET'].includes(header)) {
                td.classList.add('numeric');
                value = formatNumber(value);
            }
            
            td.textContent = value;
            tr.appendChild(td);
        });
        
        summaryTableBody.appendChild(tr);
    });
}

// Function to calculate and update the grand totals
function updateGrandTotals(data) {
    const totalInflow = data.reduce((sum, row) => sum + row['Total Inflow'], 0);
    const totalOutflow = data.reduce((sum, row) => sum + row['Total Outflow'], 0);
    const netTotal = data.reduce((sum, row) => sum + row['NET'], 0);

    grandInflowSpan.textContent = formatNumber(totalInflow);
    grandOutflowSpan.textContent = formatNumber(totalOutflow);
    grandNetTotalSpan.textContent = formatNumber(netTotal);

    // Style Net Total based on value
    grandNetTotalSpan.style.color = netTotal >= 0 ? '#108000' : '#cc0000'; // Green or Red
}

// Reset function
window.resetFilters = function() {
    companyFilter.value = '';
    monthFilter.value = '';
    filterData();
}

// Initial call to start the application
fetchData();