export default function Jumping() {
  return (
    <div className="flex h-full flex-col justify-center gap-12 bg-slate-50 px-40 text-5xl leading-snug text-slate-700">
      <h1 className="text-8xl font-bold text-slate-800">跳頁</h1>
      <ul className="list-disc space-y-6 pl-16">
        <li>
          網址的 hash 記錄目前的頁面與步驟，這一頁是 <code>#/jumping</code>
          ，重新整理之後仍然停在這一頁。
        </li>
        <li>按 End 跳到最後一頁，按 Home 回到第一頁。</li>
        <li>輸入 12 再按 Enter 跳到第 12 頁，輸入時畫面右下角會顯示頁碼。</li>
        <li>
          跳頁之後按瀏覽器的上一頁，會回到跳頁之前的頁面；逐步換頁不會留下瀏覽紀錄。
        </li>
      </ul>
      <a href="#/finale" className="self-start text-blue-600 underline">
        點這個連結跳到最後一頁
      </a>
    </div>
  );
}
