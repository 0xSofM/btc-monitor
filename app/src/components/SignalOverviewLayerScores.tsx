type SignalOverviewLayerScoresProps = {
  valuationScore: number;
  maxValuationScore: number;
  triggerScore: number;
  maxTriggerScore: number;
  confirmationScore: number;
  maxConfirmationScore: number;
};

export function SignalOverviewLayerScores({
  valuationScore,
  maxValuationScore,
  triggerScore,
  maxTriggerScore,
  confirmationScore,
  maxConfirmationScore,
}: SignalOverviewLayerScoresProps) {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <article className="rounded-xl border bg-background/70 p-4">
        <p className="text-sm text-muted-foreground">估值层</p>
        <p className="mt-1 text-xl font-semibold">{valuationScore}/{maxValuationScore}</p>
      </article>
      <article className="rounded-xl border bg-background/70 p-4">
        <p className="text-sm text-muted-foreground">触发层</p>
        <p className="mt-1 text-xl font-semibold">{triggerScore}/{maxTriggerScore}</p>
      </article>
      <article className="rounded-xl border bg-background/70 p-4">
        <p className="text-sm text-muted-foreground">确认层</p>
        <p className="mt-1 text-xl font-semibold">{confirmationScore}/{maxConfirmationScore}</p>
      </article>
    </section>
  );
}
