import type { Metadata } from "next";
import { SolanaWalletProvider } from "../components/WalletProvider";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solana RBAC — On-chain Access Control",
  description:
    "Enterprise-grade Role-Based Access Control system on Solana. Manage roles, assign permissions, and verify zero-trust on-chain.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SolanaWalletProvider>
          {children}
        </SolanaWalletProvider>
        <Toaster
          position="top-right"
          theme="dark"
          richColors
          toastOptions={{
            style: {
              background: "rgba(15, 23, 42, 0.95)",
              border: "1px solid rgba(139, 92, 246, 0.3)",
              backdropFilter: "blur(16px)",
              color: "#e2e8f0",
              fontFamily: "'Inter', sans-serif",
            },
          }}
        />
      </body>
    </html>
  );
}
