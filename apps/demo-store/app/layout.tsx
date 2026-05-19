import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WebMCP Demo Store — The Agent-Ready E-Commerce Experience',
  description: 'A revolutionary e-commerce store powered by WebMCP. AI agents can browse and purchase items directly through the MCP protocol, bypassing the UI entirely.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* dark mode everything. we're not savages. */}
      <body className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
