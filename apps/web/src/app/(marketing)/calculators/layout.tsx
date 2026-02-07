import '../../styles/10-components.calculator.css';
import '../../styles/20-pages.calculators.css';

type CalculatorsLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function CalculatorsLayout({
  children,
}: CalculatorsLayoutProps) {
  return children;
}
