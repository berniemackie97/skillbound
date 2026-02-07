import '../../styles/20-pages.home.css';

type HomeLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function HomeLayout({ children }: HomeLayoutProps) {
  return children;
}
