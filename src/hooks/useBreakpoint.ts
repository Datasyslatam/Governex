import { useState, useEffect } from "react";

export const useBreakpoint = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const checkBreakpoints = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsTablet(width < 1024);
    };

    checkBreakpoints();
    window.addEventListener("resize", checkBreakpoints);

    return () => window.removeEventListener("resize", checkBreakpoints);
  }, []);

  return {
    isMobile,
    isTablet,
    isDesktop: !isMobile && !isTablet,
    breakpoint: isMobile ? "mobile" : isTablet ? "tablet" : "desktop"
  };
};
