import { AppPageHeader, AppStack } from '@/components/ui'
import type { ComponentType } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import ActionsFamily from './ActionsFamily'
import ChartsFamily from './ChartsFamily'
import ChoiceFamily from './ChoiceFamily'
import {
  DESIGN_SYSTEM_FAMILIES,
  designSystemFamilyPath,
  type DesignSystemFamilySlug,
} from './families'
import FeedbackFamily from './FeedbackFamily'
import FieldsFamily from './FieldsFamily'
import FoundationsFamily from './FoundationsFamily'
import NumbersFamily from './NumbersFamily'
import SurfacesFamily from './SurfacesFamily'
import TablesFamily from './TablesFamily'
import TextFamily from './TextFamily'
import WaitFamily from './WaitFamily'

/* O catálogo do design system: uma tela por família, cada componente com os
 * estados dele. Todo componente exportado por `@/components/ui` aparece em
 * alguma família ou está na lista de exceções de
 * `scripts/check-ds-catalog.mjs`, que reprova o commit quando um fica de
 * fora. */

const FAMILY_SCREENS: Record<DesignSystemFamilySlug, ComponentType> = {
  fundamentos: FoundationsFamily,
  texto: TextFamily,
  acoes: ActionsFamily,
  escolha: ChoiceFamily,
  campos: FieldsFamily,
  feedback: FeedbackFamily,
  espera: WaitFamily,
  numeros: NumbersFamily,
  tabelas: TablesFamily,
  superficies: SurfacesFamily,
  graficos: ChartsFamily,
}

export default function DesignSystemPage() {
  const { family: slug } = useParams()
  const family = DESIGN_SYSTEM_FAMILIES.find((candidate) => candidate.slug === slug)

  if (!family) {
    return <Navigate to={designSystemFamilyPath(DESIGN_SYSTEM_FAMILIES[0].slug)} replace />
  }

  const Screen = FAMILY_SCREENS[family.slug]

  return (
    <AppStack gap="lg">
      <AppPageHeader title={family.label} description={family.description} />
      <Screen />
    </AppStack>
  )
}
