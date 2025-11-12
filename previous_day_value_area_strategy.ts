# Previous Day Value Area Trading Strategy
# Trades based on previous day's Value Area High (VAH), Value Area Low (VAL), and Point of Control (POC)

input showOnlyToday = yes;
input valueAreaPercentage = 70.0;
input Market_Open_Time = 0930;
input Market_Close_Time = 1600;
input atrPeriod = 14;
input atrMultiplierT1 = 1.0;
input atrMultiplierT2 = 1.5;
input stopLossATRMultiplier = 1.0;
input useEMAFilter = yes;
input emaFast = 8;
input emaMedium = 21;
input emaSlow = 34;
input showLabels = yes;
input numberOfBars = 30;  # Number of price levels to calculate for value area

# ========== Time and Session Management ==========
def day = GetDay();
def isToday = day == GetLastDay();
def shouldPlot = if showOnlyToday then isToday else 1;
def pastOpen = SecondsTillTime(Market_Open_Time) <= 0;
def pastClose = SecondsTillTime(Market_Close_Time) <= 0;
def marketOpen = pastOpen and !pastClose;
def firstBar = day[1] != day;
def isPreviousDay = day == GetLastDay() - 1;

# ========== Previous Day Value Area Calculation ==========
# We'll use a simplified volume profile approach
# Calculate the previous day's high, low, and volume distribution

def aggPeriod = AggregationPeriod.DAY;
def prevDayHigh = high(period = aggPeriod)[1];
def prevDayLow = low(period = aggPeriod)[1];
def prevDayClose = close(period = aggPeriod)[1];
def prevDayVolume = volume(period = aggPeriod)[1];

# For a more accurate value area, we'll use TPO-style calculation
# Approximate POC as the price level with most time/volume spent
# Value Area as the range containing 70% of volume around POC

# Simplified approach: Use the middle 70% of previous day's range
# More sophisticated: weight by volume at each price level
def prevDayRange = prevDayHigh - prevDayLow;
def prevDayMidpoint = (prevDayHigh + prevDayLow) / 2;

# Calculate POC as a weighted average based on VWAP concept for previous day
def prevDayVWAP = vwap(period = aggPeriod)[1];

# Value Area High and Low (70% of range centered around POC/VWAP)
# Standard value area is typically 70% of volume, we'll approximate with range
def valueAreaWidth = prevDayRange * (valueAreaPercentage / 100);
def prevVAH = prevDayVWAP + (valueAreaWidth / 2);
def prevVAL = prevDayVWAP - (valueAreaWidth / 2);
def prevPOC = prevDayVWAP;

# Ensure VAH doesn't exceed previous day high and VAL doesn't go below previous day low
def VAH = Min(prevVAH, prevDayHigh);
def VAL = Max(prevVAL, prevDayLow);
def POC = prevPOC;

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

# ========== ATR-Based Targets ==========
def atr = ATR(length = atrPeriod);
def longT1 = VAH + (atr * atrMultiplierT1);
def longT2 = VAH + (atr * atrMultiplierT2);
def shortT1 = VAL - (atr * atrMultiplierT1);
def shortT2 = VAL - (atr * atrMultiplierT2);
def longStop = VAH - (atr * stopLossATRMultiplier);
def shortStop = VAL + (atr * stopLossATRMultiplier);

plot LongTarget1 = if marketOpen and shouldPlot then longT1 else Double.NaN;
plot LongTarget2 = if marketOpen and shouldPlot then longT2 else Double.NaN;
plot ShortTarget1 = if marketOpen and shouldPlot then shortT1 else Double.NaN;
plot ShortTarget2 = if marketOpen and shouldPlot then shortT2 else Double.NaN;

LongTarget1.SetDefaultColor(Color.CYAN);
LongTarget2.SetDefaultColor(Color.CYAN);
ShortTarget1.SetDefaultColor(Color.CYAN);
ShortTarget2.SetDefaultColor(Color.CYAN);
LongTarget1.SetStyle(Curve.SHORT_DASH);
LongTarget2.SetStyle(Curve.SHORT_DASH);
ShortTarget1.SetStyle(Curve.SHORT_DASH);
ShortTarget2.SetStyle(Curve.SHORT_DASH);
LongTarget1.SetLineWeight(1);
LongTarget2.SetLineWeight(1);
ShortTarget1.SetLineWeight(1);
ShortTarget2.SetLineWeight(1);

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
# Entry conditions: breakout above VAH (long) or below VAL (short)
def rawLongEntry = close > VAH and close[1] <= VAH and (!useEMAFilter or bullishStack);
def rawShortEntry = close < VAL and close[1] >= VAL and (!useEMAFilter or bearishStack);

# Additional strategy: reversion to POC
# Can add mean reversion trades when price is far from POC
def farAbovePOC = close > VAH and close > POC;
def farBelowPOC = close < VAL and close < POC;

# Track if T1 or stop was hit to determine if we can take new trades
rec inTrade = if firstBar then 0
              else if (inTrade[1] == 1 and (high >= longT1 or low <= longStop)) then 0
              else if (inTrade[1] == -1 and (low <= shortT1 or high >= shortStop)) then 0
              else if rawLongEntry and inTrade[1] == 0 then 1
              else if rawShortEntry and inTrade[1] == 0 then -1
              else inTrade[1];

# Entry signals fire only when no active trade
def longEntrySignal = rawLongEntry and inTrade[1] == 0;
def shortEntrySignal = rawShortEntry and inTrade[1] == 0;

AddVerticalLine(longEntrySignal and marketOpen, "Long", Color.GREEN, Curve.SHORT_DASH);
AddVerticalLine(shortEntrySignal and marketOpen, "Short", Color.RED, Curve.SHORT_DASH);

# ========== Target and Stop Tracking for Bubbles ==========
rec tradeDirection = if longEntrySignal then 1
                     else if shortEntrySignal then -1
                     else if firstBar then 0
                     else tradeDirection[1];

def newEntry = longEntrySignal or shortEntrySignal;

rec t1_hit = if tradeDirection == 1 and high >= longT1 then 1
             else if tradeDirection == -1 and low <= shortT1 then 1
             else if newEntry or firstBar then 0
             else t1_hit[1];

rec t2_hit = if tradeDirection == 1 and high >= longT2 then 1
             else if tradeDirection == -1 and low <= shortT2 then 1
             else if newEntry or firstBar then 0
             else t2_hit[1];

rec stop_hit = if tradeDirection == 1 and low <= longStop then 1
               else if tradeDirection == -1 and high >= shortStop then 1
               else if newEntry or firstBar then 0
               else stop_hit[1];

# Bubble conditions - only show if trade is active (stop hasn't been hit)
def showT1Bubble = (tradeDirection == 1 and high >= longT1 or tradeDirection == -1 and low <= shortT1) and !t1_hit[1] and !stop_hit;
def showT2Bubble = (tradeDirection == 1 and high >= longT2 or tradeDirection == -1 and low <= shortT2) and !t2_hit[1] and !stop_hit;
def showStopBubble = (tradeDirection == 1 and low <= longStop or tradeDirection == -1 and high >= shortStop) and !t1_hit and !stop_hit[1];

AddChartBubble(showT1Bubble and tradeDirection == 1, high, "T1", Color.CYAN, yes);
AddChartBubble(showT1Bubble and tradeDirection == -1, low, "T1", Color.CYAN, no);
AddChartBubble(showT2Bubble and tradeDirection == 1, high, "T2", Color.CYAN, yes);
AddChartBubble(showT2Bubble and tradeDirection == -1, low, "T2", Color.CYAN, no);
AddChartBubble(showStopBubble and tradeDirection == 1, low, "Stop", Color.RED, no);
AddChartBubble(showStopBubble and tradeDirection == -1, high, "Stop", Color.RED, yes);

# ========== Active Stop Loss Lines ==========
def showActiveLongStop = tradeDirection == 1 and !t1_hit and !stop_hit and marketOpen;
def showActiveShortStop = tradeDirection == -1 and !t1_hit and !stop_hit and marketOpen;

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

AddLabel(showLabels, "Prev Day VA: " + Round(labelVAWidth, 2), Color.CYAN);
AddLabel(showLabels, "VAH: " + Round(labelVAH, 2) + " | POC: " + Round(labelPOC, 2) + " | VAL: " + Round(labelVAL, 2), Color.MAGENTA);
AddLabel(showLabels, "ATR: " + Round(atr, 2), Color.CYAN);
AddLabel(showLabels, "Long T1: " + Round(longT1, 2) + " | T2: " + Round(longT2, 2), Color.GREEN);
AddLabel(showLabels, "Short T1: " + Round(shortT1, 2) + " | T2: " + Round(shortT2, 2), Color.RED);
