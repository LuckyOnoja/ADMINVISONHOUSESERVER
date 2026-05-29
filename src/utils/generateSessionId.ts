import prisma from "../db";

/**
 * Generates a unique, premium uppercase alphanumeric session ID prefixed with 'AVH-'.
 * Example: AVH-X9B2K7
 */
export async function generateSessionId(): Promise<string> {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let isUnique = false;
  let sessionId = "";

  while (!isUnique) {
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    sessionId = `AVH-${result}`;

    // Verify uniqueness in the database
    const existing = await prisma.booking.findUnique({
      where: { sessionId }
    });

    if (!existing) {
      isUnique = true;
    }
  }

  return sessionId;
}
