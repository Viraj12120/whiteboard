import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Explainboard — Ask anything. See the idea.",
  description: "A simple chat and whiteboard for visual explanations across subjects.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
