import { HashRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import Landing from "./views/Landing";
import Vault from "./views/Vault";
import GateHall from "./views/GateHall";
import Reader from "./views/Reader";
import Search from "./views/Search";
import Companion from "./views/Companion";
import SealView from "./views/SealView";
import Account from "./views/Account";

function Shell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const inReader = pathname.startsWith("/read/");
  const navItems = [
    { to: "/vault", label: "VAULT" },
    { to: "/search", label: "SEEK" },
    { to: "/companion", label: "LIBRARIAN" },
    { to: "/seal", label: "SEAL" },
  ];
  return (
    <div className="min-h-dvh flex flex-col">
      <div className="dawn-line" aria-hidden />
      <main className="flex-1 pb-20">{children}</main>
      {!inReader && (
        <nav
          aria-label="Primary"
          className="fixed bottom-0 inset-x-0 z-30 bg-void/95 backdrop-blur-sm border-t border-gold/15"
        >
          <div className="mx-auto max-w-xl grid grid-cols-4">
            {navItems.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `py-4 text-center font-label text-[10px] leading-none tracking-seal transition-colors ${
                    isActive ? "text-gold" : "text-vellum hover:text-parchment"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/vault" element={<Vault />} />
          <Route path="/vault/:gateId" element={<GateHall />} />
          <Route path="/read/:scrollId" element={<Reader />} />
          <Route path="/search" element={<Search />} />
          <Route path="/companion" element={<Companion />} />
          <Route path="/seal" element={<SealView />} />
          <Route path="/account" element={<Account />} />
        </Routes>
      </Shell>
    </HashRouter>
  );
}
