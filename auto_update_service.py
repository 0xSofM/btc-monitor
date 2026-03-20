#!/usr/bin/env python3
"""
BTC定投指标数据自动更新服务

此脚本作为守护进程运行，定期从 BGeometrics API 获取最新数据并更新 JSON 文件
支持多种运行模式：单次更新、定时更新、守护进程模式

使用方法:
    # 单次更新
    python auto_update_service.py
    
    # 每 10 分钟更新一次（守护进程模式）
    python auto_update_service.py --daemon --interval 600
    
    # 每天指定时间更新
    python auto_update_service.py --daily --time 08:00
    
    # 检查 API 连接
    python auto_update_service.py --check

环境变量:
    BTC_UPDATE_INTERVAL: 更新间隔（秒，默认 600）
    BTC_UPDATE_TIME: 每天更新时间（如 08:00,20:00）
    BTC_OUTPUT_FILE: 输出文件路径
    BTC_LOG_LEVEL: 日志级别（DEBUG, INFO, WARNING, ERROR）
"""

import os
import sys
import json
import time
import math
import random
import signal
import argparse
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Any

# 尝试导入 requests，如果不存在则提示安装
try:
    import requests
except ImportError:
    print("错误: 需要安装 requests 模块")
    print("运行: pip install requests")
    sys.exit(1)

# 配置
CONFIG = {
    'api_base_url': 'https://bitcoin-data.com',
    'default_interval': int(os.environ.get('BTC_UPDATE_INTERVAL', '600')),  # 10分钟
    'default_times': os.environ.get('BTC_UPDATE_TIME', '08:00,20:00').split(','),
    'output_file': os.environ.get('BTC_OUTPUT_FILE', ''),
    'max_retries': 5,
    'retry_delay': 10,
    'timeout': 30,
    'request_interval': (1, 3),  # 请求间隔范围（秒）
    'rate_limit_delay': 30  # 429 错误额外等待时间（秒）
}

# 日志配置
def setup_logging(level: str = 'INFO') -> logging.Logger:
    """配置日志"""
    log_format = '%(asctime)s [%(levelname)s] %(message)s'
    date_format = '%Y-%m-%d %H:%M:%S'
    
    logging.basicConfig(
        level=getattr(logging, level.upper()),
        format=log_format,
        datefmt=date_format,
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler('btc_update.log', encoding='utf-8') if not os.environ.get('BTC_NO_LOG_FILE') else logging.StreamHandler()
        ]
    )
    return logging.getLogger(__name__)

logger = setup_logging(os.environ.get('BTC_LOG_LEVEL', 'INFO'))

# 运行标志（用于优雅退出）
running = True

def signal_handler(signum, frame):
    """处理信号，实现优雅退出"""
    global running
    logger.info(f"Received signal {signum}, stopping service...")
    running = False

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

class BTCDataService:
    """BTC 数据服务类"""
    
    def __init__(self, output_file: Optional[str] = None):
        self.api_base_url = CONFIG['api_base_url']
        self.output_file = output_file or self._get_default_output_file()
        self.session = requests.Session()
        self.session.headers.update({
            'Accept': 'application/json',
            'User-Agent': 'BTC-DCA-Monitor/1.0'
        })
        
    def _get_default_output_file(self) -> str:
        """获取默认输出文件路径"""
        # 优先保存到 app/public 目录
        app_public = os.path.join(os.path.dirname(os.path.abspath(__file__)), 
                                   "app", "public", "btc_indicators_history.json")
        if os.path.exists(os.path.dirname(app_public)):
            return app_public
        # 否则保存到项目根目录
        return os.path.join(os.path.dirname(os.path.abspath(__file__)), 
                           "btc_indicators_history.json")
    
    def _fetch_with_retry(self, endpoint: str) -> Optional[List[Dict]]:
        """带重试机制的 API 请求"""
        url = f"{self.api_base_url}{endpoint}"
        
        for attempt in range(CONFIG['max_retries']):
            try:
                logger.debug(f"请求: {url} (尝试 {attempt + 1}/{CONFIG['max_retries']})")
                response = self.session.get(url, timeout=CONFIG['timeout'])
                response.raise_for_status()
                return response.json()
            except requests.exceptions.Timeout:
                logger.warning(f"请求超时: {url}")
            except requests.exceptions.ConnectionError:
                logger.warning(f"连接错误: {url}")
            except requests.exceptions.HTTPError as e:
                status_code = e.response.status_code
                logger.warning(f"HTTP 错误 {status_code}: {url}")
                # 遇到 429 错误时，增加更长的等待时间
                if status_code == 429:
                    wait_time = CONFIG['rate_limit_delay'] + random.uniform(0, 10)
                    logger.warning(f"触发 API 限流，等待 {wait_time:.1f} 秒...")
                    time.sleep(wait_time)
                    continue  # 跳过常规重试逻辑，直接进入下一次尝试
            except Exception as e:
                logger.warning(f"请求失败: {e}")
            
            if attempt < CONFIG['max_retries'] - 1:
                # 使用指数退避策略
                delay = CONFIG['retry_delay'] * (2 ** attempt) + random.uniform(0, 5)
                logger.debug(f"等待 {delay:.1f} 秒后重试...")
                time.sleep(delay)
        
        logger.error(f"请求失败，已重试 {CONFIG['max_retries']} 次: {url}")
        return None
    
    def _fix_nan_values(self, obj):
        """修复 NaN 和 Inf 值"""
        if isinstance(obj, dict):
            return {k: self._fix_nan_values(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._fix_nan_values(v) for v in obj]
        elif isinstance(obj, float):
            if math.isnan(obj) or math.isinf(obj):
                return None
            return obj
        return obj
    
    def fetch_all_data(self) -> Optional[Dict[str, List]]:
        """获取所有指标数据"""
        logger.info("开始获取 BTC 指标数据...")
        
        endpoints = {
            'mvrv_z': '/v1/mvrv-zscore',
            'lth_mvrv': '/v1/lth-mvrv',
            'puell': '/v1/puell-multiple',
            'nupl': '/v1/nupl',
            'btc_price': '/v1/btc-price'
        }
        
        results = {}
        success = True
        
        for name, endpoint in endpoints.items():
            logger.info(f"[{list(endpoints.keys()).index(name) + 1}/{len(endpoints)}] 获取 {name.upper()}...")
            data = self._fetch_with_retry(endpoint)
            if data:
                results[name] = data
                logger.info(f"  [OK] 获取了 {len(data)} 条记录")
            else:
                logger.error(f"  [FAIL] 获取 {name.upper()} 失败")
                success = False
            
            # 请求间隔：在每次请求后添加随机延迟，避免触发 API 限流
            if list(endpoints.keys()).index(name) < len(endpoints) - 1:  # 不是最后一个
                delay = random.uniform(*CONFIG['request_interval'])
                logger.debug(f"等待 {delay:.2f} 秒后继续...")
                time.sleep(delay)
        
        if not success:
            logger.error("部分数据获取失败")
            
        return results if results else None
    
    def _get_latest_value(self, data_dict: Dict[str, float], date: str, all_dates: List[str]) -> Optional[float]:
        """获取指定日期的值，如果不存在则向前查找最近的值"""
        if date in data_dict:
            return data_dict[date]
        
        # 向前查找最近的日期
        current_idx = all_dates.index(date)
        for i in range(current_idx - 1, -1, -1):
            prev_date = all_dates[i]
            if prev_date in data_dict:
                return data_dict[prev_date]
        
        return None
    
    def process_data(self, raw_data: Dict[str, List]) -> List[Dict]:
        """处理原始数据，合并为统一格式"""
        logger.info("开始处理数据...")
        
        # 创建数据字典
        price_dict = {p['d']: float(p['btcPrice']) for p in raw_data.get('btc_price', [])}
        mvrv_dict = {item['d']: float(item['mvrvZscore']) for item in raw_data.get('mvrv_z', [])}
        lth_mvrv_dict = {item['d']: float(item['lthMvrv']) for item in raw_data.get('lth_mvrv', [])}
        puell_dict = {item['d']: float(item['puellMultiple']) for item in raw_data.get('puell', [])}
        nupl_dict = {item['d']: float(item['nupl']) for item in raw_data.get('nupl', [])}
        
        # 合并所有日期
        all_dates = sorted(set(price_dict.keys()) | set(mvrv_dict.keys()) | 
                          set(lth_mvrv_dict.keys()) | set(puell_dict.keys()) | 
                          set(nupl_dict.keys()))
        
        result = []
        price_history = []
        
        # 追踪每个指标最后从API获取数据的日期
        last_api_date = {
            'mvrvZ': None,
            'lthMvrv': None,
            'puell': None,
            'nupl': None
        }
        
        for date in all_dates:
            price = price_dict.get(date)
            if price:
                price_history.append(price)
            
            # 计算200周MA
            ma_200w = None
            if len(price_history) >= 1400:
                ma_200w = sum(price_history[-1400:]) / 1400
            
            # 获取指标数据（如果当天没有，向前查找最近的）
            mvrv_z = self._get_latest_value(mvrv_dict, date, all_dates)
            lth_mvrv = self._get_latest_value(lth_mvrv_dict, date, all_dates)
            puell = self._get_latest_value(puell_dict, date, all_dates)
            nupl = self._get_latest_value(nupl_dict, date, all_dates)
            
            # 更新每个指标最后从API获取数据的日期
            if date in mvrv_dict:
                last_api_date['mvrvZ'] = date
            if date in lth_mvrv_dict:
                last_api_date['lthMvrv'] = date
            if date in puell_dict:
                last_api_date['puell'] = date
            if date in nupl_dict:
                last_api_date['nupl'] = date
            
            # 计算信号
            signal_price_ma = (price and ma_200w and price / ma_200w < 1) or False
            signal_mvrv_z = (mvrv_z is not None and mvrv_z < 0) or False
            signal_lth_mvrv = (lth_mvrv is not None and lth_mvrv < 1) or False
            signal_puell = (puell is not None and puell < 0.5) or False
            signal_nupl = (nupl is not None and nupl < 0) or False
            
            signal_count = sum([signal_price_ma, signal_mvrv_z, signal_lth_mvrv, signal_puell, signal_nupl])
            
            # 构建 apiDataDate 字段，记录每个指标最后从API获取数据的日期
            api_data_date = {}
            if last_api_date['mvrvZ']:
                api_data_date['mvrvZ'] = last_api_date['mvrvZ']
            if last_api_date['lthMvrv']:
                api_data_date['lthMvrv'] = last_api_date['lthMvrv']
            if last_api_date['puell']:
                api_data_date['puell'] = last_api_date['puell']
            if last_api_date['nupl']:
                api_data_date['nupl'] = last_api_date['nupl']
            
            record = {
                'd': date,
                'btcPrice': price,
                'priceMa200wRatio': price / ma_200w if price and ma_200w else None,
                'ma200w': ma_200w,
                'mvrvZscore': mvrv_z,
                'lthMvrv': lth_mvrv,
                'puellMultiple': puell,
                'nupl': nupl,
                'signalPriceMa': signal_price_ma,
                'signalMvrvZ': signal_mvrv_z,
                'signalLthMvrv': signal_lth_mvrv,
                'signalPuell': signal_puell,
                'signalNupl': signal_nupl,
                'signalCount': signal_count,
                'apiDataDate': api_data_date if api_data_date else None
            }
            result.append(record)
        
        # 修复 NaN 值
        result = self._fix_nan_values(result)
        
        logger.info(f"[OK] 数据处理完成，共 {len(result)} 条记录")
        return result
    
    def save_data(self, data: List[Dict]) -> bool:
        """保存数据到文件"""
        try:
            # 确保目录存在
            output_dir = os.path.dirname(self.output_file)
            if output_dir:
                os.makedirs(output_dir, exist_ok=True)
            
            with open(self.output_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            # 同时保存到根目录作为备份
            root_backup = os.path.join(os.path.dirname(os.path.abspath(__file__)), 
                                       "btc_indicators_history.json")
            if self.output_file != root_backup:
                with open(root_backup, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                logger.info(f"[OK] 数据已保存到 {self.output_file}")
                logger.info(f"[OK] 数据已同步到 {root_backup}")
            else:
                logger.info(f"[OK] 数据已保存到 {self.output_file}")
            
            # 保存最新数据摘要
            self._save_latest_summary(data)
            
            return True
        except Exception as e:
            logger.error(f"保存数据失败: {e}")
            return False
    
    def _save_latest_summary(self, data: List[Dict]):
        """保存最新数据摘要"""
        if not data:
            return

        latest = data[-1]

        # 构建 indicatorDates - 根据 apiDataDate 字段确定每个指标的实际数据日期
        # priceMa200w 始终使用最新日期（因为它是根据价格计算的）
        indicator_dates = {
            'priceMa200w': latest['d'],
        }
    
        # 检查是否有 apiDataDate 字段
        api_dates = latest.get('apiDataDate')
        if api_dates:
            # 只添加 apiDataDate 中存在的指标
            for name in ['mvrvZ', 'lthMvrv', 'puell', 'nupl']:
                if name in api_dates:
                    indicator_dates[name] = api_dates[name]
        else:
            # 如果没有 apiDataDate，使用最新日期作为后备
            for name in ['mvrvZ', 'lthMvrv', 'puell', 'nupl']:
                indicator_dates[name] = latest['d']
    
        summary = {
            'date': latest['d'],
            'btcPrice': latest['btcPrice'],
            'priceMa200wRatio': latest['priceMa200wRatio'],
            'ma200w': latest.get('ma200w'),
            'mvrvZscore': latest['mvrvZscore'],
            'lthMvrv': latest['lthMvrv'],
            'puellMultiple': latest['puellMultiple'],
            'nupl': latest['nupl'],
            'signalCount': latest['signalCount'],
            'signals': {
                'priceMa200w': latest['signalPriceMa'],
                'mvrvZ': latest['signalMvrvZ'],
                'lthMvrv': latest['signalLthMvrv'],
                'puell': latest['signalPuell'],
                'nupl': latest['signalNupl']
            },
            'indicatorDates': indicator_dates,
            'lastUpdated': datetime.now().isoformat()
        }
        
        summary_file = os.path.join(os.path.dirname(self.output_file), 'btc_indicators_latest.json')
        root_summary = os.path.join(os.path.dirname(os.path.abspath(__file__)), 
                                    "btc_indicators_latest.json")
        
        for file_path in [summary_file, root_summary]:
            try:
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(summary, f, indent=2, ensure_ascii=False)
            except Exception as e:
                logger.warning(f"保存摘要失败 {file_path}: {e}")
    
    def print_summary(self, data: List[Dict]):
        """打印数据摘要"""
        if not data:
            return

        latest = data[-1]

        print("\n" + "=" * 60)
        print("最新数据:")
        print("=" * 60)
        print(f"日期: {latest['d']}")
        if latest['btcPrice']:
            print(f"BTC价格: ${latest['btcPrice']:,.2f}")
        if latest['priceMa200wRatio']:
            print(f"Price/200W-MA: {latest['priceMa200wRatio']:.4f}")
        if latest['mvrvZscore'] is not None:
            print(f"MVRV Z-Score: {latest['mvrvZscore']:.4f}")
        if latest['lthMvrv'] is not None:
            print(f"LTH-MVRV: {latest['lthMvrv']:.4f}")
        if latest['puellMultiple'] is not None:
            print(f"Puell Multiple: {latest['puellMultiple']:.4f}")
        if latest['nupl'] is not None:
            print(f"NUPL: {latest['nupl']:.4f}")

        print(f"\n买入信号: {latest['signalCount']}/5")
        print(f" - Price/200W-MA < 1: {'[YES]' if latest['signalPriceMa'] else '[NO]'}")
        print(f" - MVRV-Z < 0: {'[YES]' if latest['signalMvrvZ'] else '[NO]'}")
        print(f" - LTH-MVRV < 1: {'[YES]' if latest['signalLthMvrv'] else '[NO]'}")
        print(f" - Puell < 0.5: {'[YES]' if latest['signalPuell'] else '[NO]'}")
        print(f" - NUPL < 0: {'[YES]' if latest['signalNupl'] else '[NO]'}")

        # 统计历史信号
        signal_5 = sum(1 for r in data if r['signalCount'] == 5)
        signal_4 = sum(1 for r in data if r['signalCount'] >= 4)
        signal_3 = sum(1 for r in data if r['signalCount'] >= 3)

        print("\n" + "=" * 60)
        print("历史统计:")
        print("=" * 60)
        print(f"5个信号全部触发: {signal_5} 天")
        print(f"4个及以上信号触发: {signal_4} 天")
        print(f"3个及以上信号触发: {signal_3} 天")
        print("=" * 60)
    
    def check_api(self) -> bool:
        """检查 API 连接"""
        logger.info("检查 API 连接...")
        
        test_endpoints = ['/v1/btc-price/1', '/v1/mvrv-zscore/1']
        all_ok = True
        
        for endpoint in test_endpoints:
            url = f"{self.api_base_url}{endpoint}"
            try:
                response = self.session.get(url, timeout=10)
                if response.ok:
                    data = response.json()
                    if data:
                        logger.info(f"[OK] {endpoint}: OK")
                        continue
                logger.warning(f"[FAIL] {endpoint}: 响应异常")
                all_ok = False
            except Exception as e:
                logger.warning(f"[FAIL] {endpoint}: {e}")
                all_ok = False
        
        return all_ok
    
    def update(self) -> bool:
        """执行一次数据更新"""
        logger.info("=" * 60)
        logger.info(f"开始数据更新 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info("=" * 60)
        
        # 获取数据
        raw_data = self.fetch_all_data()
        if not raw_data:
            logger.error("获取数据失败")
            return False
        
        # 处理数据
        processed_data = self.process_data(raw_data)
        if not processed_data:
            logger.error("处理数据失败")
            return False
        
        # 保存数据
        if not self.save_data(processed_data):
            return False
        
        # 打印摘要
        self.print_summary(processed_data)
        
        logger.info("[OK] 数据更新完成")
        return True


def run_daemon(service: BTCDataService, interval: int):
    """守护进程模式：定时更新"""
    logger.info(f"启动守护进程模式，更新间隔: {interval}秒")
    
    while running:
        try:
            service.update()
        except Exception as e:
            logger.error(f"更新过程中出错: {e}")
        
        # 等待下一次更新
        logger.info(f"等待 {interval} 秒后进行下次更新...")
        
        # 分段等待以响应退出信号
        waited = 0
        while running and waited < interval:
            time.sleep(1)
            waited += 1
    
    logger.info("Daemon stopped")


def run_daily(service: BTCDataService, times: List[str]):
    """每日指定时间更新模式"""
    logger.info(f"启动每日更新模式，更新时间: {', '.join(times)}")
    
    # 解析时间
    target_times = []
    for t in times:
        try:
            hour, minute = map(int, t.split(':'))
            target_times.append((hour, minute))
        except ValueError:
            logger.error(f"无效的时间格式: {t}，应为 HH:MM")
            return
    
    last_run_date = None
    
    while running:
        now = datetime.now()
        current_time = (now.hour, now.minute)
        
        # 检查是否到达目标时间
        for hour, minute in target_times:
            if current_time == (hour, minute):
                today = now.strftime('%Y-%m-%d')
                if today != last_run_date:
                    logger.info(f"到达更新时间 {hour:02d}:{minute:02d}")
                    try:
                        service.update()
                    except Exception as e:
                        logger.error(f"更新失败: {e}")
                    last_run_date = today
        
        time.sleep(30)  # 每30秒检查一次
    
    logger.info("Daily update mode stopped")


def main():
    parser = argparse.ArgumentParser(
        description='BTC定投指标数据自动更新服务',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s                          # 单次更新
  %(prog)s --daemon                 # 每10分钟更新一次
  %(prog)s --daemon --interval 300  # 每5分钟更新一次
  %(prog)s --daily --time 08:00,20:00  # 每天8点和20点更新
  %(prog)s --check                  # 检查 API 连接
        """
    )
    
    parser.add_argument('-o', '--output', type=str, 
                       help='输出文件路径 (默认: app/public/btc_indicators_history.json)')
    parser.add_argument('-c', '--check', action='store_true',
                       help='仅检查 API 连接')
    parser.add_argument('-d', '--daemon', action='store_true',
                       help='守护进程模式（定时更新）')
    parser.add_argument('-i', '--interval', type=int, default=CONFIG['default_interval'],
                       help=f'更新间隔（秒，默认: {CONFIG["default_interval"]}）')
    parser.add_argument('--daily', action='store_true',
                       help='每日指定时间更新模式')
    parser.add_argument('-t', '--time', type=str, default=','.join(CONFIG['default_times']),
                       help=f'每天更新时间，逗号分隔（默认: {",".join(CONFIG["default_times"])}）')
    parser.add_argument('-v', '--verbose', action='store_true',
                       help='详细日志输出')
    
    args = parser.parse_args()
    
    # 设置日志级别
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # 创建服务实例
    service = BTCDataService(output_file=args.output)
    
    # 检查 API 连接
    if args.check:
        if service.check_api():
            print("\n[OK] API 连接正常")
            return 0
        else:
            print("\n[FAIL] API 连接异常")
            return 1
    
    # 守护进程模式
    if args.daemon:
        run_daemon(service, args.interval)
        return 0
    
    # 每日更新模式
    if args.daily:
        times = args.time.split(',')
        run_daily(service, times)
        return 0
    
    # 单次更新模式
    if service.update():
        return 0
    else:
        return 1


if __name__ == '__main__':
    sys.exit(main())
