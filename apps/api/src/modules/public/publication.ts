import { Prisma } from '@prisma/client';

export const publicSeasonWhere: Prisma.SeasonWhereInput = {
  OR: [{ competition: null }, { competition: { isPublished: true } }],
};
export const publicEventWhere: Prisma.EventWhereInput = {
  isPublished: true, season: publicSeasonWhere,
};
