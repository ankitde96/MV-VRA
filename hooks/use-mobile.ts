import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  // Keep the server render and the client's first render identical. Reading `window` in
  // the state initializer made narrow viewports render the mobile Sheet before hydration
  // while the server had emitted the desktop sidebar, forcing React to replace the tree.
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
