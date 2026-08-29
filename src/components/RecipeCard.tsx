import type { Recipe } from '../data/schema'

const EFFORT_LABEL: Record<Recipe['effort'], string> = {
  'no-cook': 'No cooking',
  assemble: 'Just assemble',
  'one-pot': 'One pot',
  stovetop: 'Stovetop',
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

export function RecipeCard({ recipe, pairing }: { recipe: Recipe; pairing?: Recipe }) {
  const sip = recipe.kind === 'drink' ? undefined : pairing

  return (
    <article
      className="card-grain flex h-full w-full flex-col rounded-[26px] border border-card-edge bg-card px-6 pt-6 pb-5 text-ink shadow-[0_24px_60px_-18px_rgba(0,0,0,0.75)]"
      aria-label={`${recipe.title}, ${recipe.totalMinutes} minutes`}
    >
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-[2.75rem] leading-none font-extrabold tracking-tight">
            {recipe.totalMinutes}
          </span>
          <span className="text-[0.7rem] font-semibold tracking-[0.18em] text-ink-soft uppercase">
            min
          </span>
        </div>
        <span className="rounded-full border border-ink/15 px-2.5 py-1 text-[0.65rem] font-semibold tracking-[0.14em] text-ink-soft uppercase">
          {EFFORT_LABEL[recipe.effort]}
        </span>
      </div>

      <h2 className="font-display mt-5 text-[2.6rem] leading-[0.95] font-extrabold tracking-[-0.02em] text-balance">
        {recipe.title}
      </h2>

      <p className="mt-3 text-[0.98rem] leading-snug text-ink-soft text-pretty">{recipe.tagline}</p>

      <div className="mt-auto pt-6">
        {sip && (
          <div className="mb-4 rounded-2xl bg-ink/[0.055] px-4 py-3">
            <div className="text-[0.62rem] font-semibold tracking-[0.18em] text-ink-soft uppercase">
              Sip alongside
            </div>
            <div className="font-display mt-0.5 text-lg font-bold tracking-tight">{sip.title}</div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-ink/12 pt-3 text-[0.72rem] text-ink-soft">
          <span>Serves {recipe.serves}</span>
          {recipe.allergens.length > 0 && (
            <span className="font-medium">Contains {list(recipe.allergens)}</span>
          )}
        </div>
      </div>
    </article>
  )
}
