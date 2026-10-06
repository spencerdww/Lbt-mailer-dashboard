import './globals.css';

export const metadata = {
  title: 'LifeBack Tax | Data Dashboard',
  description: 'On-premise customer data dashboard for LifeBack Tax',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
