import { useState } from 'react'
import { Level1Page } from './ui/Level1Page'
import { Level2Page } from './ui/Level2Page'
import { Level3Page } from './ui/Level3Page'

const LEVELS = [
  { id: 1, label: 'Level 1', Component: Level1Page },
  { id: 2, label: 'Level 2', Component: Level2Page },
  { id: 3, label: 'Level 3', Component: Level3Page },
] as const

function App() {
  const [levelId, setLevelId] = useState<(typeof LEVELS)[number]['id']>(1)
  const ActiveLevel = LEVELS.find((level) => level.id === levelId)?.Component ?? Level1Page

  return (
    <div className="min-h-svh bg-slate-950">
      <nav className="flex justify-center gap-2 border-b border-slate-800 py-3">
        {LEVELS.map((level) => (
          <button
            key={level.id}
            type="button"
            onClick={() => setLevelId(level.id)}
            className={
              level.id === levelId
                ? 'rounded bg-slate-100 px-3 py-1 text-sm font-medium text-slate-900'
                : 'rounded px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-200'
            }
          >
            {level.label}
          </button>
        ))}
      </nav>
      <ActiveLevel />
    </div>
  )
}

export default App
