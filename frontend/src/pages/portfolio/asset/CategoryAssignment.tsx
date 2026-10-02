import { AppConfirmDialog, AppSelect, AppSnackbar } from '@/components/ui'
import type { CategoryAssignment } from './category-assignment'

/** O seletor de uma linha. A categoria atual vem pelo nome, que é o que as
 *  leituras de posição carregam. */
export function CategoryCell({
  assignment,
  assetId,
  categoryName,
}: {
  assignment: CategoryAssignment
  assetId: number
  categoryName: string | null
}) {
  return (
    <AppSelect
      size="full"
      options={assignment.categories.map((cat) => ({
        value: String(cat.id),
        label: cat.name,
      }))}
      value={String(assignment.categories.find((cat) => cat.name === categoryName)?.id ?? '')}
      onChange={(value) => assignment.request(assetId, Number(value))}
    />
  )
}

/** A confirmação e o aviso de erro da troca, montados uma vez por lista. */
export function CategoryAssignmentPrompt({ assignment }: { assignment: CategoryAssignment }) {
  return (
    <>
      <AppConfirmDialog
        open={assignment.pending != null}
        title="Confirmar Alteração"
        tone="primary"
        onConfirm={assignment.confirm}
        onCancel={assignment.cancel}
      >
        Deseja realmente alterar a categoria deste ativo?
      </AppConfirmDialog>

      <AppSnackbar
        open={assignment.failed}
        message="Erro ao atualizar categoria."
        tone="danger"
        onClose={assignment.dismissFailure}
      />
    </>
  )
}
