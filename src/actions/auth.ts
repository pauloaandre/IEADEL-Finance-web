'use server'

import { getSessionUser } from '@/lib/session'

export async function getSessionUserAction() {
    return await getSessionUser()
}
