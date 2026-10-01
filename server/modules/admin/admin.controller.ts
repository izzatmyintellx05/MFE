import { Request, Response } from 'express';
import { PrismaClient, RoleCode } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_PROFILE_TABS: Record<string, RoleCode[]> = {
  ADMIN: ['ADMIN', 'BD', 'FINANCE', 'SHELLPLAN', 'DESIGN', 'PLANNING', 'PRODUCTION', 'DISPATCH'] as RoleCode[],
  BD: ['BD'] as RoleCode[],
  FINANCE: ['FINANCE'] as RoleCode[],
  SHELLPLAN: ['SHELLPLAN'] as RoleCode[],
  DESIGN: ['DESIGN'] as RoleCode[],
  PLANNING: ['PLANNING'] as RoleCode[],
  PRODUCTION: ['PRODUCTION'] as RoleCode[],
  DISPATCH: ['DISPATCH'] as RoleCode[],
};

// Helper function to extract array of role string codes from the user-role relation
function extractRoleCodes(user: any): string[] {
  if (!user || !user.roles || !Array.isArray(user.roles)) return [];
  return user.roles
    .map((ur: any) => {
      if (typeof ur === 'string') return ur;
      return ur.role?.code || ur.role?.name || ur.roleCode || ur.code;
    })
    .filter(Boolean)
    .map((s: string) => String(s).toUpperCase());
}

export async function getAllUsersWithPermissions(req: Request, res: Response): Promise<Response> {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        roles: {
          include: {
            role: true,
          },
        },
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.json({
      success: true,
      data: users.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        createdAt: u.createdAt,
        roles: extractRoleCodes(u),
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err.message || 'Failed to fetch users' } });
  }
}

export async function updateUserPermissions(req: Request, res: Response): Promise<Response> {
  try {
    const { userId } = req.params;
    const { roles, primaryProfile } = req.body;

    let targetRoles: RoleCode[] = [];

    if (primaryProfile && DEFAULT_PROFILE_TABS[primaryProfile]) {
      targetRoles = [...DEFAULT_PROFILE_TABS[primaryProfile]];
    } else if (Array.isArray(roles)) {
      targetRoles = roles as RoleCode[];
    } else {
      return res.status(400).json({ success: false, error: { message: 'Either roles array or valid primaryProfile is required' } });
    }

    // Safety guard: Protect root admin from losing ADMIN role
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });

    if (targetUser?.email === 'admin@mfeformwork.com' && !targetRoles.includes('ADMIN' as RoleCode)) {
      targetRoles.push('ADMIN' as RoleCode);
    }

    // Perform transaction: remove old userRole relations, match roleIds, and insert new ones
    await prisma.$transaction(async (tx) => {
      // 1. Fetch all system roles to map code -> roleId
      const allDbRoles = await (tx as any).role.findMany();
      const roleMap = new Map<string, string>();

      allDbRoles.forEach((r: any) => {
        if (r.code) roleMap.set(String(r.code).toUpperCase(), r.id);
        if (r.name) roleMap.set(String(r.name).toUpperCase(), r.id);
      });

      // 2. Delete existing role connections for this user
      await (tx as any).userRole.deleteMany({
        where: { userId },
      });

      // 3. Map targetRole codes to their corresponding database roleId
      const recordsToCreate = targetRoles
        .map((code) => {
          const roleId = roleMap.get(String(code).toUpperCase());
          return roleId ? { userId, roleId } : null;
        })
        .filter((item): item is { userId: string; roleId: string } => item !== null);

      // 4. Insert new relations
      if (recordsToCreate.length > 0) {
        await (tx as any).userRole.createMany({
          data: recordsToCreate,
        });
      }
    });

    // Fetch the updated user with populated role objects
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    return res.json({
      success: true,
      message: 'User authorization & tabs updated successfully',
      data: {
        id: updatedUser?.id,
        email: updatedUser?.email,
        fullName: updatedUser?.fullName,
        roles: extractRoleCodes(updatedUser),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err.message || 'Failed to update authorization' } });
  }
}

// Create a new corporate user from the Admin Console
export async function createUser(req: Request, res: Response): Promise<Response> {
  try {
    const { email, password, fullName, primaryProfile } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { message: 'Corporate Email and Password are required' },
      });
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: { message: 'A user account with this email address already exists' },
      });
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);

    // Determine initial roles
    const selectedProfile = primaryProfile || 'CUSTOM';
    const targetRoles: RoleCode[] = DEFAULT_PROFILE_TABS[selectedProfile] || [];

    // Fetch DB role map
    const allDbRoles = await (prisma as any).role.findMany();
    const roleMap = new Map<string, string>();
    allDbRoles.forEach((r: any) => {
      if (r.code) roleMap.set(String(r.code).toUpperCase(), r.id);
      if (r.name) roleMap.set(String(r.name).toUpperCase(), r.id);
    });

    // Create user and roles inside transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const createdUser = await (tx as any).user.create({
        data: {
          email: email.toLowerCase().trim(),
          passwordHash,
          fullName: fullName?.trim() || email.split('@')[0],
        },
      });

      const recordsToCreate = targetRoles
        .map((code) => {
          const roleId = roleMap.get(String(code).toUpperCase());
          return roleId ? { userId: createdUser.id, roleId } : null;
        })
        .filter((item): item is { userId: string; roleId: string } => item !== null);

      if (recordsToCreate.length > 0) {
        await (tx as any).userRole.createMany({
          data: recordsToCreate,
        });
      }

      return createdUser;
    });

    return res.status(201).json({
      success: true,
      message: 'New user created successfully',
      data: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        roles: targetRoles,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err.message || 'Failed to create user account' },
    });
  }
}

// Delete a user and clean up relational references safely
export async function deleteUser(req: Request, res: Response): Promise<Response> {
  try {
    const { userId } = req.params;

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: { message: 'User account not found' },
      });
    }

    // Safety guard: Protect root admin from deletion
    if (targetUser.email === 'admin@mfeformwork.com') {
      return res.status(403).json({
        success: false,
        error: { message: 'The primary root administrator account cannot be deleted' },
      });
    }

    // Delete relation links and user account within a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Delete associated role links
      await (tx as any).userRole.deleteMany({
        where: { userId },
      });

      // 2. Unlink any audit logs or department files uploaded by this user (if present)
      try {
        await (tx as any).departmentFileVersion?.updateMany({
          where: { uploadedById: userId },
          data: { uploadedById: null },
        });
      } catch (ignored) {
        // Table might use different naming or optional relation
      }

      // 3. Delete the user
      await tx.user.delete({
        where: { id: userId },
      });
    });

    return res.json({
      success: true,
      message: `Account for ${targetUser.email} has been deleted successfully`,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err.message || 'Failed to delete user account' },
    });
  }
}