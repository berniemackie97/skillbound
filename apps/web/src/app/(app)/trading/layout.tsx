import '../../styles/10-components.calculator.css';
import '../../styles/20-pages.trading.css';

type TradingLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function TradingLayout({ children }: TradingLayoutProps) {
  return children;
}
