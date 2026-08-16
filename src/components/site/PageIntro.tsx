import type { ReactNode } from "react";

export function Eyebrow({ children, centered = false }: { children: ReactNode; centered?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3.5 py-1.5 text-[12.5px] font-bold uppercase tracking-[0.09em] text-gold-deep ${
        centered ? "mx-auto" : ""
      }`}
    >
      <span className="size-1.5 rounded-full bg-gold" />
      {children}
    </span>
  );
}

export function SectionHead({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
}) {
  return (
    <div className="mx-auto mb-12 flex max-w-[680px] flex-col items-center text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-4 text-[clamp(26px,3.4vw,38px)]">{title}</h2>
      {copy ? <p className="mt-3 text-[16.5px] text-muted-foreground">{copy}</p> : null}
    </div>
  );
}

export function AdminNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-12 rounded-xl border border-dashed border-border bg-muted px-5 py-4 text-sm text-muted-foreground">
      {children}
    </p>
  );
}
