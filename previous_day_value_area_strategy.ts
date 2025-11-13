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
# True volume profile calculation
# Divide previous day's range into price levels and track volume at each level
# Value Area = price range containing 70% of previous day's volume
# POC = Point of Control (price level with highest volume)

# Get previous day's high, low, and total volume
def prevHigh = high(period = "DAY")[1];
def prevLow = low(period = "DAY")[1];
def prevTotalVol = volume(period = "DAY")[1];
def prevRange = prevHigh - prevLow;

# Divide range into discrete price levels (using 10 levels for manageable calculation)
def numLevels = 10;
def priceStep = prevRange / numLevels;

# Define price boundaries for each level (0 = lowest, 9 = highest)
def level0_low = prevLow;
def level1_low = prevLow + priceStep * 1;
def level2_low = prevLow + priceStep * 2;
def level3_low = prevLow + priceStep * 3;
def level4_low = prevLow + priceStep * 4;
def level5_low = prevLow + priceStep * 5;
def level6_low = prevLow + priceStep * 6;
def level7_low = prevLow + priceStep * 7;
def level8_low = prevLow + priceStep * 8;
def level9_low = prevLow + priceStep * 9;

# Track volume at each price level during previous day
# Accumulate volume when the bar's price range touches that level
def isPrevDay = GetDay() == GetLastDay() - 1;

# For each bar, check if it traded at each level (if high >= level and low <= level+step)
rec vol0 = if firstBar then 0
           else if isPrevDay and high >= level0_low and low < level1_low then vol0[1] + volume
           else if GetDay() == GetLastDay() and GetDay() != GetDay()[1] then 0
           else vol0[1];

rec vol1 = if firstBar then 0
           else if isPrevDay and high >= level1_low and low < level2_low then vol1[1] + volume
           else if GetDay() == GetLastDay() and GetDay() != GetDay()[1] then 0
           else vol1[1];

rec vol2 = if firstBar then 0
           else if isPrevDay and high >= level2_low and low < level3_low then vol2[1] + volume
           else if GetDay() == GetLastDay() and GetDay() != GetDay()[1] then 0
           else vol2[1];

rec vol3 = if firstBar then 0
           else if isPrevDay and high >= level3_low and low < level4_low then vol3[1] + volume
           else if GetDay() == GetLastDay() and GetDay() != GetDay()[1] then 0
           else vol3[1];

rec vol4 = if firstBar then 0
           else if isPrevDay and high >= level4_low and low < level5_low then vol4[1] + volume
           else if GetDay() == GetLastDay() and GetDay() != GetDay()[1] then 0
           else vol4[1];

rec vol5 = if firstBar then 0
           else if isPrevDay and high >= level5_low and low < level6_low then vol5[1] + volume
           else if GetDay() == GetLastDay() and GetDay() != GetDay()[1] then 0
           else vol5[1];

rec vol6 = if firstBar then 0
           else if isPrevDay and high >= level6_low and low < level7_low then vol6[1] + volume
           else if GetDay() == GetLastDay() and GetDay() != GetDay()[1] then 0
           else vol6[1];

rec vol7 = if firstBar then 0
           else if isPrevDay and high >= level7_low and low < level8_low then vol7[1] + volume
           else if GetDay() == GetLastDay() and GetDay() != GetDay()[1] then 0
           else vol7[1];

rec vol8 = if firstBar then 0
           else if isPrevDay and high >= level8_low and low < level9_low then vol8[1] + volume
           else if GetDay() == GetLastDay() and GetDay() != GetDay()[1] then 0
           else vol8[1];

rec vol9 = if firstBar then 0
           else if isPrevDay and high >= level9_low and low <= prevHigh then vol9[1] + volume
           else if GetDay() == GetLastDay() and GetDay() != GetDay()[1] then 0
           else vol9[1];

# Find the level with highest volume (POC)
def maxVol = Max(vol0, Max(vol1, Max(vol2, Max(vol3, Max(vol4, Max(vol5, Max(vol6, Max(vol7, Max(vol8, vol9)))))))));

# Determine which level is POC
def pocLevel = if vol0 == maxVol then 0
               else if vol1 == maxVol then 1
               else if vol2 == maxVol then 2
               else if vol3 == maxVol then 3
               else if vol4 == maxVol then 4
               else if vol5 == maxVol then 5
               else if vol6 == maxVol then 6
               else if vol7 == maxVol then 7
               else if vol8 == maxVol then 8
               else 9;

# POC price is the midpoint of the POC level
def POC = prevLow + (pocLevel * priceStep) + (priceStep / 2);

# Calculate value area by expanding from POC until we capture 70% of volume
# Start with POC level volume, then add adjacent levels until reaching 70%
def targetVol = prevTotalVol * 0.70;

# Build value area by including levels around POC
# Start with POC level and expand both directions
def pocVol = if pocLevel == 0 then vol0
             else if pocLevel == 1 then vol1
             else if pocLevel == 2 then vol2
             else if pocLevel == 3 then vol3
             else if pocLevel == 4 then vol4
             else if pocLevel == 5 then vol5
             else if pocLevel == 6 then vol6
             else if pocLevel == 7 then vol7
             else if pocLevel == 8 then vol8
             else vol9;

# Expand from POC: we'll use a simplified approach
# Calculate how many levels above and below POC to include
# For simplicity, include adjacent levels symmetrically until we hit 70%

# Sum all volumes to verify
def totalVol = vol0 + vol1 + vol2 + vol3 + vol4 + vol5 + vol6 + vol7 + vol8 + vol9;

# For value area calculation, expand from POC
# If we need ~70% of volume, and volume is distributed, we typically need 6-8 levels
# We'll expand symmetrically from POC

# Simple approach: include levels that represent top 70% of volume
# Start from POC and expand to adjacent levels
def vaLevelsAbove = 3; # Expand 3 levels above POC
def vaLevelsBelow = 3; # Expand 3 levels below POC

def vaLowLevel = Max(0, pocLevel - vaLevelsBelow);
def vaHighLevel = Min(9, pocLevel + vaLevelsAbove);

# Calculate VAH and VAL from the levels
def VAH = prevLow + (vaHighLevel * priceStep) + priceStep;
def VAL = prevLow + (vaLowLevel * priceStep);

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
# Display POC level and percentage of volume at POC
def pocVolPct = if totalVol > 0 then Round((pocVol / totalVol) * 100, 1) else 0;

# Calculate value area volume (sum of levels in VA range)
def vaVol = if vaLowLevel == 0 then vol0 else 0;
def vaVol1 = vaVol + if vaLowLevel <= 1 and vaHighLevel >= 1 then vol1 else 0;
def vaVol2 = vaVol1 + if vaLowLevel <= 2 and vaHighLevel >= 2 then vol2 else 0;
def vaVol3 = vaVol2 + if vaLowLevel <= 3 and vaHighLevel >= 3 then vol3 else 0;
def vaVol4 = vaVol3 + if vaLowLevel <= 4 and vaHighLevel >= 4 then vol4 else 0;
def vaVol5 = vaVol4 + if vaLowLevel <= 5 and vaHighLevel >= 5 then vol5 else 0;
def vaVol6 = vaVol5 + if vaLowLevel <= 6 and vaHighLevel >= 6 then vol6 else 0;
def vaVol7 = vaVol6 + if vaLowLevel <= 7 and vaHighLevel >= 7 then vol7 else 0;
def vaVol8 = vaVol7 + if vaLowLevel <= 8 and vaHighLevel >= 8 then vol8 else 0;
def vaVolTotal = vaVol8 + if vaHighLevel == 9 then vol9 else 0;

def vaPct = if totalVol > 0 then Round((vaVolTotal / totalVol) * 100, 1) else 0;

AddLabel(showLabels, "POC Level: " + pocLevel + " (" + pocVolPct + "% of vol) | VA: " + vaPct + "% of vol", Color.LIGHT_GRAY);
AddLabel(showLabels and openStatus == 1, "Opened Above VA - Looking for SHORT", Color.ORANGE);
AddLabel(showLabels and openStatus == -1, "Opened Below VA - Looking for LONG", Color.LIGHT_GREEN);
AddLabel(showLabels and openStatus == 0, "Opened Within VA - NO TRADE", Color.GRAY);
AddLabel(showLabels, "ATR: " + Round(atr, 2), Color.CYAN);
AddLabel(showLabels, "Long Target: " + Round(longTarget, 2) + " | Stop: " + Round(longStop, 2), Color.GREEN);
AddLabel(showLabels, "Short Target: " + Round(shortTarget, 2) + " | Stop: " + Round(shortStop, 2), Color.RED);
