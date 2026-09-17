import "../styles/tokens.css";
import "../styles/components.css";
import "../styles/tailwind.css";
import { Header } from "./_components/layout/Header.jsx";
import { AuthGate } from "./_components/AuthGate.jsx";
import { DeploymentUpdateNotice } from "./_components/DeploymentUpdateNotice.jsx";
import { deploymentVersion } from "../lib/deployment-version.js";

export const metadata = {
  title: "브랜드 SNS 스튜디오",
  description: "당신의 SNS를 만들어드립니다.",
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    images: ["/meta-img.png"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="font-sans" suppressHydrationWarning>
        <Header />
        <AuthGate>{children}</AuthGate>
        <DeploymentUpdateNotice initialVersion={deploymentVersion} />
      </body>
    </html>
  );
}
