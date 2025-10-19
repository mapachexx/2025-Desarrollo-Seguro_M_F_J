
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import db from '../db';
import { User, UserRow } from '../types/user';
import jwtUtils from '../utils/jwt';
import ejs from 'ejs';
import bcrypt from 'bcrypt';
import sanitize from 'sanitize-html';

const RESET_TTL = 1000 * 60 * 60; // 1h
const INVITE_TTL = 1000 * 60 * 60 * 24 * 7; // 7d

class AuthService {

  static async createUser(user: User) {
    const existing = await db<UserRow>('users')
      .where({ username: user.username })
      .orWhere({ email: user.email })
      .first();
    if (existing) throw new Error('User already exists with that username or email');

    const hashedPassword = await bcrypt.hash(user.password, 10);

    const invite_token = crypto.randomBytes(6).toString('hex');
    const invite_token_expires = new Date(Date.now() + INVITE_TTL);
    await db<UserRow>('users').insert({
      username: user.username,
      password: hashedPassword,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      invite_token,
      invite_token_expires,
      activated: false
    });

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const clean = (v: any) => sanitize(v || '', { allowedTags: [], allowedAttributes: {} });
    const fName = clean(user.first_name);
    const lName = clean(user.last_name);
    const uName = clean(user.username);

    const safeLink = [
      process.env.FRONTEND_URL,
      '/activate-user?token=',
      invite_token,
      '&username=',
      encodeURIComponent(uName)
    ].join('');

    const tpl = `<html><body><h2>Hi ${fName} ${lName}</h2><p>Use this <a href="${safeLink}">link</a> to activate your profile.</p></body></html>`;
    const htmlSafe = ejs.render(tpl, {});

    await transporter.sendMail({
      from: 'info@example.com',
      to: user.email,
      subject: 'Account Activation',
      html: htmlSafe
    });
  }

  static async updateUser(user: User) {
    const existing = await db<UserRow>('users')
      .where({ id: user.id })
      .first();
    if (!existing) throw new Error('User not found');

    const toUpdate: Partial<UserRow> = {
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name
    };

    if (user.password) {
      toUpdate.password = await bcrypt.hash(user.password, 10);
    }

    await db<UserRow>('users')
      .where({ id: user.id })
      .update(toUpdate);
    return existing;
  }

  static async authenticate(username: string, password: string) {
    const user = await db<UserRow>('users')
      .where({ username })
      .andWhere('activated', true)
      .first();
    if (!user) throw new Error('Invalid username or not activated');

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new Error('Invalid password');

    return user;
  }

  static async sendResetPasswordEmail(email: string) {
    const user = await db<UserRow>('users')
      .where({ email })
      .andWhere('activated', true)
      .first();
    if (!user) throw new Error('No user with that email or not activated');

    const token = crypto.randomBytes(6).toString('hex');
    const expires = new Date(Date.now() + RESET_TTL);

    await db('users')
      .where({ id: user.id })
      .update({
        reset_password_token: token,
        reset_password_expires: expires
      });

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const link = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    await transporter.sendMail({
      to: user.email,
      subject: 'Your password reset link',
      html: `Click <a href="${link}">here</a> to reset your password.`
    });
  }

  static async resetPassword(token: string, newPassword: string) {
    const row = await db<UserRow>('users')
      .where('reset_password_token', token)
      .andWhere('reset_password_expires', '>', new Date())
      .first();
    if (!row) throw new Error('Invalid or expired reset token');

    const hashed = await bcrypt.hash(newPassword, 10);
    await db('users')
      .where({ id: row.id })
      .update({
        password: hashed,
        reset_password_token: null,
        reset_password_expires: null
      });
  }

  static async setPassword(token: string, newPassword: string) {
    const row = await db<UserRow>('users')
      .where('invite_token', token)
      .andWhere('invite_token_expires', '>', new Date())
      .first();
    if (!row) throw new Error('Invalid or expired invite token');

    const hashed = await bcrypt.hash(newPassword, 10);
    await db('users')
      .update({
        password: hashed,
        invite_token: null,
        invite_token_expires: null,
        activated: true
      })
      .where({ id: row.id });
  }

  static generateJwt(userId: string): string {
    return jwtUtils.generateToken(userId);
  }
}

export default AuthService;