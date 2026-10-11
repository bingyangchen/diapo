import { Step } from "#diapo";

export default function HintZero() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 text-[48px]">
      <h1 className="text-[120px]">Hint zero</h1>
      <Step at={0}>
        <p>Zero hint</p>
      </Step>
    </div>
  );
}
