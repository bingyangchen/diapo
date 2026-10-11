import { Step } from "#diapo";

// Each layout appears twice, once with the middle item in a Step and once without, so a
// test can compare the two.
export default function Layout() {
  return (
    <div className="flex h-full flex-col justify-center gap-16 p-16 text-[48px]">
      <h1 className="text-[120px]">Layout</h1>
      <div className="grid grid-cols-3 gap-8">
        <div data-testid="grid-stepped-0">A</div>
        <Step at={1}>
          <div data-testid="grid-stepped-1">B</div>
        </Step>
        <div data-testid="grid-stepped-2">C</div>
      </div>
      <div className="grid grid-cols-3 gap-8">
        <div data-testid="grid-plain-0">A</div>
        <div data-testid="grid-plain-1">B</div>
        <div data-testid="grid-plain-2">C</div>
      </div>
      <div className="flex justify-between">
        <div data-testid="flex-stepped-0">Left</div>
        <Step at={1}>
          <div data-testid="flex-stepped-1">Middle</div>
        </Step>
        <div data-testid="flex-stepped-2">Right</div>
      </div>
      <div className="flex justify-between">
        <div data-testid="flex-plain-0">Left</div>
        <div data-testid="flex-plain-1">Middle</div>
        <div data-testid="flex-plain-2">Right</div>
      </div>
    </div>
  );
}
