import EarthCanvas from "@/components/earth-canvas";

export default function EarthHome() {
  return (
    <main className="earth-home relative min-h-[100svh] flex-1 overflow-hidden bg-[#02050d] text-white">
      <div
        aria-hidden="true"
        className="earth-home-overlay pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(20,76,165,0.2),transparent_34%),radial-gradient(circle_at_50%_50%,rgba(2,5,13,0),rgba(2,5,13,0.9)_76%)]"
      />
      <div className="absolute inset-0 cursor-grab active:cursor-grabbing">
        <EarthCanvas />
      </div>
      <p className="sr-only">
        Interactive 3D Earth. Drag to rotate and use the scroll wheel or pinch gesture to zoom.
      </p>
    </main>
  );
}
