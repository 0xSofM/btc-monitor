import json

data = json.load(open('data/history/btc_indicators_history.json'))
print('Total records:', len(data))

for r in data[-5:]:
    d = r.get('d')
    btc = r.get('btcPrice')
    mvrv = r.get('mvrvZscore')
    if mvrv is None:
        mvrv = 'N/A'
    lth = r.get('lthMvrv')
    if lth is None:
        lth = 'N/A'
    puell = r.get('puellMultiple')
    if puell is None:
        puell = 'N/A'
    nupl = r.get('nupl')
    if nupl is None:
        nupl = 'N/A'
    print(f"{d}: btc={btc}, mvrv={mvrv}, lth={lth}, puell={puell}, nupl={nupl}")
