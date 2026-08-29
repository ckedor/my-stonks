import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import {
  PersistQueryClientProvider,
  removeOldestQuery,
} from '@tanstack/react-query-persist-client'
import type { ReactNode } from 'react'

/* Consolidação roda três vezes por dia, então revalidar mais que isso é ruído:
   o dado não muda entre uma corrida e outra. Cinco minutos cobre a janela em
   que uma consolidação manual pode ter acontecido enquanto a aba estava
   aberta, e o foco da janela cobre o resto. */
const STALE_TIME = 5 * 60 * 1000

/* Quanto tempo um dado guardado ainda vale ser mostrado na abertura. Uma
   semana: acima disso a carteira provavelmente mudou o bastante para o repaint
   instantâneo confundir mais do que ajudar. */
const MAX_PERSISTED_AGE = 7 * 24 * 60 * 60 * 1000

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME,
      gcTime: MAX_PERSISTED_AGE,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
})

/* Partida quente, e uma persistência só.
 *
 * Antes eram duas — o Dexie de `db/` e o `persist` de cada store — e elas
 * hidratavam a mesma série em momentos diferentes, o que trocava a identidade
 * do objeto guardado duas vezes por abertura de tela. O recharts reanima por
 * identidade de props, então as curvas eram redesenhadas com dado idêntico; a
 * comparação de conteúdo que existia em `stores/portfolio/returns.ts` era o
 * curativo disso. Com uma cache e uma hidratação, o problema não existe. */
const persister = createSyncStoragePersister({
  storage: typeof window === 'undefined' ? undefined : window.localStorage,
  key: 'my-stonks-query-cache',
  /* O histórico de posições de uma carteira grande passa da cota do
     localStorage. Sem isto a gravação falha inteira e a partida quente some
     sem avisar; com isto a entrada mais antiga é descartada e a gravação é
     tentada de novo, então o que sobrevive é o que foi visto por último. */
  retry: removeOldestQuery,
})

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: MAX_PERSISTED_AGE }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
