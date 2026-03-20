"""检查历史数据中各指标的实际日期"""
import json

with open('app/public/btc_indicators_history.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print('检查最后 10 条数据中各指标的值：')
print('日期 | mvrvZscore | lthMvrv | puellMultiple | nupl')
print('-' * 60)
for item in data[-10:]:
    d = item.get('d', 'unknown')
    mvrv = item.get('mvrvZscore', item.get('mvrv_zscore', 'N/A'))
    lth = item.get('lthMvrv', item.get('lth_mvrv', 'N/A'))
    puell = item.get('puellMultiple', item.get('puell_multiple', 'N/A'))
    nupl = item.get('nupl', 'N/A')
    print(f'{d} | {mvrv} | {lth} | {puell} | {nupl}')

# 查找每个指标最后一次非空值的日期
print('\n' + '=' * 60)
print('查找每个指标最后一次非空值的日期：')

# 从后向前查找
mvrv_date = None
lth_date = None
puell_date = None
nupl_date = None
price_date = None

for i in range(len(data) - 1, -1, -1):
    item = data[i]
    d = item.get('d')
    
    if mvrv_date is None and item.get('mvrvZscore') is not None:
        mvrv_date = d
    if lth_date is None and item.get('lthMvrv') is not None:
        lth_date = d
    if puell_date is None and item.get('puellMultiple') is not None:
        puell_date = d
    if nupl_date is None and item.get('nupl') is not None:
        nupl_date = d
    if price_date is None and item.get('btcPrice') is not None:
        price_date = d
    
    if all([mvrv_date, lth_date, puell_date, nupl_date, price_date]):
        break

print(f'BTC Price: {price_date}')
print(f'MVRV Z-Score: {mvrv_date}')
print(f'LTH-MVRV: {lth_date}')
print(f'Puell Multiple: {puell_date}')
print(f'NUPL: {nupl_date}')
