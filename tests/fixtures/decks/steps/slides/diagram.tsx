import { Step } from "#diapo";

export default function Diagram() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8">
      <h1 className="text-[120px]">Diagram</h1>
      <svg width="400" height="200" viewBox="0 0 400 200">
        <rect width="150" height="200" fill="steelblue" />
        <Step at={1}>
          <circle cx="300" cy="100" r="80" fill="tomato" />
        </Step>
      </svg>
    </div>
  );
}
