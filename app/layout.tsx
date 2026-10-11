import { ClerkProvider } from "@clerk/nextjs";
import { DecisionSync } from "@/components/decision-sync";
import { Field } from "@/components/field";
import { RegisterApp } from "@/components/pwa";
import { shadcn } from "@clerk/ui/themes";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Pixelify_Sans } from "next/font/google";
import "./globals.css";
import "./motion.css";

const clerkAppearance = {
  theme: shadcn,
  variables: {
    colorPrimary: "#6ea8ff",
    colorBackground: "rgba(18, 22, 34, 0.72)",
    colorForeground: "#f6f7fb",
    colorMuted: "rgba(255, 255, 255, 0.08)",
    colorMutedForeground: "#c6ccd8",
    colorInput: "rgba(255, 255, 255, 0.08)",
    colorInputForeground: "#f6f7fb",
    colorNeutral: "#f6f7fb",
    colorModalBackdrop: "rgba(8, 10, 16, 0.72)",
    borderRadius: "1rem",
    fontFamily: "var(--font-geist-sans)",
  },
  options: {
    socialButtonsVariant: "blockButton" as const,
  },
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const pixel = Pixelify_Sans({
  variable: "--font-pixelify",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ffomo",
  applicationName: "Ffomo",
  description: "See how it turned out for people who already chose.",
  appleWebApp: {
    capable: true,
    title: "Ffomo",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0f1a",
  colorScheme: "dark",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${pixel.variable} dark h-full overflow-hidden antialiased`}
    >
      <body className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        <div className="desktop-note h-dvh place-items-center p-8 text-center">
          <div className="flex max-w-sm flex-col items-center gap-3">
            <p className="font-pixel text-3xl font-bold">Ffomo</p>
            <p className="text-lg">Best on your phone.</p>
            <p className="text-sm text-muted-foreground">
              Open ffomo.vercel.app on your phone, then Share → Add to Home Screen.
            </p>
          </div>
        </div>
        <div className="phone-app flex h-dvh flex-col overflow-hidden">
          <ClerkProvider appearance={clerkAppearance}>
            <Field>
              <RegisterApp />
              <DecisionSync />
              {children}
            </Field>
          </ClerkProvider>
        </div>
      </body>
    </html>
  );
}