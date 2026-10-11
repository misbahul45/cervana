import { Injectable } from '@nestjs/common';
import { VerificationType } from '@prisma/client';
import { PrismaService } from '../../common/config/prisma/prisma.service';

@Injectable()
export class VerificationTokenRepo {
  constructor(private readonly prisma: PrismaService) {}

  upsert(values: { identifier: string; type: VerificationType; otp: string; expires: Date }) {
    const { identifier, type, otp, expires } = values;
    return this.prisma.verificationToken.upsert({
      where: { VerificationToken_identifier_type_key: { identifier, type } },
      create: { identifier, type, otp, expires, attempts: 0 },
      update: { otp, expires, attempts: 0 },
    });
  }

  find(identifier: string, type: VerificationType) {
    return this.prisma.verificationToken.findUnique({
      where: { VerificationToken_identifier_type_key: { identifier, type } },
    });
  }

  registerFailure(id: string) {
    return this.prisma.verificationToken.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  }

  async deleteById(id: string): Promise<number> {
    const { count } = await this.prisma.verificationToken.deleteMany({ where: { id } });
    return count;
  }
}
