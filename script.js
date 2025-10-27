<<<<<<< HEAD
const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1OOdGnJhw1k6U15Aybn_2JWex_qTShP6w7CXm0_auXnc8vFnvlabPZjK3lsjqkHgn6NgeKKPyu9qW/pub?gid=1720680457&single=true&output=csv';
const tableContainer = document.getElementById('table-container');

async function fetchCsvData() {
    try {
        const response = await fetch(csvUrl);
        const csvText = await response.text();
        parseCsv(csvText);
    } catch (error) {
        console.error('Error fetching CSV data:', error);
        tableContainer.innerHTML = '<p>Failed to load data. Please try again later.</p>';
    }
}

// Function to format numbers in Indian style (xx,xx,xxx)
function formatIndianNumber(num) {
    if (isNaN(num) || num === null) {
        return num; // Return as is if not a number or null
    }

    // Convert to string and split into integer and decimal parts
    let parts = num.toString().split('.');
    let integerPart = parts[0];
    let decimalPart = parts.length > 1 ? '.' + parts[1] : '';

    // Handle negative numbers
    let sign = '';
    if (integerPart.startsWith('-')) {
        sign = '-';
        integerPart = integerPart.substring(1);
    }

    // Format the integer part with Indian commas
    if (integerPart.length <= 3) {
        return sign + integerPart + decimalPart;
    }

    let lastThree = integerPart.substring(integerPart.length - 3);
    let otherNumbers = integerPart.substring(0, integerPart.length - 3);

    // Add commas to the 'otherNumbers' part (groups of two digits)
    otherNumbers = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',');

    return sign + otherNumbers + ',' + lastThree + decimalPart;
}


function parseCsv(csvText) {
    const rows = csvText.trim().split('\n');
    if (rows.length === 0) {
        tableContainer.innerHTML = '<p>No data available.</p>';
        return;
    }

    // Basic CSV line parser that handles quoted fields and escaped quotes
    const parseLine = (line) => {
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
    };

    const headers = parseLine(rows[0]);
    const dataRows = rows.slice(1);

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    // Create table header
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create table body
    dataRows.forEach(rowData => {
        const cells = parseLine(rowData);
        const tr = document.createElement('tr');
        for (let i = 0; i < headers.length; i++) {
            const td = document.createElement('td');
            let cellContent = cells[i] !== undefined ? cells[i].trim() : '';

            // Attempt to convert to number and apply Indian formatting
            // Remove any existing commas from the string before parsing to ensure correct number conversion
            const numValue = parseFloat(cellContent.replace(/,/g, ''));

            if (!isNaN(numValue)) {
                td.textContent = formatIndianNumber(numValue);
            } else {
                td.textContent = cellContent; // Display as is if not a number
            }
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    tableContainer.innerHTML = '';
    tableContainer.appendChild(table);
}

// Call the function to fetch data when the page loads
fetchCsvData();
=======
const csvUrl = 'https://docs.google.com/spreadsheets/d/1jYlHO8x40Ygbn05DL3tMZ5wHuoZgPjk2fbtEGoDXzko/export?format=csv&gid=1720680457';
const tableContainer = document.getElementById('table-container');

async function fetchCsvData() {
    try {
        const response = await fetch(csvUrl);
        const csvText = await response.text();
        parseCsv(csvText);
    } catch (error) {
        console.error('Error fetching CSV data:', error);
        tableContainer.innerHTML = '<p>Failed to load data. Please try again later.</p>';
    }
}

// Function to format numbers in Indian style (xx,xx,xxx)
function formatIndianNumber(num) {
    if (isNaN(num) || num === null) {
        return num; // Return as is if not a number or null
    }

    // Convert to string and split into integer and decimal parts
    let parts = num.toString().split('.');
    let integerPart = parts[0];
    let decimalPart = parts.length > 1 ? '.' + parts[1] : '';

    // Handle negative numbers
    let sign = '';
    if (integerPart.startsWith('-')) {
        sign = '-';
        integerPart = integerPart.substring(1);
    }

    // Format the integer part with Indian commas
    if (integerPart.length <= 3) {
        return sign + integerPart + decimalPart;
    }

    let lastThree = integerPart.substring(integerPart.length - 3);
    let otherNumbers = integerPart.substring(0, integerPart.length - 3);

    // Add commas to the 'otherNumbers' part (groups of two digits)
    otherNumbers = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',');

    return sign + otherNumbers + ',' + lastThree + decimalPart;
}


function parseCsv(csvText) {
    const rows = csvText.trim().split('\n');
    if (rows.length === 0) {
        tableContainer.innerHTML = '<p>No data available.</p>';
        return;
    }

    // Basic CSV line parser that handles quoted fields and escaped quotes
    const parseLine = (line) => {
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
    };

    const headers = parseLine(rows[0]);
    const dataRows = rows.slice(1);

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    // Create table header
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create table body
    dataRows.forEach(rowData => {
        const cells = parseLine(rowData);
        const tr = document.createElement('tr');
        for (let i = 0; i < headers.length; i++) {
            const td = document.createElement('td');
            let cellContent = cells[i] !== undefined ? cells[i].trim() : '';

            // Attempt to convert to number and apply Indian formatting
            // Remove any existing commas from the string before parsing to ensure correct number conversion
            const numValue = parseFloat(cellContent.replace(/,/g, ''));

            if (!isNaN(numValue)) {
                td.textContent = formatIndianNumber(numValue);
            } else {
                td.textContent = cellContent; // Display as is if not a number
            }
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    tableContainer.innerHTML = '';
    tableContainer.appendChild(table);
}

// Call the function to fetch data when the page loads

fetchCsvData();
>>>>>>> 97062f67d6053ee66819e93d876f785ba5b20e00
