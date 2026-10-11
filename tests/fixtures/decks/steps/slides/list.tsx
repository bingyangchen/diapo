import { Step, useStep } from "#diapo";

export default function List() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 text-[48px]">
      <h1 className="text-[120px]">List</h1>
      <Step at={1}>
        <p>First point</p>
      </Step>
      <Step at={2}>
        <p>Second point</p>
      </Step>
      <Conclusion />
      <p>Closing</p>
      <a href="#/recap">Recap</a>
    </div>
  );
}

function Conclusion() {
  const step = useStep(3);
  return <p>{step < 3 ? "Old conclusion" : "New conclusion"}</p>;
}
