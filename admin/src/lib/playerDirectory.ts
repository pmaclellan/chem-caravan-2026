import { supabaseAdmin } from './supabaseAdmin'

export interface PlayerOption {
  userId: string
  email: string | null
  latestCharacterName: string
}

// One entry per distinct user_id that has at least one saved run, labeled by their auth email
// when available. games.user_id has no email on it directly — email only lives in auth.users,
// reachable here via the Admin API's listUsers() (available because this client is built with
// the service-role key). Falls back to the player's most recent character name if a user has no
// email on file (e.g. anonymous auth), so the picker never shows a blank entry.
export async function fetchPlayerDirectory(): Promise<PlayerOption[]> {
  const [runsResult, usersResult] = await Promise.all([
    supabaseAdmin
      .from('games')
      .select('user_id, character_name, created_at')
      .order('created_at', { ascending: false })
      .limit(5000),
    supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])
  if (runsResult.error) throw new Error(runsResult.error.message)
  if (usersResult.error) throw new Error(usersResult.error.message)

  const emailByUserId = new Map<string, string>()
  for (const u of usersResult.data.users) {
    if (u.email) emailByUserId.set(u.id, u.email)
  }

  // Rows are newest-first, so the first occurrence of a user_id is their most recent character.
  const latestNameByUserId = new Map<string, string>()
  for (const row of runsResult.data ?? []) {
    if (!latestNameByUserId.has(row.user_id)) latestNameByUserId.set(row.user_id, row.character_name)
  }

  return Array.from(latestNameByUserId.entries())
    .map(([userId, latestCharacterName]) => ({
      userId,
      email: emailByUserId.get(userId) ?? null,
      latestCharacterName,
    }))
    .sort((a, b) => (a.email ?? a.latestCharacterName).localeCompare(b.email ?? b.latestCharacterName))
}
