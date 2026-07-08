import { useEffect, useState } from "react";
import { getBookmarks, type Bookmark } from "../lib/data";
import { Link } from "react-router-dom";

export default function Account() {
  const [marks, setMarks] = useState<Bookmark[]>([]);
  useEffect(() => setMarks(getBookmarks()), []);

  return (
    <div className="mx-auto max-w-xl px-6 pt-12">
      <p className="font-label text-[11px] tracking-rite text-gold">YOUR PLACE</p>
      <h1 className="mt-2 font-heading text-4xl text-parchment">Kept on this device</h1>
      <p className="mt-3 max-w-md font-body text-base italic leading-relaxed text-vellum">
        Your bookmarks and your Seal live on this device. Cross-device sync and
        the Pro tier await their keys; nothing here pretends otherwise.
      </p>
      <div className="mt-8">
        {marks.length === 0 && (
          <p className="font-body italic text-vellum">
            Nothing kept yet. Open any scroll and choose KEEP.
          </p>
        )}
        {marks.map((m) => (
          <Link
            key={m.id}
            to={`/read/${encodeURIComponent(m.id)}`}
            className="block border-b border-gold/10 py-3 font-body italic text-parchment/90 hover:text-parchment"
          >
            <span className="mr-3 font-label not-italic text-xs text-gold">{m.id}</span>
            {m.title}
          </Link>
        ))}
      </div>
      <button
        onClick={() => {
          try {
            const order: string[] = JSON.parse(localStorage.getItem("zionos-lru") || "[]");
            for (const id of order) localStorage.removeItem(`zionos-scroll-${id}`);
            localStorage.removeItem("zionos-lru");
            alert("The offline cache is cleared. Your bookmarks remain.");
          } catch { /* nothing to clear */ }
        }}
        className="mt-10 border border-gold/40 px-6 py-3 font-label text-[10px] tracking-seal text-gold/85 hover:border-gold hover:text-gold"
      >
        CLEAR THE OFFLINE CACHE
      </button>
      <div className="h-12" />
    </div>
  );
}
