import { Step } from "#diapo";

export default function Steps() {
  return (
    <div className="flex h-full flex-col justify-center gap-16 bg-slate-50 px-40 text-5xl leading-snug text-slate-700">
      <h1 className="text-8xl font-bold text-slate-800">頁內分步</h1>
      <div className="flex gap-24">
        {/* Spaced with gap, since space-y would skip the items inside a Step. */}
        <ul className="flex w-3/5 list-disc flex-col gap-8 pl-16">
          <Step at={1}>
            <li>按 → 時，這一頁的項目一個一個出現。</li>
          </Step>
          <Step at={2}>
            <li>右邊的方塊和這一項在同一步出現。</li>
          </Step>
          <Step at={3}>
            <li>
              走完這一頁的步驟才會換頁；從下一頁按 ← 回來時，停在這一頁的最後一步。
            </li>
          </Step>
        </ul>
        <Step at={2}>
          <div className="flex w-2/5 items-center justify-center rounded-3xl bg-sky-200 text-4xl text-sky-900">
            和第 2 項一起出現
          </div>
        </Step>
      </div>
      <p className="text-4xl text-slate-500">
        網址的 hash 記錄目前的步驟，例如第 2 步是 <code>#/steps/2</code>。
      </p>
    </div>
  );
}
