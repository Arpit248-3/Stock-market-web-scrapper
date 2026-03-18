import streamlit as st
import yfinance as yf
import pandas as pd
import random
from datetime import datetime, timedelta
import smtplib
from email.message import EmailMessage
from werkzeug.security import generate_password_hash, check_password_hash
import time

# --- Configuration ---
st.set_page_config(page_title="StockScraper", layout="wide", initial_sidebar_state="expanded")

# Email Config (Replace with yours)
MAIL_SERVER = 'smtp.gmail.com'
MAIL_PORT = 587
MAIL_USERNAME = '1da23cs011.cs@drait.edu.in'
MAIL_PASSWORD = 'eckm zhbz hbnm pkvi'
ADMIN_EMAIL = '1da23cs019.cs@drait.edu.in'

# --- Constants ---
STOCK_OPTIONS = {
    "Reliance Industries": "RELIANCE.NS",
    "Tata Consultancy Services": "TCS.NS",
    "Infosys": "INFY.NS",
    "HDFC Bank": "HDFCBANK.NS",
    "SBI": "SBIN.NS",
    "Tata Motors": "TATAMOTORS.NS",
    "Apollo Hospitals": "APOLLOHOSP.NS",
    "HUL": "HINDUNILVR.NS",
    "Asian Paints": "ASIANPAINT.NS",
    "Wipro": "WIPRO.NS",
}

BROKERAGE_CONFIG = {
    "groww": {"name": "Groww", "type": "flat", "rate": 20.0},
    "upstox": {"name": "Upstox", "type": "flat", "rate": 20.0},
    "5paisa": {"name": "5Paisa", "type": "flat", "rate": 20.0},
    "zerodha": {"name": "Zerodha", "type": "flat", "rate": 20.0},
}
DEMAT_INFO = {
    "groww": {"desc": "Low-cost, max ₹20 brokerage. Free MF/IPO.", "url": "https://groww.in/"},
    "upstox": {"desc": "₹150 referral bonus, free account opening.", "url": "https://upstox.com/"},
    "zerodha": {"desc": "Largest broker, max ₹20 per trade.", "url": "https://zerodha.com/"},
}

STT_DELIVERY_PERCENT = 0.001
STT_INTRADAY_PERCENT = 0.00025
LEVERAGE_MULTIPLIER = 5

# --- Session State Initialization ---
if 'users' not in st.session_state:
    st.session_state.users = {}
if 'logged_in_user' not in st.session_state:
    st.session_state.logged_in_user = None

# For Demo Users
if 'testuser' not in st.session_state.users:
    st.session_state.users['testuser'] = {
        'hash': generate_password_hash('testpass'),
        'email': 'test@example.com',
        'phone': '9876543210',
        'verified': True,
        'help_queries': [],
        'mock_cash': 100000.00,
        'mock_portfolio': [],
        'transaction_history': []
    }

# --- Utility Functions ---
def send_otp_email(email, otp):
    try:
        msg = EmailMessage()
        msg['Subject'] = 'Your StockScraper Verification Code'
        msg['From'] = MAIL_USERNAME
        msg['To'] = email
        msg.set_content(f'Your StockScraper OTP is: {otp}\n\nThis code will expire in 5 minutes.')
        
        with smtplib.SMTP(MAIL_SERVER, MAIL_PORT) as server:
            server.starttls()
            server.login(MAIL_USERNAME, MAIL_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as e:
        st.error(f"Error sending email: {e}")
        return False

def format_large_number(num):
    if num is None: return 'N/A'
    try:
        num_float = float(num)
        if num_float > 1_00_00_00_00_00_000: return f"{num_float / 1_00_00_00_00_00_000:.2f}T"
        elif num_float > 1_00_00_00_000: return f"{num_float / 1_00_00_00_000:.2f}B"
        elif num_float > 1_00_00_000: return f"{num_float / 1_00_00_000:.2f} Cr"
        else: return f"{num_float:,.2f}"
    except: return 'N/A'

def safe_get(info, key, default='N/A'):
    val = info.get(key, default)
    return val if val is not None else default

# --- Auth Views ---
def login_view():
    st.title("Login to StockScraper")
    
    with st.form("login_form"):
        username = st.text_input("Username")
        password = st.text_input("Password", type="password")
        submitted = st.form_submit_button("Login")
        
        if submitted:
            user = st.session_state.users.get(username)
            if user and check_password_hash(user['hash'], password):
                if user.get('verified'):
                    st.session_state.logged_in_user = username
                    st.rerun()
                else:
                    st.session_state.signup_temp_user = username
                    st.warning("Please verify your account.")
                    st.session_state.page = "OTP"
                    st.rerun()
            else:
                st.error("Invalid username or password")

def signup_view():
    st.title("Sign Up")
    
    with st.form("signup_form"):
        username = st.text_input("Username")
        password = st.text_input("Password", type="password")
        email = st.text_input("Email")
        mobile = st.text_input("Mobile (Optional)")
        submitted = st.form_submit_button("Sign Up")
        
        if submitted:
            if username in st.session_state.users:
                st.error("Username already exists")
            elif not email:
                st.error("Email is required")
            else:
                otp = str(random.randint(100000, 999999))
                st.session_state.users[username] = {
                    'hash': generate_password_hash(password),
                    'email': email,
                    'phone': mobile,
                    'otp': otp,
                    'otp_expiry': datetime.now() + timedelta(minutes=5),
                    'verified': False,
                    'help_queries': [],
                    'mock_cash': 100000.0,
                    'mock_portfolio': [],
                    'transaction_history': []
                }
                if send_otp_email(email, otp):
                    st.session_state.signup_temp_user = username
                    st.session_state.page = "OTP"
                    st.success("OTP sent to your email.")
                    st.rerun()
                else:
                    st.session_state.users.pop(username)
                    st.error("Failed to send OTP email.")

def otp_view():
    st.title("OTP Verification")
    username = st.session_state.get('signup_temp_user')
    if not username:
        st.session_state.page = "Login"
        st.rerun()
        
    user_data = st.session_state.users.get(username)
    st.info(f"An OTP was sent to {user_data['email']}")
    
    with st.form("otp_form"):
        otp_input = st.text_input("Enter 6-digit OTP")
        submitted = st.form_submit_button("Verify")
        
        if submitted:
            if datetime.now() > user_data['otp_expiry']:
                st.error("OTP expired. Generating a new one...")
                new_otp = str(random.randint(100000, 999999))
                user_data['otp'] = new_otp
                user_data['otp_expiry'] = datetime.now() + timedelta(minutes=5)
                send_otp_email(user_data['email'], new_otp)
                st.rerun()
            elif otp_input == user_data['otp']:
                user_data['verified'] = True
                st.session_state.pop('signup_temp_user')
                st.success("Account verified! You can now log in.")
                st.session_state.page = "Login"
                st.rerun()
            else:
                st.error("Invalid OTP")

# --- App Views ---
def dashboard_home():
    st.title(f"Welcome to StockScraper, {st.session_state.logged_in_user}!")
    st.write("Use the sidebar to navigate to the Market Intelligence, Trading Panel, or News Scraper.")

def main_dashboard():
    st.title("Market Intelligence")
    
    col1, col2 = st.columns([1, 1])
    with col1:
        selected_stock = st.selectbox("Select a Stock", list(STOCK_OPTIONS.keys()))
        period = st.selectbox("Select Period", ["1mo", "3mo", "6mo", "1y", "5y"])
    
    ticker = STOCK_OPTIONS[selected_stock]
    with st.spinner("Fetching data..."):
        stock = yf.Ticker(ticker)
        hist = stock.history(period=period)
        info = stock.info
        
        if not hist.empty:
            st.subheader(f"Price Chart: {selected_stock} ({ticker})")
            st.line_chart(hist['Close'])
            
            # Fundamentals
            st.subheader("Fundamental Data")
            current_price = safe_get(info, 'currentPrice', hist['Close'].iloc[-1])
            col1, col2, col3, col4 = st.columns(4)
            col1.metric("Current Price", f"₹{current_price:,.2f}")
            col2.metric("Market Cap", format_large_number(safe_get(info, 'marketCap')))
            col3.metric("P/E Ratio", f"{safe_get(info, 'trailingPE'):.2f}" if isinstance(safe_get(info, 'trailingPE'), (int, float)) else 'N/A')
            col4.metric("52W High", f"₹{safe_get(info, 'fiftyTwoWeekHigh'):.2f}" if isinstance(safe_get(info, 'fiftyTwoWeekHigh'), (int, float)) else "N/A")
        else:
            st.error("No historical data found.")

def trading_dashboard():
    st.title("Trading Dashboard")
    user_data = st.session_state.users[st.session_state.logged_in_user]
    
    # Portfolio Overview
    st.subheader("Your Portfolio")
    col1, col2 = st.columns(2)
    col1.metric("Available Cash", f"₹{user_data['mock_cash']:,.2f}")
    
    portfolio = user_data.get('mock_portfolio', [])
    if portfolio:
        df = pd.DataFrame(portfolio)
        # Update live prices
        with st.spinner("Updating live prices..."):
            tickers = df['symbol'].tolist()
            if tickers:
                data = yf.download(tickers, period="1d", progress=False)
                for index, row in df.iterrows():
                    sym = row['symbol']
                    try:
                        if len(tickers) == 1: price = data['Close'].iloc[-1]
                        else: price = data['Close'][sym].iloc[-1]
                        df.at[index, 'current'] = float(price)
                        df.at[index, 'gain_loss'] = (float(price) - row['cost']) * row['shares']
                    except: pass
        
        st.dataframe(df.style.format({'cost': '₹{:.2f}', 'current': '₹{:.2f}', 'gain_loss': '₹{:.2f}'}))
        
        total_value = user_data['mock_cash'] + sum([row['current']*row['shares'] for _, row in df.iterrows()])
        col2.metric("Total Account Value", f"₹{total_value:,.2f}")
        
    else:
        st.info("You don't own any stocks yet.")
        col2.metric("Total Account Value", f"₹{user_data['mock_cash']:,.2f}")
    
    # Execute Trade
    st.markdown("---")
    st.subheader("Execute Trade")
    
    t_col1, t_col2, t_col3 = st.columns(3)
    with t_col1:
        trade_stock = st.selectbox("Stock", list(STOCK_OPTIONS.keys()), key="trade_stock")
    with t_col2:
        trade_qty = st.number_input("Quantity", min_value=1, step=1, key="trade_qty")
    with t_col3:
        broker = st.selectbox("Select Broker", list(BROKERAGE_CONFIG.keys()), format_func=lambda x: BROKERAGE_CONFIG[x]['name'])
    
    t_col4, t_col5 = st.columns(2)
    with t_col4:
        trade_type = st.radio("Trade Type", ["Delivery", "Intraday"])
    with t_col5:
        use_margin = st.checkbox("Use Margin (5x)", value=False) if trade_type == "Intraday" else False
        
    t_action1, t_action2 = st.columns(2)
    
    # --- Trade Logic ---
    symbol = STOCK_OPTIONS[trade_stock]
    def execute_trade(action):
        try:
            hist = yf.Ticker(symbol).history(period="1d")
            price = hist['Close'].iloc[-1]
        except:
            st.error("Failed to fetch price.")
            return

        broker_conf = BROKERAGE_CONFIG.get(broker, BROKERAGE_CONFIG['groww'])
        brokerage_fee = broker_conf['rate'] if broker_conf['type'] == 'flat' else broker_conf['rate'] * trade_qty
        
        trade_value = price * trade_qty
        leverage = LEVERAGE_MULTIPLIER if (trade_type == "Intraday" and use_margin) else 1
        margin_required = trade_value / leverage
        
        port = user_data['mock_portfolio']
        cash = user_data['mock_cash']
        
        if action == 'Buy':
            total_cost = margin_required + brokerage_fee
            if cash < total_cost:
                st.error(f"Not enough cash. Needed: ₹{total_cost:,.2f}, Available: ₹{cash:,.2f}")
                return
            
            user_data['mock_cash'] -= total_cost
            found = False
            for item in port:
                if item['symbol'] == symbol:
                    item['cost'] = ((item['cost'] * item['shares']) + (price * trade_qty)) / (item['shares'] + trade_qty)
                    item['shares'] += trade_qty
                    item['current'] = price
                    found = True
                    break
            if not found:
                port.append({'symbol': symbol, 'shares': trade_qty, 'cost': price, 'current': price, 'gain_loss': 0.0})
            st.success(f"Bought {trade_qty} shares of {symbol} at ₹{price:.2f}.")
            
        elif action == 'Sell':
            found = False
            for item in port:
                if item['symbol'] == symbol:
                    if item['shares'] < trade_qty:
                        st.error("Not enough shares to sell.")
                        return
                    
                    stt_fee = trade_value * (STT_INTRADAY_PERCENT if trade_type == "Intraday" else STT_DELIVERY_PERCENT)
                    total_fees = brokerage_fee + stt_fee
                    profit_loss = (price - item['cost']) * trade_qty
                    cash_return = (margin_required + profit_loss - total_fees) if (trade_type == "Intraday" and use_margin) else (trade_value - total_fees)
                    
                    user_data['mock_cash'] += cash_return
                    item['shares'] -= trade_qty
                    if item['shares'] == 0:
                        port.remove(item)
                    st.success(f"Sold {trade_qty} shares of {symbol}. Returned: ₹{cash_return:,.2f}")
                    found = True
                    break
            if not found:
                st.error(f"You don't own any shares of {symbol}.")
                return

        # Log
        user_data['transaction_history'].insert(0, {
            'type': action, 'symbol': symbol, 'shares': trade_qty, 'price': price,
            'broker': broker_conf['name'], 'fees': brokerage_fee,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        })
        st.session_state.users[st.session_state.logged_in_user] = user_data
        
    with t_action1:
        if st.button("BUY", use_container_width=True): execute_trade('Buy')
    with t_action2:
        if st.button("SELL", use_container_width=True): execute_trade('Sell')

def scraper_dashboard():
    st.title("News Scraper")
    st.write("Get the latest news articles for any stock.")
    
    ticker = st.text_input("Enter Ticker Symbol (e.g., RELIANCE.NS, AAPL)")
    if st.button("Scrape News"):
        if ticker:
            with st.spinner("Fetching news..."):
                try:
                    stock = yf.Ticker(ticker)
                    news = stock.news
                    if news:
                        for item in news:
                            title = item.get('title', item.get('content', {}).get('title', 'No Title'))
                            link = item.get('link', item.get('content', {}).get('canonicalUrl', {}).get('url', '#'))
                            pub = item.get('publisher', item.get('content', {}).get('provider', {}).get('displayName', 'Unknown'))
                            st.markdown(f"**[{title}]({link})** - *{pub}*")
                            st.divider()
                    else:
                        st.warning("No news found.")
                except Exception as e:
                    st.error(f"Failed to fetch news: {e}")
        else:
            st.error("Please enter a ticker.")

def help_dashboard():
    st.title("Help & Support")
    user_data = st.session_state.users[st.session_state.logged_in_user]
    
    with st.expander("Submit a Query"):
        with st.form("query_form"):
            name = st.text_input("Name")
            email = st.text_input("Email")
            query = st.text_area("Your Question")
            if st.form_submit_button("Submit"):
                if name and email and query:
                    tid = f"T{int(time.time())}"
                    user_data['help_queries'].insert(0, {
                        'id': tid, 'name': name, 'email': email, 'query': query,
                        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                        'response': 'Pending...'
                    })
                    st.session_state.users[st.session_state.logged_in_user] = user_data
                    st.success("Query submitted successfully!")
                else:
                    st.error("All fields are required.")
    
    st.subheader("Your Queries")
    for q in user_data['help_queries']:
        st.info(f"**{q['timestamp']} - {q['id']}**\n\n**Q:** {q['query']}\n\n**A:** {q['response']}")

# --- Main App Routing ---
if 'page' not in st.session_state:
    st.session_state.page = "Login"

if st.session_state.logged_in_user is None:
    # Not logged in
    st.sidebar.title("StockScraper Auth")
    mode = st.sidebar.radio("Navigation", ["Login", "Sign Up"])
    if st.session_state.page == "OTP":
        otp_view()
    elif mode == "Sign Up":
        signup_view()
    else:
        login_view()
else:
    # Logged In
    st.sidebar.title("StockScraper Menu")
    st.sidebar.write(f"Logged in as: **{st.session_state.logged_in_user}**")
    if st.sidebar.button("Logout"):
        st.session_state.logged_in_user = None
        st.rerun()
        
    page = st.sidebar.radio("Navigate", ["Home", "Market Intelligence", "Trading Panel", "News Scraper", "Help & Support"])
    
    if page == "Home": dashboard_home()
    elif page == "Market Intelligence": main_dashboard()
    elif page == "Trading Panel": trading_dashboard()
    elif page == "News Scraper": scraper_dashboard()
    elif page == "Help & Support": help_dashboard()
