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
export { default as AppStack, AppStackItem } from './AppStack'
export type { AppStackItemProps, AppStackProps } from './AppStack'
export { default as AppGrid, AppGridItem } from './AppGrid'
export { default as AppHeatmapTable } from './AppHeatmapTable'
export type {
  AppHeatmapCell,
  AppHeatmapRow,
  AppHeatmapTableProps,
} from './AppHeatmapTable'
export type { AppGridProps, AppGridItemProps } from './AppGrid'
export { default as AppCard } from './AppCard'
export { default as AppDivergingBars } from './AppDivergingBars'
export type { AppDivergingBar, AppDivergingBarsProps } from './AppDivergingBars'
export { default as AppTreemap } from './AppTreemap'
export type { AppTreemapGroup, AppTreemapLeaf, AppTreemapProps } from './AppTreemap'
export { default as AppDayField } from './AppDayField'
export type { AppDayFieldProps } from './AppDayField'
export { default as AppDivider } from './AppDivider'
export type { AppDividerProps } from './AppDivider'
export { default as AppShell } from './AppShell'
export type { AppShellProps } from './AppShell'
export { default as AppSidebar, SIDEBAR_WIDTH } from './AppSidebar'
export type { AppSidebarItem, AppSidebarProps } from './AppSidebar'
export { default as AppTopbar, CONTENT_MAX_WIDTH } from './AppTopbar'
export type { AppTopbarProps, AppTopbarSection } from './AppTopbar'
export { default as AppPageShell } from './AppPageShell'
export type { AppPageShellProps } from './AppPageShell'
export { default as AppNavDrawer } from './AppNavDrawer'
export type {
  AppNavDrawerGroup,
  AppNavDrawerItem,
  AppNavDrawerProps,
  AppNavDrawerSection,
} from './AppNavDrawer'
export type { AppCardProps } from './AppCard'

/* ── Controles e conteúdo ───────────────────── */
export { default as AppButton } from './AppButton'
export type { AppButtonProps } from './AppButton'
export { default as AppChip } from './AppChip'
export { default as AppIconButton } from './AppIconButton'
export { default as AppIconLink } from './AppIconLink'
export type { AppIconLinkProps } from './AppIconLink'
export { default as AppLink } from './AppLink'
export type { AppLinkProps } from './AppLink'
export { default as AppPasswordField } from './AppPasswordField'
export type { AppPasswordFieldProps } from './AppPasswordField'
export { default as AppSplitScreen } from './AppSplitScreen'
export type { AppSplitScreenProps } from './AppSplitScreen'
export { default as FieldLabel } from './FieldLabel'
export type { FieldLabelProps } from './FieldLabel'
export { default as AppLogoImage } from './AppLogoImage'
export type { AppLogoImageProps } from './AppLogoImage'
export { default as AppSkeleton } from './AppSkeleton'
export type { AppSkeletonProps } from './AppSkeleton'
export type { AppIconButtonProps } from './AppIconButton'
export { default as AppMenu } from './AppMenu'
export type { AppMenuOption, AppMenuProps } from './AppMenu'
export { default as AppMenuButton } from './AppMenuButton'
export type { AppMenuButtonProps } from './AppMenuButton'
export { default as AppMegaMenu } from './AppMegaMenu'
export type { AppMegaMenuColumn, AppMegaMenuItem, AppMegaMenuProps } from './AppMegaMenu'
export type { AppChipProps } from './AppChip'
export { default as AppAlert } from './AppAlert'
export type { AppAlertProps } from './AppAlert'
export { default as AppAutocomplete } from './AppAutocomplete'
export { default as AppMultiAutocomplete } from './AppMultiAutocomplete'
export type {
  AppMultiAutocompleteOption,
  AppMultiAutocompleteProps,
} from './AppMultiAutocomplete'
export type { AppAutocompleteAction, AppAutocompleteProps } from './AppAutocomplete'
export { default as AppConfirmDialog } from './AppConfirmDialog'
export type { AppConfirmDialogProps } from './AppConfirmDialog'
export { default as AppColorField } from './AppColorField'
export { default as AppColorSwatch } from './AppColorSwatch'
export type { AppColorSwatchProps } from './AppColorSwatch'
export type { AppColorFieldProps } from './AppColorField'
export { default as AppDateField } from './AppDateField'
export type { AppDateFieldProps } from './AppDateField'
export { default as AppFormDrawer } from './AppFormDrawer'
export type { AppFormDrawerProps } from './AppFormDrawer'
export { default as AppTextField } from './AppTextField'
export type { AppTextFieldProps } from './AppTextField'
export { default as AppCrudForm } from './AppCrudForm'
export type { AppCrudFormProps, FieldConfig } from './AppCrudForm'
export { default as AppCrudTable } from './AppCrudTable'
export type { AppCrudTableProps, ColumnConfig } from './AppCrudTable'
export { default as AppDataTable } from './AppDataTable'
export type { AppDataTableColumn } from './AppDataTable'
export { default as AppProgressBar } from './AppProgressBar'
export type { AppProgressBarProps } from './AppProgressBar'
export { default as AppChartArea } from './AppChartArea'
export type { AppChartAreaProps } from './AppChartArea'
export { default as AppMetric } from './AppMetric'
export type { AppMetricProps } from './AppMetric'
export { default as AppFloatingCard } from './AppFloatingCard'
export type { AppFloatingCardProps } from './AppFloatingCard'
export { default as AppToggleButton } from './AppToggleButton'
export type { AppToggleButtonProps } from './AppToggleButton'
export { default as AppToggleGroup } from './AppToggleGroup'
export type { AppToggleGroupOption, AppToggleGroupProps } from './AppToggleGroup'
export { default as AppTabs } from './AppTabs'
export type { AppTabsItem, AppTabsProps } from './AppTabs'
export { default as AppSimpleTable } from './AppSimpleTable'
export type { AppSimpleTableColumn, AppSimpleTableProps } from './AppSimpleTable'
export { default as AppStatCard } from './AppStatCard'
export type { AppStatCardProps } from './AppStatCard'
export { default as AppTooltip } from './AppTooltip'
export type { AppTooltipProps } from './AppTooltip'
export { default as AppHeroMetric } from './AppHeroMetric'
export type { AppHeroMetricProps } from './AppHeroMetric'
export { default as AppInlineToggle } from './AppInlineToggle'
export type { AppInlineToggleOption, AppInlineToggleProps } from './AppInlineToggle'
export { default as AppNumberField } from './AppNumberField'
export type { AppNumberFieldProps } from './AppNumberField'
export { default as AppSelect } from './AppSelect'
export type { AppSelectAction, AppSelectOption, AppSelectProps } from './AppSelect'
export { default as AppSegmentedToggle } from './AppSegmentedToggle'
export type {
  AppSegmentedToggleOption,
  AppSegmentedToggleProps,
} from './AppSegmentedToggle'
export { default as AppSwitch } from './AppSwitch'
export type { AppSwitchProps } from './AppSwitch'
export { default as AppSearchField } from './AppSearchField'
export type { AppSearchFieldProps } from './AppSearchField'
export { default as AppSnackbar } from './AppSnackbar'
export type { AppSnackbarProps } from './AppSnackbar'
export { default as AppText } from './AppText'
export type { AppTextProps } from './AppText'
export { default as PageTitle } from './PageTitle'
export type { PageTitleProps } from './PageTitle'
export { default as SectionLabel } from './SectionLabel'
export type { SectionLabelProps } from './SectionLabel'
export { default as SectionTitle } from './SectionTitle'
export type { SectionTitleProps } from './SectionTitle'

/* ── Tokens ─────────────────────────────────── */
export { useAppTheme, useViewportMatches, withOpacity } from './useAppTheme'
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
export type { LoadingSpinnerProps } from './LoadingSpinner'
export { default as MarkdownText } from './MarkdownText'
export { default as MiniDonut } from './MiniDonut'
export { default as PageHeader } from './PageHeader'
export { default as Sparkline } from './Sparkline'
export { ThemeToggleButton } from './ThemeToggleButton'
