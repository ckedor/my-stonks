import { Box, BoxProps, Link, Typography } from '@mui/material'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Props extends Omit<BoxProps, 'children'> {
  children: string
}

const components: Components = {
  p: ({ children }) => (
    <Typography variant="body2" sx={{ mb: 1 }}>
      {children}
    </Typography>
  ),
  h1: ({ children }) => (
    <Typography variant="h6" fontWeight="bold" sx={{ mt: 2, mb: 1 }}>
      {children}
    </Typography>
  ),
  h2: ({ children }) => (
    <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 2, mb: 1 }}>
      {children}
    </Typography>
  ),
  h3: ({ children }) => (
    <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 1.5, mb: 0.5 }}>
      {children}
    </Typography>
  ),
  ul: ({ children }) => (
    <Box component="ul" sx={{ pl: 3, my: 1 }}>
      {children}
    </Box>
  ),
  ol: ({ children }) => (
    <Box component="ol" sx={{ pl: 3, my: 1 }}>
      {children}
    </Box>
  ),
  li: ({ children }) => (
    <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
      {children}
    </Typography>
  ),
  a: ({ href, children }) => (
    <Link href={href} target="_blank" rel="noopener noreferrer" underline="hover">
      {children}
    </Link>
  ),
  code: ({ children }) => (
    <Box
      component="code"
      sx={{
        px: 0.5,
        py: 0.25,
        borderRadius: 0.5,
        backgroundColor: 'action.hover',
        fontFamily: 'monospace',
        fontSize: '0.85em',
      }}
    >
      {children}
    </Box>
  ),
}

export default function MarkdownText({ children, ...boxProps }: Props) {
  return (
    <Box {...boxProps}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </Box>
  )
}
