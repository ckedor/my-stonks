import { login } from '@/actions/auth'
import {
  AppButton,
  AppLink,
  AppPasswordField,
  AppSnackbar,
  AppSplitScreen,
  AppStack,
  AppText,
  AppTextField,
  FieldLabel,
} from '@/components/ui'
import { loginRequest } from '@/lib/api'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorOpen, setErrorOpen] = useState(false)

  const navigate = useNavigate()

  const handleSubmit = async () => {
    if (loading) return
    setLoading(true)
    try {
      const { access_token } = await loginRequest(username, password)
      await login(access_token)
      navigate('/portfolio/overview')
    } catch {
      setErrorOpen(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <AppSplitScreen imageUrl="/home.png">
        <AppStack gap="xl">
          <AppStack gap="md">
            <AppText variant="display">Acesse sua conta</AppText>
            <AppText tone="secondary">Bem-vindo ao My Stonks. Faça login para continuar.</AppText>
          </AppStack>

          <AppStack gap="lg">
            <AppStack gap="xs">
              <FieldLabel>E-mail</FieldLabel>
              <AppTextField
                value={username}
                onChange={setUsername}
                placeholder="seu@email.com"
                onSubmit={handleSubmit}
              />
            </AppStack>

            <AppStack gap="xs">
              <AppStack direction="row" justify="between" align="center">
                <FieldLabel>Senha</FieldLabel>
                <AppLink href="#">Esqueci minha senha</AppLink>
              </AppStack>
              <AppPasswordField
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                onSubmit={handleSubmit}
              />
            </AppStack>
          </AppStack>

          <AppButton size="lg" fullWidth onClick={handleSubmit} loading={loading}>
            Acessar conta
          </AppButton>
        </AppStack>
      </AppSplitScreen>

      <AppSnackbar
        open={errorOpen}
        message="Usuário ou senha inválidos"
        severity="error"
        onClose={() => setErrorOpen(false)}
      />
    </>
  )
}
