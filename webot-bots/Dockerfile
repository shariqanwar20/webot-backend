FROM python:latest

WORKDIR /usr/app/src

COPY tv-bot.py ./

RUN pip install tradingview_ta
RUN pip install tradingview_ws
RUN pip install pandas
RUN pip install boto3

CMD [ "python3", "tv-bot.py" ]