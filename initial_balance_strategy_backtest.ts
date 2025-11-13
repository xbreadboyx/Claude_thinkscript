# Initial Balance Strategy - Simple Backtest Version
# One trade per day, single target, clean stop

input InitialBalanceMinutes = 60;
input Market_Open_Time = 0930;
input Market_Close_Time = 1600;
input atrPeriod = 14;
input atrMultiplierTarget = 1.5;
input stopLossATRMultiplier = 1.0;
input useEMAFilter = yes;
input emaFast = 8;
input emaMedium = 21;
input emaSlow = 34;

# Time Management
def day = GetDay();
def pastOpen = SecondsTillTime(Market_Open_Time) <= 0;
def pastClose = SecondsTillTime(Market_Close_Time) <= 0;
def marketOpen = pastOpen and !pastClose;
def firstBar = day[1] != day;
def secondsFromOpen = SecondsFromTime(Market_Open_Time);
def pastOpeningRange = secondsFromOpen >= InitialBalanceMinutes * 60;

# Initial Balance
rec displayedHigh = if !marketOpen or firstBar then high else Max(high, displayedHigh[1]);
rec displayedLow = if !marketOpen or firstBar then low else Min(low, displayedLow[1]);
rec IBHigh = if pastOpeningRange then IBHigh[1] else displayedHigh;
rec IBLow = if pastOpeningRange then IBLow[1] else displayedLow;

# ATR Target and Stop
def atr = ATR(length = atrPeriod);
def longTarget = IBHigh + (atr * atrMultiplierTarget);
def shortTarget = IBLow - (atr * atrMultiplierTarget);
def longStop = IBHigh - (atr * stopLossATRMultiplier);
def shortStop = IBLow + (atr * stopLossATRMultiplier);

# EMA Filter
def ema1 = ExpAverage(close, emaFast);
def ema2 = ExpAverage(close, emaMedium);
def ema3 = ExpAverage(close, emaSlow);
def bullishStack = ema1 > ema2 and ema2 > ema3;
def bearishStack = ema1 < ema2 and ema2 < ema3;

# Entry Conditions
def longCondition = close > IBHigh and close[1] <= IBHigh and (!useEMAFilter or bullishStack) and pastOpeningRange and marketOpen;
def shortCondition = close < IBLow and close[1] >= IBLow and (!useEMAFilter or bearishStack) and pastOpeningRange and marketOpen;

# Track if we've traded today (one trade per day max)
rec tradedToday = if firstBar then 0
                  else if longCondition or shortCondition then 1
                  else tradedToday[1];

# Entry Signals - only first trade of the day
def longEntry = longCondition and tradedToday[1] == 0;
def shortEntry = shortCondition and tradedToday[1] == 0;

# Capture entry levels
rec entryStop = if longEntry then longStop
                else if shortEntry then shortStop
                else if firstBar then Double.NaN
                else entryStop[1];

rec entryTarget = if longEntry then longTarget
                  else if shortEntry then shortTarget
                  else if firstBar then Double.NaN
                  else entryTarget[1];

# Track if in position
rec inTrade = if firstBar then 0
              else if longEntry or shortEntry then 1
              else if inTrade[1] == 1 and (!IsNaN(entryStop) or !IsNaN(entryTarget)) then 1
              else 0;

# Exit Conditions
def targetHit = !IsNaN(entryTarget) and inTrade == 1 and (high >= entryTarget or low <= entryTarget);
def stopHit = !IsNaN(entryStop) and inTrade == 1 and (low <= entryStop or high >= entryStop);
def closeExit = pastClose and inTrade == 1;

# Track exits to prevent multiple fills
rec targetFired = if firstBar or longEntry or shortEntry then 0
                  else if targetHit then 1
                  else targetFired[1];

rec stopFired = if firstBar or longEntry or shortEntry then 0
                else if stopHit then 1
                else stopFired[1];

# Final exit signals (fire once only)
def exitTarget = targetHit and !targetFired[1] and !stopFired;
def exitStop = stopHit and !stopFired[1];
def exitClose = closeExit and !targetFired and !stopFired;

# Strategy Orders
AddOrder(OrderType.BUY_TO_OPEN, longEntry, close, 1, Color.GREEN, Color.GREEN, "Long Entry");
AddOrder(OrderType.SELL_TO_CLOSE, exitTarget and longEntry[1], close, 1, Color.CYAN, Color.CYAN, "Long Target");
AddOrder(OrderType.SELL_TO_CLOSE, exitStop and longEntry[1], close, 1, Color.RED, Color.RED, "Long Stop");
AddOrder(OrderType.SELL_TO_CLOSE, exitClose and longEntry[1], close, 1, Color.ORANGE, Color.ORANGE, "Long Close");

AddOrder(OrderType.SELL_TO_OPEN, shortEntry, close, 1, Color.RED, Color.RED, "Short Entry");
AddOrder(OrderType.BUY_TO_CLOSE, exitTarget and shortEntry[1], close, 1, Color.CYAN, Color.CYAN, "Short Target");
AddOrder(OrderType.BUY_TO_CLOSE, exitStop and shortEntry[1], close, 1, Color.RED, Color.RED, "Short Stop");
AddOrder(OrderType.BUY_TO_CLOSE, exitClose and shortEntry[1], close, 1, Color.ORANGE, Color.ORANGE, "Short Close");
