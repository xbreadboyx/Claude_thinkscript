# Initial Balance Trading Strategy with ATR-Based Targets
# Clean, optimized version with efficient trade filtering

input showOnlyToday = yes;
input InitialBalanceMinutes = 60;
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
input bubbleOffsetATR = 0.3;

# ========== Time and Session Management ==========
def day = GetDay();
def isToday = day == GetLastDay();
def shouldPlot = if showOnlyToday then isToday else 1;
def pastOpen = SecondsTillTime(Market_Open_Time) <= 0;
def pastClose = SecondsTillTime(Market_Close_Time) <= 0;
def marketOpen = pastOpen and !pastClose;
def firstBar = day[1] != day;
def secondsFromOpen = SecondsFromTime(Market_Open_Time);
def pastOpeningRange = secondsFromOpen >= InitialBalanceMinutes * 60;

# ========== Initial Balance Calculation ==========
rec displayedHigh = if !marketOpen or firstBar then high else Max(high, displayedHigh[1]);
rec displayedLow = if !marketOpen or firstBar then low else Min(low, displayedLow[1]);
rec IBHigh = if pastOpeningRange then IBHigh[1] else displayedHigh;
rec IBLow = if pastOpeningRange then IBLow[1] else displayedLow;

plot IBH = if pastOpeningRange and marketOpen and shouldPlot then IBHigh else Double.NaN;
plot IBL = if pastOpeningRange and marketOpen and shouldPlot then IBLow else Double.NaN;
IBH.SetDefaultColor(Color.MAGENTA);
IBH.SetStyle(Curve.SHORT_DASH);
IBH.SetLineWeight(2);
IBL.SetDefaultColor(Color.MAGENTA);
IBL.SetStyle(Curve.SHORT_DASH);
IBL.SetLineWeight(2);
AddCloud(IBH, IBL, Color.LIGHT_GRAY, Color.LIGHT_GRAY);

plot Mid = if pastOpeningRange and marketOpen and shouldPlot then (IBH + IBL) / 2 else Double.NaN;
Mid.SetDefaultColor(Color.MAGENTA);
Mid.SetStyle(Curve.SHORT_DASH);
Mid.SetLineWeight(1);

# ========== ATR-Based Targets ==========
def atr = ATR(length = atrPeriod);
def longT1 = IBHigh + (atr * atrMultiplierT1);
def longT2 = IBHigh + (atr * atrMultiplierT2);
def shortT1 = IBLow - (atr * atrMultiplierT1);
def shortT2 = IBLow - (atr * atrMultiplierT2);
def longStop = IBHigh - (atr * stopLossATRMultiplier);
def shortStop = IBLow + (atr * stopLossATRMultiplier);

# Bubble vertical offset to avoid blocking price action
def bubbleOffset = atr * bubbleOffsetATR;

plot LongTarget1 = if pastOpeningRange and marketOpen and shouldPlot then longT1 else Double.NaN;
plot LongTarget2 = if pastOpeningRange and marketOpen and shouldPlot then longT2 else Double.NaN;
plot ShortTarget1 = if pastOpeningRange and marketOpen and shouldPlot then shortT1 else Double.NaN;
plot ShortTarget2 = if pastOpeningRange and marketOpen and shouldPlot then shortT2 else Double.NaN;

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
# Raw entry conditions
def rawLongEntry = close > IBH and close[1] <= IBH and (!useEMAFilter or bullishStack);
def rawShortEntry = close < IBL and close[1] >= IBL and (!useEMAFilter or bearishStack);

# Track if T1, T2, or stop was hit to determine if we can take new trades
rec inTrade = if firstBar or !pastOpeningRange or !marketOpen then 0
              else if (inTrade[1] == 1 and (high >= longT1 or high >= longT2 or low <= longStop)) then 0
              else if (inTrade[1] == -1 and (low <= shortT1 or low <= shortT2 or high >= shortStop)) then 0
              else if rawLongEntry and inTrade[1] == 0 then 1
              else if rawShortEntry and inTrade[1] == 0 then -1
              else inTrade[1];

# Entry signals fire only when no active trade
def longEntrySignal = rawLongEntry and inTrade[1] == 0;
def shortEntrySignal = rawShortEntry and inTrade[1] == 0;

AddVerticalLine(longEntrySignal and pastOpeningRange and marketOpen, "Long", Color.GREEN, Curve.SHORT_DASH);
AddVerticalLine(shortEntrySignal and pastOpeningRange and marketOpen, "Short", Color.RED, Curve.SHORT_DASH);

# ========== Target and Stop Tracking for Bubbles ==========
rec tradeDirection = if longEntrySignal then 1
                     else if shortEntrySignal then -1
                     else if firstBar or !marketOpen then 0
                     else tradeDirection[1];

def newEntry = longEntrySignal or shortEntrySignal;

# Capture point differences at entry - held constant throughout trade, reset when trade closes
rec t1Points = if newEntry then (if longEntrySignal then Round(longT1 - IBHigh, 2) else Round(IBLow - shortT1, 2))
               else if firstBar or !marketOpen then 0
               else t1Points[1];

rec t2Points = if newEntry then (if longEntrySignal then Round(longT2 - IBHigh, 2) else Round(IBLow - shortT2, 2))
               else if firstBar or !marketOpen then 0
               else t2Points[1];

rec stopPoints = if newEntry then (if longEntrySignal then Round(IBHigh - longStop, 2) else Round(shortStop - IBLow, 2))
                 else if firstBar or !marketOpen then 0
                 else stopPoints[1];

# Capture actual stop level at entry - held constant throughout trade
rec entryStopLevel = if newEntry then (if longEntrySignal then longStop else shortStop)
                     else if firstBar or !marketOpen then Double.NaN
                     else entryStopLevel[1];

rec t1_hit = if tradeDirection == 1 and high >= longT1 then 1
             else if tradeDirection == -1 and low <= shortT1 then 1
             else if newEntry or firstBar then 0
             else t1_hit[1];

rec t2_hit = if tradeDirection == 1 and high >= longT2 then 1
             else if tradeDirection == -1 and low <= shortT2 then 1
             else if newEntry or firstBar then 0
             else t2_hit[1];

rec stop_hit = if tradeDirection == 1 and low <= entryStopLevel then 1
               else if tradeDirection == -1 and high >= entryStopLevel then 1
               else if newEntry or firstBar then 0
               else stop_hit[1];

# Bubble conditions - only show if trade is active (stop hasn't been hit)
def showT1Bubble = (tradeDirection == 1 and high >= longT1 or tradeDirection == -1 and low <= shortT1) and !t1_hit[1] and !stop_hit;
def showT2Bubble = (tradeDirection == 1 and high >= longT2 or tradeDirection == -1 and low <= shortT2) and !t2_hit[1] and !stop_hit;
def showStopBubble = (tradeDirection == 1 and low <= entryStopLevel or tradeDirection == -1 and high >= entryStopLevel) and !t1_hit and !stop_hit[1];

AddChartBubble(showT1Bubble and tradeDirection == 1, high + bubbleOffset, "T1: " + t1Points, Color.CYAN, yes);
AddChartBubble(showT1Bubble and tradeDirection == -1, low - bubbleOffset, "T1: " + t1Points, Color.CYAN, no);
AddChartBubble(showT2Bubble and tradeDirection == 1, high + bubbleOffset, "T2: " + t2Points, Color.CYAN, yes);
AddChartBubble(showT2Bubble and tradeDirection == -1, low - bubbleOffset, "T2: " + t2Points, Color.CYAN, no);
AddChartBubble(showStopBubble and tradeDirection == 1, low - bubbleOffset, "Stop: " + stopPoints, Color.RED, no);
AddChartBubble(showStopBubble and tradeDirection == -1, high + bubbleOffset, "Stop: " + stopPoints, Color.RED, yes);

# ========== Active Stop Loss Lines ==========
# Use captured stop level from entry instead of dynamic calculation
def showActiveStop = (tradeDirection == 1 or tradeDirection == -1) and !t1_hit and !stop_hit and pastOpeningRange and marketOpen;

plot ActiveStopLevel = if showActiveStop and shouldPlot then entryStopLevel else Double.NaN;
ActiveStopLevel.SetDefaultColor(Color.RED);
ActiveStopLevel.SetStyle(Curve.SHORT_DASH);
ActiveStopLevel.SetLineWeight(2);

# ========== Labels ==========
def labelIBHigh = if !IsNaN(IBH) then IBH else labelIBHigh[1];
def labelIBLow = if !IsNaN(IBL) then IBL else labelIBLow[1];
def labelIBWidth = labelIBHigh - labelIBLow;

AddLabel(showLabels, "IB: " + Round(labelIBWidth, 2), Color.CYAN);
AddLabel(showLabels, "ATR: " + Round(atr, 2), Color.CYAN);
AddLabel(showLabels, "Long T1: " + Round(longT1, 2) + " | T2: " + Round(longT2, 2), Color.GREEN);
AddLabel(showLabels, "Short T1: " + Round(shortT1, 2) + " | T2: " + Round(shortT2, 2), Color.RED);
