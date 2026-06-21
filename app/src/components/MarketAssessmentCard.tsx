import { TrendingUp } from 'lucide-react';

export interface MarketAssessment {
  boxClass: string;
  iconClass: string;
  titleClass: string;
  textClass: string;
  title: string;
  description: string;
}

interface MarketAssessmentCardProps {
  assessment: MarketAssessment | null;
}

export function MarketAssessmentCard({ assessment }: MarketAssessmentCardProps) {
  if (!assessment) {
    return null;
  }

  return (
    <section className={`surface-card rounded-lg border p-4 ${assessment.boxClass}`}>
      <div className="flex items-start gap-3">
        <TrendingUp className={`mt-0.5 h-6 w-6 ${assessment.iconClass}`} />
        <div>
          <h3 className={`font-semibold ${assessment.titleClass}`}>
            {assessment.title}
          </h3>
          <p className={`mt-1 text-sm ${assessment.textClass}`}>
            {assessment.description}
          </p>
        </div>
      </div>
    </section>
  );
}
