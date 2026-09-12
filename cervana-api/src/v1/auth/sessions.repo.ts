import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Session } from '@prisma/client';

@Injectable()
export class SessionRepo {
  constructor(private readonly prisma: PrismaService) { }

  async createSession(
    userId: string,
    sessionToken: string,
    expires: Date,
  ): Promise<Session> {
    return this.prisma.session.create({
      data: {
        userId,
        sessionToken,
        expires,
      },
    });
  }

  async findSessionByToken(sessionToken: string): Promise<Session | null> {
    return this.prisma.session.findUnique({
      where: { sessionToken },
      include: {
        user: true,
      },
    });
  }

  async deleteSession(sessionToken: string): Promise<void> {
    await this.prisma.session.delete({
      where: { sessionToken },
    });
  }

  async revokeAllUserSessions(userId: string, exceptToken?: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: {
        userId,
        ...(exceptToken && {
          sessionToken: {
            not: exceptToken,
          },
        }),
      },
    });
  }
}
