import prisma from '../config/prisma';

export function normalizeEmail(email: unknown): string {
  return String(email ?? '').trim().toLowerCase();
}

// Case-insensitive so accounts created before emails were normalised (or a
// phone autocapitalising the first letter) still match.
export function emailMatches(email: unknown) {
  return { equals: normalizeEmail(email), mode: 'insensitive' as const };
}

export async function revokeSessions(userId: number): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { userId } });
}
