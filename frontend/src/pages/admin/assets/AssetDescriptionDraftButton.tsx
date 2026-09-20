import { useState } from 'react'

import { fetchAssetDescriptionDraft, type AssetDescriptionDraft } from '@/api/ai'
import { AppButton, AppText } from '@/components/ui'

/* Pede à IA um rascunho do texto de cadastro e joga nos campos.
 *
 * O rascunho não é gravado: ele cai no formulário, quem edita e salva é quem
 * está na tela. Por isso o botão preenche os dois campos de uma vez e some do
 * caminho — o que fica no banco é sempre o que alguém gravou.
 *
 * Lê antes de gerar: clicar de novo depois de fechar o formulário sem salvar
 * não paga uma segunda chamada. Querer um rascunho diferente é outra decisão, e
 * ela entra pela execução da feature na tela de IA — que já existe e serve
 * qualquer feature, sem precisar de um segundo botão aqui. */
export default function AssetDescriptionDraftButton({
  assetId,
  onDraft,
}: {
  assetId: number
  onDraft: (draft: AssetDescriptionDraft) => void
}) {
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  const request = async () => {
    setLoading(true)
    setFailed(false)
    try {
      const artifact = await fetchAssetDescriptionDraft(assetId)
      onDraft(artifact.payload)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <AppButton emphasis="ghost" size="sm" onClick={request} loading={loading}>
        Preencher com IA
      </AppButton>
      {failed ? (
        <AppText variant="caption" tone="danger">
          Não foi possível gerar o rascunho.
        </AppText>
      ) : null}
    </>
  )
}
