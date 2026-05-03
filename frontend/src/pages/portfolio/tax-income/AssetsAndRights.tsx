
import AppCard from '@/components/ui/AppCard'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { INCOME_TAX_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import { Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { useEffect, useState } from 'react'

interface AssetTaxInfo {
  grupo: string
  codigo: string
  discriminacao: string
  position_previous_year: number
  position_fiscal_year: number
  codigo_negociacao: string
  negociado_em_bolsa: boolean
  locale: string
  cnpj: string
}

interface AssetsAndRightsProps {
  fiscalYear: number
  portfolioId: number
}

export default function AssetsAndRights({ fiscalYear, portfolioId }: AssetsAndRightsProps) {
  const [data, setData] = useState<AssetTaxInfo[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await api.get(INCOME_TAX_ROUTES.assetsAndRights(portfolioId), {
          params: { fiscal_year: fiscalYear },
        })
        setData(res.data)
      } catch (err) {
        console.error('Erro ao carregar dados:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [fiscalYear, portfolioId])

  if (loading) return <LoadingSpinner />

  return (
    <AppCard sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        Bens e Direitos
      </Typography>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Grupo</TableCell>
            <TableCell>Código</TableCell>
            <TableCell>Localização</TableCell>
            <TableCell>CNPJ</TableCell>
            <TableCell sx={{ maxWidth: 500, whiteSpace: 'normal', wordBreak: 'break-word' }}>
              Discriminação
            </TableCell>
            <TableCell>Código de Negociação</TableCell>
            <TableCell>31/12/{fiscalYear - 1}</TableCell>
            <TableCell>31/12/{fiscalYear}</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {data.map((item, index) => (
            <TableRow key={index}>
              <TableCell>{item.grupo}</TableCell>
              <TableCell>{item.codigo}</TableCell>
              <TableCell>{item.locale}</TableCell>
              <TableCell>{item.cnpj}</TableCell>
              <TableCell sx={{ maxWidth: 500, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                {item.discriminacao}
              </TableCell>
              <TableCell>{item.codigo_negociacao}</TableCell>
              <TableCell>
                {item.position_previous_year.toLocaleString('pt-BR', {
                  maximumFractionDigits: 2,
                })}
              </TableCell>
              <TableCell>
                {item.position_fiscal_year.toLocaleString('pt-BR', {
                  maximumFractionDigits: 2,
                })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AppCard>
  )
}
