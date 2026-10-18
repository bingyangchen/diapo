import { useEffect } from "react";

/**
 * Claims → on window in the capture phase, which its thumbnail still does while the overview
 * fades out (OVW-R6.7).
 */
export default function Grabber() {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") event.preventDefault();
    }
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, []);
  return <h1 className="text-[120px]">Grabber</h1>;
}
