# Previous Day Value Area Trading Strategy
# Trades based on previous day's Value Area High (VAH), Value Area Low (VAL), and Point of Control (POC)

input showOnlyToday = yes;
input Market_Open_Time = 0930;
input Market_Close_Time = 1600;
input atrPeriod = 14;
input stopLossATRMultiplier = 1.0;
input useEMAFilter = yes;
input emaFast = 8;
input emaMedium = 21;
input emaSlow = 34;
input showLabels = yes;

# ========== Time and Session Management ==========
def day = GetDay();
def isToday = day == GetLastDay();
def shouldPlot = if showOnlyToday then isToday else 1;
def pastOpen = SecondsTillTime(Market_Open_Time) <= 0;
def pastClose = SecondsTillTime(Market_Close_Time) <= 0;
def marketOpen = pastOpen and !pastClose;
def firstBar = day[1] != day;

# ========== Previous Day Value Area Calculation ==========
# Calculate volume-based value area using volume profile methodology
# Value Area = price range containing 70% of previous day's volume
# POC = Point of Control (price level with highest volume)

# Get previous day's high, low, and total volume
def prevHigh = high(period = "DAY")[1];
def prevLow = low(period = "DAY")[1];
def prevTotalVol = volume(period = "DAY")[1];
def prevRange = prevHigh - prevLow;

# Use VWAP as POC approximation (volume-weighted average price)
# VWAP represents the average price weighted by volume - close to true POC
def prevVWAP = vwap(period = "DAY")[1];

# Divide the range into thirds to estimate volume distribution
# High third, middle third, low third
def upperThird = prevHigh - (prevRange / 3);
def lowerThird = prevLow + (prevRange / 3);

# Calculate volume in each third by summing bars that fell in those ranges
# This is a simplified approach to approximate volume concentration
# Reset counters at start of each day, accumulate only during previous day bars
rec volUpperThird = if firstBar then 0
                    else if GetDay() == GetLastDay() - 1 and close >= upperThird then volUpperThird[1] + volume
                    else if GetDay() == GetLastDay() and GetDay() != GetDay()[1] then 0
                    else volUpperThird[1];

rec volMiddleThird = if firstBar then 0
                     else if GetDay() == GetLastDay() - 1 and close < upperThird and close > lowerThird then volMiddleThird[1] + volume
                     else if GetDay() == GetLastDay() and GetDay() != GetDay()[1] then 0
                     else volMiddleThird[1];

rec volLowerThird = if firstBar then 0
                    else if GetDay() == GetLastDay() - 1 and close <= lowerThird then volLowerThird[1] + volume
                    else if GetDay() == GetLastDay() and GetDay() != GetDay()[1] then 0
                    else volLowerThird[1];

# Adjust value area based on where most volume traded
# If volume is concentrated in upper/lower third, shift value area accordingly
def volumeImbalance = (volUpperThird - volLowerThird) / prevTotalVol;

# Value area should capture 70% of volume
# Start from VWAP (volume-weighted center) and expand to capture 70% of volume
# Use an adaptive width based on volume distribution
def baseVAWidth = prevRange * 0.70; # Start with 70% of range as baseline

# Adjust width based on volume concentration
# If volume is more concentrated (in one third), value area is narrower
# If volume is more dispersed, value area is wider
def volConcentration = Max(volUpperThird, Max(volMiddleThird, volLowerThird)) / prevTotalVol;
def adjustmentFactor = if volConcentration > 0.50 then 0.85 else 1.0; # Narrow if concentrated

def finalVAWidth = baseVAWidth * adjustmentFactor;

# Center value area on VWAP but shift slightly based on volume imbalance
def vaBias = volumeImbalance * (prevRange * 0.10); # Shift up to 10% of range

def VAH = Min(prevVWAP + (finalVAWidth / 2) + vaBias, prevHigh);
def VAL = Max(prevVWAP - (finalVAWidth / 2) + vaBias, prevLow);
def POC = prevVWAP;

# Plot previous day value area levels
plot PrevDayVAH = if marketOpen and shouldPlot then VAH else Double.NaN;
plot PrevDayVAL = if marketOpen and shouldPlot then VAL else Double.NaN;
plot PrevDayPOC = if marketOpen and shouldPlot then POC else Double.NaN;

PrevDayVAH.SetDefaultColor(Color.MAGENTA);
PrevDayVAH.SetStyle(Curve.SHORT_DASH);
PrevDayVAH.SetLineWeight(2);

PrevDayVAL.SetDefaultColor(Color.MAGENTA);
PrevDayVAL.SetStyle(Curve.SHORT_DASH);
PrevDayVAL.SetLineWeight(2);

PrevDayPOC.SetDefaultColor(Color.YELLOW);
PrevDayPOC.SetStyle(Curve.SHORT_DASH);
PrevDayPOC.SetLineWeight(2);

AddCloud(PrevDayVAH, PrevDayVAL, Color.LIGHT_GRAY, Color.LIGHT_GRAY);

# ========== Opening Price Logic ==========
# Capture the opening price at market open
def secondsFromOpen = SecondsFromTime(Market_Open_Time);
def isFirstBarOfDay = secondsFromOpen >= 0 and secondsFromOpen[1] < 0;

rec openingPrice = if isFirstBarOfDay then open
                   else if firstBar then open
                   else openingPrice[1];

# Determine opening position relative to value area
rec openedAboveVA = if isFirstBarOfDay then (openingPrice > VAH)
                    else if firstBar then 0
                    else openedAboveVA[1];

rec openedBelowVA = if isFirstBarOfDay then (openingPrice < VAL)
                    else if firstBar then 0
                    else openedBelowVA[1];

rec openedWithinVA = if isFirstBarOfDay then (openingPrice >= VAL and openingPrice <= VAH)
                     else if firstBar then 0
                     else openedWithinVA[1];

# No trade condition - plot at market open if opened within VA
def noTradeCondition = isFirstBarOfDay and openedWithinVA;
AddVerticalLine(noTradeCondition and marketOpen, "No Trade", Color.GRAY, Curve.SHORT_DASH);

# ========== Targets Based on Value Area ==========
# Long target = VAH (top of value area)
# Short target = VAL (bottom of value area)
def atr = ATR(length = atrPeriod);
def longTarget = VAH;
def shortTarget = VAL;

# ATR-based stops
def longStop = VAL - (atr * stopLossATRMultiplier);
def shortStop = VAH + (atr * stopLossATRMultiplier);

plot LongTargetLine = if marketOpen and shouldPlot then longTarget else Double.NaN;
plot ShortTargetLine = if marketOpen and shouldPlot then shortTarget else Double.NaN;

LongTargetLine.SetDefaultColor(Color.CYAN);
ShortTargetLine.SetDefaultColor(Color.CYAN);
LongTargetLine.SetStyle(Curve.LONG_DASH);
ShortTargetLine.SetStyle(Curve.LONG_DASH);
LongTargetLine.SetLineWeight(2);
ShortTargetLine.SetLineWeight(2);

# ========== EMA Trend Filter ==========
def ema1 = ExpAverage(close, emaFast);
def ema2 = ExpAverage(close, emaMedium);
def ema3 = ExpAverage(close, emaSlow);
def bullishStack = ema1 > ema2 and ema2 > ema3;
def bearishStack = ema1 < ema2 and ema2 < ema3;

plot EMA_Fast = ema1;
plot EMA_Medium = ema2;
plot EMA_Slow = ema3;
EMA_Fast.SetDefaultColor(Color.YELLOW);
EMA_Medium.SetDefaultColor(Color.ORANGE);
EMA_Slow.SetDefaultColor(Color.DARK_ORANGE);
EMA_Fast.SetLineWeight(1);
EMA_Medium.SetLineWeight(1);
EMA_Slow.SetLineWeight(1);

# ========== Entry Signal Logic ==========
# Mean reversion strategy:
# If opened above VAH → Wait for price to break below VAH and close within VA → SHORT
# If opened below VAL → Wait for price to break above VAL and close within VA → LONG

# Check if price is within value area
def priceInVA = close >= VAL and close <= VAH;

# Long entry: Opened below VAL, price breaks back up through VAL and closes within VA
def rawLongEntry = openedBelowVA and
                   close > VAL and
                   priceInVA and
                   close[1] <= VAL and
                   (!useEMAFilter or bullishStack);

# Short entry: Opened above VAH, price breaks back down through VAH and closes within VA
def rawShortEntry = openedAboveVA and
                    close < VAH and
                    priceInVA and
                    close[1] >= VAH and
                    (!useEMAFilter or bearishStack);

# Track if target or stop was hit to determine if we can take new trades
rec inTrade = if firstBar or !marketOpen then 0
              else if (inTrade[1] == 1 and (high >= longTarget or low <= longStop)) then 0
              else if (inTrade[1] == -1 and (low <= shortTarget or high >= shortStop)) then 0
              else if rawLongEntry and inTrade[1] == 0 then 1
              else if rawShortEntry and inTrade[1] == 0 then -1
              else inTrade[1];

# Entry signals fire only when no active trade and not in no-trade condition
def longEntrySignal = rawLongEntry and inTrade[1] == 0 and !openedWithinVA;
def shortEntrySignal = rawShortEntry and inTrade[1] == 0 and !openedWithinVA;

AddVerticalLine(longEntrySignal and marketOpen, "Long Entry", Color.GREEN, Curve.SHORT_DASH);
AddVerticalLine(shortEntrySignal and marketOpen, "Short Entry", Color.RED, Curve.SHORT_DASH);

# ========== Target and Stop Tracking for Bubbles ==========
rec tradeDirection = if longEntrySignal then 1
                     else if shortEntrySignal then -1
                     else if firstBar then 0
                     else tradeDirection[1];

def newEntry = longEntrySignal or shortEntrySignal;

rec target_hit = if tradeDirection == 1 and high >= longTarget then 1
                 else if tradeDirection == -1 and low <= shortTarget then 1
                 else if newEntry or firstBar then 0
                 else target_hit[1];

rec stop_hit = if tradeDirection == 1 and low <= longStop then 1
               else if tradeDirection == -1 and high >= shortStop then 1
               else if newEntry or firstBar then 0
               else stop_hit[1];

# Bubble conditions - only show if trade is active (stop hasn't been hit)
def showTargetBubble = (tradeDirection == 1 and high >= longTarget or tradeDirection == -1 and low <= shortTarget) and !target_hit[1] and !stop_hit;
def showStopBubble = (tradeDirection == 1 and low <= longStop or tradeDirection == -1 and high >= shortStop) and !target_hit and !stop_hit[1];

AddChartBubble(showTargetBubble and tradeDirection == 1, high, "Target", Color.CYAN, yes);
AddChartBubble(showTargetBubble and tradeDirection == -1, low, "Target", Color.CYAN, no);
AddChartBubble(showStopBubble and tradeDirection == 1, low, "Stop", Color.RED, no);
AddChartBubble(showStopBubble and tradeDirection == -1, high, "Stop", Color.RED, yes);

# ========== Active Stop Loss Lines ==========
def showActiveLongStop = tradeDirection == 1 and !target_hit and !stop_hit and marketOpen;
def showActiveShortStop = tradeDirection == -1 and !target_hit and !stop_hit and marketOpen;

plot ActiveLongStop = if showActiveLongStop then longStop else Double.NaN;
plot ActiveShortStop = if showActiveShortStop then shortStop else Double.NaN;
ActiveLongStop.SetDefaultColor(Color.RED);
ActiveLongStop.SetStyle(Curve.SHORT_DASH);
ActiveLongStop.SetLineWeight(2);
ActiveShortStop.SetDefaultColor(Color.RED);
ActiveShortStop.SetStyle(Curve.SHORT_DASH);
ActiveShortStop.SetLineWeight(2);

# ========== Labels ==========
def labelVAH = if !IsNaN(PrevDayVAH) then PrevDayVAH else labelVAH[1];
def labelVAL = if !IsNaN(PrevDayVAL) then PrevDayVAL else labelVAL[1];
def labelPOC = if !IsNaN(PrevDayPOC) then PrevDayPOC else labelPOC[1];
def labelVAWidth = labelVAH - labelVAL;

# Opening status label
def openStatus = if openedAboveVA then 1
                 else if openedBelowVA then -1
                 else if openedWithinVA then 0
                 else Double.NaN;

AddLabel(showLabels, "Prev Day VA Width: " + Round(labelVAWidth, 2), Color.CYAN);
AddLabel(showLabels, "VAH: " + Round(labelVAH, 2) + " | POC: " + Round(labelPOC, 2) + " | VAL: " + Round(labelVAL, 2), Color.MAGENTA);

# Show volume distribution for verification
def totalVolTracked = volUpperThird + volMiddleThird + volLowerThird;
def upperPct = if totalVolTracked > 0 then Round((volUpperThird / totalVolTracked) * 100, 0) else 0;
def middlePct = if totalVolTracked > 0 then Round((volMiddleThird / totalVolTracked) * 100, 0) else 0;
def lowerPct = if totalVolTracked > 0 then Round((volLowerThird / totalVolTracked) * 100, 0) else 0;

AddLabel(showLabels, "Vol Dist - Upper: " + upperPct + "% Mid: " + middlePct + "% Lower: " + lowerPct + "%", Color.LIGHT_GRAY);
AddLabel(showLabels and openStatus == 1, "Opened Above VA - Looking for SHORT", Color.ORANGE);
AddLabel(showLabels and openStatus == -1, "Opened Below VA - Looking for LONG", Color.LIGHT_GREEN);
AddLabel(showLabels and openStatus == 0, "Opened Within VA - NO TRADE", Color.GRAY);
AddLabel(showLabels, "ATR: " + Round(atr, 2), Color.CYAN);
AddLabel(showLabels, "Long Target: " + Round(longTarget, 2) + " | Stop: " + Round(longStop, 2), Color.GREEN);
AddLabel(showLabels, "Short Target: " + Round(shortTarget, 2) + " | Stop: " + Round(shortStop, 2), Color.RED);
