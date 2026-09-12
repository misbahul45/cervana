
import type { Query } from "$lib/types/api.type"
import { request } from "$lib/utils/request"

export const topicService={
    findAll:(q:Query)=>{
        return request('/curicumlum/topic', 'GET', undefined,{})
    },
    create:()=>{},
    update:()=>{},
    delete:()=>{}

}