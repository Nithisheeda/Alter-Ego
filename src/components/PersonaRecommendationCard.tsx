import type { PersonaRecommendation } from '../lib/personaRecommendation'

interface PersonaRecommendationCardProps {
  recommendation: PersonaRecommendation
  onUseArchetype?: (archetype: { name: string; masteryDomain: string; demeanor: string }) => void
}

export function PersonaRecommendationCard({ recommendation, onUseArchetype }: PersonaRecommendationCardProps) {
  return (
    <div className="animate-fade-in-up rounded-2xl border border-fuchsia-400/20 bg-gradient-to-b from-fuchsia-500/[0.06] to-transparent p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white">Scenario-to-Persona Recommendation</p>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
            recommendation.source === 'live'
              ? 'border-emerald-400/30 text-emerald-300'
              : 'border-amber-400/30 text-amber-300'
          }`}
        >
          {recommendation.source === 'live' ? 'Live AI' : 'Mock'}
        </span>
      </div>

      {recommendation.recommendedPersonaName ? (
        <div className="rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 p-4">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-fuchsia-300">
            Recommended: {recommendation.recommendedPersonaName}
          </p>
          <p className="text-sm font-medium leading-relaxed text-white">{recommendation.rationale}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-white/70">{recommendation.rationale}</p>
          {recommendation.suggestedArchetype && (
            <div className="rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 p-4">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-fuchsia-300">
                Suggested Archetype: {recommendation.suggestedArchetype.name}
              </p>
              {recommendation.suggestedArchetype.masteryDomain && (
                <p className="text-sm leading-relaxed text-white/80">
                  Mastery: {recommendation.suggestedArchetype.masteryDomain}
                </p>
              )}
              {recommendation.suggestedArchetype.demeanor && (
                <p className="mt-1 text-xs text-white/50">Demeanor: {recommendation.suggestedArchetype.demeanor}</p>
              )}
              {onUseArchetype && (
                <button
                  type="button"
                  onClick={() => onUseArchetype(recommendation.suggestedArchetype!)}
                  className="mt-3 min-h-9 rounded-lg border border-fuchsia-400/40 px-3 py-1.5 text-xs font-medium text-fuchsia-200 transition hover:bg-fuchsia-500/20"
                >
                  Use This Archetype
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
