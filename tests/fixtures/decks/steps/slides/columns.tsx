import { Step } from "#diapo";

export default function Columns() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 text-[48px]">
      <h1 className="text-[120px]">Columns</h1>
      <div className="flex gap-32">
        <div className="flex flex-col gap-8">
          <Step at={1}>
            <p>Left one</p>
          </Step>
          <Step at={2}>
            <p>Left two</p>
          </Step>
        </div>
        <Step at={2}>
          <div role="img" aria-label="Chart" className="size-64 bg-sky-400" />
        </Step>
      </div>
    </div>
  );
}
