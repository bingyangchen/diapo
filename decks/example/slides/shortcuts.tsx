const SHORTCUTS: [string, string][] = [
  ["下一頁", "→、↓、PageDown、Space、Enter，或往左滑"],
  ["上一頁", "←、↑、PageUp、Shift+Space、Backspace，或往右滑"],
  ["第一頁、最後一頁", "Home、End"],
  ["跳到第 n 頁", "輸入 n，再按 Enter"],
  ["黑畫面", "B 或 ."],
  ["全螢幕", "F、F5，或右下角的按鈕"],
];

export default function Shortcuts() {
  return (
    <div className="flex h-full flex-col justify-center gap-16 bg-slate-50 px-40 text-slate-700">
      <h1 className="text-8xl font-bold text-slate-800">操作方式</h1>
      <table className="text-5xl">
        <tbody>
          {SHORTCUTS.map(([action, keys]) => (
            <tr key={action} className="border-b-2 border-slate-200">
              <th className="py-6 pr-16 text-left font-semibold whitespace-nowrap">
                {action}
              </th>
              <td className="py-6">{keys}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-4xl text-slate-500">
        翻頁器送出的按鍵和鍵盤相同，所以也可以用翻頁器操作。
      </p>
    </div>
  );
}
