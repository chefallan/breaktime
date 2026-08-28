# Breaktime

A PWA that suggests Filipino merienda sized to a remote worker's break.
See README.md for how to run it, plans/ for why things are the way they are.

## cph4

Dangerous areas — extra care regardless of change size:
- Allergen filtering (a wrong answer gets eaten)  src/engine/suggest.ts, src/data/schema.ts
- Recipe allergen tagging                         src/data/{drinks,merienda,meals}.ts

Where things live:
- Recipe data + validator      src/data/
- Deck ranking, dayparts       src/engine/
- localStorage prefs, history  src/state/
- Swipe deck + card            src/components/
- Screens                      src/screens/

Test command:       npm test
Pre-PR command:     npm test && npm run build   (build runs tsc -b, so this is the typecheck too)
Merging:            no defined process
Plans live in:      plans/
Never decide alone: none declared
