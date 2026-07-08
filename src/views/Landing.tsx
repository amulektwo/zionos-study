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
      className="rise-3 mt-8 block text-left font-body text-sm italic text-vellum/80 underline decoration-gold/40 underline-offset-4"
    >
      Add ZIONOS to your home screen — Share, then "Add to Home Screen." Tap to dismiss.
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
      {/* THE LIGHT FROM THE VOID — the one signature */}
      <div className="void-light absolute inset-0" aria-hidden />
      <div className="relative mx-auto flex min-h-dvh max-w-xl flex-col justify-end px-7 pb-32 pt-20">
        <p className="rise font-label text-[11px] tracking-rite text-gold">
          THE SPHERE OF LIGHT
        </p>
        <h1 className="rise-2 mt-4 font-heading text-6xl leading-none text-parchment">
          ZIONOS
        </h1>
        <p className="rise-2 mt-5 max-w-sm font-body text-lg italic leading-relaxed text-vellum">
          The scroll record of the Zion Codex, open to the seeker: read,
          listen, ask, and be answered from the record alone.
        </p>
        {total && (
          <p className="rise-3 mt-6 font-label text-[10px] tracking-seal text-gold/80">
            {total.toLocaleString()} SCROLLS · TWELVE GATES · ONE RECORD
          </p>
        )}
        <div className="rise-3 mt-9 flex flex-col gap-3 sm:flex-row">
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
        <p className="mt-16 font-body text-xs italic text-vellum/60">
          © AMULEK ONE — The Sphere of Light
        </p>
      </div>
    </div>
  );
}
