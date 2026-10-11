import { useState } from "react";

export default function Form() {
  const [pressCount, setPressCount] = useState(0);
  return (
    <div className="flex h-full gap-24 bg-slate-50 px-40 py-32 text-4xl text-slate-700">
      <div className="flex w-1/2 flex-col gap-12">
        <h1 className="text-8xl font-bold text-slate-800">表單元件</h1>
        <ul className="list-disc space-y-6 pl-12 leading-snug">
          <li>在輸入框裡按方向鍵或 B，只會移動游標或打字，不會換頁。</li>
          <li>在輸入框裡按 PageDown（翻頁器的下一頁鍵）仍然會換頁。</li>
          <li>焦點在按鈕上時，Space 與 Enter 會按下按鈕，方向鍵仍然會換頁。</li>
          <li>點過按鈕之後輸入頁碼再按 Enter，仍然會跳頁。</li>
        </ul>
      </div>
      <div className="flex w-1/2 flex-col justify-center gap-10">
        <label className="flex flex-col gap-3">
          文字輸入框
          <input className="rounded-lg border-2 border-slate-300 bg-white px-4 py-2" />
        </label>
        <label className="flex flex-col gap-3">
          多行文字
          <textarea
            rows={3}
            className="rounded-lg border-2 border-slate-300 bg-white px-4 py-2"
          />
        </label>
        <label className="flex flex-col gap-3">
          下拉選單
          <select className="rounded-lg border-2 border-slate-300 bg-white px-4 py-2">
            <option>第一個選項</option>
            <option>第二個選項</option>
            <option>第三個選項</option>
          </select>
        </label>
        <label className="flex items-center gap-4">
          <input type="checkbox" className="size-10" />
          勾選方塊
        </label>
        <button
          type="button"
          className="self-start rounded-lg bg-slate-800 px-8 py-4 text-white"
          onClick={() => setPressCount(pressCount + 1)}
        >
          按了 {pressCount} 次
        </button>
      </div>
    </div>
  );
}
