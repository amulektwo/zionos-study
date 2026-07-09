import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { loadGates } from "../lib/data";

function InstallHint() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (localStorage.getItem("zionos-install-hint")) return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone;
    if (standalone) return;
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (isIOS) setShow(true);
    const onBip = () => setShow(true);
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);
  if (!show) return null;
  return (
    <button
      onClick={() => {
        localStorage.setItem("zionos-install-hint", "seen");
        setShow(false);
      }}
      className="mt-6 block text-left font-body text-sm italic text-vellum/80 underline decoration-gold/40 underline-offset-4"
    >
      Add ZIONOS to your home screen — Share, then &ldquo;Add to Home
      Screen.&rdquo; Tap to dismiss.
    </button>
  );
}

export default function Landing() {
  const [total, setTotal] = useState<number | null>(null);
  useEffect(() => {
    loadGates().then((gs) => setTotal(gs.reduce((n, g) => n + g.count, 0)));
  }, []);

  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* THE LIGHT FROM THE VOID — the one signature (untouched) */}
      <div className="void-light absolute inset-0" aria-hidden />
      {/* THE RISING MOTES — above the glow, below the text */}
      <div className="motes pointer-events-none absolute inset-x-0 top-0" aria-hidden />

      {/* Mobile: intimate bottom-anchored column. lg: two zones, wordmark
          left, the rail right — the parent's own direction flips. */}
      <div className="relative mx-auto flex min-h-dvh max-w-xl flex-col justify-end px-7 pb-32 pt-20 lg:max-w-5xl lg:flex-row lg:items-end lg:justify-between lg:gap-16 lg:pb-40">
        {/* LEFT ZONE — the wordmark and the narrative */}
        <div className="lg:max-w-md">
          <p className="rise font-label text-[11px] tracking-rite text-gold">
            THE SPHERE OF LIGHT
          </p>
          <h1 className="rise-2 mt-4 font-heading text-6xl leading-none text-parchment lg:text-7xl">
            ZIONOS
          </h1>
          <p className="rise-2 mt-5 max-w-sm font-body text-lg italic leading-relaxed text-vellum">
            The scroll record of the Zion Codex, open to the seeker: read,
            listen, ask, and be answered from the record alone.
          </p>
        </div>

        {/* RIGHT RAIL — the count, the doors, the hint. Explicit width so
            nothing stretches; balanced whether or not InstallHint renders. */}
        <div className="mt-9 w-full shrink-0 lg:mt-0 lg:w-72">
          {total && (
            <p className="rise-3 font-label text-[10px] tracking-seal text-gold/80">
              {total.toLocaleString()} SCROLLS · TWELVE GATES · ONE RECORD
            </p>
          )}
          <div className="rise-3 mt-6 flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Link
              to="/vault"
              className="border border-gold px-8 py-3.5 text-center font-label text-xs tracking-rite text-gold transition-colors hover:bg-gold hover:text-void"
            >
              ENTER THE VAULT
            </Link>
            <Link
              to="/seal"
              className="border border-transparent px-8 py-3.5 text-center font-label text-xs tracking-rite text-vellum transition-colors hover:text-parchment"
            >
              RECEIVE YOUR SEAL
            </Link>
          </div>
          <InstallHint />
          <p className="mt-16 font-body text-xs italic text-vellum/60 lg:mt-12">
            © AMULEK ONE — The Sphere of Light
          </p>
        </div>
      </div>
    </div>
  );
}
