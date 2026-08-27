import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import { Breadcrumbs, Link, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface Props {
  items: BreadcrumbItem[]
}

export default function AppBreadcrumbs({ items }: Props) {
  const navigate = useNavigate()

  return (
    <Breadcrumbs
      separator={<NavigateNextIcon sx={{ fontSize: 16 }} />}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return isLast ? (
          <Typography key={index} variant="body2" color="text.primary" fontWeight={500}>
            {item.label}
          </Typography>
        ) : (
          <Link
            key={index}
            variant="body2"
            underline="hover"
            color="text.secondary"
            sx={{ cursor: 'pointer' }}
            onClick={() => item.href && navigate(item.href)}
          >
            {item.label}
          </Link>
        )
      })}
    </Breadcrumbs>
  )
}
