import { useEffect, useState } from "react";

// Notes longer than the notes pane (OVW-R18.5).
export const notes = `
Page 1 第 1 段補充說明。

Page 1 第 2 段補充說明。

Page 1 第 3 段補充說明。

Page 1 第 4 段補充說明。

Page 1 第 5 段補充說明。

Page 1 第 6 段補充說明。

Page 1 第 7 段補充說明。

Page 1 第 8 段補充說明。

Page 1 第 9 段補充說明。

Page 1 第 10 段補充說明。

Page 1 第 11 段補充說明。

Page 1 第 12 段補充說明。

Page 1 第 13 段補充說明。

Page 1 第 14 段補充說明。

Page 1 第 15 段補充說明。

Page 1 第 16 段補充說明。

Page 1 第 17 段補充說明。

Page 1 第 18 段補充說明。

Page 1 第 19 段補充說明。

Page 1 第 20 段補充說明。

Page 1 第 21 段補充說明。

Page 1 第 22 段補充說明。

Page 1 第 23 段補充說明。

Page 1 第 24 段補充說明。

Page 1 第 25 段補充說明。

Page 1 第 26 段補充說明。

Page 1 第 27 段補充說明。

Page 1 第 28 段補充說明。

Page 1 第 29 段補充說明。

Page 1 第 30 段補充說明。

Page 1 第 31 段補充說明。

Page 1 第 32 段補充說明。

Page 1 第 33 段補充說明。

Page 1 第 34 段補充說明。

Page 1 第 35 段補充說明。

Page 1 第 36 段補充說明。

Page 1 第 37 段補充說明。

Page 1 第 38 段補充說明。

Page 1 第 39 段補充說明。

Page 1 第 40 段補充說明。
`;

/** A counter that goes up every second, which starts over whenever it mounts (OVW-R6.6). */
export default function Page1() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds((count) => count + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-16">
      <h1 className="text-[120px]">Page 1</h1>
      <p className="text-[64px]">Seconds: {seconds}</p>
    </div>
  );
}
