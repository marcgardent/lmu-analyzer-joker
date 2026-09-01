import { Shield, GitFork, Scale } from 'lucide-react';

export function Footer() {
  return (
    <footer className="mt-10 border-t border-racing-border/50">
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          {/* Brand & Author / Fork baseline */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-2">
            <div className="flex items-center gap-2.5">
              <div
                className="w-5 h-5 bg-racing-red flex items-center justify-center shrink-0"
                style={{ clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))' }}
              >
                <span className="font-racing text-[6px] font-black" style={{ color: '#ffffff' }}>LMU</span>
              </div>
              <span className="text-racing-muted/80">
                Forked by{' '}
                <a
                  href="https://github.com/marcgardent/lmu-analyzer-joker"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-racing-text hover:text-racing-red transition-colors inline-flex items-center gap-1"
                >
                  <GitFork className="w-3 h-3 text-racing-red" />
                  marcgardent
                </a>
              </span>
            </div>

            <span className="text-racing-border hidden sm:inline">•</span>

            <span className="text-racing-muted/60">
              Baseline:{' '}
              <a
                href="https://github.com/arminreiter/lmu-analyzer"
                target="_blank"
                rel="noopener noreferrer"
                className="text-racing-muted hover:text-racing-text transition-colors underline underline-offset-2 decoration-racing-border hover:decoration-racing-muted"
              >
                arminreiter (axrider)
              </a>
            </span>
          </div>

          {/* License & Client-side */}
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/marcgardent/lmu-analyzer-joker/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-racing-muted/70 hover:text-racing-text transition-colors"
              title="MIT License"
            >
              <Scale className="w-3.5 h-3.5 text-racing-muted/50" />
              <span>MIT License</span>
            </a>

            <span className="text-racing-border">•</span>

            <span className="flex items-center gap-1.5 text-racing-muted/40 text-[10px] tracking-wider font-mono">
              <Shield className="w-3 h-3 text-racing-green/70" />
              100% CLIENT-SIDE
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

