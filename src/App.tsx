import { useCallback, useEffect, useMemo, useState } from 'react'
import { RECIPES, RECIPES_BY_ID } from './data/recipes'
import { DAYPART_LABEL, DAYPART_LAMP, daypartFor } from './engine/daypart'
import { suggest, type History } from './engine/suggest'
import {
  clearAll,
  loadHistory,
  loadPrefs,
  recordDecision,
  savePrefs,
  type BreakLength,
  type StoredPrefs,
} from './state/prefs'
import { SwipeDeck, type SwipeDirection } from './components/SwipeDeck'
import { Onboarding } from './screens/Onboarding'
import { BreakPicker } from './screens/BreakPicker'
import { RecipeDetail } from './screens/RecipeDetail'
import type { Recipe } from './data/schema'

type Screen = 'onboarding' | 'picker' | 'deck' | 'detail' | 'empty' | 'exhausted'

export default function App() {
  const [prefs, setPrefs] = useState<StoredPrefs | null>(() => loadPrefs())
  const [screen, setScreen] = useState<Screen>(() => (loadPrefs() ? 'picker' : 'onboarding'))
  const [minutes, setMinutes] = useState<BreakLength | null>(null)
  const [deck, setDeck] = useState<Recipe[]>([])
  const [detail, setDetail] = useState<Recipe | null>(null)
  const [history, setHistory] = useState<History>(() => loadHistory(new Date()))

  const daypart = useMemo(() => daypartFor(new Date()), [])

  useEffect(() => {
    document.documentElement.style.setProperty('--lamp', DAYPART_LAMP[daypart])
  }, [daypart])

  const pairingFor = useCallback(
    (r: Recipe) => (r.pairsWith ? RECIPES_BY_ID.get(r.pairsWith) : undefined),
    [],
  )

  const startBreak = useCallback(
    (picked: BreakLength) => {
      if (!prefs) return
      const now = new Date()
      // Built once per break: the deck must not reshuffle under the user
      // every time they swipe.
      const next = suggest(
        RECIPES,
        { allergies: prefs.allergies, diets: prefs.diets, breakMinutes: picked },
        history,
        { now, seed: now.getTime() },
      )
      setMinutes(picked)
      setDeck(next)
      setScreen(next.length === 0 ? 'empty' : 'deck')
    },
    [history, prefs],
  )

  const onDecide = useCallback((recipe: Recipe, direction: SwipeDirection) => {
    setHistory(recordDecision(recipe.id, direction, new Date()))
    if (direction === 'take') {
      setDetail(recipe)
      setScreen('detail')
    }
  }, [])

  const finishOnboarding = useCallback(
    (picked: { allergies: StoredPrefs['allergies']; diets: StoredPrefs['diets'] }) => {
      setPrefs(savePrefs(picked))
      setScreen('picker')
    },
    [],
  )

  const editPrefs = useCallback(() => {
    clearAll()
    setPrefs(null)
    setHistory({ takenToday: [], recentlyPassed: [] })
    setScreen('onboarding')
  }, [])

  const backToPicker = useCallback(() => {
    setDeck([])
    setMinutes(null)
    setScreen('picker')
  }, [])

  const showChrome = screen !== 'onboarding'

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="lamp" />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-md flex-col px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {showChrome && (
          <header className="flex shrink-0 items-center justify-between py-1">
            <div className="text-[0.6rem] font-semibold tracking-[0.22em] text-gata/35 uppercase">
              Breaktime · {DAYPART_LABEL[daypart]}
            </div>
            {minutes !== null && screen !== 'picker' && (
              <button
                type="button"
                onClick={backToPicker}
                className="rounded-full border border-gata/15 px-3 py-1 text-[0.68rem] text-gata/55 transition hover:border-gata/35 hover:text-gata"
              >
                {minutes} min
              </button>
            )}
          </header>
        )}

        {screen === 'onboarding' && <Onboarding onDone={finishOnboarding} />}

        {screen === 'picker' && (
          <BreakPicker daypart={daypart} onPick={startBreak} onEditPrefs={editPrefs} />
        )}

        {screen === 'exhausted' && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="font-display text-2xl font-bold text-balance text-gata">
              You have seen everything that fits.
            </p>
            <p className="mt-2 text-sm text-gata/55">
              Give yourself more time and the deck gets bigger.
            </p>
            <button
              type="button"
              onClick={backToPicker}
              className="mt-6 rounded-2xl bg-ube px-6 py-3 font-display font-bold text-ground"
            >
              Pick another length
            </button>
          </div>
        )}

        {screen === 'empty' && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="font-display text-2xl font-bold text-balance text-gata">
              Nothing fits a {minutes}-minute break yet.
            </p>
            <p className="mt-2 text-sm text-gata/55">
              Try a longer break, or loosen what you are avoiding.
            </p>
            <button
              type="button"
              onClick={backToPicker}
              className="mt-6 rounded-2xl bg-ube px-6 py-3 font-display font-bold text-ground"
            >
              Pick another length
            </button>
          </div>
        )}

        {screen === 'detail' && detail && (
          <RecipeDetail
            recipe={detail}
            pairing={pairingFor(detail)}
            onBack={() => setScreen('deck')}
            onOpenPairing={(r) => setDetail(r)}
          />
        )}

        {/* Kept mounted so coming back from a recipe does not lose your place. */}
        <div
          className="flex-1 flex-col"
          style={{ display: screen === 'deck' ? 'flex' : 'none' }}
          aria-hidden={screen !== 'deck'}
        >
          {deck.length > 0 && (
            <SwipeDeck
              recipes={deck}
              pairingFor={pairingFor}
              onDecide={onDecide}
              onEmpty={() => setScreen('exhausted')}
            />
          )}
        </div>
      </div>
    </div>
  )
}
