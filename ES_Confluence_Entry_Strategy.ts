# ES Confluence Entry Strategy
# Combines HOLB/LOHB Price Reversal + TTM Momentum Reversal
# Only signals when BOTH indicators agree within specified bars

# ========== Inputs ==========
input lookback = 21;                    # Period for price channel and swing detection
input confluenceWindow = 3;             # Bars within which both signals must occur
input showPriceChannel = YES;           # Show price channel from Study 1
input showIndividualSignals = NO;       # Show individual signals or only confluence
input useTimeFilter = YES;              # Filter trades by session time
input sessionStartTime = 0930;          # RTH session start (EST)
input sessionEndTime = 1600;            # RTH session end (EST)
input avoidFirstMinutes = 30;           # Minutes to avoid after session open
input avoidLastMinutes = 30;            # Minutes to avoid before session close
input showLabels = YES;                 # Show status labels

# ========== Time Filter ==========
def secondsFromStart = SecondsFromTime(sessionStartTime);
def secondsTillEnd = SecondsTillTime(sessionEndTime);
def inSession = secondsFromStart >= 0 and secondsTillEnd >= 0;
def pastAvoidOpen = secondsFromStart >= (avoidFirstMinutes * 60);
def beforeAvoidClose = secondsTillEnd >= (avoidLastMinutes * 60);
def allowTrading = if useTimeFilter then (inSession and pastAvoidOpen and beforeAvoidClose) else yes;

# ========== Study 1: HOLB/LOHB Price Reversal Logic ==========
def lowBar = low == Lowest(low, lookback);
def HOLB = if lowBar then high else HOLB[1];
def closedAboveHOLB = if lowBar then 0 else if close > HOLB then closedAboveHOLB[1] + 1 else closedAboveHOLB[1];

def priceReversalBuy = closedAboveHOLB == 1 and closedAboveHOLB[1] == 0;

def highBar = high == Highest(high, lookback);
def LOHB = if highBar then low else LOHB[1];
def closedBelowLOHB = if highBar then 0 else if close < LOHB then closedBelowLOHB[1] + 1 else closedBelowLOHB[1];

def priceReversalSell = closedBelowLOHB == 1 and closedBelowLOHB[1] == 0;

# Price Channel
plot channelHigh = if showPriceChannel then Highest(high, lookback) else Double.NaN;
plot channelLow = if showPriceChannel then Lowest(low, lookback) else Double.NaN;
plot channelMid = if showPriceChannel then ExpAverage(close, lookback) else Double.NaN;

channelHigh.SetDefaultColor(Color.DARK_GREEN);
channelLow.SetDefaultColor(Color.VIOLET);
channelMid.SetDefaultColor(Color.GRAY);
channelHigh.SetLineWeight(1);
channelLow.SetLineWeight(1);
channelMid.SetLineWeight(1);

# ========== Study 2: TTM Momentum Reversal Logic ==========
def ttm = TTM_Squeeze();
def momentumTurnDown = ttm > 0 and ttm < ttm[1] and ttm[2] < ttm[1];
def momentumTurnUp = ttm < 0 and ttm > ttm[1] and ttm[2] > ttm[1];

# ========== Confluence Detection Logic ==========
# Check if both signals occurred within the confluence window
# For a buy: need both priceReversalBuy and momentumTurnUp within X bars
# For a sell: need both priceReversalSell and momentumTurnDown within X bars

# Track recent occurrences within the window
def priceReversalBuyRecent = Sum(priceReversalBuy, confluenceWindow) > 0;
def priceReversalSellRecent = Sum(priceReversalSell, confluenceWindow) > 0;
def momentumTurnUpRecent = Sum(momentumTurnUp, confluenceWindow) > 0;
def momentumTurnDownRecent = Sum(momentumTurnDown, confluenceWindow) > 0;

# Confluence occurs when both signals are recent AND one just fired
def confluenceBuy = (priceReversalBuy and momentumTurnUpRecent) or
                    (momentumTurnUp and priceReversalBuyRecent);

def confluenceSell = (priceReversalSell and momentumTurnDownRecent) or
                     (momentumTurnDown and priceReversalSellRecent);

# Prevent duplicate signals - only fire once per confluence event
rec lastConfluenceBuy = if confluenceBuy then BarNumber() else lastConfluenceBuy[1];
rec lastConfluenceSell = if confluenceSell then BarNumber() else lastConfluenceSell[1];

def uniqueConfluenceBuy = confluenceBuy and lastConfluenceBuy[1] != BarNumber();
def uniqueConfluenceSell = confluenceSell and lastConfluenceSell[1] != BarNumber();

# Final signals with time filter
def finalBuySignal = uniqueConfluenceBuy and allowTrading;
def finalSellSignal = uniqueConfluenceSell and allowTrading;

# ========== Individual Signal Plots (Optional) ==========
plot priceRevBuy = if showIndividualSignals and priceReversalBuy then low else Double.NaN;
plot priceRevSell = if showIndividualSignals and priceReversalSell then high else Double.NaN;
plot momTurnUp = if showIndividualSignals and momentumTurnUp then low else Double.NaN;
plot momTurnDown = if showIndividualSignals and momentumTurnDown then high else Double.NaN;

priceRevBuy.SetPaintingStrategy(PaintingStrategy.BOOLEAN_ARROW_UP);
priceRevBuy.SetDefaultColor(Color.LIGHT_GREEN);
priceRevBuy.SetLineWeight(2);

priceRevSell.SetPaintingStrategy(PaintingStrategy.BOOLEAN_ARROW_DOWN);
priceRevSell.SetDefaultColor(Color.LIGHT_RED);
priceRevSell.SetLineWeight(2);

momTurnUp.SetPaintingStrategy(PaintingStrategy.BOOLEAN_ARROW_UP);
momTurnUp.SetDefaultColor(Color.YELLOW);
momTurnUp.SetLineWeight(2);

momTurnDown.SetPaintingStrategy(PaintingStrategy.BOOLEAN_ARROW_DOWN);
momTurnDown.SetDefaultColor(Color.CYAN);
momTurnDown.SetLineWeight(2);

# ========== Confluence Signal Plots (Main Signals) ==========
plot ConfluenceBuySignal = if finalBuySignal then low else Double.NaN;
plot ConfluenceSellSignal = if finalSellSignal then high else Double.NaN;

ConfluenceBuySignal.SetPaintingStrategy(PaintingStrategy.BOOLEAN_ARROW_UP);
ConfluenceBuySignal.SetDefaultColor(Color.GREEN);
ConfluenceBuySignal.SetLineWeight(5);

ConfluenceSellSignal.SetPaintingStrategy(PaintingStrategy.BOOLEAN_ARROW_DOWN);
ConfluenceSellSignal.SetDefaultColor(Color.RED);
ConfluenceSellSignal.SetLineWeight(5);

# ========== Chart Bubbles for Confluence Signals ==========
AddChartBubble(finalBuySignal, low, "BUY\nCONFLUENCE", Color.GREEN, no);
AddChartBubble(finalSellSignal, high, "SELL\nCONFLUENCE", Color.RED, yes);

# ========== Alerts ==========
Alert(finalBuySignal, "CONFLUENCE BUY SIGNAL", Alert.BAR, Sound.Bell);
Alert(finalSellSignal, "CONFLUENCE SELL SIGNAL", Alert.BAR, Sound.Bell);

# ========== Status Labels ==========
def tradingStatus = if !allowTrading and useTimeFilter then 0 else 1;

AddLabel(showLabels,
         if tradingStatus then "TRADING: ACTIVE" else "TRADING: OUTSIDE HOURS",
         if tradingStatus then Color.GREEN else Color.GRAY);

AddLabel(showLabels,
         "Lookback: " + lookback + " | Window: " + confluenceWindow,
         Color.CYAN);

# Current channel width for context
def channelWidth = channelHigh - channelLow;
AddLabel(showLabels,
         "Channel Width: " + AsText(channelWidth, NumberFormat.TWO_DECIMAL_PLACES),
         Color.WHITE);

# TTM Squeeze current value
AddLabel(showLabels,
         "TTM: " + AsText(ttm, NumberFormat.TWO_DECIMAL_PLACES),
         if ttm > 0 then Color.GREEN else Color.RED);
