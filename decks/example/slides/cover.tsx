import slidetray from "../assets/slidetray.svg";

export const notes = `
這裡是講者備註，用 Markdown 寫在每一頁的 TSX 檔裡，只有講者視窗看得到。

先介紹 diapo 的定位：簡報是程式碼，播放只需要瀏覽器。
`;

export default function Cover() {
  return (
    <div className="flex h-full items-center justify-center gap-32 bg-slate-50">
      <img className="size-[480px]" src={slidetray} alt="幻燈片盒" />
      <div>
        <h1 className="text-9xl font-bold text-slate-800">diapo</h1>
        <p className="mt-8 text-5xl text-slate-600">用程式碼寫簡報，在任何地方播放</p>
        <p className="mt-16 text-4xl text-slate-400">按 → 或往左滑開始</p>
      </div>
    </div>
  );
}
