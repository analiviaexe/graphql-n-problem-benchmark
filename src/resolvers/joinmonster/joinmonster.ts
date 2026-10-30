import joinMonster from 'join-monster';
import pool from '../../db.js';

const runJoinMonster = (joinMonster as any).default || joinMonster;

async function resolve(_parent: unknown, _args: unknown, context: unknown, info: unknown) {
  return runJoinMonster(
    info,
    context,
    async (sql: string) => {
      const res = await pool.query(sql);
      return res.rows;
    },
    { dialect: 'pg' }
  );
}

export const joinMonsterResolvers = {
  Query: {
    getTitles: resolve,
    getTitleById: resolve,
  },
};
