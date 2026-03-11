// script.js
// --- StockScraper Client-Side Logic ---

// ----------------------------------------------------
// 1. UNIVERSAL DOM ELEMENTS AND INITIALIZATION
// ----------------------------------------------------
const themeToggle = document.getElementById('themeToggle');

// Initialize theme from local storage or default to 'light'
let currentTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', currentTheme);
updateThemeIcon();

// Global variable to hold last fetched data for theme switching/refresh
window.lastStockData = null; 

// ----------------------------------------------------
// 2. THEME MANAGEMENT LOGIC (Universal)
// ----------------------------------------------------

/**
 * Toggles the current theme between light and dark.
 */
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        currentTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        // Apply theme to the document and save to storage
        document.documentElement.setAttribute('data-theme', currentTheme);
        localStorage.setItem('theme', currentTheme);
        
        updateThemeIcon();
        
        // Re-render the chart if on the main dashboard and data is available 
        if (window.lastStockData && typeof renderChart === 'function') {
            // Re-render with the last fetched data
            renderChart(window.lastStockData);
        }
    });
}

/**
 * Updates the theme toggle icon.
 */
function updateThemeIcon() {
    if (themeToggle) {
        themeToggle.textContent = currentTheme === 'light' ? '🌙' : '☀';
    }
}


// ----------------------------------------------------
// 3. ANALYTICS DASHBOARD LOGIC (main_dashboard.html)
// ----------------------------------------------------

/**
 * Sets up all event listeners for the Analytics Dashboard page.
 */
function setupAnalyticsDashboard() {
    const loadDataBtn = document.getElementById('loadDataBtn');
    if (loadDataBtn) {
        loadDataBtn.addEventListener('click', fetchStockData);
    }
}

/**
 * Fetches stock data from the backend API.
 */
async function fetchStockData() {
    const stockSelect = document.getElementById('stockSelect');
    const tickerSearch = document.getElementById('tickerSearch');
    const chartTypeSelect = document.getElementById('chartType');
    const timePeriodSelect = document.getElementById('timePeriodSelect'); 
    
    const stockChartDiv = document.getElementById('stockChart');
    const stockDetailsDiv = document.getElementById('stockDetails');
    const fundamentalDetailsDiv = document.getElementById('fundamentalDetails');

    // Show loading placeholders
    stockChartDiv.innerHTML = `<p id="chartPlaceholder" class="loading-placeholder">Fetching chart details...</p>`;
    stockDetailsDiv.innerHTML = `<p class="loading-placeholder">Loading market intelligence...</p>`;
    fundamentalDetailsDiv.innerHTML = `<p class="loading-placeholder">Loading fundamental data...</p>`;

    // Determine the ticker
    let ticker = tickerSearch.value.trim().toUpperCase();
    if (!ticker && stockSelect) {
        ticker = stockSelect.value;
    }
    
    if (!ticker) {
        displayError('Please select a stock or enter a ticker symbol.');
        return;
    }

    const chartType = chartTypeSelect.value;
    const period = timePeriodSelect.value; 

    try {
        const response = await fetch('/get_stock_data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                ticker: ticker, 
                chart_type: chartType,
                period: period 
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Failed to fetch data.');
        }

        // Save data for theme switching
        window.lastStockData = result.data;

        // Render all components with the new data
        renderChart(result.data);
        updateStockDetails(result.data.market_intelligence);
        updateFundamentalDetails(result.data.fundamental_data);

    } catch (e) {
        console.error("Error fetching stock data:", e);
        displayError(e.message);
    }
}

/**
 * Renders the Plotly chart.
 * @param {object} data - The entire data object from the API (contains chart_data, chart_type, period).
 */
function renderChart(data) {
    const stockChartDiv = document.getElementById('stockChart');
    const chartTitle = document.getElementById('chartTitle');

    // Clear any placeholders
    stockChartDiv.innerHTML = '';
    
    const { chart_data, chart_type, period } = data;
    const plotData = [];
    
    // Determine theme colors
    const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDarkTheme ? '#374151' : '#e5e7eb'; 
    const textColor = isDarkTheme ? '#d1d5db' : '#374151';
    const bgColor = isDarkTheme ? '#1f2937' : '#ffffff';  
    const successColor = isDarkTheme ? '#34d399' : '#10b981';
    const dangerColor = isDarkTheme ? '#f87171' : '#ef4444'; 
    const areaFillColor = isDarkTheme ? 'rgba(129, 140, 248, 0.2)' : 'rgba(79, 70, 229, 0.1)'; 
    const areaLineColor = isDarkTheme ? '#818cf8' : '#4f46e5'; 

    const periodMap = { '1y': '1 Year', '6mo': '6 Month', '3mo': '3 Month', '1mo': '1 Month', '5d': '5 Day' };
    chartTitle.textContent = `${periodMap[period] || ''} Price Analysis`;

    const baseLayout = {
        xaxis: { 
            title: 'Date',
            gridcolor: gridColor,
            linecolor: gridColor,
            zerolinecolor: gridColor,
            font: { color: textColor },
            rangeslider: { visible: false } 
        },
        yaxis: { 
            title: 'Price (INR)',
            gridcolor: gridColor,
            linecolor: gridColor,
            zerolinecolor: gridColor,
            font: { color: textColor },
            autorange: true 
        },
        plot_bgcolor: bgColor,
        paper_bgcolor: bgColor,
        margin: { l: 60, r: 20, t: 10, b: 50 }, 
        autosize: true
    };
    
    let layout = { ...baseLayout };

    if (chart_type === 'candlestick') {
        plotData.push({
            x: chart_data.dates,
            open: chart_data.opens,
            high: chart_data.highs,
            low: chart_data.lows,
            close: chart_data.closes,
            type: 'candlestick',
            increasing: { line: { color: successColor } },
            decreasing: { line: { color: dangerColor } },
            name: 'Price'
        });
        layout.xaxis.rangeslider = { 
            visible: true, 
            bgcolor: isDarkTheme ? '#0f172a' : '#f3f4f6',
            bordercolor: gridColor,
            thickness: 0.15
        };
        
    } else if (chart_type === 'area') { 
        plotData.push({
            x: chart_data.dates,
            y: chart_data.closes,
            type: 'scatter',
            mode: 'lines',
            fill: 'tozeroy', 
            fillcolor: areaFillColor,
            line: { color: areaLineColor },
            name: 'Close Price'
        });
        
    } else { 
        plotData.push({
            x: chart_data.dates,
            y: chart_data.closes,
            type: 'scatter',
            mode: 'lines',
            line: { color: areaLineColor }, 
            name: 'Close Price'
        });
    }

    Plotly.newPlot(stockChartDiv, plotData, layout, {responsive: true});
}

/**
 * Populates the Market Intelligence card.
 * @param {object} details - The market intelligence data from the API.
 */
function updateStockDetails(details) {
    const stockDetailsDiv = document.getElementById('stockDetails');
    
    let changeClass = 'trend-neutral';
    const changeNum = parseFloat(details["Change %"]);
    if (changeNum > 0) {
        changeClass = 'trend-up';
    } else if (changeNum < 0) {
        changeClass = 'trend-down';
    }

    stockDetailsDiv.innerHTML = `
        <div class="detail-grid">
            <div class="detail-item">
                <span class="detail-label">Current Price</span>
                <span class="detail-value" style="font-size: 1.25rem; font-weight: 600;">${details["Current Price"]}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Change</span>
                <span class="detail-value ${changeClass}">${details["Change"]} (${details["Change %"]})</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Day High</span>
                <span class="detail-value">${details["Day High"]}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Day Low</span>
                <span class="detail-value">${details["Day Low"]}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">52 Week High</span>
                <span class="detail-value">${details["52 Week High"]}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">52 Week Low</span>
                <span class="detail-value">${details["52 Week Low"]}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Volume</span>
                <span class="detail-value">${details["Volume"]}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Previous Close</span>
                <span class="detail-value">${details["Previous Close"]}</span>
            </div>
        </div>
    `;
}

/**
 * Populates the Fundamental Data card.
 * @param {object} details - The fundamental data from the API.
 */
function updateFundamentalDetails(details) {
    const fundamentalDetailsDiv = document.getElementById('fundamentalDetails');
    
    fundamentalDetailsDiv.innerHTML = '';
    
    const orderedKeys = [
        "Stock", "Industry", "Base Country", "CMP Rs.", "P/E Ratio", "Mar Cap Rs. Cr.",
        "Div Yld %", "NP Qtr Rs. Cr.", "Qtr Profit Var %", "Sales Qtr Rs. Cr.",
        "Qtr Sales Var %", "ROCE %"
    ];

    orderedKeys.forEach(key => {
        const value = details[key] !== undefined ? details[key] : 'N/A';
        const row = document.createElement('div');
        row.className = 'detail-row';
        row.innerHTML = `
            <span class="detail-label">${key}</span>
            <span class="detail-value">${value}</span>
        `;
        fundamentalDetailsDiv.appendChild(row);
    });
}

/**
 * Displays an error message on the dashboard.
 * @param {string} message - The error message to display.
 */
function displayError(message) {
    const stockChartDiv = document.getElementById('stockChart');
    const stockDetailsDiv = document.getElementById('stockDetails');
    const fundamentalDetailsDiv = document.getElementById('fundamentalDetails');

    const errorHtml = `<p class="error-placeholder">${message}</p>`;
    
    if (stockChartDiv) stockChartDiv.innerHTML = errorHtml;
    if (stockDetailsDiv) stockDetailsDiv.innerHTML = errorHtml;
    if (fundamentalDetailsDiv) fundamentalDetailsDiv.innerHTML = errorHtml;
}


// ----------------------------------------------------
// 4. TRADING DASHBOARD LOGIC (trading_dashboard.html)
// ----------------------------------------------------

/**
 * Sets up event listeners for the Trading Dashboard.
 */
function setupTradingDashboard() {
    const executeTradeBtn = document.getElementById('executeTradeBtn');
    if (executeTradeBtn) {
        executeTradeBtn.addEventListener('click', executeTrade);
    }

    // --- NEW: Logic to show/hide margin checkbox ---
    const strategySelect = document.getElementById('tradeStrategy');
    const leverageGroup = document.querySelector('.leverage-group');
    const hiddenTradeType = document.getElementById('tradeType');
    
    if (strategySelect && leverageGroup && hiddenTradeType) {
        
        const updateTradeType = () => {
            const strategy = strategySelect.value;
            const intradayStrategies = ['intraday', 'scalping', 'momentum', 'technical'];
            
            if (intradayStrategies.includes(strategy)) {
                // It's an intraday trade
                hiddenTradeType.value = 'intraday';
                leverageGroup.classList.remove('hidden');
            } else {
                // It's a delivery trade
                hiddenTradeType.value = 'delivery';
                leverageGroup.classList.add('hidden');
                // Uncheck margin if switching back to delivery
                document.getElementById('useMargin').checked = false;
            }
        };

        // Add listener
        strategySelect.addEventListener('change', updateTradeType);
        
        // Run on page load
        updateTradeType();
    }
}

/**
 * Handles the trade execution (Buy/Sell) API call.
 */
async function executeTrade(event) {
    event.preventDefault(); // Prevent form submission

    const symbol = document.getElementById('tradeTicker').value.trim().toUpperCase();
    const quantity = document.getElementById('tradeQuantity').value;
    const action = document.querySelector('input[name="tradeAction"]:checked').value;
    
    // --- MODIFIED: Get new form values ---
    const trade_type = document.getElementById('tradeType').value; // From hidden input
    const use_margin = document.getElementById('useMargin').checked;
    const broker = document.getElementById('broker').value;

    if (!symbol) {
        alertMessage("Please enter a ticker symbol.", 'danger');
        return;
    }
    if (!quantity || parseInt(quantity) <= 0) {
        alertMessage("Please enter a valid quantity.", 'danger');
        return;
    }

    const btn = document.getElementById('executeTradeBtn');
    btn.disabled = true;
    btn.textContent = 'Executing...';

    try {
        const response = await fetch('/execute_trade', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                symbol: symbol,
                quantity: parseInt(quantity),
                action: action,
                trade_type: trade_type, 
                use_margin: use_margin,
                broker: broker
            })
        });

        const result = await response.json();

        if (result.success) {
            window.location.reload();
        } else {
            alertMessage(result.message, 'danger');
        }
    } catch (e) {
        console.error("Trade execution error:", e);
        alertMessage("An unexpected error occurred during trade execution.", 'danger');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Execute Trade';
    }
}


// ----------------------------------------------------
// 5. SCRAPER DASHBOARD LOGIC (scraper_dashboard.html)
// ----------------------------------------------------

/**
 * Sets up event listeners for the Scraper Dashboard.
 */
function setupScraperDashboard() {
    const scrapeBtn = document.getElementById('scrapeNewsBtn');
    if (scrapeBtn) {
        scrapeBtn.addEventListener('click', executeNewsScrape);
    }
}

/**
 * Handles the news scraping API call.
 */
async function executeNewsScrape() {
    const ticker = document.getElementById('scrapeTicker').value.trim().toUpperCase();
    const resultsDiv = document.getElementById('scrapeResults');
    const btn = document.getElementById('scrapeNewsBtn');

    if (!ticker) {
        alertMessage("Please enter a ticker symbol.", 'danger');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Scraping...';
    resultsDiv.innerHTML = `<p class="loading-placeholder">Fetching news for ${ticker}...</p>`;

    try {
        const response = await fetch('/scrape_news', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker: ticker })
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message);
        }
        
        renderNewsResults(result.news);

    } catch (e) {
        console.error("Scraping error:", e);
        resultsDiv.innerHTML = `<p class="error-placeholder">${e.message}</p>`;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Scrape News';
    }
}

/**
 * Renders the list of scraped news articles.
 * @param {Array} newsItems - Array of news objects from the API.
 */
function renderNewsResults(newsItems) {
    const resultsDiv = document.getElementById('scrapeResults');
    if (!newsItems || newsItems.length === 0) {
        resultsDiv.innerHTML = `<p class="error-placeholder">No news found for this ticker.</p>`;
        return;
    }

    // We can reuse the 'query-list' styles from the help page
    let html = '<div class="query-list">'; 

    newsItems.forEach(item => {
        // Create an 'a' tag for the title
        html += `
            <div class="query-item">
                <h4 style="font-size: 1.1rem; margin-bottom: 5px; line-height: 1.4;">
                    <a href="${item.link}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: none;">
                        ${item.title}
                    </a>
                </h4>
                <span class="query-meta">
                    Publisher: ${item.publisher}
                </span>
            </div>
        `;
    });

    html += '</div>';
    resultsDiv.innerHTML = html;
}


// ----------------------------------------------------
// 6. GLOBAL UTILITIES AND INITIALIZATION
// ----------------------------------------------------

/**
 * Displays a non-intrusive message (instead of alert()).
 */
function alertMessage(message, type = 'info') {
    const container = document.querySelector('.container');
    if (!container) return; 

    let flash = document.createElement('div');
    flash.className = `flash-message flash-${type} custom-alert`;
    flash.innerHTML = message;
    
    document.querySelectorAll('.custom-alert').forEach(el => el.remove());
    
    container.prepend(flash);
    
    setTimeout(() => {
        if(flash.parentNode) {
            flash.remove();
        }
    }, 5000);
}


// Wait for the DOM to be fully loaded before setting up event listeners
document.addEventListener('DOMContentLoaded', () => {
    
    // --- Analytics Page ---
    if (document.getElementById('stockChart')) {
        setupAnalyticsDashboard();
    }
    
    // --- Trading Page ---
    if (document.getElementById('tradeForm')) {
        setupTradingDashboard();
    }
    
    // --- Scraper Page (NEW) ---
    if (document.getElementById('scrapeNewsBtn')) {
        setupScraperDashboard();
    }
    
    // --- Help Page Tab Logic (Also used by Admin page) ---
    const tabContainer = document.querySelector('.tab-container');
    if (tabContainer) {
        const tabButtons = tabContainer.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content-item');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTabId = button.getAttribute('data-tab');

                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));

                button.classList.add('active');
                const targetContent = document.getElementById(targetTabId);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            });
        });

        const successBanner = document.querySelector('.flash-success, .success-banner');
        const activityButton = document.querySelector('[data-tab="tab-activity"]');
        const pendingButton = document.querySelector('[data-tab="tab-pending"]'); // For Admin page
        
        if (successBanner && activityButton) {
            activityButton.click(); // For Help page
        } else if (tabButtons.length > 0) {
             // Default to first tab (tab-guide on help, tab-pending on admin)
            tabButtons[0].click();
        }
    }
});