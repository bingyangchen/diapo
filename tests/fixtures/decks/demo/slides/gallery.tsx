import { useEffect, useState } from "react";

/** A carousel that claims → on window, like many carousel libraries (PRES-R6.6, PRES-R6.7). */
export default function Gallery() {
  const [imageNumber, setImageNumber] = useState(1);
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "ArrowRight") return;
      event.preventDefault();
      setImageNumber((number) => number + 1);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-16">
      <h1 className="text-[120px]">Gallery</h1>
      <p className="text-[64px]">Image {imageNumber}</p>
    </div>
  );
}
