function ballClass(n: number): string {
  if (n <= 10) return "ball-1";
  if (n <= 20) return "ball-2";
  if (n <= 30) return "ball-3";
  if (n <= 40) return "ball-4";
  return "ball-5";
}

export function LottoBall({ n }: { n: number }) {
  return <span className={`lotto-ball ${ballClass(n)}`}>{n}</span>;
}

export function ComboRow({
  combo,
  index,
}: {
  combo: number[];
  index?: number;
}) {
  const sorted = [...combo].sort((a, b) => a - b);
  return (
    <div className="flex items-center gap-1.5">
      {typeof index === "number" && (
        <span className="w-7 shrink-0 text-xs font-semibold text-muted-foreground">
          {index + 1}
        </span>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {sorted.map((n, i) => (
          <LottoBall key={`${n}-${i}`} n={n} />
        ))}
      </div>
    </div>
  );
}
