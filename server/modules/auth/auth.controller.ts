import { Request, Response } from 'express';
import { PrismaClient, RoleCode } from '@prisma/client';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { hydrateUsersFromDb, saveUserToDb } from '../../db/supabase';

const prisma = new PrismaClient();
const getJwtSecret = () => process.env.JWT_SECRET || 'mfe-formwork-mr11-enterprise-secret-key-2026';

// Every seeded account starts with this password until its user changes it
const DEFAULT_PASSWORD = 'admin123';
const MIN_PASSWORD_LENGTH = 8;

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `pbkdf2$${salt}$${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;

  if (storedHash.startsWith('pbkdf2$')) {
    const parts = storedHash.split('$');
    if (parts.length >= 3) {
      const computed = crypto.pbkdf2Sync(password, parts[1], 1000, 64, 'sha512').toString('hex');
      return computed === parts[2];
    }
  }

  if (storedHash.includes(':')) {
    const [salt, expectedHash] = storedHash.split(':');
    if (salt && expectedHash) {
      const computed = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
      return computed === expectedHash;
    }
  }

  // Accounts created in the Admin Console (bcrypt). `require` does not exist in this ES module.
  if (storedHash.startsWith('$2')) {
    return bcrypt.compareSync(password, storedHash);
  }

  const sha = crypto.createHash('sha256').update(password).digest('hex');
  if (storedHash === sha) return true;

  return password === storedHash;
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' },
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Accounts may have been added, changed or removed on another instance
    await hydrateUsersFromDb();

    let user = await prisma.user.findFirst({
      where: { email: cleanEmail },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    if (!user && (cleanEmail === 'admin@mfeformwork.com' || cleanEmail === 'admin@mfe.com')) {
      const adminRole = await prisma.role.findFirst({ where: { code: RoleCode.ADMIN } });
      user = await prisma.user.create({
        data: {
          email: 'admin@mfeformwork.com',
          fullName: 'System Administrator',
          passwordHash: hashPassword('admin123'),
          status: 'ACTIVE',
          isActive: true,
          roles: adminRole ? { create: { roleId: adminRole.id } } : undefined,
        },
        include: {
          roles: {
            include: { role: true },
          },
        },
      });
    }

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_FAILED', message: 'Invalid email or password' },
      });
    }

    let roleCodes = (user.roles || []).map((r: any) => r.role?.code || r.roleCode || r);
    if (cleanEmail === 'admin@mfeformwork.com') {
      roleCodes = [RoleCode.ADMIN];
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roles: roleCodes,
      },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    const userPayload = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: roleCodes,
      usingDefaultPassword: password === DEFAULT_PASSWORD,
    };

    return res.json({
      success: true,
      token,
      user: userPayload,
      data: {
        token,
        user: userPayload,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'AUTH_ERROR', message: err.message || 'Authentication failed' },
    });
  }
}

export async function register(req: Request, res: Response) {
  try {
    const { email, password, fullName, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' },
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const displayName = String(fullName || name || cleanEmail.split('@')[0]).trim();

    const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: { code: 'USER_EXISTS', message: 'User already exists' },
      });
    }

    let adminRole = await prisma.role.findUnique({ where: { code: RoleCode.ADMIN } });
    if (!adminRole) {
      adminRole = await prisma.role.create({
        data: { code: RoleCode.ADMIN, name: 'System Administrator' },
      });
    }

    const userCount = await prisma.user.count();
    const assignedRole = userCount === 0 || cleanEmail.includes('admin') ? adminRole : adminRole;

    const passwordHash = hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        fullName: displayName,
        passwordHash,
        status: 'ACTIVE',
        isActive: true,
        roles: {
          create: { roleId: assignedRole.id },
        },
      },
      include: { roles: { include: { role: true } } },
    });

    const roleCodes = (user.roles || []).map((r: any) => r.role?.code || r.roleCode || r);

    const token = jwt.sign(
      { id: user.id, email: user.email, fullName: user.fullName, roles: roleCodes },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    const userPayload = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: roleCodes,
    };

    return res.status(201).json({
      success: true,
      token,
      user: userPayload,
      data: { token, user: userPayload },
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'REGISTRATION_FAILED', message: err.message },
    });
  }
}

export async function getCurrentUser(req: Request, res: Response) {
  try {
    const userPayload = (req as any).user;
    if (!userPayload?.id && !userPayload?.email) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          userPayload.id ? { id: userPayload.id } : undefined,
          userPayload.email ? { email: userPayload.email } : undefined,
        ].filter(Boolean) as any,
      },
      include: {
        roles: { include: { role: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND' } });
    }

    let roleCodes = (user.roles || []).map((r: any) => r.role?.code || r.roleCode || r);
    if (roleCodes.length === 0 || user.email === 'admin@mfeformwork.com') {
      roleCodes = [RoleCode.ADMIN];
    }

    const out = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: roleCodes,
    };

    return res.json({
      success: true,
      data: out,
      user: out,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
}

// Get current authenticated user details
export async function getMe(req: Request, res: Response): Promise<Response> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
    }

    const token = authHeader.split(' ')[1];
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as any;

    const findUser = () =>
      prisma.user.findUnique({
        where: { id: decoded.id },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });
    let user = await findUser();
    // Created on another instance since this one loaded its users
    if (!user && (await hydrateUsersFromDb())) user = await findUser();

    if (!user) {
      return res.status(404).json({ success: false, error: { message: 'User not found' } });
    }

    const roleCodes: string[] = (user.roles || [])
      .map((ur: any) => {
        if (typeof ur === 'string') return ur;
        return ur.role?.code || ur.role?.name || ur.roleCode;
      })
      .filter(Boolean)
      .map((s: string) => String(s).toUpperCase());

    if (user.email === 'admin@mfeformwork.com' && !roleCodes.includes('ADMIN')) {
      roleCodes.push('ADMIN');
    }

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          roles: roleCodes,
        },
      },
    });
  } catch (err: any) {
    return res.status(401).json({ success: false, error: { message: 'Invalid or expired token' } });
  }
}

/** Lets a signed-in user replace their password. The new hash is saved to the database. */
export async function changePassword(req: Request, res: Response) {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const reject = (code: string, message: string, status = 400) =>
      res.status(status).json({ success: false, error: { code, message } });

    if (!currentPassword || !newPassword) {
      return reject('VALIDATION_ERROR', 'Enter your current password and a new password.');
    }
    const next = String(newPassword);
    if (next.length < MIN_PASSWORD_LENGTH) {
      return reject('WEAK_PASSWORD', `The new password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (next === String(currentPassword)) {
      return reject('SAME_PASSWORD', 'The new password must be different from your current password.');
    }
    if (next === DEFAULT_PASSWORD) {
      return reject('DEFAULT_PASSWORD', 'Choose a password other than the default one.');
    }

    // The account may have been changed on another instance
    await hydrateUsersFromDb();
    const user = await prisma.user.findUnique({ where: { id: (req as any).user?.id } });
    if (!user) {
      return reject('USER_NOT_FOUND', 'Your account was not found. Sign in again.', 404);
    }
    if (!verifyPassword(String(currentPassword), user.passwordHash)) {
      return reject('WRONG_PASSWORD', 'Your current password is incorrect.');
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(next) },
    });
    const roleIds = (await prisma.userRole.findMany({ where: { userId: user.id } })).map((ur: any) => ur.roleId);
    try {
      await saveUserToDb(updated, roleIds);
    } catch (err: any) {
      // Keep memory in step with the database, so the old password stays in force
      await hydrateUsersFromDb();
      console.error('Password change could not be saved:', err?.message || err);
      return reject('SAVE_FAILED', 'Your new password could not be saved. Please try again.', 500);
    }

    return res.json({ success: true, message: 'Password changed.' });
  } catch (err: any) {
    console.error('Change password error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'CHANGE_PASSWORD_ERROR', message: 'Your password could not be changed. Please try again.' },
    });
  }
}
