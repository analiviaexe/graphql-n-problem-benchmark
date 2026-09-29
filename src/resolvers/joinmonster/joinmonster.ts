import joinMonster from 'join-monster';
import pool from '../../db.js';

export const joinMonsterResolvers = {
    Query: {
        getTitles: async (_parent: unknown, _args: unknown, context: unknown, info: unknown) => {
            const fn = (joinMonster as any).default || joinMonster;
            return fn(
                info,
                context,
                async (sql: string) => {
                    const res = await pool.query(sql);
                    return res.rows;
                },
                { dialect: 'pg' }
            );
        },

        getTitleById: async (_parent: unknown, _args: unknown, context: unknown, info: unknown) => {
            const fn = (joinMonster as any).default || joinMonster;
            return fn(
                info,
                context,
                async (sql: string) => {
                    const res = await pool.query(sql);
                    return res.rows;
                },
                { dialect: 'pg' }
            );
        },
    },
};
