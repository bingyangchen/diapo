import { useStep } from "#diapo";

const STAGES = ["規劃", "開發", "上線"];

export default function StepHook() {
  const step = useStep(1, 2);
  return (
    <div className="flex h-full flex-col justify-center gap-16 bg-slate-50 px-40 text-slate-700">
      <h1 className="text-8xl font-bold text-slate-800">用 useStep 替換內容</h1>
      <div className="flex gap-12">
        {STAGES.map((stage, index) => (
          <div
            key={stage}
            className={`flex h-48 flex-1 items-center justify-center rounded-3xl text-6xl font-semibold ${
              index === step ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-500"
            }`}
          >
            {stage}
          </div>
        ))}
      </div>
      <p className="text-5xl leading-snug">
        目前在第 {step} 步。<code>{"<Step>"}</code>{" "}
        只會讓內容出現，要替換或移除內容時，用 <code>useStep</code> 讀出目前的步驟。
      </p>
    </div>
  );
}
