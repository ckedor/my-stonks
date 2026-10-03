/* Datas e tamanhos de um arquivo enviado. `uploaded_at` chega em UTC: ler só
 * a data do texto poria um envio da noite no dia seguinte. */

const DATE = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const TIME = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const MONTH = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })

export const uploadedDate = (uploadedAt: string) => DATE.format(new Date(uploadedAt))

export const uploadedTime = (uploadedAt: string) => TIME.format(new Date(uploadedAt))

/** "Setembro de 2026": o grupo da lista. */
export const uploadedMonth = (uploadedAt: string) => {
  const month = MONTH.format(new Date(uploadedAt))
  return month.charAt(0).toUpperCase() + month.slice(1)
}

export const fileSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
