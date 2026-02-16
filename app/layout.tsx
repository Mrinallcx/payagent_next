import type { Metadata } from "next";
import { DM_Sans, Space_Mono, Inter, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import { Providers } from "./providers";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["300", "400", "500", "600", "700"],
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-space-mono",
  weight: ["400", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Instant Crypto Payments – Low Fees + AI Agent Payment API",
  description:
    "Accept instant crypto payments with low transaction fees. Simple for humans and merchants, with an AI agent payment API for autonomous commerce.",
  authors: [{ name: "PayAgent" }],
  metadataBase: new URL("https://www.payagent.co"),
  alternates: { canonical: "/" },
  openGraph: {
    title: "Instant Crypto Payments – Low Fees + AI Agent Payment API",
    description:
      "Accept instant crypto payments with low transaction fees. Simple for humans and merchants, with an AI agent payment API for autonomous commerce.",
    url: "https://www.payagent.co",
    siteName: "PayAgent",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Instant Crypto Payments – Low Fees + AI Agent Payment API",
    description:
      "Accept instant crypto payments with low transaction fees. Simple for humans and merchants, with an AI agent payment API for autonomous commerce.",
  },
  icons: {
    icon: "/favicon/favicon.svg",
    apple: "/favicon/favicon.svg",
  },
  manifest: "/favicon/site.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${spaceMono.variable} ${inter.variable} ${spaceGrotesk.variable}`}
    >
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-8VHXB1BCLP"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-8VHXB1BCLP');
          `}
        </Script>
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
