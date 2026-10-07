import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { LEGAL } from '@/lib/legalConfig';

export const LegalSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-2">
    <h2 className="font-heading text-lg font-bold">{title}</h2>
    <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
  </section>
);

export const LegalDoc = ({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) => (
  <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15">{icon}</div>
      <div>
        <h1 className="font-heading text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">Effective {LEGAL.effectiveDate}</p>
      </div>
    </div>
    {LEGAL.draft && (
      <Card className="border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-200">
        <strong className="text-amber-300">Draft.</strong> This document describes how {LEGAL.serviceName} works today but has not yet been reviewed by an attorney and may change.
      </Card>
    )}
    <Card className="space-y-6 p-5">{children}</Card>
    <p className="text-center text-xs text-muted-foreground">
      <Link to="/terms" className="underline">Terms of Use</Link> · <Link to="/privacy" className="underline">Privacy Policy</Link> · <Link to="/legal" className="underline">Disclaimers</Link> · <Link to="/methodology" className="underline">Methodology</Link>
    </p>
  </div>
);
