import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Acadexis",
  description: "Academic documentation platform for BMU course files.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} [font-family:var(--font-geist-sans),system-ui,sans-serif] antialiased`}
      >
        {children}
      </body>
    </html>
  );
}