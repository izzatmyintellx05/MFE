/**
 * In-memory high-fidelity Prisma database implementation for AI Studio
 * Provides full model support, querying, relations, filtering, and seeding.
 */
import crypto from 'crypto';

export function normalizeDatabaseUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  // If user provided postgresql://user:pass@word@host:port/db, encode the password component
  try {
    const trimmed = rawUrl.trim();
    const match = trimmed.match(/^(postgres(?:ql)?:\/\/)([^:]+):(.+)@([^@]+:\d+\/.*)$/);
    if (match) {
      const [, prefix, user, pass, rest] = match;
      if (pass.includes('@') && !pass.includes('%40')) {
        return `${prefix}${user}:${encodeURIComponent(pass)}@${rest}`;
      }
    }
  } catch {}
  return rawUrl;
}

export enum RoleCode {
  ADMIN = 'ADMIN',
  CEO = 'CEO',
  BD = 'BD',
  FINANCE = 'FINANCE',
  SHELLPLAN = 'SHELLPLAN',
  DESIGN = 'DESIGN',
  PLANNING = 'PLANNING',
  PRODUCTION = 'PRODUCTION',
  DISPATCH = 'DISPATCH',
}

export enum Mr11Status {
  EMPTY = 'EMPTY',
  PARTIAL = 'PARTIAL',
  READY = 'READY',
  FAILED = 'FAILED',
}

export enum FileVersionStatus {
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  FAILED = 'FAILED',
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `pbkdf2$${salt}$${hash}`;
}

// In-Memory Storage Tables
interface InMemoryStore {
  users: Map<string, any>;
  roles: Map<string, any>;
  userRoles: Map<string, any>;
  departments: Map<string, any>;
  fileVersions: Map<string, any>;
  auditLogs: any[];
  mr11Runs: any[];
  mr11Config: Map<string, any>;
  planningSeriesHistory: Map<string, any>;
  planningProjectQuantityTrackers: Map<string, any>;
  productionSeriesHistory: Map<string, any>;
}

const store: InMemoryStore = {
  users: new Map(),
  roles: new Map(),
  userRoles: new Map(),
  departments: new Map(),
  fileVersions: new Map(),
  auditLogs: [],
  mr11Runs: [],
  mr11Config: new Map(),
  planningSeriesHistory: new Map(),
  planningProjectQuantityTrackers: new Map(),
  productionSeriesHistory: new Map(),
};

// Seed initial roles
const INITIAL_ROLES = [
  { id: 'role-admin', code: RoleCode.ADMIN, name: 'System Administrator', description: 'Full system configuration & control' },
  { id: 'role-ceo', code: RoleCode.CEO, name: 'Executive / CEO', description: 'Executive read-only matrix & financial access' },
  { id: 'role-bd', code: RoleCode.BD, name: 'Business Development', description: 'Master commercial schedule management' },
  { id: 'role-finance', code: RoleCode.FINANCE, name: 'Finance', description: 'Cash flow & advance tracking' },
  { id: 'role-shellplan', code: RoleCode.SHELLPLAN, name: 'Shellplan', description: 'Pre-design coordination' },
  { id: 'role-design', code: RoleCode.DESIGN, name: 'Design', description: 'Design engineering execution' },
  { id: 'role-planning', code: RoleCode.PLANNING, name: 'Planning', description: 'Factory sequence planning' },
  { id: 'role-production', code: RoleCode.PRODUCTION, name: 'Production', description: 'Manufacturing & progress tracking' },
  { id: 'role-dispatch', code: RoleCode.DISPATCH, name: 'Dispatch', description: 'Logistics & shipment verification' },
];

for (const r of INITIAL_ROLES) {
  store.roles.set(r.id, { ...r, createdAt: new Date() });
}

// Seed initial departments
const INITIAL_DEPTS = [
  { id: 'dept-bd', code: RoleCode.BD, name: 'Business Development', description: 'Contract specifications & commercial data' },
  { id: 'dept-finance', code: RoleCode.FINANCE, name: 'Finance', description: 'Payments & financial terms' },
  { id: 'dept-shellplan', code: RoleCode.SHELLPLAN, name: 'Shellplan', description: 'Consultant drawing statuses & submissions' },
  { id: 'dept-design', code: RoleCode.DESIGN, name: 'Design', description: 'Engineering design status & order quantities' },
  { id: 'dept-planning', code: RoleCode.PLANNING, name: 'Planning', description: 'Production series & processing stages' },
  { id: 'dept-production', code: RoleCode.PRODUCTION, name: 'Production', description: 'Manufacturing output tracking' },
  { id: 'dept-dispatch', code: RoleCode.DISPATCH, name: 'Dispatch', description: 'Logistics, delivery, and sailing actuals' },
];

for (const d of INITIAL_DEPTS) {
  store.departments.set(d.id, {
    ...d,
    activeVersionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

// Seed Admin User
const adminId = 'user-admin-1';
const adminEmail = 'admin@mfeformwork.com';
const adminUser = {
  id: adminId,
  email: adminEmail,
  fullName: 'System Administrator',
  passwordHash: hashPassword('admin123'),
  status: 'ACTIVE',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};
store.users.set(adminId, adminUser);

// Link admin to all roles
for (const r of INITIAL_ROLES) {
  const urId = `ur-${adminId}-${r.id}`;
  store.userRoles.set(urId, {
    id: urId,
    userId: adminId,
    roleId: r.id,
    createdAt: new Date(),
  });
}

// Seed role demo accounts (password: admin123)
const DEMO_USERS = [
  { id: 'user-ceo-1', email: 'ceo@mfeformwork.com', fullName: 'Executive Director', roleCode: RoleCode.CEO },
  { id: 'user-bd-1', email: 'bd@mfeformwork.com', fullName: 'BD Lead Officer', roleCode: RoleCode.BD },
  { id: 'user-finance-1', email: 'finance@mfeformwork.com', fullName: 'Commercial Finance Lead', roleCode: RoleCode.FINANCE },
  { id: 'user-shellplan-1', email: 'shellplan@mfeformwork.com', fullName: 'Shellplan Architect', roleCode: RoleCode.SHELLPLAN },
  { id: 'user-design-1', email: 'design@mfeformwork.com', fullName: 'Lead Design Engineer', roleCode: RoleCode.DESIGN },
  { id: 'user-planning-1', email: 'planning@mfeformwork.com', fullName: 'Planning & Series Lead', roleCode: RoleCode.PLANNING },
  { id: 'user-production-1', email: 'production@mfeformwork.com', fullName: 'Plant Operations Manager', roleCode: RoleCode.PRODUCTION },
  { id: 'user-dispatch-1', email: 'dispatch@mfeformwork.com', fullName: 'Dispatch & Logistics Lead', roleCode: RoleCode.DISPATCH },
];

for (const du of DEMO_USERS) {
  store.users.set(du.id, {
    id: du.id,
    email: du.email,
    fullName: du.fullName,
    passwordHash: hashPassword('admin123'),
    status: 'ACTIVE',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const roleObj = INITIAL_ROLES.find((r) => r.code === du.roleCode);
  if (roleObj) {
    const urId = `ur-${du.id}-${roleObj.id}`;
    store.userRoles.set(urId, {
      id: urId,
      userId: du.id,
      roleId: roleObj.id,
      createdAt: new Date(),
    });
  }
}

// Seed default MR11 Config singleton
store.mr11Config.set('singleton', {
  id: 'singleton',
  visibleColumns: [],
  updatedAt: new Date(),
});

const WHERE_OPERATORS = ['in', 'gt', 'gte', 'lt', 'lte'];

/** A Prisma compound unique key: not a field of the item, and its value lists the fields to match. */
function isCompoundKey(item: any, key: string, val: any): boolean {
  return (
    typeof val === 'object' &&
    val !== null &&
    !(val instanceof Date) &&
    !(key in item) &&
    !Object.keys(val).some((k) => WHERE_OPERATORS.includes(k))
  );
}

function matchesWhere(item: any, where: any): boolean {
  if (!where || typeof where !== 'object') return true;

  if (Array.isArray(where.OR)) {
    return where.OR.some((clause: any) => matchesWhere(item, clause));
  }

  for (const [key, val] of Object.entries(where)) {
    if (val === undefined) continue;

    if (key === 'email' && typeof val === 'string') {
      if (String(item.email || '').toLowerCase() !== val.toLowerCase()) return false;
    } else if (isCompoundKey(item, key, val)) {
      // e.g. { projectNo_stream_fontColor: { projectNo, stream, fontColor } }
      if (!matchesWhere(item, val)) return false;
    } else if (typeof val === 'object' && val !== null) {
      const objVal = val as any;
      if (objVal.in && Array.isArray(objVal.in)) {
        if (!objVal.in.includes(item[key])) return false;
      } else if (objVal.gt !== undefined) {
        if (!(item[key] > objVal.gt)) return false;
      } else if (objVal.gte !== undefined) {
        if (!(item[key] >= objVal.gte)) return false;
      } else if (objVal.lt !== undefined) {
        if (!(item[key] < objVal.lt)) return false;
      } else if (objVal.lte !== undefined) {
        if (!(item[key] <= objVal.lte)) return false;
      } else if (item[key] !== val) {
        return false;
      }
    } else {
      if (item[key] !== val) return false;
    }
  }

  return true;
}

function populateUser(user: any, include?: any, select?: any) {
  if (!user) return null;
  const result: any = { ...user };

  if (include?.roles || select?.roles) {
    const rolesInclude = include?.roles?.include || select?.roles?.include;
    const userRoleLinks = Array.from(store.userRoles.values()).filter((ur) => ur.userId === user.id);
    result.roles = userRoleLinks.map((ur) => {
      const urObj: any = { ...ur };
      if (rolesInclude?.role) {
        urObj.role = store.roles.get(ur.roleId) || null;
      }
      return urObj;
    });
  }

  if (select) {
    const selected: any = {};
    for (const key of Object.keys(select)) {
      if (select[key]) {
        selected[key] = result[key];
      }
    }
    return selected;
  }

  return result;
}

function populateDepartment(dept: any, include?: any) {
  if (!dept) return null;
  const result: any = { ...dept };

  if (include?.activeVersion) {
    const activeVersion = dept.activeVersionId ? store.fileVersions.get(dept.activeVersionId) : null;
    if (activeVersion) {
      const vObj: any = { ...activeVersion };
      if (include.activeVersion?.include?.uploadedBy) {
        const u = activeVersion.uploadedById ? store.users.get(activeVersion.uploadedById) : null;
        vObj.uploadedBy = u ? { fullName: u.fullName, email: u.email } : null;
      }
      result.activeVersion = vObj;
    } else {
      result.activeVersion = null;
    }
  }

  if (include?.versions) {
    result.versions = Array.from(store.fileVersions.values()).filter((v) => v.departmentId === dept.id);
  }

  return result;
}

export class MockPrismaClient {
  user = {
    findUnique: async (args: { where: any; include?: any; select?: any }) => {
      for (const u of store.users.values()) {
        if (matchesWhere(u, args.where)) {
          return populateUser(u, args.include, args.select);
        }
      }
      return null;
    },
    findFirst: async (args: { where: any; include?: any; select?: any }) => {
      for (const u of store.users.values()) {
        if (matchesWhere(u, args.where)) {
          return populateUser(u, args.include, args.select);
        }
      }
      return null;
    },
    findMany: async (args: { where?: any; include?: any; select?: any; orderBy?: any } = {}) => {
      let list = Array.from(store.users.values());
      if (args.where) {
        list = list.filter((u) => matchesWhere(u, args.where));
      }
      if (args.orderBy?.createdAt === 'asc') {
        list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      }
      return list.map((u) => populateUser(u, args.include, args.select));
    },
    create: async (args: { data: any; include?: any; select?: any }) => {
      const id = args.data.id || `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const user = {
        id,
        email: args.data.email,
        fullName: args.data.fullName || args.data.email.split('@')[0],
        passwordHash: args.data.passwordHash,
        status: args.data.status || 'ACTIVE',
        isActive: args.data.isActive ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.users.set(id, user);

      if (args.data.roles?.create) {
        const createObj = args.data.roles.create;
        const roleId = createObj.roleId;
        if (roleId) {
          const urId = `ur-${id}-${roleId}`;
          store.userRoles.set(urId, {
            id: urId,
            userId: id,
            roleId,
            createdAt: new Date(),
          });
        }
      }

      return populateUser(user, args.include, args.select);
    },
    update: async (args: { where: any; data: any; include?: any; select?: any }) => {
      for (const u of store.users.values()) {
        if (matchesWhere(u, args.where)) {
          const updated = { ...u, ...args.data, updatedAt: new Date() };
          store.users.set(u.id, updated);
          return populateUser(updated, args.include, args.select);
        }
      }
      throw new Error('User not found');
    },
    upsert: async (args: { where: any; update: any; create: any; include?: any; select?: any }) => {
      for (const u of store.users.values()) {
        if (matchesWhere(u, args.where)) {
          const updated = { ...u, ...args.update, updatedAt: new Date() };
          store.users.set(u.id, updated);
          return populateUser(updated, args.include, args.select);
        }
      }
      const id = args.create.id || `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const user = {
        id,
        email: args.create.email,
        fullName: args.create.fullName || args.create.email.split('@')[0],
        passwordHash: args.create.passwordHash,
        status: args.create.status || 'ACTIVE',
        isActive: args.create.isActive ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.users.set(id, user);
      return populateUser(user, args.include, args.select);
    },
    delete: async (args: { where: any }) => {
      for (const [id, u] of store.users.entries()) {
        if (matchesWhere(u, args.where)) {
          store.users.delete(id);
          // Delete related userRoles
          for (const [urId, ur] of store.userRoles.entries()) {
            if (ur.userId === id) store.userRoles.delete(urId);
          }
          return u;
        }
      }
      throw new Error('User not found');
    },
    count: async () => store.users.size,
  };

  role = {
    findUnique: async (args: { where: any }) => {
      for (const r of store.roles.values()) {
        if (matchesWhere(r, args.where)) return { ...r };
      }
      return null;
    },
    findFirst: async (args: { where: any }) => {
      for (const r of store.roles.values()) {
        if (matchesWhere(r, args.where)) return { ...r };
      }
      return null;
    },
    findMany: async () => Array.from(store.roles.values()).map((r) => ({ ...r })),
    create: async (args: { data: any }) => {
      const id = args.data.id || `role-${Date.now()}`;
      const role = { ...args.data, id, createdAt: new Date() };
      store.roles.set(id, role);
      return role;
    },
    upsert: async (args: { where: any; update: any; create: any }) => {
      for (const r of store.roles.values()) {
        if (matchesWhere(r, args.where)) {
          const updated = { ...r, ...args.update };
          store.roles.set(r.id, updated);
          return updated;
        }
      }
      const id = args.create.id || `role-${Date.now()}`;
      const role = { ...args.create, id, createdAt: new Date() };
      store.roles.set(id, role);
      return role;
    },
  };

  userRole = {
    findMany: async (args: { where?: any } = {}) => {
      let list = Array.from(store.userRoles.values());
      if (args.where) list = list.filter((ur) => matchesWhere(ur, args.where));
      return list;
    },
    create: async (args: { data: any }) => {
      const id = args.data.id || `ur-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const ur = { ...args.data, id, createdAt: new Date() };
      store.userRoles.set(id, ur);
      return ur;
    },
    createMany: async (args: { data: any[] }) => {
      for (const item of args.data) {
        const id = item.id || `ur-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        store.userRoles.set(id, { ...item, id, createdAt: new Date() });
      }
      return { count: args.data.length };
    },
    deleteMany: async (args: { where?: any }) => {
      let count = 0;
      for (const [id, ur] of store.userRoles.entries()) {
        if (!args.where || matchesWhere(ur, args.where)) {
          store.userRoles.delete(id);
          count++;
        }
      }
      return { count };
    },
    upsert: async (args: { where: any; update: any; create: any }) => {
      for (const ur of store.userRoles.values()) {
        if (matchesWhere(ur, args.where)) {
          const updated = { ...ur, ...args.update };
          store.userRoles.set(ur.id, updated);
          return updated;
        }
      }
      const id = args.create.id || `ur-${Date.now()}`;
      const ur = { ...args.create, id, createdAt: new Date() };
      store.userRoles.set(id, ur);
      return ur;
    },
  };

  department = {
    findUnique: async (args: { where: any; include?: any }) => {
      for (const d of store.departments.values()) {
        if (matchesWhere(d, args.where)) {
          return populateDepartment(d, args.include);
        }
      }
      return null;
    },
    findFirst: async (args: { where: any; include?: any }) => {
      for (const d of store.departments.values()) {
        if (matchesWhere(d, args.where)) {
          return populateDepartment(d, args.include);
        }
      }
      return null;
    },
    findMany: async (args: { where?: any; include?: any; orderBy?: any } = {}) => {
      let list = Array.from(store.departments.values());
      if (args.where) list = list.filter((d) => matchesWhere(d, args.where));
      return list.map((d) => populateDepartment(d, args.include));
    },
    upsert: async (args: { where: any; update: any; create: any; include?: any }) => {
      for (const d of store.departments.values()) {
        if (matchesWhere(d, args.where)) {
          const updated = { ...d, ...args.update, updatedAt: new Date() };
          store.departments.set(d.id, updated);
          return populateDepartment(updated, args.include);
        }
      }
      const id = args.create.id || `dept-${Date.now()}`;
      const created = { ...args.create, id, createdAt: new Date(), updatedAt: new Date() };
      store.departments.set(id, created);
      return populateDepartment(created, args.include);
    },
    update: async (args: { where: any; data: any; include?: any }) => {
      for (const d of store.departments.values()) {
        if (matchesWhere(d, args.where)) {
          const updated = { ...d, ...args.data, updatedAt: new Date() };
          store.departments.set(d.id, updated);
          return populateDepartment(updated, args.include);
        }
      }
      throw new Error('Department not found');
    },
  };

  fileVersion = {
    findUnique: async (args: { where: any }) => {
      for (const v of store.fileVersions.values()) {
        if (matchesWhere(v, args.where)) return { ...v };
      }
      return null;
    },
    findFirst: async (args: { where: any }) => {
      for (const v of store.fileVersions.values()) {
        if (matchesWhere(v, args.where)) return { ...v };
      }
      return null;
    },
    findMany: async (args: { where?: any } = {}) => {
      let list = Array.from(store.fileVersions.values());
      if (args.where) list = list.filter((v) => matchesWhere(v, args.where));
      return list;
    },
    create: async (args: { data: any }) => {
      const id = args.data.id || `fv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const fv = {
        ...args.data,
        id,
        createdAt: new Date(),
        uploadedAt: args.data.uploadedAt || new Date(),
      };
      store.fileVersions.set(id, fv);
      return fv;
    },
    update: async (args: { where: any; data: any }) => {
      for (const v of store.fileVersions.values()) {
        if (matchesWhere(v, args.where)) {
          const updated = { ...v, ...args.data };
          store.fileVersions.set(v.id, updated);
          return updated;
        }
      }
      throw new Error('FileVersion not found');
    },
  };

  auditLog = {
    create: async (args: { data: any }) => {
      const log = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        ...args.data,
        createdAt: new Date(),
      };
      store.auditLogs.push(log);
      return log;
    },
    findMany: async () => [...store.auditLogs],
  };

  mr11Run = {
    findFirst: async (args: { where?: any; orderBy?: any } = {}) => {
      let list = [...store.mr11Runs];
      if (args.where) list = list.filter((r) => matchesWhere(r, args.where));
      if (list.length === 0) return null;
      if (args.orderBy?.generatedAt === 'desc') {
        return { ...list[list.length - 1] };
      }
      return { ...list[0] };
    },
    findMany: async (args: { where?: any; orderBy?: any } = {}) => {
      let list = [...store.mr11Runs];
      if (args.where) list = list.filter((r) => matchesWhere(r, args.where));
      return list;
    },
    create: async (args: { data: any }) => {
      const run = {
        id: args.data.id || `run-${Date.now()}`,
        generatedAt: args.data.generatedAt ? new Date(args.data.generatedAt) : new Date(),
        status: args.data.status || Mr11Status.READY,
        sourceSnapshot: args.data.sourceSnapshot || {},
        recordCount: args.data.recordCount || 0,
        records: args.data.records || [],
      };
      store.mr11Runs.push(run);
      return run;
    },
  };

  mr11Config = {
    findUnique: async (args: { where: any }) => {
      const cfg = store.mr11Config.get(args.where.id || 'singleton');
      return cfg ? { ...cfg } : null;
    },
    upsert: async (args: { where: any; update: any; create: any }) => {
      const id = args.where.id || 'singleton';
      const existing = store.mr11Config.get(id);
      if (existing) {
        const updated = { ...existing, ...args.update, updatedAt: new Date() };
        store.mr11Config.set(id, updated);
        return updated;
      }
      const created = { id, ...args.create, updatedAt: new Date() };
      store.mr11Config.set(id, created);
      return created;
    },
    update: async (args: { where: any; data: any }) => {
      const id = args.where.id || 'singleton';
      const existing = store.mr11Config.get(id) || { id, visibleColumns: [] };
      const updated = { ...existing, ...args.data, updatedAt: new Date() };
      store.mr11Config.set(id, updated);
      return updated;
    },
  };

  planningSeriesHistory = {
    findMany: async (args: { where?: any; orderBy?: any } = {}) => {
      let list = Array.from(store.planningSeriesHistory.values());
      if (args.where) list = list.filter((p) => matchesWhere(p, args.where));
      return list;
    },
    upsert: async (args: { where: any; update: any; create: any }) => {
      const key = `${args.create.projectNo}_${args.create.stream}_${args.create.fontColor}_${args.create.seriesNumber}`;
      const existing = store.planningSeriesHistory.get(key);
      if (existing) {
        const updated = { ...existing, ...args.update, updatedAt: new Date() };
        store.planningSeriesHistory.set(key, updated);
        return updated;
      }
      const created = {
        id: `psh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        ...args.create,
        detectedAt: new Date(),
        updatedAt: new Date(),
      };
      store.planningSeriesHistory.set(key, created);
      return created;
    },
  };

  planningProjectQuantityTracker = {
    findMany: async (args: { where?: any; orderBy?: any } = {}) => {
      let list = Array.from(store.planningProjectQuantityTrackers.values());
      if (args.where) list = list.filter((t) => matchesWhere(t, args.where));
      return list;
    },
    findUnique: async (args: { where: any }) => {
      for (const t of store.planningProjectQuantityTrackers.values()) {
        if (matchesWhere(t, args.where)) return { ...t };
      }
      return null;
    },
    create: async (args: { data: any }) => {
      const key = `${args.data.projectNo}_${args.data.stream}_${args.data.fontColor}`;
      const tracker = {
        id: `ppqt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        ...args.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.planningProjectQuantityTrackers.set(key, tracker);
      return tracker;
    },
    update: async (args: { where: any; data: any }) => {
      for (const [k, t] of store.planningProjectQuantityTrackers.entries()) {
        if (matchesWhere(t, args.where)) {
          const updated = { ...t, ...args.data, updatedAt: new Date() };
          store.planningProjectQuantityTrackers.set(k, updated);
          return updated;
        }
      }
      throw new Error('Tracker not found');
    },
  };

  productionSeriesHistory = {
    findMany: async (args: { where?: any; orderBy?: any } = {}) => {
      let list = Array.from(store.productionSeriesHistory.values());
      if (args.where) list = list.filter((p) => matchesWhere(p, args.where));
      return list;
    },
    upsert: async (args: { where: any; update: any; create: any }) => {
      const key = `${args.create.projectShortname}_${args.create.stream}_${args.create.fontColor}_${args.create.seriesNumber}`;
      const existing = store.productionSeriesHistory.get(key);
      if (existing) {
        const updated = { ...existing, ...args.update, updatedAt: new Date() };
        store.productionSeriesHistory.set(key, updated);
        return updated;
      }
      const created = {
        id: `prsh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        ...args.create,
        detectedAt: new Date(),
        updatedAt: new Date(),
      };
      store.productionSeriesHistory.set(key, created);
      return created;
    },
  };

  async $transaction<T>(action: (tx: any) => Promise<T>): Promise<T> {
    return await action(this);
  }

  async $disconnect() {}
}

/** Replaces this instance's users and role links with the database's copy (server/db/supabase.ts). */
export function replaceUsers(users: any[], userRoles: any[]): void {
  store.users.clear();
  store.userRoles.clear();
  for (const u of users) store.users.set(u.id, u);
  for (const ur of userRoles) store.userRoles.set(ur.id, ur);
}

/** The MR11 engine's running history, which is saved with each MR11 run. */
export function exportEngineHistory() {
  return {
    planningSeriesHistory: [...store.planningSeriesHistory.values()],
    planningProjectQuantityTrackers: [...store.planningProjectQuantityTrackers.values()],
    productionSeriesHistory: [...store.productionSeriesHistory.values()],
  };
}

/** Restores the history saved by exportEngineHistory, keyed the same way as the upserts above. */
export function importEngineHistory(history: ReturnType<typeof exportEngineHistory>): void {
  const load = (map: Map<string, any>, rows: any[] | undefined, keyOf: (r: any) => string) => {
    map.clear();
    for (const r of rows || []) map.set(keyOf(r), r);
  };
  load(store.planningSeriesHistory, history.planningSeriesHistory, (r) => `${r.projectNo}_${r.stream}_${r.fontColor}_${r.seriesNumber}`);
  load(store.planningProjectQuantityTrackers, history.planningProjectQuantityTrackers, (r) => `${r.projectNo}_${r.stream}_${r.fontColor}`);
  load(store.productionSeriesHistory, history.productionSeriesHistory, (r) => `${r.projectShortname}_${r.stream}_${r.fontColor}_${r.seriesNumber}`);
}

export const PrismaClient = MockPrismaClient;
export type PrismaClient = MockPrismaClient;
export const prisma = new MockPrismaClient();
export default prisma;

// Support both ESM and CJS consumers
const g = globalThis as any;
if (typeof g.module !== 'undefined' && g.module.exports) {
  g.module.exports = {
    PrismaClient: MockPrismaClient,
    MockPrismaClient,
    prisma,
    RoleCode,
    Mr11Status,
    FileVersionStatus,
    default: prisma,
  };
}

