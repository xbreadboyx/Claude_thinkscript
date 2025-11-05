# Initial Balance Trading Strategy - Backtest Version
# Optimized for backtesting different stop loss, target, and timeframe settings

# ========== Input Parameters ==========
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

# ========== Time and Session Management ==========
def day = GetDay();
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

# ========== ATR-Based Targets and Stops ==========
def atr = ATR(length = atrPeriod);
def longT1 = IBHigh + (atr * atrMultiplierT1);
def longT2 = IBHigh + (atr * atrMultiplierT2);
def shortT1 = IBLow - (atr * atrMultiplierT1);
def shortT2 = IBLow - (atr * atrMultiplierT2);
def longStop = IBHigh - (atr * stopLossATRMultiplier);
def shortStop = IBLow + (atr * stopLossATRMultiplier);

# ========== EMA Trend Filter ==========
def ema1 = ExpAverage(close, emaFast);
def ema2 = ExpAverage(close, emaMedium);
def ema3 = ExpAverage(close, emaSlow);
def bullishStack = ema1 > ema2 and ema2 > ema3;
def bearishStack = ema1 < ema2 and ema2 < ema3;

# ========== Entry Signal Logic ==========
def rawLongEntry = close > IBHigh and close[1] <= IBHigh and (!useEMAFilter or bullishStack);
def rawShortEntry = close < IBLow and close[1] >= IBLow and (!useEMAFilter or bearishStack);

# Track if T1, T2, or stop was hit to determine if we can take new trades
rec inTrade = if firstBar or !pastOpeningRange or !marketOpen then 0
              else if (inTrade[1] == 1 and (high >= longT1 or high >= longT2 or low <= longStop)) then 0
              else if (inTrade[1] == -1 and (low <= shortT1 or low <= shortT2 or high >= shortStop)) then 0
              else if rawLongEntry and inTrade[1] == 0 then 1
              else if rawShortEntry and inTrade[1] == 0 then -1
              else inTrade[1];

# Entry signals fire only when no active trade
def longEntrySignal = rawLongEntry and inTrade[1] == 0 and pastOpeningRange and marketOpen;
def shortEntrySignal = rawShortEntry and inTrade[1] == 0 and pastOpeningRange and marketOpen;

# ========== Trade Direction Tracking ==========
rec tradeDirection = if longEntrySignal then 1
                     else if shortEntrySignal then -1
                     else if firstBar or !marketOpen then 0
                     else tradeDirection[1];

def newEntry = longEntrySignal or shortEntrySignal;

# Capture stop level at entry - held constant throughout trade
rec entryStopLevel = if newEntry then (if longEntrySignal then longStop else shortStop)
                     else if firstBar or !marketOpen then Double.NaN
                     else entryStopLevel[1];

# Capture target levels at entry - held constant throughout trade
rec entryT1 = if newEntry then (if longEntrySignal then longT1 else shortT1)
              else if firstBar or !marketOpen then Double.NaN
              else entryT1[1];

rec entryT2 = if newEntry then (if longEntrySignal then longT2 else shortT2)
              else if firstBar or !marketOpen then Double.NaN
              else entryT2[1];

# ========== Exit Tracking - Prevent Multiple Fills ==========
# Track which exits have been triggered
rec t1_hit = if newEntry or firstBar then 0
             else if (tradeDirection == 1 and high >= entryT1) or (tradeDirection == -1 and low <= entryT1) then 1
             else t1_hit[1];

rec t2_hit = if newEntry or firstBar then 0
             else if (tradeDirection == 1 and high >= entryT2) or (tradeDirection == -1 and low <= entryT2) then 1
             else t2_hit[1];

rec stop_hit = if newEntry or firstBar then 0
               else if (tradeDirection == 1 and low <= entryStopLevel) or (tradeDirection == -1 and high >= entryStopLevel) then 1
               else stop_hit[1];

# ========== Exit Conditions - Fire Once Only ==========
# T1 exit - close 50% of position (only if stop hasn't been hit)
def t1Exit = ((tradeDirection == 1 and high >= entryT1) or (tradeDirection == -1 and low <= entryT1))
             and !t1_hit[1] and !stop_hit;

# T2 exit - close remaining 50% of position (only if stop hasn't been hit)
def t2Exit = ((tradeDirection == 1 and high >= entryT2) or (tradeDirection == -1 and low <= entryT2))
             and !t2_hit[1] and !stop_hit;

# Stop exit - close entire position (takes priority, fires once)
def stopExit = ((tradeDirection == 1 and low <= entryStopLevel) or (tradeDirection == -1 and high >= entryStopLevel))
               and !stop_hit[1];

# Market close exit - close any remaining open positions
def marketCloseExit = pastClose and !firstBar and (tradeDirection == 1 or tradeDirection == -1) and !stop_hit;

# ========== Strategy Orders ==========
AddOrder(OrderType.BUY_TO_OPEN, longEntrySignal, close, 2, Color.GREEN, Color.GREEN, "Long Entry");
AddOrder(OrderType.SELL_TO_CLOSE, t1Exit and tradeDirection == 1, close, 1, Color.CYAN, Color.CYAN, "Long T1");
AddOrder(OrderType.SELL_TO_CLOSE, t2Exit and tradeDirection == 1, close, 1, Color.CYAN, Color.CYAN, "Long T2");
AddOrder(OrderType.SELL_TO_CLOSE, stopExit and tradeDirection == 1, close, 2, Color.RED, Color.RED, "Long Stop");
AddOrder(OrderType.SELL_TO_CLOSE, marketCloseExit and tradeDirection == 1, close, 2, Color.ORANGE, Color.ORANGE, "Long Close");

AddOrder(OrderType.SELL_TO_OPEN, shortEntrySignal, close, 2, Color.RED, Color.RED, "Short Entry");
AddOrder(OrderType.BUY_TO_CLOSE, t1Exit and tradeDirection == -1, close, 1, Color.CYAN, Color.CYAN, "Short T1");
AddOrder(OrderType.BUY_TO_CLOSE, t2Exit and tradeDirection == -1, close, 1, Color.CYAN, Color.CYAN, "Short T2");
AddOrder(OrderType.BUY_TO_CLOSE, stopExit and tradeDirection == -1, close, 2, Color.RED, Color.RED, "Short Stop");
AddOrder(OrderType.BUY_TO_CLOSE, marketCloseExit and tradeDirection == -1, close, 2, Color.ORANGE, Color.ORANGE, "Short Close");
