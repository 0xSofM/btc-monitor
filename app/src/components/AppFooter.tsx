interface AppFooterProps {
  dataTimestampLabel: string;
}

export function AppFooter({ dataTimestampLabel }: AppFooterProps) {
  return (
    <footer className="footer-line mt-12">
      <div className="app-container flex flex-col gap-2 py-6 text-left text-sm text-muted-foreground">
        <p>数据来源：BGeometrics 链上指标 | Strategy 官方 mNAV | 实时 BTC 价格</p>
        <p>数据时间：{dataTimestampLabel}</p>
      </div>
    </footer>
  );
}
