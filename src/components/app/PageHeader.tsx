interface Props {
  eyebrow?: string;
  title: string;
  description?: string;
  right?: React.ReactNode;
}

export function PageHeader({ eyebrow, title, description, right }: Props) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {eyebrow && <div className="text-sm font-medium text-muted-foreground">{eyebrow}</div>}
        </div>
        {description && (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {right}
    </header>
  );
}
