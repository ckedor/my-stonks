/* ──────────────────────────────────────────────
   Design system — ponto de entrada único
   ──────────────────────────────────────────────

   As camadas de domínio e de página importam daqui, nunca de
   `@mui/material` nem de arquivos internos desta pasta. Esta é a única
   camada autorizada a depender do MUI, e o linter garante isso
   (`eslint.config.js` + `eslint-ds-baseline.json`).

   Regra de crescimento: um componente só ganha prop nova quando existe uma
   tela usando. Sem variante especulativa. */

/* ── Layout ─────────────────────────────────── */
export { default as AppStack } from './AppStack'
export type { AppStackProps } from './AppStack'
export { default as AppGrid, AppGridItem } from './AppGrid'
export type { AppGridProps, AppGridItemProps } from './AppGrid'
export { default as AppCard } from './AppCard'
export type { AppCardProps } from './AppCard'

/* ── Controles e conteúdo ───────────────────── */
export { default as AppButton } from './AppButton'
export type { AppButtonProps } from './AppButton'
export { default as AppChip } from './AppChip'
export type { AppChipProps } from './AppChip'
export { default as AppAlert } from './AppAlert'
export type { AppAlertProps } from './AppAlert'
export { default as AppAutocomplete } from './AppAutocomplete'
export type { AppAutocompleteProps } from './AppAutocomplete'
export { default as AppConfirmDialog } from './AppConfirmDialog'
export type { AppConfirmDialogProps } from './AppConfirmDialog'
export { default as AppCrudForm } from './AppCrudForm'
export type { AppCrudFormProps, FieldConfig } from './AppCrudForm'
export { default as AppCrudTable } from './AppCrudTable'
export type { AppCrudTableProps, ColumnConfig } from './AppCrudTable'
export { default as AppDataTable } from './AppDataTable'
export type { AppDataTableColumn } from './AppDataTable'
export { default as AppSearchField } from './AppSearchField'
export type { AppSearchFieldProps } from './AppSearchField'
export { default as AppSnackbar } from './AppSnackbar'
export type { AppSnackbarProps } from './AppSnackbar'
export { default as AppText } from './AppText'
export type { AppTextProps } from './AppText'
export { default as PageTitle } from './PageTitle'

/* ── Tokens ─────────────────────────────────── */
export { useAppTheme } from './useAppTheme'
export type { AppTheme } from './useAppTheme'
export { radius, space } from '@/theme/tokens'
export type { RadiusToken, SpaceToken } from '@/theme/tokens'

/* ── Componentes existentes ─────────────────── */
export { default as AppBreadcrumbs } from './AppBreadcrumbs'
export { default as AppPieChart } from './app-pie-chart'
export { default as AppTable } from './app-table'
export type { TableColumn, TableRowData } from './app-table'
export { default as BackButton } from './BackButton'
export { default as InformationCard } from './infomation-card'
export { default as LoadingSpinner } from './LoadingSpinner'
export { default as MarkdownText } from './MarkdownText'
export { default as MiniDonut } from './MiniDonut'
export { default as PageHeader } from './PageHeader'
export { default as Sparkline } from './Sparkline'
export { ThemeToggleButton } from './ThemeToggleButton'
