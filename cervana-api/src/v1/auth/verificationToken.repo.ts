import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/config/prisma/prisma.service';
import { errorHandler, validation } from '@/common/lib/utils';
import { CreateVerificationTokenDto, CreateVerificationTokenDtoType, UpdateVerificationTokenDto, UpdateVerificationTokenDtoType } from './auth.dto';

@Injectable()
export class VerificationTokenRepo {
    constructor(
        private readonly prisma:PrismaService
    ){}
    
    async find(identifier:string, otp:string){
        return errorHandler(async()=>{
            const data= await this.prisma.verificationToken.findUnique({
                where:{
                    VerificationToken_identifier_otp_key:{
                        identifier,
                        otp
                    },
                    expires: {
                        gt: new Date(),
                    },
                },
            })

            return data
        })
    }

    async create(values:CreateVerificationTokenDtoType){
        return errorHandler(async()=>{
            const data=validation(CreateVerificationTokenDto, values)
            return await this.prisma.verificationToken.create({
                data
            })
        })
    }

    async update(id:string,values:UpdateVerificationTokenDtoType){
        return errorHandler(async()=>{
            const data=validation(UpdateVerificationTokenDto, values)
            return await this.prisma.verificationToken.update({
                where:{id},
                data
            })
        })
    }

    async delete(identifier:string, otp:string) {
        return errorHandler(async () => {
            const deleted = await this.prisma.verificationToken.delete({
            where: { 
                VerificationToken_identifier_otp_key:{
                    identifier,
                    otp
                }
             },
            })

            return {
                success: true,
                data: deleted,
            }
        })
    }

    async deleteByIdentifier(identifier:string) {
        return errorHandler(async () => {
            return await this.prisma.verificationToken.deleteMany({
                where: { 
                    identifier
                },
            })
        })
    }
}
