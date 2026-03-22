export function Footer() {
  return (
    <footer className="px-6 py-6" style={{ backgroundColor: "#2D1810" }}>
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 md:flex-row md:justify-between">
        <div>
          <div className="text-lg font-bold" style={{ color: "#FFF8F5" }}>Sakhiyaan</div>
          <div className="text-xs" style={{ color: "#8c706f" }}>Your Digital Sanctuary</div>
        </div>
        <div className="flex gap-6">
          <a href="/privacy" className="text-sm" style={{ color: "#E0BFBD" }}>Privacy Policy</a>
          <a href="/terms" className="text-sm" style={{ color: "#E0BFBD" }}>Terms of Service</a>
          <a href="/support" className="text-sm" style={{ color: "#E0BFBD" }}>Support</a>
        </div>
        <div className="text-xs" style={{ color: "#8c706f" }}>© 2026 Sakhiyaan</div>
      </div>
    </footer>
  );
}
