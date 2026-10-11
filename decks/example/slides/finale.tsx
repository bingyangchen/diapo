export default function Finale() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-16 bg-slate-50 px-40 text-slate-700">
      <h1 className="text-9xl font-bold text-slate-800">謝謝觀看</h1>
      <p className="max-w-[1500px] text-center text-5xl leading-snug">
        這是最後一頁。如果是用連結、End
        或輸入頁碼跳過來的，按瀏覽器的上一頁可以回到剛才的頁面。
      </p>
      <a href="#/cover" className="text-5xl text-blue-600 underline">
        回到第一頁
      </a>
    </div>
  );
}
