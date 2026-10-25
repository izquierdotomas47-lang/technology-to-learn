'use strict';

const { createHash, randomBytes } = require('node:crypto');

const SESSION_COOKIE = 'ttl_session';
const SECURE_SESSION_COOKIE = '__Host-ttl_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function cookieName(env = process.env) {
    const secure = env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview'
        || env.NODE_ENV === 'production';
    return secure ? SECURE_SESSION_COOKIE : SESSION_COOKIE;
}

function newSessionToken() {
    return randomBytes(32).toString('base64url');
}

function hashSessionToken(token) {
    return createHash('sha256').update(token).digest('hex');
}

function readSessionToken(request, env = process.env) {
    const name = cookieName(env);
    const cookieHeader = request.headers?.cookie || '';
    const value = cookieHeader.split(';').map(part => part.trim())
        .find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
    if (!value || !/^[A-Za-z0-9_-]{43}$/.test(value)) return null;
    return value;
}

function sessionCookie(token, env = process.env) {
    const secure = env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview'
        || env.NODE_ENV === 'production';
    return `${cookieName(env)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure ? '; Secure' : ''}`;
}

function clearedSessionCookie(env = process.env) {
    const secure = env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview'
        || env.NODE_ENV === 'production';
    return `${cookieName(env)}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
}

module.exports = {
    SESSION_COOKIE,
    SECURE_SESSION_COOKIE,
    SESSION_MAX_AGE_SECONDS,
    cookieName,
    newSessionToken,
    hashSessionToken,
    readSessionToken,
    sessionCookie,
    clearedSessionCookie
};
