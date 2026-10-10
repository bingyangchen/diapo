import photo from "../assets/photo.png";

export default function Intro() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-16">
      <h1 className="text-[120px]">Intro</h1>
      <img className="size-[240px]" src={photo} alt="Noise" />
    </div>
  );
}
