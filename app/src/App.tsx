import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster, toast } from 'sonner';
import { 
  Bitcoin, 
  LineChart, 
  History, 
  BookOpen, 
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { IndicatorCard } from '@/components/IndicatorCard';
import { SignalOverview } from '@/components/SignalOverview';
import { HistoryReview } from '@/components/HistoryReview';
import { IndicatorExplanation } from '@/components/IndicatorExplanation';
import { IndicatorCharts } from '@/components/IndicatorCharts';
import type { LatestData, IndicatorData } from '@/types';
import { 
  fetchAllLatestIndicators, 
  fetchHistoricalData,
  getLatestFromHistory
} from '@/services/dataService';
import './App.css';

function App() {
  const [latestData, setLatestData] = useState<LatestData | null>(null);
  const [historicalData, setHistoricalData] = useState<IndicatorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('-');
  const [error, setError] = useState<string | null>(null);
  const [usingBackupData, setUsingBackupData] = useState(false);

  // 获取历史数据（从本地JSON文件）
  useEffect(() => {
    const loadHistoricalData = async () => {
      const data = await fetchHistoricalData();
      if (data.length > 0) {
        setHistoricalData(data);
      }
    };
    loadHistoricalData();
  }, []);

  // 获取最新数据
  const fetchLatestData = async () => {
    setLoading(true);
    setError(null);
    setUsingBackupData(false);
    
    try {
      // 首先尝试从API获取最新数据
      const data = await fetchAllLatestIndicators();
      
      if (data) {
        setLatestData(data);
        setLastUpdated(new Date().toLocaleString('zh-CN'));
        setUsingBackupData(false);
        
        // 如果有4个及以上信号触发，显示通知
        if (data.signalCount >= 4) {
          toast.success(
            `买入信号触发: ${data.signalCount}/5 个指标达到目标区间`,
            {
              description: `当前BTC价格: $${data.btcPrice.toLocaleString()}`,
              duration: 10000,
            }
          );
        }
      } else {
        // API返回null，使用历史数据作为备用
        throw new Error('API返回空数据');
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      
      // 使用历史数据作为备用
      if (historicalData.length > 0) {
        const backupData = getLatestFromHistory(historicalData);
        if (backupData) {
          setLatestData(backupData);
          setLastUpdated(`${backupData.date} (历史数据)`);
          setUsingBackupData(true);
          toast.info('正在使用历史数据展示（API暂时不可用）');
        } else {
          setError('无法获取数据，请稍后重试');
        }
      } else {
        setError('无法获取数据，请检查网络连接后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchLatestData();
    
    // 每5分钟自动刷新
    const interval = setInterval(fetchLatestData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [historicalData]); // 依赖historicalData确保历史数据加载后再获取最新数据

  const indicators = latestData ? [
    {
      name: 'BTC Price / 200W-MA',
      description: '价格与200周均线比值',
      currentValue: latestData.priceMa200wRatio,
      targetValue: 1,
      targetOperator: 'lt' as const,
      triggered: latestData.signals.priceMa200w,
      format: 'ratio' as const,
      color: '#F7931A',
      dataDate: latestData.indicatorDates?.priceMa200w || latestData.date,
      detailValue: latestData.ma200w 
        ? `BTC: $${latestData.btcPrice.toLocaleString()} / MA200: $${Math.round(latestData.ma200w).toLocaleString()}`
        : `BTC: $${latestData.btcPrice.toLocaleString()}`
    },
    {
      name: 'MVRV Z-Score',
      description: '市值与实现市值标准化比值',
      currentValue: latestData.mvrvZscore,
      targetValue: 0,
      targetOperator: 'lt' as const,
      triggered: latestData.signals.mvrvZ,
      format: 'number' as const,
      color: '#3B82F6',
      dataDate: latestData.indicatorDates?.mvrvZ || latestData.date
    },
    {
      name: 'LTH-MVRV',
      description: '长期持有者成本比值',
      currentValue: latestData.lthMvrv,
      targetValue: 1,
      targetOperator: 'lt' as const,
      triggered: latestData.signals.lthMvrv,
      format: 'ratio' as const,
      color: '#10B981',
      dataDate: latestData.indicatorDates?.lthMvrv || latestData.date
    },
    {
      name: 'Puell Multiple',
      description: '矿工收入比值',
      currentValue: latestData.puellMultiple,
      targetValue: 0.5,
      targetOperator: 'lt' as const,
      triggered: latestData.signals.puell,
      format: 'ratio' as const,
      color: '#8B5CF6',
      dataDate: latestData.indicatorDates?.puell || latestData.date
    },
    {
      name: 'NUPL',
      description: '净未实现利润/亏损',
      currentValue: latestData.nupl,
      targetValue: 0,
      targetOperator: 'lt' as const,
      triggered: latestData.signals.nupl,
      format: 'number' as const,
      color: '#EF4444',
      dataDate: latestData.indicatorDates?.nupl || latestData.date
    }
  ] : [];

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500 rounded-lg">
                <Bitcoin className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">BTC定投指标监控</h1>
                <p className="text-sm text-muted-foreground">
                  基于链上数据的智能定投决策系统
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLatestData}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              刷新数据
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <LineChart className="w-4 h-4" />
              <span className="hidden sm:inline">监控面板</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">历史复盘</span>
            </TabsTrigger>
            <TabsTrigger value="guide" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">指标说明</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* 错误提示 */}
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertTitle>数据获取失败</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {/* 备用数据提示 */}
            {usingBackupData && (
              <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <AlertTitle className="text-yellow-800 dark:text-yellow-200">使用历史数据</AlertTitle>
                <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                  API服务暂时不可用，正在展示历史数据。数据日期：{latestData?.date}
                </AlertDescription>
              </Alert>
            )}
            
            {/* 加载中 */}
            {loading && !latestData && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-12 h-12 animate-spin text-orange-500 mb-4" />
                <p className="text-muted-foreground">正在加载数据...</p>
              </div>
            )}
            
            {latestData && (
              <>
                <SignalOverview
                  btcPrice={latestData.btcPrice}
                  signalCount={latestData.signalCount}
                  totalIndicators={5}
                  lastUpdated={lastUpdated}
                />
                
                {/* 历史指标图表 */}
                {historicalData.length > 0 && (
                  <IndicatorCharts data={historicalData} />
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {indicators.map((indicator, index) => (
                    <IndicatorCard
                      key={index}
                      {...indicator}
                    />
                  ))}
                </div>

                {/* 当前市场评估 */}
                <div className={`p-4 rounded-lg border ${
                  latestData.signalCount >= 4 
                    ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                    : latestData.signalCount === 0
                    ? 'bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700'
                    : latestData.signalCount <= 2
                    ? 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800'
                    : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800'
                }`}>
                  <div className="flex items-start gap-3">
                    {latestData.signalCount >= 4 ? (
                      <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400 mt-0.5" />
                    ) : latestData.signalCount === 0 ? (
                      <TrendingUp className="w-6 h-6 text-gray-600 dark:text-gray-400 mt-0.5" />
                    ) : latestData.signalCount <= 2 ? (
                      <AlertTriangle className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    )}
                    <div>
                      <h3 className={`font-semibold ${
                        latestData.signalCount >= 4 
                          ? 'text-green-800 dark:text-green-200'
                          : latestData.signalCount === 0
                          ? 'text-gray-800 dark:text-gray-200'
                          : latestData.signalCount <= 2
                          ? 'text-blue-800 dark:text-blue-200'
                          : 'text-yellow-800 dark:text-yellow-200'
                      }`}>
                        当前市场评估
                      </h3>
                      <p className={`mt-1 text-sm ${
                        latestData.signalCount >= 4 
                          ? 'text-green-700 dark:text-green-300'
                          : latestData.signalCount === 0
                          ? 'text-gray-700 dark:text-gray-300'
                          : latestData.signalCount <= 2
                          ? 'text-blue-700 dark:text-blue-300'
                          : 'text-yellow-700 dark:text-yellow-300'
                      }`}>
                        {latestData.signalCount >= 4 
                          ? `当前有 ${latestData.signalCount} 个指标达到买入区间，是较好的定投时机。建议按计划执行定投策略。`
                          : latestData.signalCount === 0
                          ? '当前市场处于常规区间，距离极端底部尚远。建议保持观望或小额定投，等待更好的买入时机。'
                          : latestData.signalCount <= 2
                          ? `当前有 ${latestData.signalCount} 个指标接近买入区间，建议保持关注，准备资金等待更好的买入时机。`
                          : `当前有 ${latestData.signalCount} 个指标接近买入区间，市场开始接近底部区域，建议密切关注。`
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            {historicalData.length > 0 ? (
              <HistoryReview data={historicalData} />
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-12 h-12 animate-spin text-orange-500 mb-4" />
                <p className="text-muted-foreground">正在加载历史数据...</p>
              </div>
            )}
          </TabsContent>

          {/* Guide Tab */}
          <TabsContent value="guide">
            <IndicatorExplanation />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              数据来源: BGeometrics API | 仅供参考，不构成投资建议
            </p>
            <p className="text-sm text-muted-foreground">
              最后更新: {lastUpdated}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
