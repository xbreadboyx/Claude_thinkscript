# Initial Balance Trading Strategy - Backtest Version
# Optimized for backtesting - Strategy with AddOrder()

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

# ATR Targets and Stops
def atr = ATR(length = atrPeriod);
def longT1 = IBHigh + (atr * atrMultiplierT1);
def longT2 = IBHigh + (atr * atrMultiplierT2);
def shortT1 = IBLow - (atr * atrMultiplierT1);
def shortT2 = IBLow - (atr * atrMultiplierT2);
def longStop = IBHigh - (atr * stopLossATRMultiplier);
def shortStop = IBLow + (atr * stopLossATRMultiplier);

# EMA Filter
def ema1 = ExpAverage(close, emaFast);
def ema2 = ExpAverage(close, emaMedium);
def ema3 = ExpAverage(close, emaSlow);
def bullishStack = ema1 > ema2 and ema2 > ema3;
def bearishStack = ema1 < ema2 and ema2 < ema3;

# Entry Conditions
def rawLongEntry = close > IBHigh and close[1] <= IBHigh and (!useEMAFilter or bullishStack) and pastOpeningRange and marketOpen;
def rawShortEntry = close < IBLow and close[1] >= IBLow and (!useEMAFilter or bearishStack) and pastOpeningRange and marketOpen;

# Entry Signals - prevent rapid-fire by checking previous bar
def longEntry = rawLongEntry and !rawLongEntry[1];
def shortEntry = rawShortEntry and !rawShortEntry[1];

# Capture levels at entry
rec entryStop = if longEntry then longStop
                else if shortEntry then shortStop
                else if firstBar or !marketOpen then Double.NaN
                else entryStop[1];

rec entryTarget1 = if longEntry then longT1
                   else if shortEntry then shortT1
                   else if firstBar or !marketOpen then Double.NaN
                   else entryTarget1[1];

rec entryTarget2 = if longEntry then longT2
                   else if shortEntry then shortT2
                   else if firstBar or !marketOpen then Double.NaN
                   else entryTarget2[1];

# Track which exits fired
rec t1Hit = if longEntry or shortEntry or firstBar then 0
            else if !IsNaN(entryTarget1) and (high >= entryTarget1 or low <= entryTarget1) then 1
            else t1Hit[1];

rec t2Hit = if longEntry or shortEntry or firstBar then 0
            else if !IsNaN(entryTarget2) and (high >= entryTarget2 or low <= entryTarget2) then 1
            else t2Hit[1];

rec stopHit = if longEntry or shortEntry or firstBar then 0
              else if !IsNaN(entryStop) and (low <= entryStop or high >= entryStop) then 1
              else stopHit[1];

# Exit Conditions
def t1Exit = !IsNaN(entryTarget1) and (high >= entryTarget1 or low <= entryTarget1) and !t1Hit[1] and !stopHit;
def t2Exit = !IsNaN(entryTarget2) and (high >= entryTarget2 or low <= entryTarget2) and !t2Hit[1] and !stopHit;
def stopExit = !IsNaN(entryStop) and (low <= entryStop or high >= entryStop) and !stopHit[1];
def closeExit = pastClose and !firstBar and (!stopHit or !t2Hit);

# Strategy Orders
AddOrder(OrderType.BUY_TO_OPEN, longEntry, close, 2, Color.GREEN, Color.GREEN, "Long");
AddOrder(OrderType.SELL_TO_CLOSE, t1Exit and longEntry[1], close, 1, Color.CYAN, Color.CYAN, "Long T1");
AddOrder(OrderType.SELL_TO_CLOSE, t2Exit and longEntry[1], close, 1, Color.CYAN, Color.CYAN, "Long T2");
AddOrder(OrderType.SELL_TO_CLOSE, stopExit and longEntry[1], close, 2, Color.RED, Color.RED, "Long Stop");
AddOrder(OrderType.SELL_TO_CLOSE, closeExit and longEntry[1], close, 2, Color.ORANGE, Color.ORANGE, "Long Close");

AddOrder(OrderType.SELL_TO_OPEN, shortEntry, close, 2, Color.RED, Color.RED, "Short");
AddOrder(OrderType.BUY_TO_CLOSE, t1Exit and shortEntry[1], close, 1, Color.CYAN, Color.CYAN, "Short T1");
AddOrder(OrderType.BUY_TO_CLOSE, t2Exit and shortEntry[1], close, 1, Color.CYAN, Color.CYAN, "Short T2");
AddOrder(OrderType.BUY_TO_CLOSE, stopExit and shortEntry[1], close, 2, Color.RED, Color.RED, "Short Stop");
AddOrder(OrderType.BUY_TO_CLOSE, closeExit and shortEntry[1], close, 2, Color.ORANGE, Color.ORANGE, "Short Close");
