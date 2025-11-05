input showOnlyToday = yes;
input InitialBalanceMinutes = 60;
input Market_Open_Time = 0930;
input Market_Close_Time = 1600;
input coeff1 = 0.50;
input coeff2 = 1.00;
input stopLossPoints = 3.0;
input useEMAFilter = yes;
input emaFast = 8;
input emaMedium = 21;
input emaSlow = 34;

def day = GetDay();
def isToday = day == GetLastDay();
def shouldPlot = if showOnlyToday then isToday else 1;
def pastOpen = SecondsTillTime(Market_Open_Time) <= 0;
def pastClose = SecondsTillTime(Market_Close_Time) <= 0;
def marketOpen = pastOpen and !pastClose;
def firstBar = day[1] != day;

def secondsFromOpen = SecondsFromTime(Market_Open_Time);
def pastOpeningRange = secondsFromOpen >= InitialBalanceMinutes * 60;

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

def ORWidth = IBH - IBL;
plot Mid = (IBH + IBL) / 2;
Mid.SetDefaultColor(Color.MAGENTA);
Mid.SetStyle(Curve.SHORT_DASH);
Mid.SetLineWeight(1);

plot extp1 = IBH + (ORWidth * coeff1);
plot extp2 = IBH + (ORWidth * coeff2);
plot extn1 = IBL - (ORWidth * coeff1);
plot extn2 = IBL - (ORWidth * coeff2);
extp1.SetDefaultColor(Color.CYAN);
extp2.SetDefaultColor(Color.CYAN);
extn1.SetDefaultColor(Color.CYAN);
extn2.SetDefaultColor(Color.CYAN);
extp1.SetStyle(Curve.SHORT_DASH);
extp2.SetStyle(Curve.SHORT_DASH);
extn1.SetStyle(Curve.SHORT_DASH);
extn2.SetStyle(Curve.SHORT_DASH);
extp1.SetLineWeight(1);
extp2.SetLineWeight(1);
extn1.SetLineWeight(1);
extn2.SetLineWeight(1);

# Stacked EMA Trend Filter
def ema1 = ExpAverage(close, emaFast);
def ema2 = ExpAverage(close, emaMedium);
def ema3 = ExpAverage(close, emaSlow);

def bullishStack = ema1 > ema2 and ema2 > ema3;
def bearishStack = ema1 < ema2 and ema2 < ema3;

# Plot EMAs
plot EMA_Fast = ema1;
plot EMA_Medium = ema2;
plot EMA_Slow = ema3;

EMA_Fast.SetDefaultColor(Color.YELLOW);
EMA_Medium.SetDefaultColor(Color.ORANGE);
EMA_Slow.SetDefaultColor(Color.DARK_ORANGE);
EMA_Fast.SetLineWeight(1);
EMA_Medium.SetLineWeight(1);
EMA_Slow.SetLineWeight(1);

# Raw entry conditions (price crosses IB levels)
def rawLongEntry = close > IBH and close[1] <= IBH and (!useEMAFilter or bullishStack);
def rawShortEntry = close < IBL and close[1] >= IBL and (!useEMAFilter or bearishStack);

# Use raw entries for trade state tracking
rec tradeState = if rawLongEntry then 1 else if rawShortEntry then -1 else if firstBar then 0 else tradeState[1];
def isNewSignal = rawLongEntry or rawShortEntry;

rec t1p_was_hit = if tradeState == 1 and high >= extp1 then 1 else if isNewSignal or firstBar then 0 else t1p_was_hit[1];
rec t2p_was_hit = if tradeState == 1 and high >= extp2 then 1 else if isNewSignal or firstBar then 0 else t2p_was_hit[1];
rec t1n_was_hit = if tradeState == -1 and low <= extn1 then 1 else if isNewSignal or firstBar then 0 else t1n_was_hit[1];
rec t2n_was_hit = if tradeState == -1 and low <= extn2 then 1 else if isNewSignal or firstBar then 0 else t2n_was_hit[1];

rec anyTargetHit = if isNewSignal or firstBar then 0 else if t1p_was_hit or t2p_was_hit or t1n_was_hit or t2n_was_hit then 1 else anyTargetHit[1];

def longStopCondition = tradeState == 1 and low <= (IBHigh - stopLossPoints);
def shortStopCondition = tradeState == -1 and high >= (IBLow + stopLossPoints);
rec stop_was_hit = if isNewSignal or firstBar then 0 else if (longStopCondition or shortStopCondition) and !anyTargetHit then 1 else stop_was_hit[1];

# Track if there's an active trade (one that hasn't hit T1 or stop yet)
rec hasActiveTrade = if firstBar then 0
                     else if t1p_was_hit or t1n_was_hit or stop_was_hit then 0
                     else if isNewSignal then 1
                     else hasActiveTrade[1];

# Filtered entry signals - only trigger when no active trade exists
def longEntrySignal = rawLongEntry and !hasActiveTrade[1];
def shortEntrySignal = rawShortEntry and !hasActiveTrade[1];

# Vertical lines for entries (only show when no active trade)
AddVerticalLine(longEntrySignal and pastOpeningRange and marketOpen, "Long Triggered", Color.GREEN, Curve.SHORT_DASH);
AddVerticalLine(shortEntrySignal and pastOpeningRange and marketOpen, "Short Triggered", Color.RED, Curve.SHORT_DASH);

def plot_t1p_bubble = tradeState == 1 and high >= extp1 and !t1p_was_hit[1];
def plot_t2p_bubble = tradeState == 1 and high >= extp2 and !t2p_was_hit[1];
def plot_t1n_bubble = tradeState == -1 and low <= extn1 and !t1n_was_hit[1];
def plot_t2n_bubble = tradeState == -1 and low <= extn2 and !t2n_was_hit[1];
def plot_stop_bubble = (longStopCondition or shortStopCondition) and !anyTargetHit and !stop_was_hit[1];

AddChartBubble(plot_t1p_bubble, high, "T1", Color.CYAN, yes);
AddChartBubble(plot_t2p_bubble, high, "T2", Color.CYAN, yes);
AddChartBubble(plot_t1n_bubble, low, "T1", Color.CYAN, no);
AddChartBubble(plot_t2n_bubble, low, "T2", Color.CYAN, no);
AddChartBubble(plot_stop_bubble and tradeState == 1, low, "Stop", Color.RED, no);
AddChartBubble(plot_stop_bubble and tradeState == -1, high, "Stop", Color.RED, yes);

# Plot stop loss lines
def showLongStop = tradeState == 1 and !t1p_was_hit and !stop_was_hit and pastOpeningRange and marketOpen;
def showShortStop = tradeState == -1 and !t1n_was_hit and !stop_was_hit and pastOpeningRange and marketOpen;

plot LongStop = if showLongStop then IBHigh - stopLossPoints else Double.NaN;
plot ShortStop = if showShortStop then IBLow + stopLossPoints else Double.NaN;

LongStop.SetDefaultColor(Color.RED);
LongStop.SetStyle(Curve.SHORT_DASH);
LongStop.SetLineWeight(2);
ShortStop.SetDefaultColor(Color.RED);
ShortStop.SetStyle(Curve.SHORT_DASH);
ShortStop.SetLineWeight(2);

input InitialBalance_Label = yes;

# Store the last valid IB values for labels
def labelIBHigh = if !IsNaN(IBH) then IBH else labelIBHigh[1];
def labelIBLow = if !IsNaN(IBL) then IBL else labelIBLow[1];
def labelORWidth = labelIBHigh - labelIBLow;
def labelExtp1 = labelIBHigh + (labelORWidth * coeff1);
def labelExtp2 = labelIBHigh + (labelORWidth * coeff2);
def labelExtn1 = labelIBLow - (labelORWidth * coeff1);
def labelExtn2 = labelIBLow - (labelORWidth * coeff2);

AddLabel(InitialBalance_Label, "IB: " + Round(labelORWidth, 2), Color.CYAN);
AddLabel(InitialBalance_Label, "Long T1: " + Round(labelExtp1, 2), Color.GREEN);
AddLabel(InitialBalance_Label, "Long T2: " + Round(labelExtp2, 2), Color.GREEN);
AddLabel(InitialBalance_Label, "Short T1: " + Round(labelExtn1, 2), Color.RED);
AddLabel(InitialBalance_Label, "Short T2: " + Round(labelExtn2, 2), Color.RED);
