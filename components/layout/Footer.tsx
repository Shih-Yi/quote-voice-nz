import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-white border-t border-border py-8 px-4">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-text-muted">
        <div>
          <span className="font-semibold text-text">KiwiSpeakQuote</span> © {newDhate().getFullYear()}
        </div>
        <div className="flex items-center gap-6">
          <span>Made in Christchurch 🇳🇿</span>
          <Link href="#" className="hover:text-primary transition-colors">Privacy</Link>
          <Link href="#" className="hover:text-primary transition-colors">Terms</Link>
        </div>
      </div>
    </footer>
  );
}

function newDhate() {
    return new Date();
}
