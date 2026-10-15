import {z} from 'zod';
import type {Prisma} from '@prisma/client';
export const pagination=z.object({page:z.coerce.number().int().min(1).max(1000000).default(1),limit:z.coerce.number().int().min(1).max(100).default(24)});
export function athleteSearch(value:unknown):Prisma.AthleteWhereInput{
 const words=String(value??'').trim().split(/\s+/).filter(Boolean).slice(0,12);
 return words.length?{AND:words.map(word=>({OR:[{firstName:{contains:word,mode:'insensitive'}},{lastName:{contains:word,mode:'insensitive'}},{club:{name:{contains:word,mode:'insensitive'}}}]}))}:{};
}
