/**
 * src/db/client.ts
 *
 * Singleton Prisma Client for database access.
 */

import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
