'use server'

import { timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_SESSION_COOKIE, createAdminSessionValue } from '@/lib/admin-session'

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8

function isCorrectPassword(password: string, adminToken: string) {
  const passwordBuffer = Buffer.from(password)
  const tokenBuffer = Buffer.from(adminToken)

  return passwordBuffer.length === tokenBuffer.length && timingSafeEqual(passwordBuffer, tokenBuffer)
}

export async function loginAdmin(formData: FormData) {
  const password = String(formData.get('password') || '')
  const adminToken = process.env.ADMIN_TOKEN

  if (!adminToken || !isCorrectPassword(password, adminToken)) {
    redirect('/admin/login?error=1')
  }

  const sessionValue = await createAdminSessionValue(adminToken)
  const cookieStore = await cookies()

  cookieStore.set(ADMIN_SESSION_COOKIE, sessionValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })

  redirect('/merchants/admin')
}
