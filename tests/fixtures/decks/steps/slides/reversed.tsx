import { Step } from "#diapo";

export default function Reversed() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 text-[48px]">
      <h1 className="text-[120px]">Reversed</h1>
      <Step at={2}>
        <p>Shown second</p>
      </Step>
      <Step at={1}>
        <p>Shown first</p>
      </Step>
    </div>
  );
}
