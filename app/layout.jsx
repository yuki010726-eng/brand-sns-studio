import '../styles/tokens.css';
import '../styles/components.css';
import '../styles/tailwind.css';
import { Header } from './_components/layout/Header.jsx';
import { AuthGate } from './_components/AuthGate.jsx';

export const metadata = {
  title: 'Brand SNS Studio',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="font-sans" suppressHydrationWarning>
        <Header />
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
