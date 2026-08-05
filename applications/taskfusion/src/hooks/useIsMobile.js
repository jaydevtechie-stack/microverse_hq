import { useEffect, useState } from 'react';

export const MOBILE_BREAKPOINT = 640;

// Shared by Navbar (hamburger collapse) and GofeelerSplitView (list vs
// detail panel layout) — one breakpoint definition, not two.
export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
}
