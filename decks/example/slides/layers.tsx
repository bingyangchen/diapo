export default function Layers() {
  return (
    <div className="flex h-full items-center gap-24 bg-slate-50 px-40 text-slate-700">
      <div className="flex w-1/2 flex-col gap-12">
        <h1 className="text-8xl font-bold text-slate-800">黑畫面</h1>
        <ul className="list-disc space-y-6 pl-12 text-4xl leading-snug">
          <li>按 B 或 . 切換黑畫面。</li>
          <li>右邊的圖層設定了 z-index，黑畫面仍然會蓋住它們。</li>
          <li>黑畫面時按換頁的按鍵，只會結束黑畫面，不會換頁。</li>
          <li>黑畫面時按 F 切換全螢幕，黑畫面維持不變。</li>
          <li>按住 B 不放，黑畫面只會切換一次。</li>
        </ul>
      </div>
      <div className="relative size-[700px]">
        <div className="absolute top-0 left-0 z-10 size-[400px] rounded-3xl bg-sky-400 shadow-xl" />
        <div className="absolute top-[150px] left-[150px] z-20 size-[400px] rounded-3xl bg-amber-400 shadow-xl" />
        <div className="absolute top-[300px] left-[300px] z-30 flex size-[400px] items-center justify-center rounded-3xl bg-rose-400 text-6xl font-bold text-white shadow-xl">
          z-30
        </div>
      </div>
    </div>
  );
}
