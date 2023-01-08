from tradingview_ta import TA_Handler, Interval
import tradingview_ws as td
import time
import pandas as pd
import boto3
import json
import os

#event bridge
event_bus_name = os.getenv('EVENT_BUS_NAME')

#user stats
start = 1000
amnt = 1000
owned = 0
trades = 0

# tradingview indicator summary
pair = "BTCUSDT"
exch = "BINANCE"
coin = TA_Handler(
    symbol= pair,
    screener= "Crypto",
    exchange=exch,
    interval=Interval.INTERVAL_1_MINUTE,
)
client = boto3.client('events')

#user functions
def decision(analysis, rate):
    #buying is done in this function
    global start, amnt, owned, trades
    holding = owned * rate
    if analysis["RECOMMENDATION"] == "BUY":
        if amnt > start *0.1:
            trades+=1
            qty = start * 1/100
            amnt = amnt - qty
            owned = owned + (qty / rate)
            send_event(detail={"pair": pair, "exchange": exch, "quantity": qty, "rate": rate, "trades": trades, "amount": amnt, "owned": owned}, detail_type="BUY")
        else:
            print("No more buying power")
    elif analysis["RECOMMENDATION"] == "STRONG_BUY":
        if amnt > start *0.05:
            trades+=1
            qty = start * 5/100
            amnt = amnt - qty
            owned = owned + (qty / rate)
            send_event(detail={"pair": pair, "exchange": exch, "quantity": qty, "rate": rate, "trades": trades, "amount": amnt, "owned": owned}, detail_type="STRONG_BUY")

        else:
            print("No more buying power")
    elif analysis["RECOMMENDATION"] == "SELL":
        if owned != 0:
            qty = start * 1/100
            trades+=1
            if holding > qty:
                amnt = amnt + qty
                owned = owned - (qty / rate)
            else:
                amnt = amnt + holding
                owned = owned - (holding / rate)
            send_event(detail={"pair": pair, "exchange": exch, "quantity": qty, "rate": rate, "trades": trades, "amount": amnt, "owned": owned}, detail_type="SELL")
        else:
            print("Not holding so not selling")
    elif analysis["RECOMMENDATION"] == "STRONG_SELL":
        if owned != 0:
            qty = start * 5/100
            trades+=1
            if holding > qty:
                amnt = amnt + qty
                owned = owned - (qty / rate)
            else:
                amnt = amnt + holding
                owned = owned - (holding / rate)
            send_event(detail={"pair": pair, "exchange": exch, "quantity": qty, "rate": rate, "trades": trades, "amount": amnt, "owned": owned}, detail_type="STRONG_SELL")
        else:
            print("Not holding so not selling")
    else:
        print("Holding no trades executed")

#sends event to eventbus
def send_event(detail, detail_type):
    event = {
                'EventBusName': event_bus_name,
                'Detail': json.dumps(detail),
                'DetailType': detail_type,
                'Source': 'tvbot'
            }

    response = client.put_events(
        Entries=[event]
    )
    print("Response => ", response)

def status(rec, rate):
    #status is printed
    global start, amnt, owned, trades
    holding = owned * rate
    profit = amnt + holding - start 
    print("RECOMMENDATION: ", rec)
    print(pd.DataFrame(data=[[amnt, holding, owned, profit, trades]], columns=["Amount", "Holding", "Owned", "Profit", "Trades"]))

#tradingview data
def callbackFunc(s):
    global start, amnt, owned, trades
    rate = s["price"]
    analysis = coin.get_analysis().summary
    decision(analysis=analysis, rate=rate)
    status(rec=analysis["RECOMMENDATION"], rate=rate)
    time.sleep(5)
pair = "BTCUSDT"

market = "crypto" # 'stock' | 'futures' | 'forex' | 'cfd' | 'crypto' | 'index' | 'economic'
username = None
password = None
trading = td.TradingViewWs(pair, market, username, password)
# get quote price
trading.realtime_quote(callbackFunc)

