import AddIcon from '@mui/icons-material/Add'
import { useMemo, useState } from 'react'

import { CITY_CATALOG } from '@/components/city-game/catalog'
import {
  AppAlert, AppButton, AppChip, AppConfirmDialog, AppNumberField, AppSearchField, AppSelect, AppSimpleTable,
  AppSnackbar, AppStack, AppText, AppTextField, PageTitle,
  type AppSimpleTableColumn, type IsoBuilderItem,
} from '@/components/ui'
import { CATALOG_FILE_ENDPOINT } from '../../../server/catalog-file'
import { calculatedPrice, catalogChanges, draftItem, useGameStudioStore } from './studio-store'

const usd = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const ALL = '__all__'

interface Row {
  item: IsoBuilderItem
  /** O preço fixo do rascunho; `null` é o preço pelo volume. */
  fixedPrice: number | null
  volumePrice: number
  changed: boolean
}

/** O que o diálogo de criar categoria está criando, e para qual peça. */
type Creating = { id: string; kind: 'group' | 'subgroup'; group: string; subgroup: string }

async function saveCatalog(edits: Parameters<typeof catalogChanges>[0]) {
  const response = await fetch(CATALOG_FILE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(catalogChanges(edits)),
  })
  if (!response.ok) throw new Error((await response.text()) || `O dev server respondeu ${response.status}`)
}

/** O catálogo do jogo: em que categoria e subcategoria da loja cada peça
 *  fica, e quanto custa.
 *
 *  Tudo é rascunho até o "Salvar", que grava `catalog.ts` pelo dev server do
 *  `tools/` (`server/catalog-file.ts`); o sandbox já joga com o rascunho. O
 *  preço em branco é o do jogo — o volume da peça, em `economy.ts`; um
 *  número ali fixa o preço da peça no catálogo. */
export default function CatalogPage() {
  const { edits, editItem, discardEdits } = useGameStudioStore()
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState(ALL)
  const [creating, setCreating] = useState<Creating | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const rows = useMemo<Row[]>(() => CITY_CATALOG.map(base => {
    const item = draftItem(base, edits[base.id])
    const { price, ...unpriced } = item
    return { item, fixedPrice: price ?? null, volumePrice: calculatedPrice(unpriced), changed: !!edits[base.id] }
  }), [edits])

  /** As categorias e as subcategorias de cada uma, como estão no rascunho. */
  const groups = useMemo(() => {
    const byGroup = new Map<string, Set<string>>()
    for (const { item } of rows) {
      if (!byGroup.has(item.group)) byGroup.set(item.group, new Set())
      byGroup.get(item.group)!.add(item.subgroup)
    }
    return byGroup
  }, [rows])

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows
      .filter(({ item }) => groupFilter === ALL || item.group === groupFilter)
      .filter(({ item }) => !query || `${item.label} ${item.id} ${item.subgroup}`.toLowerCase().includes(query))
      .sort((a, b) =>
        a.item.group.localeCompare(b.item.group) || a.item.subgroup.localeCompare(b.item.subgroup)
        || (a.fixedPrice ?? a.volumePrice) - (b.fixedPrice ?? b.volumePrice))
  }, [rows, search, groupFilter])

  const changedCount = Object.keys(edits).length
  const groupNames = [...groups.keys()].sort((a, b) => a.localeCompare(b))

  /** Mudar de categoria leva a peça para a subcategoria de mesmo nome, se a
   *  nova tiver uma, ou para a primeira dela. */
  const moveToGroup = (item: IsoBuilderItem, group: string) => {
    const subgroups = groups.get(group)
    const subgroup = subgroups?.has(item.subgroup) ? item.subgroup : [...(subgroups ?? [])].sort()[0] ?? item.subgroup
    editItem(item.id, { group, subgroup })
  }

  const save = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await saveCatalog(edits)
      discardEdits()
      setSaved(true)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  const columns: AppSimpleTableColumn<Row>[] = [
    {
      label: 'Peça',
      share: 0.3,
      render: ({ item, changed }) => (
        <AppStack gap="none">
          <AppStack direction="row" align="center" gap="xs">
            <AppText variant="bodySmall" weight="strong">{item.label}</AppText>
            {item.hidden && <AppChip label="Fora da loja" />}
            {changed && <AppChip label="Mudada" tone="primary" />}
          </AppStack>
          <AppText variant="caption" tone="secondary">{item.id}</AppText>
        </AppStack>
      ),
    },
    {
      label: 'Categoria',
      share: 0.2,
      render: ({ item }) => (
        <AppSelect
          density="compact"
          size="full"
          options={groupNames.map(group => ({ value: group, label: group }))}
          value={item.group}
          onChange={group => moveToGroup(item, group)}
          actions={[{
            label: 'Nova categoria…', icon: <AddIcon fontSize="small" />,
            onSelect: () => setCreating({ id: item.id, kind: 'group', group: '', subgroup: '' }),
          }]}
        />
      ),
    },
    {
      label: 'Subcategoria',
      share: 0.2,
      render: ({ item }) => (
        <AppSelect
          density="compact"
          size="full"
          options={[...(groups.get(item.group) ?? [])].sort().map(subgroup => ({ value: subgroup, label: subgroup }))}
          value={item.subgroup}
          onChange={subgroup => editItem(item.id, { subgroup })}
          actions={[{
            label: 'Nova subcategoria…', icon: <AddIcon fontSize="small" />,
            onSelect: () => setCreating({ id: item.id, kind: 'subgroup', group: item.group, subgroup: '' }),
          }]}
        />
      ),
    },
    {
      label: 'Pelo volume',
      hint: 'O preço que o jogo calcula pelo volume da peça. Ruas e a árvore comum são de graça.',
      align: 'right',
      share: 0.12,
      sortValue: ({ volumePrice }) => volumePrice,
      render: ({ volumePrice }) => (
        <AppText variant="bodySmall" tone="secondary">{volumePrice ? usd.format(volumePrice) : 'Grátis'}</AppText>
      ),
    },
    {
      label: 'Preço fixo',
      hint: 'Em branco, a peça custa o preço pelo volume.',
      align: 'right',
      share: 0.18,
      sortValue: ({ fixedPrice }) => fixedPrice,
      render: ({ item, fixedPrice }) => (
        <AppNumberField
          label={`Preço fixo de ${item.label}`}
          hideLabel
          align="right"
          prefix="US$"
          size="md"
          min={0}
          step={10}
          allowEmpty
          value={fixedPrice}
          onChange={price => editItem(item.id, { price })}
        />
      ),
    },
  ]

  const creatingTaken = creating != null && (creating.kind === 'group'
    ? groups.has(creating.group.trim())
    : groups.get(creating.group)?.has(creating.subgroup.trim()) ?? false)

  return (
    <AppStack gap="md">
      <AppStack direction="row" justify="between" align="center" gap="sm" wrap>
        <AppStack gap="none">
          <PageTitle>Catálogo do jogo</PageTitle>
          <AppText variant="bodySmall" tone="secondary">
            {CITY_CATALOG.length} peças em {groups.size} categorias
            {changedCount > 0 && ` · ${changedCount} ${changedCount === 1 ? 'mudada' : 'mudadas'}, sem salvar`}
          </AppText>
        </AppStack>
        <AppStack direction="row" gap="sm">
          <AppButton emphasis="ghost" disabled={changedCount === 0 || saving} onClick={discardEdits}>Descartar</AppButton>
          <AppButton onClick={save} disabled={changedCount === 0} loading={saving}>Salvar no catalog.ts</AppButton>
        </AppStack>
      </AppStack>

      {saveError && <AppAlert tone="danger">{saveError}</AppAlert>}

      <AppStack direction="row" align="center" gap="sm" wrap>
        <AppSearchField label="Buscar peça" size="bar" value={search} onChange={setSearch} placeholder="Nome, id ou subcategoria" />
        <AppSelect
          label="Categoria"
          density="compact"
          options={[{ value: ALL, label: 'Todas' }, ...groupNames.map(group => ({ value: group, label: group }))]}
          value={groupFilter}
          onChange={setGroupFilter}
        />
      </AppStack>

      <AppSimpleTable
        rows={visible}
        columns={columns}
        getRowKey={({ item }) => item.id}
        surface="outlined"
        maxHeight="viewport"
        emptyMessage="Nenhuma peça com esse filtro."
      />

      <AppConfirmDialog
        open={creating != null}
        title={creating?.kind === 'group' ? 'Nova categoria' : `Nova subcategoria em ${creating?.group ?? ''}`}
        confirmLabel="Mover para lá"
        confirmDisabled={!creating?.subgroup.trim() || (creating.kind === 'group' && !creating.group.trim()) || creatingTaken}
        onCancel={() => setCreating(null)}
        onConfirm={() => {
          if (!creating) return
          editItem(creating.id, { group: creating.group.trim(), subgroup: creating.subgroup.trim() })
          setCreating(null)
        }}
      >
        {creating && (
          <AppStack gap="sm">
            <AppText variant="bodySmall" tone="secondary">
              Toda aba da loja tem subcategorias: a peça entra numa delas.
            </AppText>
            {creating.kind === 'group' && (
              <AppTextField
                label="Categoria"
                value={creating.group}
                onChange={group => setCreating({ ...creating, group })}
                error={creatingTaken}
                helperText={creatingTaken ? 'Essa categoria já existe: escolha-a na lista.' : undefined}
              />
            )}
            <AppTextField
              label="Subcategoria"
              value={creating.subgroup}
              onChange={subgroup => setCreating({ ...creating, subgroup })}
              error={creating.kind === 'subgroup' && creatingTaken}
              helperText={creating.kind === 'subgroup' && creatingTaken ? 'Essa subcategoria já existe: escolha-a na lista.' : undefined}
            />
          </AppStack>
        )}
      </AppConfirmDialog>

      <AppSnackbar open={saved} message="Catálogo salvo em catalog.ts. O commit é o que publica." tone="success" onClose={() => setSaved(false)} />
    </AppStack>
  )
}
