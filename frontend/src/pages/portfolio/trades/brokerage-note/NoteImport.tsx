import type {
  Broker,
  DraftNote,
  GroupAction,
  ImportResult,
  NoteHeader,
  ReconciliationGroup,
} from '@/api/brokerageNote'
import { AppButton, AppCard, AppChip, AppStack, AppText, SectionLabel } from '@/components/ui'
import { useImportBrokerageNote, useReconcileBrokerageNote } from '@/queries/brokerageNote'
import type { Asset, Trade } from '@/types'
import { useEffect, useMemo, useRef, useState } from 'react'
import LinesTable from './LinesTable'
import NoteHeaderForm from './NoteHeaderForm'
import ReconciliationTable from './ReconciliationTable'
import {
  countByAction,
  decisionsFor,
  defaultActions,
  initialHeader,
  initialRows,
  isRowInvalid,
  toLineInputs,
  updateRow,
  type NoteRow,
} from './draft'

export type Notice = { message: string; tone: 'success' | 'danger' | 'info' }

interface NoteImportProps {
  note: DraftNote
  /** O PDF de onde a nota foi lida, guardado; a nota confirmada aponta para ele. */
  documentId: number | null
  portfolioId: number
  brokers: Broker[]
  assets: Asset[]
  trades: Trade[]
  onNotice: (notice: Notice) => void
}

/** Espera depois da última tecla antes de cruzar de novo. */
const RECROSS_DELAY_MS = 500

function errorMessage(error: unknown, fallback: string): string {
  const response = (error as { response?: { data?: { message?: string } } })?.response
  return response?.data?.message ?? fallback
}

const isConflict = (error: unknown) =>
  (error as { response?: { status?: number } })?.response?.status === 409

/* Uma nota lida, da conferência à confirmação.
 *
 * Tudo o que vai para o banco é editável aqui. Cada edição refaz o cruzamento
 * no servidor — sem chamar o modelo —, e a confirmação só é liberada quando o
 * cruzamento na tela é o das linhas como estão: decidir sobre um cruzamento
 * velho é decidir sobre outra nota. Cada nota se confirma sozinha. */
export default function NoteImport({
  note,
  documentId,
  portfolioId,
  brokers,
  assets,
  trades,
  onNotice,
}: NoteImportProps) {
  const reconciliation = useReconcileBrokerageNote()
  const importing = useImportBrokerageNote()

  const [header, setHeader] = useState<NoteHeader>(() => initialHeader(note, documentId))
  const [rows, setRows] = useState<NoteRow[]>(() => initialRows(note))
  const [groups, setGroups] = useState<ReconciliationGroup[]>(note.groups)
  const [actions, setActions] = useState<Record<string, GroupAction>>(() =>
    defaultActions(note.groups)
  )
  const [result, setResult] = useState<ImportResult | null>(null)

  const lines = useMemo(() => toLineInputs(note.index, header, rows), [note.index, header, rows])
  const linesKey = JSON.stringify(lines)
  // O cruzamento que está na tela é o destas linhas.
  const [crossedKey, setCrossedKey] = useState(linesKey)
  const invalid = rows.some(isRowInvalid)

  const recross = useRef(reconciliation.mutate)
  recross.current = reconciliation.mutate

  useEffect(() => {
    if (linesKey === crossedKey || invalid) return
    const timer = setTimeout(() => {
      recross.current(
        { portfolioId, lines: JSON.parse(linesKey) },
        {
          onSuccess: (next) => {
            setGroups(next)
            setActions(defaultActions(next))
            setCrossedKey(linesKey)
          },
          onError: (error) =>
            onNotice({
              message: errorMessage(error, 'Não foi possível cruzar a nota'),
              tone: 'danger',
            }),
        }
      )
    }, RECROSS_DELAY_MS)
    return () => clearTimeout(timer)
  }, [linesKey, crossedKey, invalid, portfolioId, onNotice])

  const handleImport = () => {
    importing.mutate(
      { portfolioId, note: header, lines, decisions: decisionsFor(groups, actions) },
      {
        onSuccess: (imported) => {
          setResult(imported)
          onNotice({ message: 'Nota importada.', tone: 'success' })
        },
        onError: (error) => {
          onNotice({
            message: errorMessage(error, 'Não foi possível importar a nota'),
            tone: 'danger',
          })
          // A carteira mudou desde o cruzamento: força cruzar de novo.
          if (isConflict(error)) setCrossedKey('')
        },
      }
    )
  }

  if (result) {
    return (
      <AppCard>
        <AppStack direction="row" gap="md" align="center" wrap>
          <AppChip label="Importada" tone="success" />
          <AppText weight="strong">
            {header.note_number ? `Nota ${header.note_number}` : 'Nota sem número'}
          </AppText>
          <AppText variant="bodySmall" tone="secondary">
            {result.created} criada(s) · {result.updated} completada(s) · {result.deleted}{' '}
            substituída(s)
          </AppText>
        </AppStack>
      </AppCard>
    )
  }

  const counts = countByAction(groups, actions)
  const writes = counts.create + counts.update + counts.replace
  const stale = linesKey !== crossedKey

  return (
    <AppCard>
      <AppStack gap="lg">
        <NoteHeaderForm note={note} header={header} brokers={brokers} onChange={setHeader} />

        <AppStack gap="sm">
          <SectionLabel>Linhas</SectionLabel>
          <LinesTable
            note={note}
            rows={rows}
            currency={header.currency}
            assets={assets}
            onRowChange={(lineIndex, patch) =>
              setRows((current) => updateRow(current, lineIndex, patch))
            }
          />
        </AppStack>

        <AppStack gap="sm">
          <SectionLabel>Cruzamento com a carteira</SectionLabel>
          <ReconciliationTable
            groups={groups}
            lines={lines}
            currency={header.currency}
            assets={assets}
            trades={trades}
            actions={actions}
            onActionChange={(key, action) =>
              setActions((current) => ({ ...current, [key]: action }))
            }
          />
        </AppStack>

        <AppStack direction="row" gap="md" justify="end" align="center" wrap>
          <AppText variant="bodySmall" tone="secondary">
            {invalid
              ? 'Há linha sem quantidade.'
              : stale
                ? 'Cruzando com a carteira…'
                : `${counts.create} a criar · ${counts.update} a completar · ${counts.replace} a substituir · ${counts.skip} ignorada(s)`}
          </AppText>
          <AppButton
            onClick={handleImport}
            disabled={header.broker_id === null || invalid || stale || importing.isPending}
            loading={importing.isPending}
          >
            {writes === 0 ? 'Salvar nota' : 'Confirmar nota'}
          </AppButton>
        </AppStack>
      </AppStack>
    </AppCard>
  )
}
