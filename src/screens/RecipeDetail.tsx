import type { Recipe } from '../data/schema'

const EFFORT_LABEL: Record<Recipe['effort'], string> = {
  'no-cook': 'No cooking',
  assemble: 'Just assemble',
  'one-pot': 'One pot',
  stovetop: 'Stovetop',
}

export function RecipeDetail({
  recipe,
  pairing,
  onBack,
  onOpenPairing,
}: {
  recipe: Recipe
  pairing?: Recipe
  onBack: () => void
  onOpenPairing?: (r: Recipe) => void
}) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <button
        type="button"
        onClick={onBack}
        className="-ml-1 flex w-fit items-center gap-2 py-2 text-sm text-gata/55 transition hover:text-gata"
      >
        <span aria-hidden>←</span> Back to the deck
      </button>

      <header className="pt-4">
        <div className="flex items-baseline gap-2 text-[0.65rem] font-semibold tracking-[0.18em] text-gata/40 uppercase">
          <span>{recipe.totalMinutes} min</span>
          <span aria-hidden>·</span>
          <span>{EFFORT_LABEL[recipe.effort]}</span>
          <span aria-hidden>·</span>
          <span>Serves {recipe.serves}</span>
        </div>
        <h1 className="font-display mt-2 text-[2.7rem] leading-[0.95] font-extrabold tracking-[-0.02em] text-balance text-gata">
          {recipe.title}
        </h1>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-gata/60 text-pretty">
          {recipe.tagline}
        </p>
      </header>

      <section className="mt-8">
        <h2 className="text-[0.65rem] font-semibold tracking-[0.2em] text-gata/40 uppercase">
          What you need
        </h2>
        <ul className="mt-3 divide-y divide-gata/8">
          {recipe.ingredients.map((ing) => (
            <li key={ing.item} className="flex items-baseline justify-between gap-4 py-2.5">
              <span className="text-[0.95rem] text-gata/90">
                {ing.item}
                {ing.allergens && ing.allergens.length > 0 && (
                  <span className="ml-2 rounded-full bg-ube/20 px-2 py-0.5 text-[0.6rem] font-semibold tracking-wide text-ube uppercase">
                    {ing.allergens.join(' · ')}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-sm text-gata/45">{ing.amount}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-[0.65rem] font-semibold tracking-[0.2em] text-gata/40 uppercase">
          How to make it
        </h2>
        {/* Numbered because cooking genuinely is a sequence — the order carries
            information the reader needs, not decoration. */}
        <ol className="mt-4 flex flex-col gap-5">
          {recipe.steps.map((step, i) => (
            <li key={step} className="flex gap-4">
              <span className="font-display w-7 shrink-0 pt-0.5 text-lg leading-none font-extrabold text-ube">
                {i + 1}
              </span>
              <span className="text-[1.02rem] leading-relaxed text-gata/85 text-pretty">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {recipe.note && (
        <p className="mt-8 border-l-2 border-ube/50 pl-4 text-[0.9rem] leading-relaxed text-gata/55 italic">
          {recipe.note}
        </p>
      )}

      {pairing && (
        <section className="mt-8">
          <h2 className="text-[0.65rem] font-semibold tracking-[0.2em] text-gata/40 uppercase">
            Sip alongside
          </h2>
          <button
            type="button"
            onClick={() => onOpenPairing?.(pairing)}
            className="mt-3 flex w-full items-center justify-between gap-4 rounded-2xl border border-gata/12 bg-gata/[0.03] px-5 py-4 text-left transition hover:border-ube/60 hover:bg-ube/10"
          >
            <span>
              <span className="font-display block text-lg font-bold tracking-tight text-gata">
                {pairing.title}
              </span>
              <span className="block text-xs text-gata/45">{pairing.totalMinutes} min</span>
            </span>
            <span aria-hidden className="text-gata/25">
              →
            </span>
          </button>
        </section>
      )}

      <div className="mt-auto pt-10 pb-2">
        <button
          type="button"
          onClick={onBack}
          className="font-display w-full rounded-2xl border border-gata/15 py-4 text-base font-bold tracking-tight text-gata/70 transition hover:border-gata/35 hover:text-gata"
        >
          Back to the deck
        </button>
      </div>
    </div>
  )
}
