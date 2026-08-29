import { useState } from 'react'
import { ALLERGENS, DIET_TAGS, type Allergen, type DietTag } from '../data/schema'

const ALLERGEN_LABEL: Record<Allergen, string> = {
  peanut: 'Peanuts',
  treenut: 'Tree nuts',
  shellfish: 'Shellfish',
  fish: 'Fish',
  egg: 'Egg',
  dairy: 'Dairy',
  soy: 'Soy',
  gluten: 'Gluten',
  sesame: 'Sesame',
  coconut: 'Coconut',
}

/** The ingredient people actually forget carries it. */
const ALLERGEN_HINT: Partial<Record<Allergen, string>> = {
  shellfish: 'bagoong, patis',
  coconut: 'gata',
  gluten: 'lumpia wrapper',
  dairy: 'evap, condensada',
  peanut: 'kare-kare',
}

const DIET_LABEL: Record<DietTag, string> = {
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  'pork-free': 'No pork',
}

function Chip({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean
  onClick: () => void
  label: string
  hint?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-2xl border px-4 py-2.5 text-left transition ${
        active
          ? 'border-ube bg-ube/20 text-gata'
          : 'border-gata/15 bg-gata/[0.03] text-gata/70 hover:border-gata/30'
      }`}
    >
      <span className="block text-sm font-semibold">{label}</span>
      {hint && <span className="block text-[0.68rem] text-gata/45">{hint}</span>}
    </button>
  )
}

export function Onboarding({
  onDone,
}: {
  onDone: (prefs: { allergies: Allergen[]; diets: DietTag[] }) => void
}) {
  const [allergies, setAllergies] = useState<Allergen[]>([])
  const [diets, setDiets] = useState<DietTag[]>([])

  const toggle = <T,>(list: T[], set: (v: T[]) => void, v: T) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="pt-6">
        <h1 className="font-display text-[2.4rem] leading-[1] font-extrabold tracking-tight text-balance text-gata">
          Anything you cannot eat?
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-gata/60">
          Tap what to keep out. Nothing carrying it will ever reach your deck. You can change this
          later.
        </p>
      </div>

      <section className="mt-7">
        <h2 className="text-[0.65rem] font-semibold tracking-[0.2em] text-gata/40 uppercase">
          Allergies
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {ALLERGENS.map((a) => (
            <Chip
              key={a}
              active={allergies.includes(a)}
              onClick={() => toggle(allergies, setAllergies, a)}
              label={ALLERGEN_LABEL[a]}
              hint={ALLERGEN_HINT[a]}
            />
          ))}
        </div>
      </section>

      <section className="mt-7">
        <h2 className="text-[0.65rem] font-semibold tracking-[0.2em] text-gata/40 uppercase">
          How you eat
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {DIET_TAGS.map((d) => (
            <Chip
              key={d}
              active={diets.includes(d)}
              onClick={() => toggle(diets, setDiets, d)}
              label={DIET_LABEL[d]}
            />
          ))}
        </div>
      </section>

      <div className="mt-auto pt-8 pb-2">
        <button
          type="button"
          onClick={() => onDone({ allergies, diets })}
          className="w-full rounded-2xl bg-ube py-4 font-display text-lg font-extrabold tracking-tight text-ground transition hover:bg-ube/90 active:scale-[0.99]"
        >
          {allergies.length === 0 && diets.length === 0 ? 'Nothing to avoid' : 'Save and start'}
        </button>
      </div>
    </div>
  )
}
