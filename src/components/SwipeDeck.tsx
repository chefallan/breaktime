import { useCallback, useEffect, useRef, useState } from 'react'
import { animated, to, useSpring } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'
import type { Recipe } from '../data/schema'
import { RecipeCard } from './RecipeCard'

export type SwipeDirection = 'pass' | 'take'

const THRESHOLD = 90
const FLING_VELOCITY = 0.35
const EXIT_MS = 380

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

const awayX = (direction: SwipeDirection) =>
  (direction === 'take' ? 1 : -1) * (window.innerWidth + 320)

/**
 * The departing card, animated purely for looks. It is mounted after the deck has
 * already advanced, so if the animation never runs — a backgrounded tab, reduced
 * motion, a dropped frame — nothing about the deck's state depends on it.
 */
function FlyingCard({
  recipe,
  pairing,
  direction,
  fromX,
  reduced,
}: {
  recipe: Recipe
  pairing?: Recipe
  direction: SwipeDirection
  fromX: number
  reduced: boolean
}) {
  const [out, setOut] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setOut(true), 16)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        zIndex: 30,
        opacity: out ? 0 : 1,
        transform: `translateX(${out ? awayX(direction) : fromX}px) rotate(${
          out ? (direction === 'take' ? 20 : -20) : fromX / 22
        }deg)`,
        transition: reduced
          ? 'none'
          : `transform ${EXIT_MS}ms cubic-bezier(.22,.61,.36,1), opacity ${EXIT_MS}ms ease-out`,
      }}
    >
      <RecipeCard recipe={recipe} pairing={pairing} />
    </div>
  )
}

export function SwipeDeck({
  recipes,
  pairingFor,
  onDecide,
  onEmpty,
}: {
  recipes: Recipe[]
  pairingFor: (r: Recipe) => Recipe | undefined
  onDecide: (recipe: Recipe, direction: SwipeDirection) => void
  onEmpty: () => void
}) {
  const [index, setIndex] = useState(0)
  const [flying, setFlying] = useState<{
    recipe: Recipe
    direction: SwipeDirection
    fromX: number
  } | null>(null)
  const reduced = usePrefersReducedMotion()
  const flyTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const [{ x, y, rot }, api] = useSpring(() => ({
    x: 0,
    y: 0,
    rot: 0,
    config: { tension: 340, friction: 32 },
  }))

  // A new deck (different filters) must start from the top, not mid-stack.
  useEffect(() => {
    setIndex(0)
    setFlying(null)
    api.set({ x: 0, y: 0, rot: 0 })
  }, [recipes, api])

  useEffect(() => () => clearTimeout(flyTimer.current), [])

  const top = recipes[index]

  const commit = useCallback(
    (direction: SwipeDirection) => {
      if (!top) return
      const fromX = x.get()

      // Deck state advances now, not when an animation says so.
      onDecide(top, direction)
      setFlying({ recipe: top, direction, fromX })
      setIndex((i) => i + 1)
      api.set({ x: 0, y: 0, rot: 0 })

      clearTimeout(flyTimer.current)
      flyTimer.current = setTimeout(() => setFlying(null), reduced ? 0 : EXIT_MS + 40)
    },
    [api, onDecide, reduced, top, x],
  )

  useEffect(() => {
    if (recipes.length > 0 && index >= recipes.length) onEmpty()
  }, [index, recipes.length, onEmpty])

  const bind = useDrag(
    ({ active, movement: [mx, my], velocity: [vx], direction: [dx], cancel }) => {
      if (!top) {
        cancel()
        return
      }
      const flung = vx > FLING_VELOCITY && Math.abs(mx) > 40
      if (!active && (Math.abs(mx) > THRESHOLD || flung)) {
        commit(mx > 0 || (flung && dx > 0) ? 'take' : 'pass')
        return
      }
      if (active) {
        // set(), not start() — the card must track the finger exactly, with no
        // spring lag and no dependency on the frame loop.
        api.set({ x: mx, y: my * 0.35, rot: mx / 22 })
      } else if (reduced) {
        api.set({ x: 0, y: 0, rot: 0 })
      } else {
        api.start({ x: 0, y: 0, rot: 0 })
      }
    },
    { filterTaps: true, pointer: { touch: true } },
  )

  if (!top) return null

  const behind = recipes.slice(index + 1, index + 3)

  return (
    <div className="relative flex w-full flex-1 flex-col">
      <div className="relative flex-1">
        {behind
          .map((r, i) => (
            <div
              key={r.id}
              aria-hidden
              className="absolute inset-0 origin-bottom"
              style={{
                transform: `translateY(${(i + 1) * 14}px) scale(${1 - (i + 1) * 0.05})`,
                opacity: 1 - (i + 1) * 0.35,
                zIndex: 10 - i,
              }}
            >
              <RecipeCard recipe={r} pairing={pairingFor(r)} />
            </div>
          ))
          .reverse()}

        {flying && (
          <FlyingCard
            key={flying.recipe.id}
            recipe={flying.recipe}
            pairing={pairingFor(flying.recipe)}
            direction={flying.direction}
            fromX={flying.fromX}
            reduced={reduced}
          />
        )}

        <animated.div
          {...bind()}
          className="absolute inset-0 cursor-grab touch-none will-change-transform active:cursor-grabbing"
          style={{ x, y, rotateZ: rot, zIndex: 20 }}
        >
          <RecipeCard recipe={top} pairing={pairingFor(top)} />

          <animated.div
            className="font-display pointer-events-none absolute top-7 left-6 -rotate-12 rounded-lg border-[3px] border-ube-deep px-3 py-1 text-xl font-extrabold tracking-widest text-ube-deep uppercase"
            style={{ opacity: to(x, (v) => Math.min(1, Math.max(0, v / THRESHOLD))) }}
          >
            Take it
          </animated.div>
          <animated.div
            className="font-display pointer-events-none absolute top-7 right-6 rotate-12 rounded-lg border-[3px] border-ink-soft px-3 py-1 text-xl font-extrabold tracking-widest text-ink-soft uppercase"
            style={{ opacity: to(x, (v) => Math.min(1, Math.max(0, -v / THRESHOLD))) }}
          >
            Pass
          </animated.div>
        </animated.div>
      </div>

      {/* Gesture is never the only way in — this deck has to work with a keyboard. */}
      <div className="mt-6 flex items-center justify-center gap-5">
        <button
          type="button"
          onClick={() => commit('pass')}
          className="flex h-16 w-16 items-center justify-center rounded-full border border-gata/20 bg-ground-lift text-2xl text-gata/70 transition hover:border-gata/40 hover:text-gata active:scale-95"
        >
          <span aria-hidden>✕</span>
          <span className="sr-only">Pass on {top.title}</span>
        </button>
        <button
          type="button"
          onClick={() => commit('take')}
          className="flex h-20 w-20 items-center justify-center rounded-full bg-ube text-3xl font-bold text-ground shadow-[0_10px_30px_-8px_rgba(155,111,212,0.7)] transition hover:bg-ube/90 active:scale-95"
        >
          <span aria-hidden>✓</span>
          <span className="sr-only">Take {top.title}</span>
        </button>
      </div>
    </div>
  )
}
