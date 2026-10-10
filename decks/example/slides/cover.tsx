import slidetray from "../assets/slidetray.svg";

export default function Cover() {
  return (
    <div className="flex h-full items-center justify-center gap-32 bg-slate-50">
      <img className="size-[480px]" src={slidetray} alt="幻燈片盒" />
      <div>
        <h1 className="text-9xl font-bold text-slate-800">diapo</h1>
        <p className="mt-8 text-5xl text-slate-600">用程式碼寫簡報，在任何地方播放</p>
      </div>
    </div>
  );
}
