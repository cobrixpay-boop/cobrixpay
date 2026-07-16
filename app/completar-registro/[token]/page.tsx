import { RegistrationForm } from './RegistrationForm'

type RegistrationPageProps = {
  params: Promise<{ token: string }>
}

export const dynamic = 'force-dynamic'

export default async function RegistrationPage({ params }: RegistrationPageProps) {
  const { token } = await params
  return <RegistrationForm token={token} />
}
