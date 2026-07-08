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
      <div className="h-12" />
    </div>
  );
}
