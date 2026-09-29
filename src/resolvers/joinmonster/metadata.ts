import { GraphQLSchema, GraphQLObjectType } from 'graphql';

export function attachJoinMonsterMetadata(schema: GraphQLSchema): void {
    const Title = schema.getType('Title') as GraphQLObjectType;
    if (Title) {
        (Title as any).extensions = {
            ...Title.extensions,
            joinMonster: {
                sqlTable: 'titles',
                uniqueKey: 'tconst',
            },
        };

        const fields = Title.getFields();

        if (fields.rating) {
            (fields.rating as any).extensions = {
                ...fields.rating.extensions,
                joinMonster: {
                    sqlJoin: (titleTable: string, ratingTable: string) =>
                        `${titleTable}.tconst = ${ratingTable}.tconst`,
                },
            };
        }

        if (fields.principals) {
            (fields.principals as any).extensions = {
                ...fields.principals.extensions,
                joinMonster: {
                    sqlJoin: (titleTable: string, principalTable: string) =>
                        `${titleTable}.tconst = ${principalTable}.tconst`,
                    orderBy: { ordering: 'asc' },
                },
            };
        }

    }

    const Rating = schema.getType('Rating') as GraphQLObjectType;
    if (Rating) {
        (Rating as any).extensions = {
            ...Rating.extensions,
            joinMonster: {
                sqlTable: 'ratings',
                uniqueKey: 'tconst',
            },
        };
    }

    const Principal = schema.getType('Principal') as GraphQLObjectType;
    if (Principal) {
        (Principal as any).extensions = {
            ...Principal.extensions,
            joinMonster: {
                sqlTable: 'principals',
                uniqueKey: ['tconst', 'ordering'],
            },
        };

        const fields = Principal.getFields();

        if (fields.name) {
            (fields.name as any).extensions = {
                ...fields.name.extensions,
                joinMonster: {
                    sqlJoin: (principalTable: string, nameTable: string) =>
                        `${principalTable}.nconst = ${nameTable}.nconst`,
                },
            };
        }
    }

    const Name = schema.getType('Name') as GraphQLObjectType;
    if (Name) {
        (Name as any).extensions = {
            ...Name.extensions,
            joinMonster: {
                sqlTable: 'names',
                uniqueKey: 'nconst',
            },
        };

        const fields = Name.getFields();

        if (fields.known_for_titles) {
            (fields.known_for_titles as any).extensions = {
                ...fields.known_for_titles.extensions,
                joinMonster: {
                    orderBy: { tconst: 'asc' },
                    junction: {
                        sqlTable: 'principals',
                        sqlJoins: [
                            (nameTable: string, junctionTable: string) =>
                                `${nameTable}.nconst = ${junctionTable}.nconst`,
                            (junctionTable: string, titleTable: string) =>
                                `${junctionTable}.tconst = ${titleTable}.tconst`,
                        ],
                    },
                },
            };
        }
    }

    const Query = schema.getType('Query') as GraphQLObjectType;
    if (Query) {
        const fields = Query.getFields();

        if (fields.getTitles) {
            (fields.getTitles as any).extensions = {
                ...fields.getTitles.extensions,
                joinMonster: {
                    orderBy: { tconst: 'asc' },
                    limit: (args: any) => args.limit || 20,
                    offset: (args: any) => args.offset || 0,
                },
            };
        }

        if (fields.getTitleById) {
            (fields.getTitleById as any).extensions = {
                ...fields.getTitleById.extensions,
                joinMonster: {
                    where: (table: string, args: any) => `${table}.tconst = '${args.tconst}'`,
                },
            };
        }
    }


}
