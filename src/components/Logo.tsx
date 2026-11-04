import { useId } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

// The Tickerframe mark: a bevelled picture frame (mitred corners) around a
// thin inner frame and a solid T. Drawn as vectors so it stays sharp at any
// size and picks up the light/dark theme colours.
export const LogoMark = ({ className }: { className?: string }) => {
  const id = useId();
  return (
    <svg viewBox="0 0 600 600" className={cn('h-6 w-6 shrink-0', className)} aria-hidden="true">
      <defs>
        {/* cuts the four diagonal gaps into the outer frame without needing a background colour */}
        <mask id={id}>
          <rect width="600" height="600" fill="white" />
          <path d="M0 0L50 50M600 0L550 50M0 600L50 550M600 600L550 550" stroke="black" strokeWidth="16" />
        </mask>
      </defs>
      <path
        d="M0 0H600V600H0Z M50 50V550H550V50Z"
        fillRule="evenodd"
        fill="hsl(var(--logo-green))"
        mask={`url(#${id})`}
      />
      <rect x="99" y="99" width="404" height="404" fill="none" stroke="hsl(var(--logo-green))" strokeWidth="12" />
      <rect x="185" y="188" width="230" height="60" fill="hsl(var(--foreground))" />
      <rect x="270" y="248" width="61" height="162" fill="hsl(var(--foreground))" />
    </svg>
  );
};

export const Logo = ({ className, markClassName }: { className?: string; markClassName?: string }) => (
  <span className={cn('inline-flex items-center gap-2 leading-none', className)}>
    <LogoMark className={markClassName} />
    <span className="text-[17px] font-semibold tracking-tight">
      <span className="text-foreground">Ticker</span><span className="text-[hsl(var(--logo-green))]">frame</span>
    </span>
  </span>
);

// The logo as a link to the landing page, used in the top-left of every page.
export const LogoLink = ({ className }: { className?: string }) => (
  <Link to="/welcome" aria-label="Tickerframe home" className={cn('inline-flex rounded-sm transition-opacity hover:opacity-80', className)}>
    <Logo />
  </Link>
);
