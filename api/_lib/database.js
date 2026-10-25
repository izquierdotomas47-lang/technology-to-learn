'use strict';

let neonPromise;

async function getSql(env = process.env) {
    const connectionString = env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not configured');
    let parsed;
    try { parsed = new URL(connectionString); }
    catch { throw new Error('DATABASE_URL is invalid'); }
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
        throw new Error('DATABASE_URL must use PostgreSQL');
    }

    if (!neonPromise) {
        neonPromise = import('@neondatabase/serverless').then(({ neon }) => neon(connectionString));
    }
    return neonPromise;
}

module.exports = { getSql };
