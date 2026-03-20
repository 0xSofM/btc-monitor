#!/usr/bin/env python3
"""
检查历史数据中的API数据日期
"""

import json

def main():
    data = json.load(open('btc_indicators_history.json', 'r', encoding='utf-8'))
    last_records = data[-10:]
    
    print("最后10条记录的API数据日期:")
    for i, r in enumerate(last_records):
        api_date = r.get('apiDataDate') or r.get('api_data_date')
        print(f'{i+1}. {r.get("d")}: apiDataDate={api_date}')

if __name__ == '__main__':
    main()
