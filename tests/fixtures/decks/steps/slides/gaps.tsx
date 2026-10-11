import { Step } from "#diapo";

export default function Gaps() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 text-[48px]">
      <h1 className="text-[120px]">Gaps</h1>
      <Step at={1}>
        <p>Gap one</p>
      </Step>
      <Step at={3}>
        <p>Gap three</p>
      </Step>
    </div>
  );
}
