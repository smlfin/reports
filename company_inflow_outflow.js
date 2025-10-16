// company_inflow_outflow.js

// --- Configuration ---
const csvUrl = 'https://docs.google.com/spreadsheets/d/1jYlHO8x40Ygbn05DL3tMZ5wHuoZgPjk2fbtEGoDXzko/export?format=csv&gid=1720680457';

// --- Global Data Storage ---
let allData = []; // Stores all parsed CSV rows
let headers = []; // Stores CSV headers
let allCompanyNames = []; // Stores all unique company names for search functionality

// --- Fixed Date Range for Data Validity (April 2025 to Current Month) ---
const dataStartDate = new Date('2025-04-01T00:00:00'); // April 1, 2025, 00:00:00 local time
const currentDate = new Date(); // Current date and time
const dataEndDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59); // End of the current month

// --- DOM Elements ---
const monthSelect = document.getElementById('month-select');
const companySearchInput = document.getElementById('company-search');
const companySelect = document.getElementById('company-select');
const viewDetailedEntriesBtn = document.getElementById('view-detailed-entries-btn');

const overallTotalInflowEl = document.getElementById('overall-total-inflow');
const overallTotalOutflowEl = document.getElementById('overall-total-outflow');
const overallTotalNetEl = document.getElementById('overall-total-net');
const detailedTableBody = document.getElementById('detailed-table-body');

// --- Helper Functions ---

/**
 * Robustly parses an Indian-formatted number string to a float.
 * Handles commas, parentheses for negatives, and trailing hyphens.
 * @param {string|number} value - The input value.
 * @returns {number} The parsed number.
 */
function parseNumericalValue(value) {
    if (value === null || value === undefined) return 0;
    let str = String(value).trim();
    if (str === '') return 0;

    let isNegative = false;
    if (str.startsWith('(') && str.endsWith(')')) {
        str = str.slice(1, -1);
        isNegative = true;
    } else if (str.endsWith('-')) {
        str = str.slice(0, -1);
        isNegative = true;
    }

    str = str.replace(/,/g, '');
    let num = parseFloat(str);

    if (isNaN(num)) return 0;
    return isNegative ? -num : num;
}

/**
 * Formats a number into Indian Lakh/Crore format (e.g., '1,23,456').
 * @param {number} num - The number to format.
 * @returns {string} The formatted string.
 */
function formatIndianNumber(num) {
    if (isNaN(num)) return '';
    const parts = Math.abs(num).toFixed(2).split('.');
    let integerPart = parts[0];
    const decimalPart = parts[1] ? '.' + parts[1] : '';

    if (integerPart.length > 3) {
        let lastThree = integerPart.substring(integerPart.length - 3);
        let otherNumbers = integerPart.substring(0, integerPart.length - 3);
        integerPart = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree;
    }

    const sign = num < 0 ? '-' : '';
    return sign + integerPart + decimalPart;
}

/**
 * Extracts and returns the month/year string (e.g., "October 2025") from a Date object.
 * @param {Date} date - The date object.
 * @returns {string} The month/year string.
 */
function getMonthYear(date) {
    return date.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

/**
 * Generates a unique key for a row based on core transaction columns to identify duplicates.
 * @param {object} row - The data row.
 * @returns {string} A unique key for the row.
 */
function generateUniqueKey(row) {
    // Columns that define a unique transaction. Adjust if other columns are more relevant.
    const keyColumns = [
        'DATE', 'CUSTOMER NAME', 'STAFF NAME', 'COMPANY NAME', 
        'INF Total', 'OUT Total', 'Net'
    ];
    
    // Create a string by concatenating the values of the key columns
    return keyColumns.map(col => String(row[col])).join('|');
}

/**
 * Removes duplicate rows from the data array. This is the crucial fix.
 * @param {Array<object>} data - The raw data array.
 * @returns {Array<object>} The deduplicated data array.
 */
function deduplicateData(data) {
    const uniqueKeys = new Set();
    const uniqueData = [];
    
    for (const row of data) {
        const key = generateUniqueKey(row);
        if (!uniqueKeys.has(key)) {
            uniqueKeys.add(key);
            uniqueData.push(row);
        }
    }
    
    console.log(`Deduplication: Reduced ${data.length} records to ${uniqueData.length} unique records.`);
    return uniqueData;
}


// --- Data Fetching and Initialization ---

/**
 * Fetches the CSV data and initializes the application.
 */
function fetchCSVData() {
    // Using a proxy or CORS-enabled fetching mechanism for live deployment
    fetch(csvUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.text();
        })
        .then(csvText => {
            const parsedData = Papa.parse(csvText, { header: true, skipEmptyLines: true });
            
            headers = parsedData.meta.fields.map(h => h.trim());
            
            // 1. Map data to objects and clean up headers and parse dates
            let rawData = parsedData.data.map(row => {
                const newRow = {};
                Object.keys(row).forEach(key => {
                    // Clean up header names (remove leading/trailing spaces)
                    newRow[key.trim()] = row[key];
                });
                // Parse date string into Date object
                if (newRow['DATE']) {
                    const parts = newRow['DATE'].split('-'); // Assuming DD-MM-YYYY format
                    // new Date(year, monthIndex, day)
                    newRow['DATE'] = new Date(parts[2], parts[1] - 1, parts[0]);
                }
                return newRow;
            });

            // 2. Filter out records outside the valid date range
            rawData = rawData.filter(row => {
                return row.DATE && row.DATE >= dataStartDate && row.DATE <= dataEndDate;
            });
            
            // 3. --- NEW CRITICAL STEP: DEDUPLICATE THE DATA ---
            allData = deduplicateData(rawData);
            
            initializeMonthSelector();
            initializeCompanySearch();
            generateReport(); // Initial report generation
        })
        .catch(error => {
            console.error('There was a problem with the fetch operation:', error);
            // Optionally, update the UI to show an error message
        });
}

// ... rest of the code is unchanged ...


// --- Report Generation and UI Logic (Unchanged) ---

/**
 * Populates the month selection dropdown based on available data.
 */
function initializeMonthSelector() {
    const availableMonths = new Set();
    allData.forEach(row => {
        if (row.DATE) {
            availableMonths.add(getMonthYear(row.DATE));
        }
    });

    // Clear existing options
    monthSelect.innerHTML = '';
    
    // Create an "All Months" option
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All Months';
    monthSelect.appendChild(allOption);

    // Populate with available months, sorting them
    const sortedMonths = Array.from(availableMonths).map(monthYearStr => {
        const parts = monthYearStr.split(' ');
        const monthIndex = new Date(Date.parse(parts[0] + " 1, " + parts[1])).getMonth();
        const year = parseInt(parts[1]);
        return { str: monthYearStr, sortValue: year * 100 + monthIndex };
    }).sort((a, b) => b.sortValue - a.sortValue); // Sort in descending order (most recent first)

    sortedMonths.forEach(month => {
        const option = document.createElement('option');
        option.value = month.str;
        option.textContent = month.str;
        monthSelect.appendChild(option);
    });
}

/**
 * Initializes the list of unique company names for search.
 */
function initializeCompanySearch() {
    const uniqueCompanyNames = new Set();
    allData.forEach(row => {
        if (row['COMPANY NAME']) {
            uniqueCompanyNames.add(row['COMPANY NAME'].trim());
        }
    });
    allCompanyNames = Array.from(uniqueCompanyNames).sort();

    // The actual select/datalist population and filtering is handled by filterCompanyList and the input event listener.
    // Ensure the datalist is cleared and repopulated if it's not being handled by the input event.
    // Assuming the companySearchInput and companySelect logic is to allow searching/filtering.
    // For simplicity, we just store the list here and let filterCompanyList handle the UI element.
    // We will ensure the initial list for the select element is populated.
    
    // Clear existing options in the visible select element
    companySelect.innerHTML = '';
    const allCompaniesOption = document.createElement('option');
    allCompaniesOption.value = 'all';
    allCompaniesOption.textContent = 'All Companies';
    companySelect.appendChild(allCompaniesOption);
    
    allCompanyNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        companySelect.appendChild(option);
    });
}

/**
 * Filters the visible list of companies based on user input.
 */
function filterCompanyList() {
    // This function is for the search input's filtering effect, often for a datalist or similar dynamic filtering.
    // Since we have both a search input and a select, we'll focus on filtering the select dropdown for the user.
    const searchValue = companySearchInput.value.toLowerCase();
    
    // Simple implementation for the 'select' dropdown:
    // This should ideally apply to a dynamically generated list or datalist.
    // For the <select> element, we will reset the options and only show matches.
    
    companySelect.innerHTML = '';
    
    // Add 'All Companies' option first
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All Companies';
    companySelect.appendChild(allOption);
    
    allCompanyNames.forEach(name => {
        if (name.toLowerCase().includes(searchValue)) {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            companySelect.appendChild(option);
        }
    });
    
    // If the select box has a change listener, call generateReport() to update the main report.
    // Since we only updated the list of options, we don't call generateReport here. The user must select an option.
}


/**
 * Generates and displays the report based on selected filters.
 */
function generateReport() {
    const selectedMonth = monthSelect.value;
    const selectedCompany = companySelect.value;

    let filteredData = allData.filter(row => {
        // Filter by Month
        const monthMatch = selectedMonth === 'all' || (row.DATE && getMonthYear(row.DATE) === selectedMonth);
        
        // Filter by Company
        const companyMatch = selectedCompany === 'all' || (row['COMPANY NAME'] && row['COMPANY NAME'].trim() === selectedCompany);
        
        return monthMatch && companyMatch;
    });

    // Calculate Totals
    let totalInflow = 0;
    let totalOutflow = 0;
    let totalNet = 0;

    // Numerical headers for parsing
    const numericalHeaders = [
        'SML NCD INF', 'SML SD INF', 'SML GB INF', 'SML BDSL', 'VFL NCD INF', 'VFL SD INF', 'VFL GB INF',
        'SNL FD INF', 'LLP INF', 'INF Total', 'SNL FD OUT', 'VFL NCD OUT', 'VFL BD OUT', 'VFL GB OUT', 'SML PURCHASE',
        'SML NCD OUT', 'SML SD OUT', 'SML GB OUT', 'LLP OUT', 'OUT Total', 'Net'
    ];

    filteredData.forEach(row => {
        const infTotal = parseNumericalValue(row['INF Total']);
        const outTotal = parseNumericalValue(row['OUT Total']);
        const net = parseNumericalValue(row['Net']);

        totalInflow += infTotal;
        totalOutflow += outTotal;
        totalNet += net;
    });

    // Update Overall Totals UI
    overallTotalInflowEl.textContent = formatIndianNumber(totalInflow);
    overallTotalOutflowEl.textContent = formatIndianNumber(totalOutflow);
    overallTotalNetEl.textContent = formatIndianNumber(totalNet);

    // Store filtered data for detailed view
    // Assuming a global variable like 'currentFilteredData' might be used for the detailed view logic.
    // For this example, we'll store it in a way that the viewDetailedEntries function can access it.
    window.currentFilteredData = filteredData;
    
    console.log(`Report generated for ${selectedMonth} / ${selectedCompany}. Records: ${filteredData.length}. Net: ${totalNet}`);
}

/**
 * Shows the detailed table of filtered entries.
 */
function viewDetailedEntries() {
    const dataToShow = window.currentFilteredData || []; // Use the data from the last report generation

    // Clear previous entries
    detailedTableBody.innerHTML = '';
    
    // Prepare the headers for the detailed table display (using all headers)
    const displayHeaders = headers.filter(h => h && h.trim() !== '');
    
    // Create the table header row if it's not permanently in the HTML
    const tableEl = detailedTableBody.parentElement.parentElement;
    let thead = tableEl.querySelector('thead');
    if (!thead) {
        thead = tableEl.createTHead();
    }
    thead.innerHTML = '';
    const headerRow = thead.insertRow();
    displayHeaders.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });

    // Numerical headers list (redefined here for scope)
    const numericalHeaders = [
        'SML NCD INF', 'SML SD INF', 'SML GB INF', 'SML BDSL', 'VFL NCD INF', 'VFL SD INF', 'VFL GB INF',
        'SNL FD INF', 'LLP INF', 'INF Total', 'SNL FD OUT', 'VFL NCD OUT', 'VFL BD OUT', 'VFL GB OUT', 'SML PURCHASE',
        'SML NCD OUT', 'SML SD OUT', 'SML GB OUT', 'LLP OUT', 'OUT Total', 'Net'
    ];

    // Populate the table body
    dataToShow.forEach(row => {
        const tr = detailedTableBody.insertRow();
        
        displayHeaders.forEach(header => {
            const td = tr.insertCell();
            let content = row[header];
            
            if (header === 'DATE' && content instanceof Date) {
                // Display date in DD/MM/YYYY format
                content = content.toLocaleDateString('en-IN');
            }
            else {
                // Apply formatting for numerical columns
                if (numericalHeaders.includes(header)) {
                    const numValue = parseNumericalValue(content);
                    if (!isNaN(numValue)) {
                        content = formatIndianNumber(numValue);
                    }
                }
            }
            td.textContent = content;
        });
    });
    
    // The previous implementation was slightly different, mapping rowData.
    // This revised version directly iterates over the displayHeaders for robustness.
}


// --- Event Listeners ---
monthSelect.addEventListener('change', generateReport);
companySelect.addEventListener('change', generateReport);
companySearchInput.addEventListener('input', filterCompanyList);
viewDetailedEntriesBtn.addEventListener('click', viewDetailedEntries);

// --- Initialize the report when the page loads ---
fetchCSVData();
