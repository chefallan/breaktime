import { BREAK_LENGTHS, type BreakLength } from '../state/prefs'
import { DAYPART_LABEL } from '../engine/daypart'
import type { Daypart } from '../data/schema'

const BLURB: Record<BreakLength, string> = {
  15: 'A sip and something sweet',
  30: 'A proper merienda',
  60: 'Cook something real',
}

const GREETING: Record<Daypart, string> = {
  morning: 'Good morning.',
  midday: 'Halfway there.',
  merienda: 'Merienda time.',
  evening: 'Winding down.',
  graveyard: 'Still on shift.',
}

export function BreakPicker({
  daypart,
  onPick,
  onEditPrefs,
}: {
  daypart: Daypart
  onPick: (minutes: BreakLength) => void
  onEditPrefs: () => void
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="pt-8">
        <div className="text-[0.65rem] font-semibold tracking-[0.22em] text-gata/40 uppercase">
          {DAYPART_LABEL[daypart]}
        </div>
        <h1 className="font-display mt-2 text-[2.6rem] leading-[1] font-extrabold tracking-tight text-gata">
          {GREETING[daypart]}
        </h1>
        <p className="mt-3 text-sm text-gata/60">How long have you got?</p>
      </div>

      <div className="mt-8 flex flex-col gap-3">
        {BREAK_LENGTHS.map((minutes) => (
          <button
            key={minutes}
            type="button"
            onClick={() => onPick(minutes)}
            className="group flex items-center gap-4 rounded-2xl border border-gata/12 bg-gata/[0.03] px-5 py-4 text-left transition hover:border-ube/60 hover:bg-ube/10"
          >
            <span className="font-display w-14 shrink-0 text-3xl font-extrabold tracking-tight text-gata">
              {minutes}
            </span>
            <span className="flex-1">
              <span className="block text-[0.62rem] font-semibold tracking-[0.18em] text-gata/40 uppercase">
                minutes
              </span>
              <span className="block text-sm text-gata/75">{BLURB[minutes]}</span>
            </span>
            <span aria-hidden className="text-gata/25 transition group-hover:text-ube">
              →
            </span>
          </button>
        ))}
      </div>

      <div className="mt-auto pb-2">
        <button
          type="button"
          onClick={onEditPrefs}
          className="text-xs text-gata/40 underline underline-offset-4 transition hover:text-gata/70"
        >
          Change what you cannot eat
        </button>
      </div>
    </div>
  )
}
