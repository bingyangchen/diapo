export default function Fullscreen() {
  return (
    <div className="flex h-full flex-col justify-center gap-12 bg-slate-50 px-40 text-5xl leading-snug text-slate-700">
      <h1 className="text-8xl font-bold text-slate-800">全螢幕與游標</h1>
      <ul className="list-disc space-y-6 pl-16">
        <li>按 F 切換全螢幕，按 Esc 離開全螢幕。</li>
        <li>按 F5 或 Shift+F5（翻頁器的播放鍵）進入全螢幕，網頁不會重新載入。</li>
        <li>
          移動滑鼠時，右下角會出現全螢幕按鈕；滑鼠停止移動 2 秒後，按鈕與游標一起隱藏。
        </li>
        <li>按住 → 不放會連續換頁；按住 F 不放，全螢幕只會切換一次。</li>
      </ul>
    </div>
  );
}
