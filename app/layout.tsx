import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LMS² — Let me survive",
  description: "Your student survival workspace for attendance, tasks, timetable and courses.",
  icons: {
    icon: "/lms-favicon.png",
    shortcut: "/lms-favicon.png",
    apple: "/lms-favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
