"use client";

import { useEffect, useState } from "react";

const MIN_WIDTH = 1024;

interface DesktopGateProps {
  children: React.ReactNode;
}

export function DesktopGate({ children }: DesktopGateProps) {
  const [isDesktop, setIsDesktop] = useState(true);
  const [isChecking, setIsChecking] = useState(true);
  const [currentWidth, setCurrentWidth] = useState<number | null>(null);

  useEffect(() => {
    const checkWidth = () => {
      const width = window.innerWidth;
      setCurrentWidth(width);
      setIsDesktop(width >= MIN_WIDTH);
      setIsChecking(false);
    };

    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  // Don't render anything during SSR or while checking
  if (isChecking) {
    return null;
  }

  if (!isDesktop) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 p-8">
        <div className="max-w-md text-center">
          <div className="mb-6 text-6xl">🎰</div>
          <h1 className="mb-4 text-2xl font-bold text-white">
            Desktop Only
          </h1>
          <p className="text-gray-400">
            The Poker Tournament Replay Viewer is optimized for desktop screens.
            Please access this application on a device with a screen width of at
            least {MIN_WIDTH}px.
          </p>
          <p className="mt-4 text-sm text-gray-500">
            Current width: {currentWidth}px
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
