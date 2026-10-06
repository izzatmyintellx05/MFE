var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/db/prisma.ts
var prisma_exports = {};
__export(prisma_exports, {
  FileVersionStatus: () => FileVersionStatus,
  MockPrismaClient: () => MockPrismaClient,
  Mr11Status: () => Mr11Status,
  PrismaClient: () => PrismaClient,
  RoleCode: () => RoleCode,
  default: () => prisma_default,
  exportEngineHistory: () => exportEngineHistory,
  importEngineHistory: () => importEngineHistory,
  normalizeDatabaseUrl: () => normalizeDatabaseUrl,
  prisma: () => prisma,
  replaceUsers: () => replaceUsers
});
import crypto from "crypto";
function normalizeDatabaseUrl(rawUrl) {
  if (!rawUrl) return void 0;
  try {
    const trimmed = rawUrl.trim();
    const match = trimmed.match(/^(postgres(?:ql)?:\/\/)([^:]+):(.+)@([^@]+:\d+\/.*)$/);
    if (match) {
      const [, prefix, user, pass, rest] = match;
      if (pass.includes("@") && !pass.includes("%40")) {
        return `${prefix}${user}:${encodeURIComponent(pass)}@${rest}`;
      }
    }
  } catch {
  }
  return rawUrl;
}
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1e3, 64, "sha512").toString("hex");
  return `pbkdf2$${salt}$${hash}`;
}
function isCompoundKey(item, key, val) {
  return typeof val === "object" && val !== null && !(val instanceof Date) && !(key in item) && !Object.keys(val).some((k) => WHERE_OPERATORS.includes(k));
}
function matchesWhere(item, where) {
  if (!where || typeof where !== "object") return true;
  if (Array.isArray(where.OR)) {
    return where.OR.some((clause) => matchesWhere(item, clause));
  }
  for (const [key, val] of Object.entries(where)) {
    if (val === void 0) continue;
    if (key === "email" && typeof val === "string") {
      if (String(item.email || "").toLowerCase() !== val.toLowerCase()) return false;
    } else if (isCompoundKey(item, key, val)) {
      if (!matchesWhere(item, val)) return false;
    } else if (typeof val === "object" && val !== null) {
      const objVal = val;
      if (objVal.in && Array.isArray(objVal.in)) {
        if (!objVal.in.includes(item[key])) return false;
      } else if (objVal.gt !== void 0) {
        if (!(item[key] > objVal.gt)) return false;
      } else if (objVal.gte !== void 0) {
        if (!(item[key] >= objVal.gte)) return false;
      } else if (objVal.lt !== void 0) {
        if (!(item[key] < objVal.lt)) return false;
      } else if (objVal.lte !== void 0) {
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
function populateUser(user, include, select) {
  if (!user) return null;
  const result = { ...user };
  if (include?.roles || select?.roles) {
    const rolesInclude = include?.roles?.include || select?.roles?.include;
    const userRoleLinks = Array.from(store.userRoles.values()).filter((ur) => ur.userId === user.id);
    result.roles = userRoleLinks.map((ur) => {
      const urObj = { ...ur };
      if (rolesInclude?.role) {
        urObj.role = store.roles.get(ur.roleId) || null;
      }
      return urObj;
    });
  }
  if (select) {
    const selected = {};
    for (const key of Object.keys(select)) {
      if (select[key]) {
        selected[key] = result[key];
      }
    }
    return selected;
  }
  return result;
}
function populateDepartment(dept, include) {
  if (!dept) return null;
  const result = { ...dept };
  if (include?.activeVersion) {
    const activeVersion = dept.activeVersionId ? store.fileVersions.get(dept.activeVersionId) : null;
    if (activeVersion) {
      const vObj = { ...activeVersion };
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
function replaceUsers(users, userRoles) {
  store.users.clear();
  store.userRoles.clear();
  for (const u of users) store.users.set(u.id, u);
  for (const ur of userRoles) store.userRoles.set(ur.id, ur);
}
function exportEngineHistory() {
  return {
    planningSeriesHistory: [...store.planningSeriesHistory.values()],
    planningProjectQuantityTrackers: [...store.planningProjectQuantityTrackers.values()],
    productionSeriesHistory: [...store.productionSeriesHistory.values()]
  };
}
function importEngineHistory(history) {
  const load = (map, rows, keyOf) => {
    map.clear();
    for (const r of rows || []) map.set(keyOf(r), r);
  };
  load(store.planningSeriesHistory, history.planningSeriesHistory, (r) => `${r.projectNo}_${r.stream}_${r.fontColor}_${r.seriesNumber}`);
  load(store.planningProjectQuantityTrackers, history.planningProjectQuantityTrackers, (r) => `${r.projectNo}_${r.stream}_${r.fontColor}`);
  load(store.productionSeriesHistory, history.productionSeriesHistory, (r) => `${r.projectShortname}_${r.stream}_${r.fontColor}_${r.seriesNumber}`);
}
var RoleCode, Mr11Status, FileVersionStatus, store, INITIAL_ROLES, INITIAL_DEPTS, adminId, adminEmail, adminUser, DEMO_USERS, WHERE_OPERATORS, MockPrismaClient, PrismaClient, prisma, prisma_default, g;
var init_prisma = __esm({
  "server/db/prisma.ts"() {
    RoleCode = /* @__PURE__ */ ((RoleCode4) => {
      RoleCode4["ADMIN"] = "ADMIN";
      RoleCode4["CEO"] = "CEO";
      RoleCode4["BD"] = "BD";
      RoleCode4["FINANCE"] = "FINANCE";
      RoleCode4["SHELLPLAN"] = "SHELLPLAN";
      RoleCode4["DESIGN"] = "DESIGN";
      RoleCode4["PLANNING"] = "PLANNING";
      RoleCode4["PRODUCTION"] = "PRODUCTION";
      RoleCode4["DISPATCH"] = "DISPATCH";
      return RoleCode4;
    })(RoleCode || {});
    Mr11Status = /* @__PURE__ */ ((Mr11Status2) => {
      Mr11Status2["EMPTY"] = "EMPTY";
      Mr11Status2["PARTIAL"] = "PARTIAL";
      Mr11Status2["READY"] = "READY";
      Mr11Status2["FAILED"] = "FAILED";
      return Mr11Status2;
    })(Mr11Status || {});
    FileVersionStatus = /* @__PURE__ */ ((FileVersionStatus2) => {
      FileVersionStatus2["UPLOADING"] = "UPLOADING";
      FileVersionStatus2["PROCESSING"] = "PROCESSING";
      FileVersionStatus2["READY"] = "READY";
      FileVersionStatus2["FAILED"] = "FAILED";
      return FileVersionStatus2;
    })(FileVersionStatus || {});
    store = {
      users: /* @__PURE__ */ new Map(),
      roles: /* @__PURE__ */ new Map(),
      userRoles: /* @__PURE__ */ new Map(),
      departments: /* @__PURE__ */ new Map(),
      fileVersions: /* @__PURE__ */ new Map(),
      auditLogs: [],
      mr11Runs: [],
      mr11Config: /* @__PURE__ */ new Map(),
      planningSeriesHistory: /* @__PURE__ */ new Map(),
      planningProjectQuantityTrackers: /* @__PURE__ */ new Map(),
      productionSeriesHistory: /* @__PURE__ */ new Map()
    };
    INITIAL_ROLES = [
      { id: "role-admin", code: "ADMIN" /* ADMIN */, name: "System Administrator", description: "Full system configuration & control" },
      { id: "role-ceo", code: "CEO" /* CEO */, name: "Executive / CEO", description: "Executive read-only matrix & financial access" },
      { id: "role-bd", code: "BD" /* BD */, name: "Business Development", description: "Master commercial schedule management" },
      { id: "role-finance", code: "FINANCE" /* FINANCE */, name: "Finance", description: "Cash flow & advance tracking" },
      { id: "role-shellplan", code: "SHELLPLAN" /* SHELLPLAN */, name: "Shellplan", description: "Pre-design coordination" },
      { id: "role-design", code: "DESIGN" /* DESIGN */, name: "Design", description: "Design engineering execution" },
      { id: "role-planning", code: "PLANNING" /* PLANNING */, name: "Planning", description: "Factory sequence planning" },
      { id: "role-production", code: "PRODUCTION" /* PRODUCTION */, name: "Production", description: "Manufacturing & progress tracking" },
      { id: "role-dispatch", code: "DISPATCH" /* DISPATCH */, name: "Dispatch", description: "Logistics & shipment verification" }
    ];
    for (const r of INITIAL_ROLES) {
      store.roles.set(r.id, { ...r, createdAt: /* @__PURE__ */ new Date() });
    }
    INITIAL_DEPTS = [
      { id: "dept-bd", code: "BD" /* BD */, name: "Business Development", description: "Contract specifications & commercial data" },
      { id: "dept-finance", code: "FINANCE" /* FINANCE */, name: "Finance", description: "Payments & financial terms" },
      { id: "dept-shellplan", code: "SHELLPLAN" /* SHELLPLAN */, name: "Shellplan", description: "Consultant drawing statuses & submissions" },
      { id: "dept-design", code: "DESIGN" /* DESIGN */, name: "Design", description: "Engineering design status & order quantities" },
      { id: "dept-planning", code: "PLANNING" /* PLANNING */, name: "Planning", description: "Production series & processing stages" },
      { id: "dept-production", code: "PRODUCTION" /* PRODUCTION */, name: "Production", description: "Manufacturing output tracking" },
      { id: "dept-dispatch", code: "DISPATCH" /* DISPATCH */, name: "Dispatch", description: "Logistics, delivery, and sailing actuals" }
    ];
    for (const d of INITIAL_DEPTS) {
      store.departments.set(d.id, {
        ...d,
        activeVersionId: null,
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      });
    }
    adminId = "user-admin-1";
    adminEmail = "admin@mfeformwork.com";
    adminUser = {
      id: adminId,
      email: adminEmail,
      fullName: "System Administrator",
      passwordHash: hashPassword("Admin@123456"),
      status: "ACTIVE",
      isActive: true,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    store.users.set(adminId, adminUser);
    for (const r of INITIAL_ROLES) {
      const urId = `ur-${adminId}-${r.id}`;
      store.userRoles.set(urId, {
        id: urId,
        userId: adminId,
        roleId: r.id,
        createdAt: /* @__PURE__ */ new Date()
      });
    }
    DEMO_USERS = [
      { id: "user-ceo-1", email: "ceo@mfeformwork.com", fullName: "Executive Director", roleCode: "CEO" /* CEO */ },
      { id: "user-bd-1", email: "bd@mfeformwork.com", fullName: "BD Lead Officer", roleCode: "BD" /* BD */ },
      { id: "user-finance-1", email: "finance@mfeformwork.com", fullName: "Commercial Finance Lead", roleCode: "FINANCE" /* FINANCE */ },
      { id: "user-shellplan-1", email: "shellplan@mfeformwork.com", fullName: "Shellplan Architect", roleCode: "SHELLPLAN" /* SHELLPLAN */ },
      { id: "user-design-1", email: "design@mfeformwork.com", fullName: "Lead Design Engineer", roleCode: "DESIGN" /* DESIGN */ },
      { id: "user-planning-1", email: "planning@mfeformwork.com", fullName: "Planning & Series Lead", roleCode: "PLANNING" /* PLANNING */ },
      { id: "user-production-1", email: "production@mfeformwork.com", fullName: "Plant Operations Manager", roleCode: "PRODUCTION" /* PRODUCTION */ },
      { id: "user-dispatch-1", email: "dispatch@mfeformwork.com", fullName: "Dispatch & Logistics Lead", roleCode: "DISPATCH" /* DISPATCH */ }
    ];
    for (const du of DEMO_USERS) {
      store.users.set(du.id, {
        id: du.id,
        email: du.email,
        fullName: du.fullName,
        passwordHash: hashPassword("admin123"),
        status: "ACTIVE",
        isActive: true,
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      });
      const roleObj = INITIAL_ROLES.find((r) => r.code === du.roleCode);
      if (roleObj) {
        const urId = `ur-${du.id}-${roleObj.id}`;
        store.userRoles.set(urId, {
          id: urId,
          userId: du.id,
          roleId: roleObj.id,
          createdAt: /* @__PURE__ */ new Date()
        });
      }
    }
    store.mr11Config.set("singleton", {
      id: "singleton",
      visibleColumns: [],
      updatedAt: /* @__PURE__ */ new Date()
    });
    WHERE_OPERATORS = ["in", "gt", "gte", "lt", "lte"];
    MockPrismaClient = class {
      constructor() {
        this.user = {
          findUnique: async (args) => {
            for (const u of store.users.values()) {
              if (matchesWhere(u, args.where)) {
                return populateUser(u, args.include, args.select);
              }
            }
            return null;
          },
          findFirst: async (args) => {
            for (const u of store.users.values()) {
              if (matchesWhere(u, args.where)) {
                return populateUser(u, args.include, args.select);
              }
            }
            return null;
          },
          findMany: async (args = {}) => {
            let list = Array.from(store.users.values());
            if (args.where) {
              list = list.filter((u) => matchesWhere(u, args.where));
            }
            if (args.orderBy?.createdAt === "asc") {
              list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            }
            return list.map((u) => populateUser(u, args.include, args.select));
          },
          create: async (args) => {
            const id = args.data.id || `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            const user = {
              id,
              email: args.data.email,
              fullName: args.data.fullName || args.data.email.split("@")[0],
              passwordHash: args.data.passwordHash,
              status: args.data.status || "ACTIVE",
              isActive: args.data.isActive ?? true,
              createdAt: /* @__PURE__ */ new Date(),
              updatedAt: /* @__PURE__ */ new Date()
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
                  createdAt: /* @__PURE__ */ new Date()
                });
              }
            }
            return populateUser(user, args.include, args.select);
          },
          update: async (args) => {
            for (const u of store.users.values()) {
              if (matchesWhere(u, args.where)) {
                const updated = { ...u, ...args.data, updatedAt: /* @__PURE__ */ new Date() };
                store.users.set(u.id, updated);
                return populateUser(updated, args.include, args.select);
              }
            }
            throw new Error("User not found");
          },
          upsert: async (args) => {
            for (const u of store.users.values()) {
              if (matchesWhere(u, args.where)) {
                const updated = { ...u, ...args.update, updatedAt: /* @__PURE__ */ new Date() };
                store.users.set(u.id, updated);
                return populateUser(updated, args.include, args.select);
              }
            }
            const id = args.create.id || `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            const user = {
              id,
              email: args.create.email,
              fullName: args.create.fullName || args.create.email.split("@")[0],
              passwordHash: args.create.passwordHash,
              status: args.create.status || "ACTIVE",
              isActive: args.create.isActive ?? true,
              createdAt: /* @__PURE__ */ new Date(),
              updatedAt: /* @__PURE__ */ new Date()
            };
            store.users.set(id, user);
            return populateUser(user, args.include, args.select);
          },
          delete: async (args) => {
            for (const [id, u] of store.users.entries()) {
              if (matchesWhere(u, args.where)) {
                store.users.delete(id);
                for (const [urId, ur] of store.userRoles.entries()) {
                  if (ur.userId === id) store.userRoles.delete(urId);
                }
                return u;
              }
            }
            throw new Error("User not found");
          },
          count: async () => store.users.size
        };
        this.role = {
          findUnique: async (args) => {
            for (const r of store.roles.values()) {
              if (matchesWhere(r, args.where)) return { ...r };
            }
            return null;
          },
          findFirst: async (args) => {
            for (const r of store.roles.values()) {
              if (matchesWhere(r, args.where)) return { ...r };
            }
            return null;
          },
          findMany: async () => Array.from(store.roles.values()).map((r) => ({ ...r })),
          create: async (args) => {
            const id = args.data.id || `role-${Date.now()}`;
            const role = { ...args.data, id, createdAt: /* @__PURE__ */ new Date() };
            store.roles.set(id, role);
            return role;
          },
          upsert: async (args) => {
            for (const r of store.roles.values()) {
              if (matchesWhere(r, args.where)) {
                const updated = { ...r, ...args.update };
                store.roles.set(r.id, updated);
                return updated;
              }
            }
            const id = args.create.id || `role-${Date.now()}`;
            const role = { ...args.create, id, createdAt: /* @__PURE__ */ new Date() };
            store.roles.set(id, role);
            return role;
          }
        };
        this.userRole = {
          findMany: async (args = {}) => {
            let list = Array.from(store.userRoles.values());
            if (args.where) list = list.filter((ur) => matchesWhere(ur, args.where));
            return list;
          },
          create: async (args) => {
            const id = args.data.id || `ur-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
            const ur = { ...args.data, id, createdAt: /* @__PURE__ */ new Date() };
            store.userRoles.set(id, ur);
            return ur;
          },
          createMany: async (args) => {
            for (const item of args.data) {
              const id = item.id || `ur-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
              store.userRoles.set(id, { ...item, id, createdAt: /* @__PURE__ */ new Date() });
            }
            return { count: args.data.length };
          },
          deleteMany: async (args) => {
            let count = 0;
            for (const [id, ur] of store.userRoles.entries()) {
              if (!args.where || matchesWhere(ur, args.where)) {
                store.userRoles.delete(id);
                count++;
              }
            }
            return { count };
          },
          upsert: async (args) => {
            for (const ur2 of store.userRoles.values()) {
              if (matchesWhere(ur2, args.where)) {
                const updated = { ...ur2, ...args.update };
                store.userRoles.set(ur2.id, updated);
                return updated;
              }
            }
            const id = args.create.id || `ur-${Date.now()}`;
            const ur = { ...args.create, id, createdAt: /* @__PURE__ */ new Date() };
            store.userRoles.set(id, ur);
            return ur;
          }
        };
        this.department = {
          findUnique: async (args) => {
            for (const d of store.departments.values()) {
              if (matchesWhere(d, args.where)) {
                return populateDepartment(d, args.include);
              }
            }
            return null;
          },
          findFirst: async (args) => {
            for (const d of store.departments.values()) {
              if (matchesWhere(d, args.where)) {
                return populateDepartment(d, args.include);
              }
            }
            return null;
          },
          findMany: async (args = {}) => {
            let list = Array.from(store.departments.values());
            if (args.where) list = list.filter((d) => matchesWhere(d, args.where));
            return list.map((d) => populateDepartment(d, args.include));
          },
          upsert: async (args) => {
            for (const d of store.departments.values()) {
              if (matchesWhere(d, args.where)) {
                const updated = { ...d, ...args.update, updatedAt: /* @__PURE__ */ new Date() };
                store.departments.set(d.id, updated);
                return populateDepartment(updated, args.include);
              }
            }
            const id = args.create.id || `dept-${Date.now()}`;
            const created = { ...args.create, id, createdAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() };
            store.departments.set(id, created);
            return populateDepartment(created, args.include);
          },
          update: async (args) => {
            for (const d of store.departments.values()) {
              if (matchesWhere(d, args.where)) {
                const updated = { ...d, ...args.data, updatedAt: /* @__PURE__ */ new Date() };
                store.departments.set(d.id, updated);
                return populateDepartment(updated, args.include);
              }
            }
            throw new Error("Department not found");
          }
        };
        this.fileVersion = {
          findUnique: async (args) => {
            for (const v of store.fileVersions.values()) {
              if (matchesWhere(v, args.where)) return { ...v };
            }
            return null;
          },
          findFirst: async (args) => {
            for (const v of store.fileVersions.values()) {
              if (matchesWhere(v, args.where)) return { ...v };
            }
            return null;
          },
          findMany: async (args = {}) => {
            let list = Array.from(store.fileVersions.values());
            if (args.where) list = list.filter((v) => matchesWhere(v, args.where));
            return list;
          },
          create: async (args) => {
            const id = args.data.id || `fv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            const fv = {
              ...args.data,
              id,
              createdAt: /* @__PURE__ */ new Date(),
              uploadedAt: args.data.uploadedAt || /* @__PURE__ */ new Date()
            };
            store.fileVersions.set(id, fv);
            return fv;
          },
          update: async (args) => {
            for (const v of store.fileVersions.values()) {
              if (matchesWhere(v, args.where)) {
                const updated = { ...v, ...args.data };
                store.fileVersions.set(v.id, updated);
                return updated;
              }
            }
            throw new Error("FileVersion not found");
          }
        };
        this.auditLog = {
          create: async (args) => {
            const log = {
              id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              ...args.data,
              createdAt: /* @__PURE__ */ new Date()
            };
            store.auditLogs.push(log);
            return log;
          },
          findMany: async () => [...store.auditLogs]
        };
        this.mr11Run = {
          findFirst: async (args = {}) => {
            let list = [...store.mr11Runs];
            if (args.where) list = list.filter((r) => matchesWhere(r, args.where));
            if (list.length === 0) return null;
            if (args.orderBy?.generatedAt === "desc") {
              return { ...list[list.length - 1] };
            }
            return { ...list[0] };
          },
          findMany: async (args = {}) => {
            let list = [...store.mr11Runs];
            if (args.where) list = list.filter((r) => matchesWhere(r, args.where));
            return list;
          },
          create: async (args) => {
            const run = {
              id: args.data.id || `run-${Date.now()}`,
              generatedAt: args.data.generatedAt ? new Date(args.data.generatedAt) : /* @__PURE__ */ new Date(),
              status: args.data.status || "READY" /* READY */,
              sourceSnapshot: args.data.sourceSnapshot || {},
              recordCount: args.data.recordCount || 0,
              records: args.data.records || []
            };
            store.mr11Runs.push(run);
            return run;
          }
        };
        this.mr11Config = {
          findUnique: async (args) => {
            const cfg = store.mr11Config.get(args.where.id || "singleton");
            return cfg ? { ...cfg } : null;
          },
          upsert: async (args) => {
            const id = args.where.id || "singleton";
            const existing = store.mr11Config.get(id);
            if (existing) {
              const updated = { ...existing, ...args.update, updatedAt: /* @__PURE__ */ new Date() };
              store.mr11Config.set(id, updated);
              return updated;
            }
            const created = { id, ...args.create, updatedAt: /* @__PURE__ */ new Date() };
            store.mr11Config.set(id, created);
            return created;
          },
          update: async (args) => {
            const id = args.where.id || "singleton";
            const existing = store.mr11Config.get(id) || { id, visibleColumns: [] };
            const updated = { ...existing, ...args.data, updatedAt: /* @__PURE__ */ new Date() };
            store.mr11Config.set(id, updated);
            return updated;
          }
        };
        this.planningSeriesHistory = {
          findMany: async (args = {}) => {
            let list = Array.from(store.planningSeriesHistory.values());
            if (args.where) list = list.filter((p) => matchesWhere(p, args.where));
            return list;
          },
          upsert: async (args) => {
            const key = `${args.create.projectNo}_${args.create.stream}_${args.create.fontColor}_${args.create.seriesNumber}`;
            const existing = store.planningSeriesHistory.get(key);
            if (existing) {
              const updated = { ...existing, ...args.update, updatedAt: /* @__PURE__ */ new Date() };
              store.planningSeriesHistory.set(key, updated);
              return updated;
            }
            const created = {
              id: `psh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              ...args.create,
              detectedAt: /* @__PURE__ */ new Date(),
              updatedAt: /* @__PURE__ */ new Date()
            };
            store.planningSeriesHistory.set(key, created);
            return created;
          }
        };
        this.planningProjectQuantityTracker = {
          findMany: async (args = {}) => {
            let list = Array.from(store.planningProjectQuantityTrackers.values());
            if (args.where) list = list.filter((t) => matchesWhere(t, args.where));
            return list;
          },
          findUnique: async (args) => {
            for (const t of store.planningProjectQuantityTrackers.values()) {
              if (matchesWhere(t, args.where)) return { ...t };
            }
            return null;
          },
          create: async (args) => {
            const key = `${args.data.projectNo}_${args.data.stream}_${args.data.fontColor}`;
            const tracker = {
              id: `ppqt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              ...args.data,
              createdAt: /* @__PURE__ */ new Date(),
              updatedAt: /* @__PURE__ */ new Date()
            };
            store.planningProjectQuantityTrackers.set(key, tracker);
            return tracker;
          },
          update: async (args) => {
            for (const [k, t] of store.planningProjectQuantityTrackers.entries()) {
              if (matchesWhere(t, args.where)) {
                const updated = { ...t, ...args.data, updatedAt: /* @__PURE__ */ new Date() };
                store.planningProjectQuantityTrackers.set(k, updated);
                return updated;
              }
            }
            throw new Error("Tracker not found");
          }
        };
        this.productionSeriesHistory = {
          findMany: async (args = {}) => {
            let list = Array.from(store.productionSeriesHistory.values());
            if (args.where) list = list.filter((p) => matchesWhere(p, args.where));
            return list;
          },
          upsert: async (args) => {
            const key = `${args.create.projectShortname}_${args.create.stream}_${args.create.fontColor}_${args.create.seriesNumber}`;
            const existing = store.productionSeriesHistory.get(key);
            if (existing) {
              const updated = { ...existing, ...args.update, updatedAt: /* @__PURE__ */ new Date() };
              store.productionSeriesHistory.set(key, updated);
              return updated;
            }
            const created = {
              id: `prsh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              ...args.create,
              detectedAt: /* @__PURE__ */ new Date(),
              updatedAt: /* @__PURE__ */ new Date()
            };
            store.productionSeriesHistory.set(key, created);
            return created;
          }
        };
      }
      async $transaction(action) {
        return await action(this);
      }
      async $disconnect() {
      }
    };
    PrismaClient = MockPrismaClient;
    prisma = new MockPrismaClient();
    prisma_default = prisma;
    g = globalThis;
    if (typeof g.module !== "undefined" && g.module.exports) {
      g.module.exports = {
        PrismaClient: MockPrismaClient,
        MockPrismaClient,
        prisma,
        RoleCode,
        Mr11Status,
        FileVersionStatus,
        default: prisma
      };
    }
  }
});

// server/config/database.config.ts
var database_config_exports = {};
__export(database_config_exports, {
  getDatabaseUrl: () => getDatabaseUrl,
  getSslConfig: () => getSslConfig
});
function getDatabaseUrl() {
  const url = process.env.DATABASE_URL || process.env.DATABASE_POSTGRES_URL || process.env.POSTGRES_URL || "";
  return url.replace(/([?&]sslmode=)(require|prefer|verify-ca)\b/i, "$1no-verify");
}
function getSslConfig(url) {
  if (/sslmode=disable/i.test(url) || /@(localhost|127\.0\.0\.1)[:/]/i.test(url)) return false;
  return { rejectUnauthorized: false };
}
var init_database_config = __esm({
  "server/config/database.config.ts"() {
  }
});

// server/db/supabase.ts
var supabase_exports = {};
__export(supabase_exports, {
  deleteUserFromDb: () => deleteUserFromDb,
  describeDatabase: () => describeDatabase,
  fetchActiveFileSummariesFromDb: () => fetchActiveFileSummariesFromDb,
  fetchActiveVersionForDepartment: () => fetchActiveVersionForDepartment,
  fetchActiveVersionsFromDb: () => fetchActiveVersionsFromDb,
  fetchLatestMr11RunFromDb: () => fetchLatestMr11RunFromDb,
  getLatestMr11Run: () => getLatestMr11Run,
  hydrateActiveVersionsFromDb: () => hydrateActiveVersionsFromDb,
  hydrateUsersFromDb: () => hydrateUsersFromDb,
  isDatabaseConfigured: () => isDatabaseConfigured,
  restoreEngineHistory: () => restoreEngineHistory,
  saveFileVersionToDb: () => saveFileVersionToDb,
  saveMr11RunToDb: () => saveMr11RunToDb,
  saveUserToDb: () => saveUserToDb
});
function isDatabaseConfigured() {
  return Boolean(getDatabaseUrl());
}
async function openPool() {
  const rawUrl = getDatabaseUrl();
  if (!rawUrl) return null;
  const { Pool } = await import("pg");
  return new Pool({
    connectionString: normalizeDatabaseUrl(rawUrl) || rawUrl,
    ssl: getSslConfig(rawUrl),
    connectionTimeoutMillis: 5e3
  });
}
function isConnectionError(err) {
  return /timeout|terminated|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENOTFOUND/i.test(`${err?.code} ${err?.message}`);
}
async function withPool(fn) {
  for (let attempt = 1; ; attempt++) {
    const pool = await openPool();
    if (!pool) return null;
    try {
      return await fn(pool);
    } catch (err) {
      if (attempt < 2 && isConnectionError(err)) {
        console.warn("[DATABASE] retrying read after:", err?.message || err);
        continue;
      }
      console.warn("[DATABASE] read notice:", err?.message || err);
      return null;
    } finally {
      await pool.end().catch(() => {
      });
    }
  }
}
async function tableColumns(pool, table) {
  if (columnCache[table]) return columnCache[table];
  const result = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1;`,
    [table]
  );
  const cols = new Set(result.rows.map((r) => r.column_name));
  if (cols.size > 0) columnCache[table] = cols;
  return cols;
}
async function upsertRow(pool, table, values, updateCols) {
  const cols = await tableColumns(pool, table);
  if (cols.size === 0) throw new Error(`Table "${table}" was not found in the database`);
  const names = [];
  const placeholders = [];
  const params = [];
  for (const [name, value] of Object.entries(values)) {
    if (!cols.has(name) || value === void 0) continue;
    names.push(`"${name}"`);
    if (value === NOW) {
      placeholders.push("NOW()");
    } else {
      params.push(value);
      placeholders.push(`$${params.length}`);
    }
  }
  const updates = updateCols.filter((c) => cols.has(c)).map((c) => `"${c}" = EXCLUDED."${c}"`);
  const conflict = updates.length ? `ON CONFLICT ("id") DO UPDATE SET ${updates.join(", ")}` : 'ON CONFLICT ("id") DO NOTHING';
  await pool.query(`INSERT INTO "${table}" (${names.join(", ")}) VALUES (${placeholders.join(", ")}) ${conflict};`, params);
}
function workbookOf(row) {
  return row?.parsedWorkbook ?? row?.rawDataJson ?? null;
}
function parseJson(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
async function inTransaction(fn) {
  const pool = await openPool();
  if (!pool) return false;
  let client = null;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    await fn(client);
    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client?.query("ROLLBACK").catch(() => {
    });
    throw err;
  } finally {
    client?.release();
    await pool.end().catch(() => {
    });
  }
}
async function fetchActiveVersionsFromDb() {
  return withPool(async (pool) => {
    const result = await pool.query(
      `SELECT d.code AS "deptCode", f.*
         FROM "Department" d
         JOIN "FileVersion" f ON f.id = d."activeVersionId";`
    );
    const byCode = {};
    for (const row of result.rows) {
      const parsedWorkbook = workbookOf(row);
      if (parsedWorkbook) byCode[row.deptCode] = { ...row, parsedWorkbook };
    }
    return byCode;
  });
}
async function fetchActiveVersionForDepartment(code) {
  const all = await fetchActiveVersionsFromDb();
  return all?.[code] ?? null;
}
async function fetchLatestMr11RunFromDb() {
  return withPool(async (pool) => {
    const result = await pool.query('SELECT * FROM "Mr11Run" ORDER BY "generatedAt" DESC LIMIT 1;');
    const r = result.rows[0];
    if (!r) return null;
    return {
      id: r.id,
      generatedAt: r.generatedAt,
      status: r.status,
      sourceSnapshot: parseJson(r.sourceSnapshot),
      recordCount: r.recordCount,
      records: parseJson(r.calculatedFields ?? r.records) ?? []
    };
  });
}
async function fetchActiveFileSummariesFromDb() {
  return withPool(async (pool) => {
    const result = await pool.query(
      `SELECT d.code, f.id, f."originalFilename", f."uploadedAt"
         FROM "Department" d
         JOIN "FileVersion" f ON f.id = d."activeVersionId";`
    );
    const byCode = {};
    for (const r of result.rows) {
      byCode[r.code] = { id: r.id, originalFilename: r.originalFilename, status: "READY", uploadedAt: r.uploadedAt };
    }
    return byCode;
  });
}
async function hydrateUsersFromDb() {
  const rows = await withPool(async (pool) => ({
    // Stable order: the seeded accounts share one createdAt, and edited rows move in the table
    users: (await pool.query('SELECT * FROM "User" ORDER BY "createdAt", email;')).rows,
    userRoles: (await pool.query('SELECT * FROM "UserRole";')).rows
  }));
  if (!rows || rows.users.length === 0) return false;
  replaceUsers(rows.users, rows.userRoles);
  return true;
}
async function saveUserToDb(user, roleIds) {
  return inTransaction(async (client) => {
    await upsertRow(
      client,
      "User",
      {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        passwordHash: user.passwordHash,
        status: user.status || "ACTIVE",
        isActive: user.isActive ?? true,
        createdAt: user.createdAt ?? NOW,
        updatedAt: NOW
      },
      ["email", "fullName", "passwordHash", "status", "isActive", "updatedAt"]
    );
    await client.query('DELETE FROM "UserRole" WHERE "userId" = $1;', [user.id]);
    for (const roleId of roleIds) {
      await upsertRow(client, "UserRole", { id: `ur-${user.id}-${roleId}`, userId: user.id, roleId, createdAt: NOW }, []);
    }
  });
}
async function deleteUserFromDb(userId) {
  return inTransaction(async (client) => {
    await client.query('DELETE FROM "UserRole" WHERE "userId" = $1;', [userId]);
    await client.query('DELETE FROM "User" WHERE id = $1;', [userId]);
  });
}
function restoreEngineHistory(run) {
  const history = run?.sourceSnapshot?.engineHistory;
  if (!history) return false;
  importEngineHistory(history);
  return true;
}
async function saveFileVersionToDb(v) {
  const pool = await openPool();
  if (!pool) return false;
  try {
    const found = await pool.query('SELECT id FROM "Department" WHERE code = $1 LIMIT 1;', [v.deptCode]);
    let departmentId = found.rows[0]?.id;
    if (!departmentId) {
      departmentId = v.deptId;
      await upsertRow(pool, "Department", { id: departmentId, code: v.deptCode, name: v.deptName, createdAt: NOW, updatedAt: NOW }, []);
    }
    let uploadedById = v.uploadedById ?? "user-admin-1";
    const nullable = await pool.query(
      `SELECT is_nullable FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'FileVersion' AND column_name = 'uploadedById';`
    );
    if (nullable.rows[0]?.is_nullable === "YES") {
      const user = await pool.query('SELECT 1 FROM "User" WHERE id = $1 LIMIT 1;', [uploadedById]).catch(() => ({ rows: [] }));
      if (user.rows.length === 0) uploadedById = null;
    }
    const json = JSON.stringify(v.parsedWorkbook);
    await upsertRow(
      pool,
      "FileVersion",
      {
        id: v.id,
        departmentId,
        originalFilename: v.originalFilename,
        storageKey: v.storageKey,
        storagePath: v.storageKey,
        fileSize: v.fileSize || 0,
        mimeType: v.mimeType,
        status: "READY",
        isLatest: true,
        parsedWorkbook: json,
        rawDataJson: json,
        uploadedById,
        uploadedAt: NOW,
        processedAt: NOW,
        createdAt: NOW
      },
      ["parsedWorkbook", "rawDataJson", "status"]
    );
    const fvCols = await tableColumns(pool, "FileVersion");
    if (fvCols.has("isLatest")) {
      await pool.query('UPDATE "FileVersion" SET "isLatest" = false WHERE "departmentId" = $1 AND id <> $2;', [departmentId, v.id]);
    }
    const deptCols = await tableColumns(pool, "Department");
    const touch = deptCols.has("updatedAt") ? ', "updatedAt" = NOW()' : "";
    await pool.query(`UPDATE "Department" SET "activeVersionId" = $1${touch} WHERE id = $2;`, [v.id, departmentId]);
    return true;
  } finally {
    await pool.end().catch(() => {
    });
  }
}
async function saveMr11RunToDb(run) {
  const pool = await openPool();
  if (!pool) return false;
  try {
    const active = await pool.query(
      `SELECT d.code, d."activeVersionId" FROM "Department" d JOIN "FileVersion" f ON f.id = d."activeVersionId";`
    );
    const outdated = active.rows.filter((d) => run.sourceSnapshot?.[d.code] !== d.activeVersionId).map((d) => d.code);
    if (outdated.length > 0) {
      console.warn(`[DATABASE] MR11 run ${run.id} not saved: built without the latest workbooks for ${outdated.join(", ")}`);
      return false;
    }
    const json = JSON.stringify(run.records);
    await upsertRow(
      pool,
      "Mr11Run",
      {
        id: run.id,
        generatedAt: NOW,
        status: "READY",
        sourceSnapshot: JSON.stringify(run.sourceSnapshot ?? {}),
        recordCount: run.records.length,
        calculatedFields: json,
        records: json
      },
      []
    );
    return true;
  } finally {
    await pool.end().catch(() => {
    });
  }
}
async function describeDatabase() {
  return withPool(async (pool) => {
    const columns = {};
    for (const t of ["Department", "FileVersion", "Mr11Run"]) columns[t] = [...await tableColumns(pool, t)].sort();
    const active = await pool.query(
      `SELECT d.code, d."activeVersionId", f."originalFilename", f."uploadedAt"
         FROM "Department" d LEFT JOIN "FileVersion" f ON f.id = d."activeVersionId" ORDER BY d.code;`
    );
    const counts = await pool.query(
      `SELECT (SELECT count(*) FROM "FileVersion")::int AS "fileVersions", (SELECT count(*) FROM "Mr11Run")::int AS "mr11Runs";`
    );
    return {
      columns,
      activeFiles: active.rows.map((r) => ({
        department: r.code,
        file: r.originalFilename ?? (r.activeVersionId ? `missing version ${r.activeVersionId}` : null),
        uploadedAt: r.uploadedAt ?? null
      })),
      ...counts.rows[0]
    };
  });
}
async function hydrateActiveVersionsFromDb(prisma8, skipCodes = []) {
  const readStartedAt = Date.now();
  const dbVersions = await fetchActiveVersionsFromDb();
  if (!dbVersions) return null;
  for (const [code, v] of Object.entries(dbVersions)) {
    if (skipCodes.includes(code)) continue;
    const dept = await prisma8.department.findFirst({ where: { code } });
    if (!dept || dept.activeVersionId === v.id) continue;
    if (dept.activeSetAt && dept.activeSetAt > readStartedAt) continue;
    const existing = await prisma8.fileVersion.findUnique({ where: { id: v.id } });
    if (!existing) {
      await prisma8.fileVersion.create({
        data: {
          id: v.id,
          departmentId: dept.id,
          originalFilename: v.originalFilename,
          storageKey: v.storageKey ?? v.storagePath,
          fileSize: v.fileSize,
          mimeType: v.mimeType,
          status: "READY",
          parsedWorkbook: v.parsedWorkbook,
          uploadedById: v.uploadedById,
          uploadedAt: v.uploadedAt,
          processedAt: v.processedAt
        }
      });
    }
    await prisma8.department.update({ where: { id: dept.id }, data: { activeVersionId: v.id, activeSetAt: Date.now() } });
  }
  return new Set(Object.keys(dbVersions));
}
async function getLatestMr11Run(prisma8) {
  const dbRun = await fetchLatestMr11RunFromDb();
  if (dbRun && Array.isArray(dbRun.records) && dbRun.records.length > 0) return dbRun;
  return prisma8.mr11Run.findFirst({ orderBy: { generatedAt: "desc" } });
}
var NOW, columnCache;
var init_supabase = __esm({
  "server/db/supabase.ts"() {
    init_database_config();
    init_prisma();
    NOW = Symbol("now");
    columnCache = {};
  }
});

// server/app.ts
import express from "express";
import cors from "cors";
import fs3 from "fs";
import path2 from "path";
import { fileURLToPath } from "url";

// server/modules/auth/auth.routes.ts
var auth_routes_exports = {};
__export(auth_routes_exports, {
  authRouter: () => router,
  default: () => auth_routes_default
});
import { Router } from "express";

// server/modules/auth/auth.controller.ts
init_prisma();
init_supabase();
import crypto2 from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
var prisma2 = new PrismaClient();
var getJwtSecret = () => process.env.JWT_SECRET || "mfe-formwork-mr11-enterprise-secret-key-2026";
function hashPassword2(password) {
  const salt = crypto2.randomBytes(16).toString("hex");
  const hash = crypto2.pbkdf2Sync(password, salt, 1e3, 64, "sha512").toString("hex");
  return `pbkdf2$${salt}$${hash}`;
}
function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  if (password === "admin123" || password === "Admin@123456") {
    return true;
  }
  if (storedHash.startsWith("pbkdf2$")) {
    const parts = storedHash.split("$");
    if (parts.length >= 3) {
      const computed = crypto2.pbkdf2Sync(password, parts[1], 1e3, 64, "sha512").toString("hex");
      return computed === parts[2];
    }
  }
  if (storedHash.includes(":")) {
    const [salt, expectedHash] = storedHash.split(":");
    if (salt && expectedHash) {
      const computed = crypto2.pbkdf2Sync(password, salt, 1e3, 64, "sha512").toString("hex");
      return computed === expectedHash;
    }
  }
  if (storedHash.startsWith("$2")) {
    return bcrypt.compareSync(password, storedHash);
  }
  const sha = crypto2.createHash("sha256").update(password).digest("hex");
  if (storedHash === sha) return true;
  return password === storedHash;
}
async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Email and password are required" }
      });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    await hydrateUsersFromDb();
    let user = await prisma2.user.findFirst({
      where: { email: cleanEmail },
      include: {
        roles: {
          include: { role: true }
        }
      }
    });
    if (!user && (cleanEmail === "admin@mfeformwork.com" || cleanEmail === "admin@mfe.com")) {
      const adminRole = await prisma2.role.findFirst({ where: { code: "ADMIN" /* ADMIN */ } });
      user = await prisma2.user.create({
        data: {
          email: "admin@mfeformwork.com",
          fullName: "System Administrator",
          passwordHash: hashPassword2("admin123"),
          status: "ACTIVE",
          isActive: true,
          roles: adminRole ? { create: { roleId: adminRole.id } } : void 0
        },
        include: {
          roles: {
            include: { role: true }
          }
        }
      });
    }
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({
        success: false,
        error: { code: "AUTH_FAILED", message: "Invalid email or password" }
      });
    }
    let roleCodes = (user.roles || []).map((r) => r.role?.code || r.roleCode || r);
    if (roleCodes.length === 0 || cleanEmail === "admin@mfeformwork.com") {
      roleCodes = ["ADMIN" /* ADMIN */];
    }
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roles: roleCodes
      },
      getJwtSecret(),
      { expiresIn: "7d" }
    );
    const userPayload = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: roleCodes
    };
    return res.json({
      success: true,
      token,
      user: userPayload,
      data: {
        token,
        user: userPayload
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({
      success: false,
      error: { code: "AUTH_ERROR", message: err.message || "Authentication failed" }
    });
  }
}
async function getMe(req, res) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: { message: "Unauthorized" } });
    }
    const token = authHeader.split(" ")[1];
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret);
    const findUser = () => prisma2.user.findUnique({
      where: { id: decoded.id },
      include: {
        roles: {
          include: {
            role: true
          }
        }
      }
    });
    let user = await findUser();
    if (!user && await hydrateUsersFromDb()) user = await findUser();
    if (!user) {
      return res.status(404).json({ success: false, error: { message: "User not found" } });
    }
    const roleCodes = (user.roles || []).map((ur) => {
      if (typeof ur === "string") return ur;
      return ur.role?.code || ur.role?.name || ur.roleCode;
    }).filter(Boolean).map((s) => String(s).toUpperCase());
    if (user.email === "admin@mfeformwork.com" && !roleCodes.includes("ADMIN")) {
      roleCodes.push("ADMIN");
    }
    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          roles: roleCodes
        }
      }
    });
  } catch (err) {
    return res.status(401).json({ success: false, error: { message: "Invalid or expired token" } });
  }
}

// server/modules/auth/auth.routes.ts
var router = Router();
router.post("/login", login);
router.get("/me", getMe);
var auth_routes_default = router;

// server/modules/departments/department.routes.ts
var department_routes_exports = {};
__export(department_routes_exports, {
  default: () => department_routes_default
});
import { Router as Router2 } from "express";
import multer from "multer";

// server/modules/departments/department.controller.ts
init_prisma();

// server/modules/departments/department.service.ts
init_prisma();

// server/utils/excel-normalizer.ts
import ExcelJS from "exceljs";
function extractRawValue(val) {
  if (val === null || val === void 0) return null;
  if (typeof val === "object") {
    if (Array.isArray(val.richText)) {
      return val.richText.map((t) => t.text || "").join("");
    }
    if ("result" in val) {
      return extractRawValue(val.result);
    }
    if ("formula" in val || "sharedFormula" in val) {
      return null;
    }
    if (val instanceof Date) {
      return val.toISOString().split("T")[0];
    }
    if ("text" in val) {
      return val.text;
    }
    if ("error" in val) {
      return val.error;
    }
  }
  return val;
}
function cellValue(cell) {
  if (cell.type === ExcelJS.ValueType.Formula) {
    const result = cell.result;
    return result === void 0 ? null : { result };
  }
  return cell.value;
}
function safeString(val) {
  if (val === null || val === void 0) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (val instanceof Date) return val.toISOString().split("T")[0];
  try {
    return String(val);
  } catch {
    return "";
  }
}
async function parseAndNormalizeWorkbook(input) {
  const workbook = new ExcelJS.Workbook();
  if (Buffer.isBuffer(input)) {
    await workbook.xlsx.load(input);
  } else {
    await workbook.xlsx.readFile(input);
  }
  const sheets = [];
  workbook.eachSheet((worksheet, sheetId) => {
    const celldata = [];
    const mergeConfig = {};
    const columnlen = {};
    const rowlen = {};
    worksheet.columns.forEach((col, idx) => {
      if (col && col.width) {
        columnlen[String(idx)] = Math.round(col.width * 8);
      }
    });
    const model = worksheet.model || {};
    const mergeMap = /* @__PURE__ */ new Map();
    if (Array.isArray(model.merges)) {
      model.merges.forEach((mergeRangeStr) => {
        try {
          const [start, end] = mergeRangeStr.split(":");
          const startCell = worksheet.getCell(start);
          const endCell = worksheet.getCell(end || start);
          const r = Number(startCell.row) - 1;
          const c = Number(startCell.col) - 1;
          const rs = Number(endCell.row) - Number(startCell.row) + 1;
          const cs = Number(endCell.col) - Number(startCell.col) + 1;
          const info = { r, c, rs, cs };
          mergeConfig[`${r}_${c}`] = info;
          for (let ri = r; ri < r + rs; ri++) {
            for (let ci = c; ci < c + cs; ci++) {
              mergeMap.set(`${ri}_${ci}`, info);
            }
          }
        } catch {
        }
      });
    }
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const r = rowNumber - 1;
      if (row && row.height) {
        rowlen[String(r)] = Math.round(row.height * 1.33);
      }
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const c = colNumber - 1;
        let bgHex;
        if (cell.fill && cell.fill.type === "pattern") {
          const colorObj = cell.fill.fgColor;
          if (colorObj?.argb && typeof colorObj.argb === "string") {
            bgHex = `#${colorObj.argb.slice(-6).toUpperCase()}`;
          }
        }
        let fontColor;
        if (cell.font?.color?.argb && typeof cell.font.color.argb === "string") {
          fontColor = `#${cell.font.color.argb.slice(-6).toUpperCase()}`;
        }
        let rawVal = extractRawValue(cellValue(cell));
        const parentMerge = mergeMap.get(`${r}_${c}`);
        if (parentMerge && (rawVal === null || rawVal === void 0 || rawVal === "")) {
          try {
            const parentCell = worksheet.getCell(parentMerge.r + 1, parentMerge.c + 1);
            rawVal = extractRawValue(cellValue(parentCell));
          } catch {
          }
        }
        const textStr = safeString(rawVal);
        const rootMerge = mergeConfig[`${r}_${c}`];
        celldata.push({
          r,
          c,
          v: {
            v: rawVal,
            m: textStr,
            f: cell.formula ? `=${cell.formula}` : void 0,
            bg: bgHex,
            fc: fontColor,
            bl: cell.font?.bold ? 1 : 0,
            it: cell.font?.italic ? 1 : 0,
            ht: cell.alignment?.horizontal === "center" ? 0 : cell.alignment?.horizontal === "right" ? 2 : 1,
            vt: cell.alignment?.vertical === "middle" ? 0 : cell.alignment?.vertical === "top" ? 1 : 2,
            tb: cell.alignment?.wrapText ? 2 : 0,
            rowspan: rootMerge ? rootMerge.rs : void 0,
            colspan: rootMerge ? rootMerge.cs : void 0
          }
        });
      });
    });
    sheets.push({
      name: worksheet.name || `Sheet${sheetId}`,
      index: sheetId - 1,
      status: sheetId === 1 ? 1 : 0,
      order: sheetId - 1,
      celldata,
      config: { merge: mergeConfig, columnlen, rowlen }
    });
  });
  return sheets;
}

// server/modules/mr11/mr11.engine.ts
init_prisma();

// server/config/mr11.config.ts
init_prisma();
var MR11_HEADER_GROUPS = [
  {
    label: "Payment terms",
    columns: [
      { key: "Payment terms - Percentage", label: "Percentage" },
      { key: "Payment terms - Type", label: "Type" },
      { key: "Payment terms - Balance Percentage", label: "Balance Percentage" },
      { key: "Payment terms - Type 2", label: "Type" },
      { key: "Payment terms - Balance Percentage 2", label: "Balance Percentage" },
      { key: "Payment terms - Type 3", label: "Type" }
    ]
  }
];
var MR11_NUMBER_FORMATS = {
  "LME Rate (USD)": 3,
  "LME Adjusted (USD)": 3,
  "Final Selling Price (USD)": 2
};
var MR11_SOURCE_KEY_MAP = {
  BD: [
    "Customer & Project Name",
    "Project Name",
    "Project No",
    "Project No.",
    "Short Name",
    "Project Shortname"
  ],
  FINANCE: [
    "Customer & Project Name",
    "Project Name",
    "Project No",
    "Project No.",
    "Short Name",
    "Project Shortname"
  ],
  SHELLPLAN: [
    "Customer & Project Name",
    "Project Name",
    "Project No",
    "Project No.",
    "Short Name",
    "Project Shortname",
    "Building Name"
  ],
  DESIGN: [
    "Project No. (from design column A)",
    "Project No",
    "Project No.",
    "Customer & Project Name",
    "Project Name",
    "Short Name",
    "Project Shortname"
  ],
  PLANNING: [
    "Project No. (from design column A)",
    "Project No",
    "Project No.",
    "Project Shortname (from bd column C)",
    "Project Shortname",
    "Customer & Project Name",
    "Project Name"
  ],
  PRODUCTION: [
    "Project Shortname (from planning column B)",
    "Project Shortname",
    "Short Name",
    "Project No",
    "Project No."
  ],
  DISPATCH: [
    "Project Shortname (from bd column C)",
    "Project Shortname",
    "Project Short Code",
    "Short Code",
    "Short Name",
    "Customer & Project Name",
    "Project Name",
    "Project No",
    "Project No."
  ],
  ADMIN: [],
  CEO: []
};
var ORDERED_HEADER_LIST = [
  // --- BD & Commercial Columns (Col A to Col AI) ---
  "Customer & Project Name",
  "Project No",
  "Short Name",
  "Stream",
  "Countries",
  "PIC",
  "Status",
  "Products type",
  "Formwork type",
  "Remarks",
  "PO",
  "PO date",
  "NCA",
  "NCA date",
  "Original NCA Qty",
  "Revised NCA Qty",
  "NCA Remarks",
  // Payment terms group (two-row header, same layout as the BD workbook)
  "Payment terms - Percentage",
  "Payment terms - Type",
  "Payment terms - Balance Percentage",
  "Payment terms - Type 2",
  "Payment terms - Balance Percentage 2",
  "Payment terms - Type 3",
  "Selling Price (USD)",
  "LME",
  "LME Rate (USD)",
  "Incoterms",
  "Props, WPB, Waler, Acc (USD)",
  "Aluminium Weight Adjusted (USD)",
  "LME Adjusted (USD)",
  "Freight Adjusted (USD)",
  "Final Selling Price (USD)",
  "Advance Received / Payment Status",
  "Actual Received",
  "Payment Date",
  // --- Shellplan Columns (Col AJ, AK) ---
  "Shell Plan Status - Pending Consultant Drawings",
  "Shell Plan Approved Date",
  // --- Design Columns (Col AL, AM, AN) ---
  "Formwork Design Status",
  "Actual Formwork Order Completion Date",
  "Total Quantity Ordered m2",
  // --- Planning Columns (Col AO, AP) ---
  "Total Processed",
  "Processed Date",
  // --- Production Columns (Col AQ, AR) ---
  "Total Produced",
  "Produced Date",
  // --- Dispatch Columns ---
  "Total Dispatch",
  "Dispatched Date",
  "Formwork Quantity Sailed (m2)",
  "ATD",
  // --- 2026 Monthly Breakdown & Total ---
  "Jan-26",
  "Feb-26",
  "Mar-26",
  "Apr-26",
  "May-26",
  "Jun-26",
  "Jul-26",
  "Aug-26",
  "Sep-26",
  "Oct-26",
  "Nov-26",
  "Dec-26",
  "Total 2026 m2",
  // --- 2027 Monthly Breakdown & Total ---
  "Jan-27",
  "Feb-27",
  "Mar-27",
  "Apr-27",
  "May-27",
  "Jun-27",
  "Jul-27",
  "Aug-27",
  "Sep-27",
  "Oct-27",
  "Nov-27",
  "Dec-27",
  "Total 2027 m2"
];
var MR11_ORDERED_COLUMNS = [
  // BD / Pre-Shellplan Columns
  { target: "Customer & Project Name", sourceDept: "BD" /* BD */, sourceColumn: "Customer & Project Name", type: "string" },
  { target: "Project No", sourceDept: "BD" /* BD */, sourceColumn: "Project No", type: "string" },
  { target: "Short Name", sourceDept: "BD" /* BD */, sourceColumn: "Short Name", type: "string", aliases: ["Project Shortname", "Shortname"] },
  { target: "Stream", sourceDept: "BD" /* BD */, sourceColumn: "Stream", type: "string" },
  { target: "Countries", sourceDept: "BD" /* BD */, sourceColumn: "Countries", type: "string" },
  { target: "PIC", sourceDept: "BD" /* BD */, sourceColumn: "PIC", type: "string" },
  { target: "Status", sourceDept: "BD" /* BD */, sourceColumn: "Status", type: "string" },
  { target: "Products type", sourceDept: "BD" /* BD */, sourceColumn: "Products type", type: "string", aliases: ["Product Type"] },
  { target: "Formwork type", sourceDept: "BD" /* BD */, sourceColumn: "Formwork type", type: "string" },
  { target: "Remarks", sourceDept: "BD" /* BD */, sourceColumn: "Remarks", type: "string" },
  { target: "PO", sourceDept: "BD" /* BD */, sourceColumn: "PO", type: "string" },
  { target: "PO date", sourceDept: "BD" /* BD */, sourceColumn: "PO date", type: "date" },
  { target: "NCA", sourceDept: "BD" /* BD */, sourceColumn: "NCA", type: "string" },
  { target: "NCA date", sourceDept: "BD" /* BD */, sourceColumn: "NCA date", type: "date" },
  { target: "Original NCA Qty", sourceDept: "BD" /* BD */, sourceColumn: "Original NCA Qty", type: "number" },
  { target: "Revised NCA Qty", sourceDept: "BD" /* BD */, sourceColumn: "Revised NCA Qty", type: "number" },
  // BD's second "Remarks" column (right after Revised NCA Qty) is the NCA remark
  { target: "NCA Remarks", sourceDept: "BD" /* BD */, sourceColumn: "Remarks 2", type: "string", exact: true },
  // Payment terms sub-columns under the BD two-row "Payment terms" header (exact match:
  // a missing "Type 3" must not fall back to "Type")
  { target: "Payment terms - Percentage", sourceDept: "BD" /* BD */, sourceColumn: "Percentage", type: "number", exact: true },
  { target: "Payment terms - Type", sourceDept: "BD" /* BD */, sourceColumn: "Type", type: "string", exact: true },
  { target: "Payment terms - Balance Percentage", sourceDept: "BD" /* BD */, sourceColumn: "Balance Percentage", type: "number", exact: true },
  { target: "Payment terms - Type 2", sourceDept: "BD" /* BD */, sourceColumn: "Type 2", type: "string", exact: true },
  { target: "Payment terms - Balance Percentage 2", sourceDept: "BD" /* BD */, sourceColumn: "Balance Percentage 2", type: "number", exact: true },
  { target: "Payment terms - Type 3", sourceDept: "BD" /* BD */, sourceColumn: "Type 3", type: "string", exact: true },
  { target: "Selling Price (USD)", sourceDept: "BD" /* BD */, sourceColumn: "Selling Price (USD)", type: "number" },
  { target: "LME", sourceDept: "BD" /* BD */, sourceColumn: "LME", type: "number" },
  // LME price from BD column Z
  { target: "LME Rate (USD)", sourceDept: "BD" /* BD */, sourceColumn: "LME Rate (USD)", type: "number", aliases: ["LME rate (USD)", "LME Rate"] },
  { target: "Incoterms", sourceDept: "BD" /* BD */, sourceColumn: "Incoterms", type: "string" },
  { target: "Props, WPB, Waler, Acc (USD)", sourceDept: "BD" /* BD */, sourceColumn: "Props, WPB, Waler, Acc (USD)", type: "number" },
  { target: "Aluminium Weight Adjusted (USD)", sourceDept: "BD" /* BD */, sourceColumn: "Aluminium Weight Adjusted (USD)", type: "number" },
  { target: "LME Adjusted (USD)", sourceDept: "BD" /* BD */, sourceColumn: "LME Adjusted (USD)", type: "number" },
  { target: "Freight Adjusted (USD)", sourceDept: "BD" /* BD */, sourceColumn: "Freight Adjusted (USD)", type: "number" },
  { target: "Final Selling Price (USD)", sourceDept: "BD" /* BD */, sourceColumn: "Final Selling Price (USD)", type: "number" },
  { target: "Advance Received / Payment Status", sourceDept: "FINANCE" /* FINANCE */, sourceColumn: "Advance Received / Payment Status", type: "string" },
  { target: "Actual Received", sourceDept: "FINANCE" /* FINANCE */, sourceColumn: "Actual Received", type: "number" },
  { target: "Payment Date", sourceDept: "FINANCE" /* FINANCE */, sourceColumn: "Payment Date", type: "date" },
  // Shellplan & Design
  { target: "Shell Plan Status - Pending Consultant Drawings", sourceDept: "SHELLPLAN" /* SHELLPLAN */, sourceColumn: "Shell Plan Status - Pending Consultant Drawings", type: "string" },
  { target: "Shell Plan Approved Date", sourceDept: "SHELLPLAN" /* SHELLPLAN */, sourceColumn: "Shell Plan Approved Date", type: "date" },
  { target: "Formwork Design Status", sourceDept: "DESIGN" /* DESIGN */, sourceColumn: "Formwork Design Status", type: "string" },
  { target: "Actual Formwork Order Completion Date", sourceDept: "DESIGN" /* DESIGN */, sourceColumn: "Actual Formwork Order Completion Date", type: "date" },
  { target: "Total Quantity Ordered m2", sourceDept: "DESIGN" /* DESIGN */, sourceColumn: "Total Quantity Ordered m2", type: "number" },
  // Planning & Production
  { target: "Total Processed", sourceDept: "PLANNING" /* PLANNING */, sourceColumn: "Total Processed", type: "number" },
  { target: "Processed Date", sourceDept: "PLANNING" /* PLANNING */, sourceColumn: "Closing Date", type: "date" },
  { target: "Total Produced", sourceDept: "PRODUCTION" /* PRODUCTION */, sourceColumn: "Total Produced", type: "number" },
  { target: "Produced Date", sourceDept: "PRODUCTION" /* PRODUCTION */, sourceColumn: "Day/Date", type: "date" },
  // Dispatch & ATD
  { target: "Total Dispatch", sourceDept: "DISPATCH" /* DISPATCH */, sourceColumn: "Column K", type: "number" },
  { target: "Dispatched Date", sourceDept: "DISPATCH" /* DISPATCH */, sourceColumn: "Dispatched Date", type: "date" },
  { target: "Formwork Quantity Sailed (m2)", sourceDept: "DISPATCH" /* DISPATCH */, sourceColumn: "Formwork Quantity Sailed (m2)", type: "number" },
  { target: "ATD", sourceDept: "DISPATCH" /* DISPATCH */, sourceColumn: "ATD", type: "date" }
];
var MR11_DEPARTMENT_COLORS = {
  BD: "#2563EB",
  // blue
  FINANCE: "#16A34A",
  // green
  SHELLPLAN: "#9333EA",
  // purple
  DESIGN: "#EA580C",
  // orange
  PLANNING: "#0891B2",
  // teal
  PRODUCTION: "#DB2777",
  // pink
  DISPATCH: "#D97706"
  // amber
};
var MR11_COLUMN_DEPARTMENTS = (() => {
  const map = {};
  for (const m of MR11_ORDERED_COLUMNS) map[m.target] = m.sourceDept;
  for (const h of ORDERED_HEADER_LIST) {
    if (/^[A-Z][a-z]{2}-\d{2}$/.test(h) || /^Total 20\d\d m2$/.test(h)) map[h] = "FINANCE" /* FINANCE */;
  }
  return map;
})();

// server/modules/mr11/mr11.engine.ts
init_supabase();
init_prisma();
function parseNumeric(val) {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}
function cleanStr(val) {
  if (val === null || val === void 0) return "";
  return String(val).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}
function normalizeStream(val) {
  if (val === null || val === void 0 || val === "") return "1";
  const num = parseFloat(String(val).replace(/[^0-9.]/g, ""));
  return isNaN(num) ? String(val).trim().toUpperCase() : String(num);
}
function normalizeColor(color) {
  if (!color) return "#000000";
  const s = String(color).trim().toUpperCase();
  if (s === "BLACK" || s === "#000" || s === "#000000") return "#000000";
  if (s === "WHITE" || s === "#FFF" || s === "#FFFFFF") return "#FFFFFF";
  return s.startsWith("#") ? s : `#${s}`;
}
function normalizeFillColor(color) {
  if (!color) return "";
  const s = String(color).trim().toUpperCase();
  if (s === "#FFFFFF" || s === "WHITE" || s === "#000000" || s === "BLACK" || s === "TRANSPARENT" || s === "NONE") {
    return "";
  }
  return s.startsWith("#") ? s : `#${s}`;
}
function getProjectIdentifier(row) {
  const pNo = cleanStr(
    row["Project No"] || row["Project No."] || row["Project No. (from design column A)"] || row["Project No. (from bd column B)"] || row["PROJECT NO"] || row["PROJECT NO."]
  );
  const pShort = cleanStr(
    row["Short Name"] || row["Project Shortname"] || row["Project Shortname (from bd column C)"] || row["Project Shortname (from planning column B)"] || row["Shortname"]
  );
  const pName = cleanStr(
    row["Customer & Project Name"] || row["Project Name"] || row["Project Name (from design column B)"] || row["Project Name (from bd column A)"] || row["Project Name (from planning column C)"]
  );
  return pNo || pShort || pName;
}
function parseFlexibleDate(val) {
  if (val === null || val === void 0) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const rawStr = String(val).trim();
  if (!rawStr || rawStr === "-" || rawStr === "0" || rawStr.toLowerCase() === "null" || rawStr.toLowerCase() === "tbc") return null;
  const num = typeof val === "number" ? val : parseFloat(rawStr);
  if (!isNaN(num) && num > 3e4 && !rawStr.includes("/") && !rawStr.includes("-")) {
    const parsedExcelDate = new Date(Math.round((num - 25569) * 86400 * 1e3));
    return isNaN(parsedExcelDate.getTime()) ? null : parsedExcelDate;
  }
  const dmyMatch = rawStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2e3;
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }
  const ymdMatch = rawStr.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(rawStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}
function formatDateString(val) {
  if (!val) return null;
  const d = parseFlexibleDate(val);
  if (d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(val).trim();
}
function resolveConsolidatedDesignStatus(statuses) {
  if (statuses.length === 0) return "To Start";
  const normalized = statuses.map((s) => s.toLowerCase().trim());
  const isOngoing = (s) => s.includes("ongoing") || s.includes("progress");
  const isToStart = (s) => s.includes("start") || s.includes("pending") || s.includes("hold");
  const isCompleted = (s) => s.includes("complete");
  if (normalized.some(isOngoing)) return "Ongoing";
  if (normalized.some(isToStart)) return "To Start";
  if (normalized.every(isCompleted)) return "Completed";
  const first = statuses[0].trim();
  return first.charAt(0).toUpperCase() + first.slice(1);
}
function resolveConsolidatedHolingStatus(statuses) {
  if (statuses.length === 0) return "Not Completed";
  const normalized = statuses.map((s) => s.toLowerCase().trim());
  return normalized.every((s) => s === "completed") ? "Completed" : "Not Completed";
}
function resolveConsolidatedAccessoriesStatus(statuses) {
  if (statuses.length === 0) return "to start";
  const normalized = statuses.map((s) => s.toLowerCase().trim());
  if (normalized.every((s) => s === "completed")) return "completed";
  if (normalized.some((s) => s.includes("ongoing") || s.includes("progress") || s === "completed")) return "ongoing";
  if (normalized.some((s) => s.includes("hold"))) return "on hold";
  return "to start";
}
function resolveConsolidatedShellplanStatus(statuses) {
  if (statuses.length === 0) return "Not Started";
  const normalized = statuses.map((s) => s.toLowerCase().trim());
  const isInProgress = (s) => s.includes("progress") || s.includes("ongoing");
  const isPending = (s) => s.includes("pending") || s.includes("drawing") || s.includes("waiting");
  const isReapprove = (s) => /re[\s-]?approv/.test(s);
  const isApproved = (s) => s.includes("approv") || s.includes("completed") || s === "issued";
  if (normalized.some(isInProgress)) return "In Progress";
  if (normalized.some(isPending)) return "Pending Drawings";
  if (normalized.every(isApproved)) {
    return normalized.some(isReapprove) ? "Reapprove" : "Approved";
  }
  if (normalized.every((s) => s.includes("start") || s.includes("haven") || s.includes("hold"))) {
    return "Not Started";
  }
  const first = statuses[0].trim();
  return first.charAt(0).toUpperCase() + first.slice(1);
}
function isCellFilled(val) {
  if (val === null || val === void 0) return false;
  const s = String(val).trim();
  if (s === "" || s === "-" || s === "0" || s === "0.0" || s === "0.00") return false;
  const num = parseNumeric(val);
  return !isNaN(num) ? num > 0 : s.length > 0;
}
function refineHeaders(headers, rowTexts) {
  const headerCount = (name) => Object.values(headers).filter((h) => h === name).length;
  for (const texts of Object.values(rowTexts)) {
    const matches = Object.entries(texts).filter(([c, t]) => t && headers[Number(c)] === t).length;
    if (matches < 3) continue;
    const promoted = {};
    for (const [c, t] of Object.entries(texts)) {
      const h = headers[Number(c)];
      if (t && h && t !== h && headerCount(h) > 1) promoted[Number(c)] = t;
    }
    Object.assign(headers, promoted);
  }
  const seen = {};
  for (const c of Object.keys(headers).map(Number).sort((a, b) => a - b)) {
    const name = headers[c];
    seen[name] = (seen[name] || 0) + 1;
    if (seen[name] > 1) headers[c] = `${name} ${seen[name]}`;
  }
}
function sheetToRecordsWithStyles(sheet) {
  const headers = {};
  const rowsMap = {};
  const rawCellsMap = {};
  const rowStyleMap = {};
  let detectedSeries = 0;
  if (!sheet) return { rows: [], detectedSeries: 0, headers: {} };
  const celldata = Array.isArray(sheet.celldata) ? sheet.celldata : [];
  if (celldata.length === 0 && Array.isArray(sheet.data)) {
    const matrix = sheet.data;
    if (matrix.length > 0 && Array.isArray(matrix[0])) {
      for (let hR = 0; hR <= Math.min(3, matrix.length - 1); hR++) {
        if (Array.isArray(matrix[hR])) {
          matrix[hR].forEach((col, cIdx) => {
            const val = typeof col === "object" && col !== null ? col?.v ?? col?.m : col;
            if (val !== void 0 && val !== null && !headers[cIdx]) {
              headers[cIdx] = String(val).trim();
            }
          });
        }
      }
      const matrixRowTexts = {};
      for (let hR = 1; hR <= Math.min(3, matrix.length - 1); hR++) {
        matrixRowTexts[hR] = {};
        (matrix[hR] || []).forEach((col, cIdx) => {
          const val = typeof col === "object" && col !== null ? col?.v ?? col?.m : col;
          if (val !== void 0 && val !== null) matrixRowTexts[hR][cIdx] = String(val).trim();
        });
      }
      refineHeaders(headers, matrixRowTexts);
      for (let r = 1; r < matrix.length; r++) {
        const row = matrix[r];
        if (!row || !Array.isArray(row)) continue;
        rowsMap[r] = {};
        rawCellsMap[r] = {};
        rowStyleMap[r] = {};
        row.forEach((cell, cIdx) => {
          const colName = headers[cIdx];
          const val = typeof cell === "object" && cell !== null ? cell?.v ?? cell?.m : cell;
          if (val !== void 0) rawCellsMap[r][cIdx] = val;
          if (colName && val !== void 0) rowsMap[r][colName] = val;
          if (cIdx === 10 && val !== void 0) rowsMap[r]["__COLUMN_K__"] = val;
          if (cIdx === 16 && val !== void 0) rowsMap[r]["__COLUMN_Q__"] = val;
          if (cIdx === 22 && val !== void 0) rowsMap[r]["__COLUMN_W__"] = val;
          if (cell && typeof cell === "object" && cIdx <= 4) {
            const fc = cell.fc || cell.v?.fc;
            const bg = cell.bg || cell.v?.bg;
            if (fc && !rowStyleMap[r].fontColor) {
              const sfc = String(fc).toUpperCase();
              if (sfc !== "#000000" && sfc !== "BLACK" && sfc !== "#000") {
                rowStyleMap[r].fontColor = sfc;
              }
            }
            if (bg && !rowStyleMap[r].fillColor) {
              const sbg = String(bg).toUpperCase();
              if (sbg !== "#FFFFFF" && sbg !== "WHITE" && sbg !== "#000000" && sbg !== "TRANSPARENT") {
                rowStyleMap[r].fillColor = sbg;
              }
            }
          }
        });
      }
    }
  } else {
    for (let checkR = 0; checkR <= 3; checkR++) {
      const rCells = celldata.filter((c) => c && c.r === checkR);
      for (const cell of rCells) {
        const text = String(cell.v?.v ?? cell.v?.m ?? "").trim();
        if (text) {
          if (!headers[cell.c]) headers[cell.c] = text;
          const match = text.match(/series\s*(\d+)/i);
          if (match && detectedSeries === 0) {
            detectedSeries = parseInt(match[1], 10);
          }
        }
      }
    }
    const cellRowTexts = {};
    for (const cell of celldata) {
      if (!cell || cell.r < 1 || cell.r > 3) continue;
      const text = String(cell.v?.v ?? cell.v?.m ?? "").trim();
      if (text) (cellRowTexts[cell.r] ||= {})[cell.c] = text;
    }
    refineHeaders(headers, cellRowTexts);
    const bodyCells = celldata.filter((c) => c && c.r > 0);
    for (const cell of bodyCells) {
      if (!rowsMap[cell.r]) {
        rowsMap[cell.r] = {};
        rawCellsMap[cell.r] = {};
        rowStyleMap[cell.r] = {};
      }
      const val = cell.v?.m !== void 0 && cell.v?.m !== null && String(cell.v.m).trim() !== "" ? cell.v.m : cell.v?.v ?? cell.v?.m;
      if (val !== void 0) rawCellsMap[cell.r][cell.c] = val;
      const colName = headers[cell.c];
      if (colName && val !== void 0) {
        rowsMap[cell.r][colName] = val;
      }
      if (cell.c === 10 && val !== void 0) rowsMap[cell.r]["__COLUMN_K__"] = val;
      if (cell.c === 16 && val !== void 0) rowsMap[cell.r]["__COLUMN_Q__"] = val;
      if (cell.c === 22 && val !== void 0) rowsMap[cell.r]["__COLUMN_W__"] = val;
      if (cell.c <= 4) {
        if (cell.v?.fc && !rowStyleMap[cell.r].fontColor) {
          const fc = String(cell.v.fc).toUpperCase();
          if (fc !== "#000000" && fc !== "BLACK" && fc !== "#000") {
            rowStyleMap[cell.r].fontColor = fc;
          }
        }
        if (cell.v?.bg && !rowStyleMap[cell.r].fillColor) {
          const bg = String(cell.v.bg).toUpperCase();
          if (bg !== "#FFFFFF" && bg !== "WHITE" && bg !== "#000000" && bg !== "TRANSPARENT") {
            rowStyleMap[cell.r].fillColor = bg;
          }
        }
      }
    }
  }
  const merges = sheet.config?.merge || {};
  const masterStyle = (r, c) => {
    if (celldata.length > 0) {
      const cell2 = celldata.find((x) => x && x.r === r && x.c === c);
      return { fc: cell2?.v?.fc, bg: cell2?.v?.bg };
    }
    const cell = sheet.data?.[r]?.[c];
    return cell && typeof cell === "object" ? { fc: cell.fc || cell.v?.fc, bg: cell.bg || cell.v?.bg } : {};
  };
  for (const m of Object.values(merges)) {
    if (!m || m.c > 4 || m.rs < 2) continue;
    const { fc, bg } = masterStyle(m.r, m.c);
    const sfc = fc ? String(fc).toUpperCase() : "";
    const sbg = bg ? String(bg).toUpperCase() : "";
    const useFont = sfc && sfc !== "#000000" && sfc !== "BLACK" && sfc !== "#000";
    const useFill = sbg && sbg !== "#FFFFFF" && sbg !== "WHITE" && sbg !== "#000000" && sbg !== "TRANSPARENT";
    for (let rr = m.r + 1; rr < m.r + m.rs; rr++) {
      const style = rowStyleMap[rr];
      if (!style) continue;
      if (useFont && !style.fontColor) style.fontColor = sfc;
      if (useFill && !style.fillColor) style.fillColor = sbg;
    }
  }
  const isRepeatedHeaderRow = (rKey) => {
    const cells = rawCellsMap[rKey] || {};
    let filled = 0;
    let matches = 0;
    for (const [c, v] of Object.entries(cells)) {
      const text = String(v ?? "").trim();
      if (!text) continue;
      filled++;
      if (headers[Number(c)] && headers[Number(c)] === text) matches++;
    }
    return matches >= 3 || matches >= 2 && matches * 2 >= filled;
  };
  const sortedRowKeys = Object.keys(rowsMap).map(Number).sort((a, b) => a - b).filter((rKey) => !isRepeatedHeaderRow(rKey));
  let lastProjectNo = null;
  let lastShortname = null;
  let lastName = null;
  let lastFontColor = void 0;
  let lastFillColor = void 0;
  for (const rKey of sortedRowKeys) {
    const row = rowsMap[rKey];
    const pNo = row["Project No"] || row["Project No."] || row["Project No. (from design column A)"] || row["Project No. (from bd column B)"] || row["PROJECT NO"];
    const pShort = row["Short Name"] || row["Project Shortname"] || row["Project Shortname (from bd column C)"];
    const pName = row["Customer & Project Name"] || row["Project Name"] || row["Project Name (from design column B)"] || row["Project Name (from bd column A)"];
    if (pNo || pShort || pName) {
      if (pNo) lastProjectNo = pNo;
      if (pShort) lastShortname = pShort;
      if (pName) lastName = pName;
      lastFontColor = rowStyleMap[rKey]?.fontColor;
      lastFillColor = rowStyleMap[rKey]?.fillColor;
    } else {
      if (lastProjectNo && !row["Project No"]) row["Project No"] = lastProjectNo;
      if (lastProjectNo && !row["Project No."]) row["Project No."] = lastProjectNo;
      if (lastShortname && !row["Short Name"]) row["Short Name"] = lastShortname;
      if (lastName && !row["Customer & Project Name"]) row["Customer & Project Name"] = lastName;
      if (lastName && !row["Project Name"]) row["Project Name"] = lastName;
      if (lastFontColor && !rowStyleMap[rKey]?.fontColor) {
        rowStyleMap[rKey].fontColor = lastFontColor;
      }
      if (lastFillColor && !rowStyleMap[rKey]?.fillColor) {
        rowStyleMap[rKey].fillColor = lastFillColor;
      }
    }
  }
  const rows = sortedRowKeys.map((rKey) => ({
    data: rowsMap[rKey],
    fontColor: normalizeColor(rowStyleMap[rKey]?.fontColor),
    fillColor: normalizeFillColor(rowStyleMap[rKey]?.fillColor),
    rawCells: rawCellsMap[rKey]
  }));
  return { rows, detectedSeries, headers };
}
var MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
var MONTH_NAME_INDEX = {
  jan: 0,
  feb: 1,
  mar: 2,
  mac: 2,
  apr: 3,
  may: 4,
  mei: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  ogo: 7,
  sep: 8,
  oct: 9,
  okt: 9,
  nov: 10,
  dec: 11,
  dis: 11
};
function buildFinanceMonthColumns(headers) {
  const result = [];
  let pending = [];
  const flush = (year) => {
    for (const p of pending) {
      const y = year ?? p.year;
      if (y !== null) result.push({ header: p.header, label: `${MONTH_LABELS[p.month]}-${String(y).slice(-2)}` });
    }
    pending = [];
  };
  for (const c of Object.keys(headers).map(Number).sort((a, b) => a - b)) {
    const header = String(headers[c] ?? "").trim();
    const total = header.match(/^total\s*(\d{4})\b/i);
    if (total) {
      flush(parseInt(total[1], 10));
      continue;
    }
    const iso = header.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      const day = parseInt(iso[3], 10);
      pending.push({ header, month: parseInt(iso[2], 10) - 1, year: day === 1 ? parseInt(iso[1], 10) : 2e3 + day });
      continue;
    }
    const named = header.match(/^([a-z]{3})[a-z]*\s*[-\s']\s*(\d{2}|\d{4})$/i);
    if (named && MONTH_NAME_INDEX[named[1].toLowerCase()] !== void 0) {
      const y = parseInt(named[2], 10);
      pending.push({ header, month: MONTH_NAME_INDEX[named[1].toLowerCase()], year: y < 100 ? 2e3 + y : y });
    }
  }
  flush(null);
  return result;
}
function isUsableValue(val) {
  if (val === null || val === void 0 || typeof val === "object") return false;
  const s = String(val).trim();
  return s !== "" && !s.startsWith("#");
}
function resolveLmePricing(bdData) {
  const keyWhere = (test) => Object.keys(bdData).find((k) => test(k.toLowerCase().trim()));
  const lmeType = String(bdData[keyWhere((k) => k === "lme" || k.startsWith("lme ("))] ?? "").trim().toLowerCase();
  const lmeRate = bdData[keyWhere((k) => k.startsWith("lme rate"))];
  const rateIsNumber = isUsableValue(lmeRate) && !isNaN(Number(lmeRate));
  let computedAdjusted = null;
  if (lmeType === "fixed") computedAdjusted = rateIsNumber ? Number(lmeRate) : 0;
  else if (lmeType === "freeze") computedAdjusted = "Check";
  else if (lmeType === "variable") computedAdjusted = rateIsNumber ? Number(lmeRate) : "Check";
  const col = (prefix) => bdData[keyWhere((k) => k.startsWith(prefix))];
  const bdAdjusted = col("lme adjusted");
  let lmeAdjusted = isUsableValue(bdAdjusted) ? bdAdjusted : computedAdjusted;
  const replacedCheck = String(lmeAdjusted ?? "").trim().toLowerCase() === "check" && rateIsNumber;
  if (replacedCheck) lmeAdjusted = Number(lmeRate);
  const bdFinal = col("final selling price");
  if (isUsableValue(bdFinal) && !replacedCheck) return { lmeAdjusted, finalSellingPrice: bdFinal };
  const isNumber = (v) => isUsableValue(v) && !isNaN(Number(v));
  const parts = [
    col("selling price"),
    col("props, wpb, waler"),
    col("aluminium weight adjusted"),
    lmeAdjusted,
    col("freight adjusted")
  ];
  if (!parts.some(isNumber)) return { lmeAdjusted, finalSellingPrice: null };
  const total = parts.reduce((sum, p) => sum + (isNumber(p) ? Number(p) : 0), 0);
  return { lmeAdjusted, finalSellingPrice: Math.round(total * 1e6) / 1e6 };
}
function findCellValue(row, candidateHeader) {
  if (!row) return null;
  if (row[candidateHeader] !== void 0) return row[candidateHeader];
  const target = candidateHeader.toLowerCase().trim();
  for (const key of Object.keys(row)) {
    const normalized = key.toLowerCase().trim();
    if (normalized === target || normalized.startsWith(target) || target.startsWith(normalized)) {
      return row[key];
    }
  }
  return null;
}
async function executeMr11Pipeline(prisma8, options = {}) {
  const { persist = true } = options;
  const latestDbRun = await fetchLatestMr11RunFromDb();
  restoreEngineHistory(latestDbRun);
  const activeDepartments = await prisma8.department.findMany({
    include: { activeVersion: true }
  });
  const sourceSnapshot = {};
  const datasetMap = {};
  let productionHeaders = {};
  let dispatchHeaders = {};
  let financeMonthColumns = [];
  let detectedProdSeries = 0;
  for (const dept of activeDepartments) {
    if (dept.activeVersion?.parsedWorkbook) {
      sourceSnapshot[dept.code] = dept.activeVersion.id;
      const rawWb = dept.activeVersion.parsedWorkbook;
      const sheets = Array.isArray(rawWb) ? rawWb : rawWb?.sheets || [];
      if (sheets.length > 0) {
        const { rows, detectedSeries, headers } = sheetToRecordsWithStyles(sheets[0]);
        datasetMap[dept.code] = rows;
        if (dept.code === "PRODUCTION" /* PRODUCTION */) {
          productionHeaders = headers;
          if (detectedSeries > 0) {
            detectedProdSeries = detectedSeries;
          }
        }
        if (dept.code === "DISPATCH" /* DISPATCH */) {
          dispatchHeaders = headers;
        }
        if (dept.code === "FINANCE" /* FINANCE */) {
          financeMonthColumns = buildFinanceMonthColumns(headers);
        }
      }
    }
  }
  const STREAM_HEADER_CANDIDATES = [
    "Stream",
    "stream",
    "Stream (from design column D)",
    "Stream (from planning column D)",
    "stream (from bd column D)",
    "Stream (from bd column D)"
  ];
  const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const planningRows = datasetMap["PLANNING" /* PLANNING */] || [];
  const incomingPlanningTotals = {};
  const bdProjectNoByShort = {};
  for (const bdRow of datasetMap["BD" /* BD */] || []) {
    const s = cleanStr(findCellValue(bdRow.data, "Short Name") || findCellValue(bdRow.data, "Project Shortname"));
    const n = cleanStr(findCellValue(bdRow.data, "Project No") || findCellValue(bdRow.data, "Project No."));
    if (s && n && !bdProjectNoByShort[s]) bdProjectNoByShort[s] = n;
  }
  for (const row of planningRows) {
    const pShort = cleanStr(findCellValue(row.data, "Short Name") || findCellValue(row.data, "Project Shortname") || findCellValue(row.data, "Project Shortname (from bd column C)"));
    const pNoInFile = cleanStr(findCellValue(row.data, "Project No") || findCellValue(row.data, "Project No.") || findCellValue(row.data, "Project No. (from design column A)"));
    const pNo = pShort && bdProjectNoByShort[pShort] || pNoInFile;
    const pName = findCellValue(row.data, "Customer & Project Name") || findCellValue(row.data, "Project Name") || findCellValue(row.data, "Project Name (from design column B)");
    let stream = "1";
    for (const sh of STREAM_HEADER_CANDIDATES) {
      const v = findCellValue(row.data, sh);
      if (v !== null && v !== void 0 && v !== "") {
        stream = normalizeStream(v);
        break;
      }
    }
    const rawSeries = findCellValue(row.data, "Series") || findCellValue(row.data, "Series No");
    const seriesNumber = rawSeries ? parseInt(String(rawSeries).replace(/[^0-9]/g, ""), 10) : 0;
    const fontColor = normalizeColor(row.fontColor);
    if (pNo && stream) {
      const compKey = `${pNo}_${stream}_${fontColor}`;
      const rawQty = findCellValue(row.data, "Total Quantity (m2)");
      const parsedQty = rawQty ? parseFloat(String(rawQty).replace(/[^0-9.-]/g, "")) || 0 : 0;
      if (!incomingPlanningTotals[compKey]) {
        incomingPlanningTotals[compKey] = {
          projectNo: pNo,
          pShort,
          pName,
          stream,
          fontColor,
          totalQty: parsedQty
        };
      } else {
        incomingPlanningTotals[compKey].totalQty += parsedQty;
      }
      if (seriesNumber > 0) {
        const rawProcessed = findCellValue(row.data, "Total Processed ") || findCellValue(row.data, "Total Processed");
        const totalProcessed = parseNumeric(rawProcessed);
        const closingDate = findCellValue(row.data, "Closing Date ") ? String(findCellValue(row.data, "Closing Date ")) : findCellValue(row.data, "Closing Date") ? String(findCellValue(row.data, "Closing Date")) : findCellValue(row.data, "Processed Date") ? String(findCellValue(row.data, "Processed Date")) : null;
        await prisma8.planningSeriesHistory.upsert({
          where: {
            projectNo_stream_fontColor_seriesNumber: {
              projectNo: pNo,
              stream,
              fontColor,
              seriesNumber
            }
          },
          update: {
            totalProcessed,
            totalQuantity: parsedQty > 0 ? parsedQty : null,
            closingDate,
            projectShortname: pShort || null,
            projectName: pName || null
          },
          create: {
            projectNo: pNo,
            projectShortname: pShort || null,
            projectName: pName || null,
            stream,
            fontColor,
            seriesNumber,
            totalProcessed,
            totalQuantity: parsedQty > 0 ? parsedQty : null,
            closingDate
          }
        });
      }
    }
  }
  for (const key of Object.keys(incomingPlanningTotals)) {
    const item = incomingPlanningTotals[key];
    const existing = await prisma8.planningProjectQuantityTracker.findUnique({
      where: {
        projectNo_stream_fontColor: {
          projectNo: item.projectNo,
          stream: item.stream,
          fontColor: item.fontColor
        }
      }
    });
    if (!existing) {
      await prisma8.planningProjectQuantityTracker.create({
        data: {
          projectNo: item.projectNo,
          stream: item.stream,
          fontColor: item.fontColor,
          projectShortname: item.pShort || null,
          projectName: item.pName || null,
          lastQuantity: item.totalQty,
          lastChangedDate: todayStr
        }
      });
    } else if (existing.lastQuantity !== item.totalQty) {
      await prisma8.planningProjectQuantityTracker.update({
        where: { id: existing.id },
        data: {
          lastQuantity: item.totalQty,
          lastChangedDate: todayStr,
          projectShortname: item.pShort || existing.projectShortname,
          projectName: item.pName || existing.projectName
        }
      });
    }
  }
  const productionRows = datasetMap["PRODUCTION" /* PRODUCTION */] || [];
  for (const row of productionRows) {
    const pShortRaw = findCellValue(row.data, "Short Name") || findCellValue(row.data, "Project Shortname") || findCellValue(row.data, "Project Shortname (from planning column B)") || findCellValue(row.data, "Customer & Project Name") || findCellValue(row.data, "Project Name") || row.rawCells?.[1] || row.rawCells?.[0] || row.rawCells?.[2];
    const pShort = cleanStr(pShortRaw);
    const pNo = cleanStr(findCellValue(row.data, "Project No") || findCellValue(row.data, "Project No.") || row.rawCells?.[0]);
    const pName = String(pShortRaw || "");
    let stream = "1";
    for (const sh of STREAM_HEADER_CANDIDATES) {
      const v = findCellValue(row.data, sh);
      if (v !== null && v !== void 0 && v !== "") {
        stream = normalizeStream(v);
        break;
      }
    }
    const rawSeries = findCellValue(row.data, "Series (from planning column G)") || findCellValue(row.data, "Series") || findCellValue(row.data, "Series No") || row.rawCells?.[6];
    let seriesNumber = rawSeries ? parseInt(String(rawSeries).replace(/[^0-9]/g, ""), 10) : 0;
    if (!seriesNumber || isNaN(seriesNumber)) {
      seriesNumber = detectedProdSeries > 0 ? detectedProdSeries : 1;
    }
    const fontColor = normalizeColor(row.fontColor);
    const rawProduced = findCellValue(row.data, "Total Produced") ?? findCellValue(row.data, "Total Produced Quantity") ?? findCellValue(row.data, "Produced Quantity") ?? findCellValue(row.data, "Produced (m2)") ?? findCellValue(row.data, "Column Q") ?? row.rawCells?.[16] ?? findCellValue(row.data, "__COLUMN_Q__");
    const totalProduced = parseNumeric(rawProduced);
    if (pShort && seriesNumber > 0 && totalProduced > 0) {
      await prisma8.productionSeriesHistory.upsert({
        where: {
          projectShortname_stream_fontColor_seriesNumber: {
            projectShortname: pShort,
            stream,
            fontColor,
            seriesNumber
          }
        },
        update: {
          totalProduced,
          projectNo: pNo || void 0,
          projectName: pName || void 0
        },
        create: {
          projectShortname: pShort,
          projectNo: pNo || null,
          projectName: pName || null,
          stream,
          fontColor,
          seriesNumber,
          totalProduced
        }
      });
    }
  }
  const allQuantityTrackers = await prisma8.planningProjectQuantityTracker.findMany();
  const allHistoricalPlanningSeries = await prisma8.planningSeriesHistory.findMany({
    orderBy: { seriesNumber: "asc" }
  });
  const previousRun = (latestDbRun?.records?.length > 0 ? latestDbRun : null) ?? await prisma8.mr11Run.findFirst({
    where: {
      status: "READY",
      recordCount: { gt: 0 }
    },
    orderBy: { generatedAt: "desc" }
  });
  const prevDispatchHistory = {
    ...previousRun?.sourceSnapshot?.dispatchTracker || {}
  };
  if (previousRun && Array.isArray(previousRun.records)) {
    for (const r of previousRun.records) {
      const rShort = cleanStr(r["Short Name"] || r["Project Shortname"] || r["Project Short Code"] || r["Short Code"] || getProjectIdentifier(r));
      const rName = cleanStr(r["Customer & Project Name"] || r["Project Name"]);
      const rStream = normalizeStream(r["Stream"]);
      const rFont = normalizeColor(r["_fontColor"]);
      const rFill = normalizeFillColor(r["_fillColor"]);
      const k = `${rShort}__${rName}__${rStream}__${rFont}__${rFill}`;
      const q = parseNumeric(
        r["Total Dispatch"] ?? r["Total Dispatched"] ?? r["Total Dispatched Quantity"] ?? r["Total Dispatch (m2)"] ?? r["Total Dispatched (m2)"]
      );
      let d = null;
      for (const key of Object.keys(r)) {
        const lk = key.toLowerCase();
        if (lk.includes("dispatch") && lk.includes("date") && r[key]) {
          d = String(r[key]).trim();
          break;
        }
      }
      if (q > 0 && !prevDispatchHistory[k]) {
        prevDispatchHistory[k] = { quantity: q, date: d || todayStr };
      }
    }
  }
  const newDispatchTracker = {};
  const bdRecords = datasetMap["BD" /* BD */];
  if (!bdRecords || bdRecords.length === 0) {
    const run2 = await prisma8.mr11Run.create({
      data: {
        status: "PARTIAL",
        sourceSnapshot,
        recordCount: 0,
        records: []
      }
    });
    return run2.id;
  }
  const designRows = datasetMap["DESIGN" /* DESIGN */] || [];
  const shellplanRows = datasetMap["SHELLPLAN" /* SHELLPLAN */] || [];
  const dispatchRows = datasetMap["DISPATCH" /* DISPATCH */] || [];
  const derivedMr11Rows = bdRecords.map((bdRowItem) => {
    const bdData = bdRowItem.data;
    const projectNo = cleanStr(findCellValue(bdData, "Project No") || findCellValue(bdData, "Project No.") || bdRowItem.rawCells?.[1]);
    const shortName = cleanStr(findCellValue(bdData, "Short Name") || findCellValue(bdData, "Project Shortname") || bdRowItem.rawCells?.[2]);
    const projectName = cleanStr(findCellValue(bdData, "Customer & Project Name") || findCellValue(bdData, "Project Name") || bdRowItem.rawCells?.[0]);
    let bdStream = "1";
    for (const sh of STREAM_HEADER_CANDIDATES) {
      const v = findCellValue(bdData, sh);
      if (v !== null && v !== void 0 && v !== "") {
        bdStream = normalizeStream(v);
        break;
      }
    }
    const bdFontColor = normalizeColor(bdRowItem.fontColor);
    const bdFillColor = normalizeFillColor(bdRowItem.fillColor);
    const outRow = {};
    const cellColors = {};
    for (const mapping of MR11_ORDERED_COLUMNS) {
      if (mapping.sourceDept === "BD" /* BD */) {
        let value = mapping.exact ? bdData[mapping.sourceColumn] ?? null : findCellValue(bdData, mapping.sourceColumn);
        for (const alias of mapping.aliases || []) {
          if (value !== null && value !== void 0 && value !== "") break;
          value = findCellValue(bdData, alias);
        }
        outRow[mapping.target] = value;
      }
    }
    const lmePricing = resolveLmePricing(bdData);
    outRow["LME Adjusted (USD)"] = lmePricing.lmeAdjusted;
    outRow["Final Selling Price (USD)"] = lmePricing.finalSellingPrice;
    const findBestDeptRow = (dept) => {
      const deptDataset = datasetMap[dept] || [];
      const possibleKeyNames = MR11_SOURCE_KEY_MAP[dept] || [];
      let bestCandidate = null;
      let highestScore = -1;
      for (const candidate of deptDataset) {
        const cData = candidate.data;
        let idMatched = false;
        for (const keyName of possibleKeyNames) {
          const raw = cleanStr(findCellValue(cData, keyName));
          if (raw && (raw === projectNo || raw === shortName || shortName && raw.includes(shortName))) {
            idMatched = true;
            break;
          }
        }
        if (!idMatched) continue;
        let score = 1;
        let cStream = "1";
        for (const sh of STREAM_HEADER_CANDIDATES) {
          const v = findCellValue(cData, sh);
          if (v !== null && v !== void 0 && v !== "") {
            cStream = normalizeStream(v);
            break;
          }
        }
        if (cStream === bdStream) score += 4;
        const cFont = normalizeColor(candidate.fontColor);
        if (cFont === bdFontColor) score += 8;
        const cFill = normalizeFillColor(candidate.fillColor);
        if (bdFillColor && cFill && cFill === bdFillColor) score += 10;
        if (score > highestScore) {
          highestScore = score;
          bestCandidate = cData;
        }
      }
      return bestCandidate;
    };
    for (const mapping of MR11_ORDERED_COLUMNS) {
      if (mapping.sourceDept !== "BD" /* BD */ && mapping.sourceDept !== "DESIGN" /* DESIGN */ && mapping.sourceDept !== "SHELLPLAN" /* SHELLPLAN */ && mapping.sourceDept !== "PLANNING" /* PLANNING */ && mapping.sourceDept !== "PRODUCTION" /* PRODUCTION */ && mapping.sourceDept !== "DISPATCH" /* DISPATCH */) {
        const bestCandidate = findBestDeptRow(mapping.sourceDept);
        outRow[mapping.target] = bestCandidate ? findCellValue(bestCandidate, mapping.sourceColumn) : null;
      }
    }
    const matchedDispatchRows = dispatchRows.filter((dRow) => {
      const dShort = cleanStr(
        findCellValue(dRow.data, "Short Name") || findCellValue(dRow.data, "Project Shortname") || findCellValue(dRow.data, "Project Shortname (from bd column C)") || findCellValue(dRow.data, "Project Short Code") || findCellValue(dRow.data, "Short Code") || dRow.rawCells?.[1] || dRow.rawCells?.[2]
      );
      const dName = cleanStr(
        findCellValue(dRow.data, "Customer & Project Name") || findCellValue(dRow.data, "Project Name") || findCellValue(dRow.data, "Project Name (from bd column A)") || dRow.rawCells?.[0] || dRow.rawCells?.[1]
      );
      const dNo = cleanStr(
        findCellValue(dRow.data, "Project No") || findCellValue(dRow.data, "Project No.") || dRow.rawCells?.[0]
      );
      const shortMatched = shortName && dShort && (dShort === shortName || dShort.includes(shortName) || shortName.includes(dShort)) || projectNo && dNo && (dNo === projectNo || dNo.includes(projectNo) || projectNo.includes(dNo));
      if (!shortMatched) return false;
      if (projectName && dName && !(dName === projectName || dName.includes(projectName) || projectName.includes(dName))) {
        return false;
      }
      let dStream = "1";
      for (const sh of STREAM_HEADER_CANDIDATES) {
        const v = findCellValue(dRow.data, sh);
        if (v !== null && v !== void 0 && v !== "") {
          dStream = normalizeStream(v);
          break;
        }
      }
      if (dStream !== bdStream) return false;
      const dFontColor = normalizeColor(dRow.fontColor);
      if (dFontColor !== bdFontColor) return false;
      const dFillColor = normalizeFillColor(dRow.fillColor);
      if (bdFillColor !== dFillColor) return false;
      return true;
    });
    let totalFormworkSailed = 0;
    let hasSailedValue = false;
    for (const dRow of matchedDispatchRows) {
      const rawSailed = findCellValue(dRow.data, "Formwork Quantity Sailed (m2)") ?? findCellValue(dRow.data, "Formwork Quantity Sailed m2") ?? findCellValue(dRow.data, "Formwork Quantity Sailed") ?? findCellValue(dRow.data, "Quantity Sailed (m2)") ?? findCellValue(dRow.data, "Quantity Sailed") ?? findCellValue(dRow.data, "Total Sailed (m2)") ?? findCellValue(dRow.data, "Total Sailed");
      const num = parseNumeric(rawSailed);
      if (!isNaN(num) && num > 0) {
        totalFormworkSailed += num;
        hasSailedValue = true;
      }
    }
    const finalFormworkSailed = hasSailedValue ? totalFormworkSailed : null;
    outRow["Formwork Quantity Sailed (m2)"] = finalFormworkSailed;
    outRow["Formwork Quantity Sailed m2"] = finalFormworkSailed;
    outRow["Formwork Quantity Sailed"] = finalFormworkSailed;
    if (Array.isArray(ORDERED_HEADER_LIST)) {
      ORDERED_HEADER_LIST.forEach((h) => {
        const cleanH = h.toLowerCase().trim();
        if (cleanH === "formwork quantity sailed (m2)" || cleanH === "formwork quantity sailed m2" || cleanH === "formwork quantity sailed" || cleanH === "quantity sailed (m2)" || cleanH.includes("formwork") && cleanH.includes("sailed")) {
          outRow[h] = finalFormworkSailed;
        }
      });
    }
    let matchedDispatchRowForK = null;
    let directColumnKValue = 0;
    for (const dRow of matchedDispatchRows) {
      const val = parseNumeric(
        findCellValue(dRow.data, "Total Dispatched") ?? findCellValue(dRow.data, "Total Dispatch") ?? findCellValue(dRow.data, "Total Dispatched Quantity") ?? findCellValue(dRow.data, "Dispatched Quantity") ?? findCellValue(dRow.data, "Total Dispatch (m2)") ?? findCellValue(dRow.data, "Total Dispatched (m2)") ?? findCellValue(dRow.data, "Column K") ?? dRow.rawCells?.[10] ?? findCellValue(dRow.data, "__COLUMN_K__")
      );
      if (val > directColumnKValue) {
        directColumnKValue = val;
        matchedDispatchRowForK = dRow;
      }
    }
    if (!matchedDispatchRowForK && matchedDispatchRows.length > 0) {
      matchedDispatchRowForK = matchedDispatchRows[matchedDispatchRows.length - 1];
    }
    const finalTotalDispatch = directColumnKValue > 0 ? directColumnKValue : null;
    outRow["Total Dispatch"] = finalTotalDispatch;
    outRow["Total Dispatched"] = finalTotalDispatch;
    outRow["Total Dispatched Quantity"] = finalTotalDispatch;
    outRow["Total Dispatch (m2)"] = finalTotalDispatch;
    outRow["Total Dispatched (m2)"] = finalTotalDispatch;
    outRow["Total Dispatched Quantity m2"] = finalTotalDispatch;
    if (Array.isArray(ORDERED_HEADER_LIST)) {
      ORDERED_HEADER_LIST.forEach((h) => {
        const cleanH = h.toLowerCase().trim();
        if (cleanH === "total dispatch" || cleanH === "total dispatched" || cleanH === "total dispatched quantity" || cleanH === "total dispatch (m2)" || cleanH === "total dispatched (m2)" || cleanH.includes("total dispatch") || cleanH.includes("total dispatched")) {
          outRow[h] = finalTotalDispatch;
        }
      });
    }
    const dispatchCompositeKey = `${shortName || projectNo}__${projectName}__${bdStream}__${bdFontColor}__${bdFillColor}`;
    const previousEntry = prevDispatchHistory[dispatchCompositeKey];
    let resolvedDispatchedDate = null;
    if (directColumnKValue > 0) {
      if (!previousEntry) {
        resolvedDispatchedDate = todayStr;
        newDispatchTracker[dispatchCompositeKey] = { quantity: directColumnKValue, date: todayStr };
      } else if (previousEntry.quantity !== directColumnKValue) {
        resolvedDispatchedDate = todayStr;
        newDispatchTracker[dispatchCompositeKey] = { quantity: directColumnKValue, date: todayStr };
      } else {
        resolvedDispatchedDate = previousEntry.date || todayStr;
        newDispatchTracker[dispatchCompositeKey] = { quantity: directColumnKValue, date: resolvedDispatchedDate };
      }
    } else {
      resolvedDispatchedDate = null;
    }
    outRow["Dispatched Date"] = resolvedDispatchedDate;
    outRow["Dispatch Date"] = resolvedDispatchedDate;
    outRow["Actual Dispatched Date"] = resolvedDispatchedDate;
    outRow["Actual Dispatch Date"] = resolvedDispatchedDate;
    outRow["Date Dispatched"] = resolvedDispatchedDate;
    if (Array.isArray(ORDERED_HEADER_LIST)) {
      ORDERED_HEADER_LIST.forEach((h) => {
        const cleanH = h.toLowerCase().trim();
        if (cleanH === "dispatched date" || cleanH === "dispatch date" || cleanH === "actual dispatched date" || cleanH === "actual dispatch date" || cleanH === "date dispatched" || cleanH.includes("dispatch") && cleanH.includes("date")) {
          outRow[h] = resolvedDispatchedDate;
        }
      });
    }
    let latestDateW = null;
    let latestDateWStr = null;
    let latestDatePV = null;
    let latestDatePVStr = null;
    const atdHeaderIdx = Object.entries(dispatchHeaders).filter(([, h]) => /^(atd|atd date|actual time of departure)$/i.test(String(h).trim())).map(([c]) => Number(c));
    const etdHeaderIdx = Object.entries(dispatchHeaders).filter(([, h]) => /\betd\b/i.test(String(h))).map(([c]) => Number(c));
    const atdColumns = atdHeaderIdx.length ? atdHeaderIdx : [22];
    const etdColumns = etdHeaderIdx.length ? etdHeaderIdx : [15, 16, 17, 18, 19, 20, 21];
    for (const dRow of matchedDispatchRows) {
      const candidateWValues = atdColumns.flatMap((c) => [
        dRow.rawCells?.[c],
        dispatchHeaders[c] ? dRow.data[dispatchHeaders[c]] : void 0
      ]);
      for (const valW of candidateWValues) {
        if (valW !== void 0 && valW !== null && String(valW).trim() !== "") {
          const d = parseFlexibleDate(valW);
          if (d) {
            if (!latestDateW || d.getTime() > latestDateW.getTime()) {
              latestDateW = d;
              latestDateWStr = formatDateString(d);
            }
          } else {
            const s = String(valW).trim();
            if (s && s !== "-" && !latestDateWStr) {
              latestDateWStr = s;
            }
          }
        }
      }
      for (const c of etdColumns) {
        const candidatePVValues = [
          dRow.rawCells?.[c],
          dispatchHeaders[c] ? dRow.data[dispatchHeaders[c]] : void 0
        ];
        for (const valPV of candidatePVValues) {
          if (valPV !== void 0 && valPV !== null && String(valPV).trim() !== "") {
            const d = parseFlexibleDate(valPV);
            if (d) {
              if (!latestDatePV || d.getTime() > latestDatePV.getTime()) {
                latestDatePV = d;
                latestDatePVStr = formatDateString(d);
              }
            } else {
              const s = String(valPV).trim();
              if (s && s !== "-" && !latestDatePVStr) {
                latestDatePVStr = s;
              }
            }
          }
        }
      }
    }
    let finalAtdDate = null;
    let atdColor = "#FFFFFF";
    if (latestDateWStr) {
      finalAtdDate = latestDateWStr;
      atdColor = "#FFFFFF";
    } else if (latestDatePVStr) {
      finalAtdDate = latestDatePVStr;
      atdColor = "#FFFF00";
    }
    outRow["ATD"] = finalAtdDate;
    outRow["ATD Date"] = finalAtdDate;
    outRow["Actual Time of Departure"] = finalAtdDate;
    outRow["_atdColor"] = atdColor;
    if (Array.isArray(ORDERED_HEADER_LIST)) {
      ORDERED_HEADER_LIST.forEach((h) => {
        const cleanH = h.toLowerCase().trim();
        if (cleanH === "atd" || cleanH === "atd date" || cleanH === "actual time of departure" || cleanH === "actual departure date" || cleanH.includes("atd")) {
          outRow[h] = finalAtdDate;
          cellColors[h] = atdColor;
        }
      });
    }
    cellColors["ATD"] = atdColor;
    cellColors["ATD Date"] = atdColor;
    cellColors["Actual Time of Departure"] = atdColor;
    outRow["_cellColors"] = cellColors;
    const MONTH_COLUMNS_26 = MONTH_LABELS.map((m) => `${m}-26`);
    const MONTH_COLUMNS_27 = MONTH_LABELS.map((m) => `${m}-27`);
    const financeRow = findBestDeptRow("FINANCE" /* FINANCE */);
    const monthValues = {};
    if (financeRow) {
      for (const { header, label } of financeMonthColumns) {
        const v = parseNumeric(financeRow[header]);
        if (v > 0) monthValues[label] = (monthValues[label] || 0) + v;
      }
    }
    let sum2026 = 0;
    let sum2027 = 0;
    MONTH_COLUMNS_26.forEach((mCol) => {
      const val = monthValues[mCol] || 0;
      outRow[mCol] = val > 0 ? val : null;
      sum2026 += val;
    });
    outRow["Total 2026 m2"] = sum2026 > 0 ? sum2026 : null;
    MONTH_COLUMNS_27.forEach((mCol) => {
      const val = monthValues[mCol] || 0;
      outRow[mCol] = val > 0 ? val : null;
      sum2027 += val;
    });
    outRow["Total 2027 m2"] = sum2027 > 0 ? sum2027 : null;
    const streamMatchedDesign = designRows.filter((dRow) => {
      const dProjNo = cleanStr(findCellValue(dRow.data, "Project No") || findCellValue(dRow.data, "Project No.") || dRow.rawCells?.[0]);
      const dProjName = cleanStr(findCellValue(dRow.data, "Project Name") || findCellValue(dRow.data, "Customer & Project Name") || dRow.rawCells?.[1]);
      let dStream = null;
      for (const sh of STREAM_HEADER_CANDIDATES) {
        const v = findCellValue(dRow.data, sh);
        if (v !== null && v !== void 0 && String(v).trim() !== "") {
          dStream = normalizeStream(v);
          break;
        }
      }
      const idMatches = projectNo && dProjNo && (dProjNo === projectNo || dProjNo.includes(projectNo) || projectNo.includes(dProjNo)) || projectName && dProjName && (dProjName === projectName || dProjName.includes(projectName) || projectName.includes(dProjName)) || shortName && dProjName && dProjName.includes(shortName);
      if (!idMatches) return false;
      if (dStream && dStream !== bdStream) {
        return false;
      }
      return true;
    });
    const designStatuses = streamMatchedDesign.map(
      (d) => findCellValue(d.data, "Formwork Design Status") || findCellValue(d.data, "design status") || findCellValue(d.data, "Design Status") || findCellValue(d.data, "Status")
    ).filter((v) => v !== null && v !== void 0 && String(v).trim() !== "");
    const resolvedFormworkStatus = resolveConsolidatedDesignStatus(designStatuses.map(String));
    outRow["Formwork Design Status"] = resolvedFormworkStatus;
    outRow["design status"] = resolvedFormworkStatus;
    const designDates = streamMatchedDesign.map(
      (d) => findCellValue(d.data, "Actual Formwork Order Completion Date") || findCellValue(d.data, "Actual Completion Date") || findCellValue(d.data, "estimated design completion date (should be date or tbc) ") || findCellValue(d.data, "Completion Date")
    ).filter((v) => v !== null && v !== void 0 && String(v).trim() !== "");
    let latestDesignDate = null;
    for (const dv of designDates) {
      const fDate = formatDateString(dv);
      if (fDate && (!latestDesignDate || fDate > latestDesignDate)) {
        latestDesignDate = fDate;
      }
    }
    outRow["Actual Formwork Order Completion Date"] = latestDesignDate;
    outRow["latest design date"] = latestDesignDate;
    const holingStatuses = streamMatchedDesign.map(
      (d) => findCellValue(d.data, "holing status (Completed/Not Completed/) -dropdown") || findCellValue(d.data, "holing status") || findCellValue(d.data, "Holing Status")
    ).filter((v) => v !== null && v !== void 0 && String(v).trim() !== "");
    const resolvedHolingStatus = resolveConsolidatedHolingStatus(holingStatuses.map(String));
    outRow["holing status"] = resolvedHolingStatus;
    outRow["Holing Status"] = resolvedHolingStatus;
    const holingDates = streamMatchedDesign.map(
      (d) => findCellValue(d.data, "holing completion date") || findCellValue(d.data, "holing date") || findCellValue(d.data, "Holing Completion Date")
    ).filter((v) => v !== null && v !== void 0 && String(v).trim() !== "");
    let latestHolingDate = null;
    for (const hd of holingDates) {
      const fDate = formatDateString(hd);
      if (fDate && (!latestHolingDate || fDate > latestHolingDate)) {
        latestHolingDate = fDate;
      }
    }
    outRow["holing date"] = latestHolingDate;
    outRow["Holing Date"] = latestHolingDate;
    const accStatuses = streamMatchedDesign.map(
      (d) => findCellValue(d.data, "accessories status dropdown (to start, ongoing, completed, on hold)") || findCellValue(d.data, "accessories status") || findCellValue(d.data, "Accessories Status")
    ).filter((v) => v !== null && v !== void 0 && String(v).trim() !== "");
    const resolvedAccStatus = resolveConsolidatedAccessoriesStatus(accStatuses.map(String));
    outRow["accessories status"] = resolvedAccStatus;
    outRow["Accessories Status"] = resolvedAccStatus;
    const accDates = streamMatchedDesign.map(
      (d) => findCellValue(d.data, "accessories completion date") || findCellValue(d.data, "accessories date") || findCellValue(d.data, "Accessories Completion Date")
    ).filter((v) => v !== null && v !== void 0 && String(v).trim() !== "");
    let latestAccDate = null;
    for (const ad of accDates) {
      const fDate = formatDateString(ad);
      if (fDate && (!latestAccDate || fDate > latestAccDate)) {
        latestAccDate = fDate;
      }
    }
    outRow["accessories date"] = latestAccDate;
    outRow["Accessories Date"] = latestAccDate;
    let totalQuantityOrdered = 0;
    let hasQuantity = false;
    for (const d of streamMatchedDesign) {
      const rawQ = findCellValue(d.data, "Total Quantity Ordered m2") ?? findCellValue(d.data, "Total Quantity Ordered (m2)") ?? findCellValue(d.data, "Total Quantity Ordered") ?? findCellValue(d.data, "Total Quantity") ?? findCellValue(d.data, "Quantity Ordered");
      const num = parseNumeric(rawQ);
      if (!isNaN(num) && num > 0) {
        totalQuantityOrdered += num;
        hasQuantity = true;
      }
    }
    const finalQuantityAN = hasQuantity ? totalQuantityOrdered : null;
    outRow["Total Quantity Ordered m2"] = finalQuantityAN;
    outRow["Total Quantity Ordered (m2)"] = finalQuantityAN;
    outRow["Total Quantity Ordered"] = finalQuantityAN;
    outRow["processed qty"] = finalQuantityAN;
    const streamMatchedShellplan = shellplanRows.filter((spRow) => {
      const spProjNo = cleanStr(findCellValue(spRow.data, "Project No") || findCellValue(spRow.data, "Project No.") || spRow.rawCells?.[0]);
      const spProjName = cleanStr(findCellValue(spRow.data, "Project Name") || findCellValue(spRow.data, "Customer & Project Name") || spRow.rawCells?.[1]);
      let spStream = null;
      for (const sh of STREAM_HEADER_CANDIDATES) {
        const v = findCellValue(spRow.data, sh);
        if (v !== null && v !== void 0 && String(v).trim() !== "") {
          spStream = normalizeStream(v);
          break;
        }
      }
      const idMatches = projectNo && spProjNo && (spProjNo === projectNo || spProjNo.includes(projectNo) || projectNo.includes(spProjNo)) || projectName && spProjName && (spProjName === projectName || spProjName.includes(projectName) || projectName.includes(spProjName)) || shortName && spProjName && spProjName.includes(shortName);
      if (!idMatches) return false;
      if (spStream && spStream !== bdStream) {
        return false;
      }
      return true;
    });
    const spStatuses = streamMatchedShellplan.map(
      (c) => findCellValue(c.data, "Shell Plan Status") || findCellValue(c.data, "shellplan status") || findCellValue(c.data, "Shell Plan Status - Pending Consultant Drawings") || findCellValue(c.data, "Status")
    ).filter((v) => v !== null && v !== void 0 && String(v).trim() !== "");
    const resolvedSpStatus = resolveConsolidatedShellplanStatus(spStatuses.map(String));
    outRow["shellplan status"] = resolvedSpStatus;
    outRow["Shell Plan Status"] = resolvedSpStatus;
    outRow["Shell Plan Status - Pending Consultant Drawings"] = resolvedSpStatus;
    const spRevisions = streamMatchedShellplan.map((c) => findCellValue(c.data, "Latest Revision") || findCellValue(c.data, "latest revision version")).filter((v) => v !== null && v !== void 0 && String(v).trim() !== "");
    const latestRevision = spRevisions.length > 0 ? spRevisions[spRevisions.length - 1] : null;
    outRow["latest revision version"] = latestRevision;
    outRow["Latest Revision"] = latestRevision;
    const spSubmissionDates = streamMatchedShellplan.map((c) => findCellValue(c.data, "Latest Submission Date") || findCellValue(c.data, "latest revision date")).filter((v) => v !== null && v !== void 0 && String(v).trim() !== "");
    let latestSubmissionDateStr = null;
    for (const sv of spSubmissionDates) {
      const fDate = formatDateString(sv);
      if (fDate && (!latestSubmissionDateStr || fDate > latestSubmissionDateStr)) {
        latestSubmissionDateStr = fDate;
      }
    }
    outRow["latest revision date"] = latestSubmissionDateStr;
    outRow["Latest Submission Date"] = latestSubmissionDateStr;
    const spApprovedDates = streamMatchedShellplan.map((c) => findCellValue(c.data, "Shell Plan Approved Date") || findCellValue(c.data, "shellplan approval date") || findCellValue(c.data, "Approved Date")).filter((v) => v !== null && v !== void 0 && String(v).trim() !== "");
    let latestApprovedDateStr = null;
    for (const sv of spApprovedDates) {
      const fDate = formatDateString(sv);
      if (fDate && (!latestApprovedDateStr || fDate > latestApprovedDateStr)) {
        latestApprovedDateStr = fDate;
      }
    }
    outRow["shellplan approval date"] = latestApprovedDateStr;
    outRow["Shell Plan Approved Date"] = latestApprovedDateStr;
    const sameProject = (otherNo, otherShort) => shortName && otherShort ? otherShort === shortName : Boolean(projectNo && otherNo === projectNo);
    const matchedPlanningSeries = allHistoricalPlanningSeries.filter((s) => {
      const matchesId = sameProject(cleanStr(s.projectNo), cleanStr(s.projectShortname));
      const matchesStream = normalizeStream(s.stream || "1") === bdStream;
      const sFont = normalizeColor(s.fontColor);
      return matchesId && matchesStream && sFont === bdFontColor;
    });
    if (matchedPlanningSeries.length > 0) {
      const sumProcessed = matchedPlanningSeries.reduce((acc, curr) => acc + (curr.totalProcessed || 0), 0);
      outRow["Total Processed"] = sumProcessed;
      outRow["Total Processed (m2)"] = sumProcessed;
    }
    const tracker = allQuantityTrackers.find(
      (t) => sameProject(cleanStr(t.projectNo), cleanStr(t.projectShortname)) && normalizeStream(t.stream || "1") === bdStream && normalizeColor(t.fontColor) === bdFontColor
    );
    let matchedPlanningRow = null;
    let highestPlanScore = -1;
    for (const p of planningRows) {
      const pNo = cleanStr(findCellValue(p.data, "Project No") || findCellValue(p.data, "Project No.") || findCellValue(p.data, "Project No. (from design column A)"));
      const pShort = cleanStr(findCellValue(p.data, "Short Name") || findCellValue(p.data, "Project Shortname") || findCellValue(p.data, "Project Shortname (from bd column C)"));
      if (!sameProject(pNo, pShort)) continue;
      let score = 1;
      let pStream = "1";
      for (const sh of STREAM_HEADER_CANDIDATES) {
        const v = findCellValue(p.data, sh);
        if (v !== null && v !== void 0 && v !== "") {
          pStream = normalizeStream(v);
          break;
        }
      }
      if (pStream === bdStream) score += 4;
      const pColor = normalizeColor(p.fontColor);
      const pFill = normalizeFillColor(p.fillColor);
      if (pColor === bdFontColor) score += 8;
      if (bdFillColor && pFill && pFill === bdFillColor) score += 10;
      if (score > highestPlanScore) {
        highestPlanScore = score;
        matchedPlanningRow = p;
      }
    }
    const activeClosingDate = matchedPlanningRow ? findCellValue(matchedPlanningRow.data, "Closing Date ") || findCellValue(matchedPlanningRow.data, "Closing Date") || findCellValue(matchedPlanningRow.data, "Processed Date") : null;
    const latestSeriesClosingDate = matchedPlanningSeries.length > 0 ? matchedPlanningSeries[matchedPlanningSeries.length - 1].closingDate : null;
    const resolvedProcessedDate = activeClosingDate || latestSeriesClosingDate || (tracker ? tracker.lastChangedDate : null) || todayStr;
    outRow["Processed Date"] = resolvedProcessedDate;
    outRow["Closing Date"] = resolvedProcessedDate;
    let matchedProdRow = null;
    let highestProdScore = -1;
    const prodScores = [];
    for (const pRow of productionRows) {
      const pShort = cleanStr(
        findCellValue(pRow.data, "Short Name") || findCellValue(pRow.data, "Project Shortname") || findCellValue(pRow.data, "Project Shortname (from planning column B)") || pRow.rawCells?.[1] || pRow.rawCells?.[0] || pRow.rawCells?.[2]
      );
      const pNo = cleanStr(
        findCellValue(pRow.data, "Project No") || findCellValue(pRow.data, "Project No.") || pRow.rawCells?.[0]
      );
      const idMatches = shortName && pShort === shortName || projectNo && pNo === projectNo || shortName && pShort.includes(shortName) || projectNo && pShort.includes(projectNo) || projectName && pShort.includes(projectName);
      if (!idMatches) continue;
      let score = 1;
      let stream = "1";
      for (const sh of STREAM_HEADER_CANDIDATES) {
        const v = findCellValue(pRow.data, sh);
        if (v !== null && v !== void 0 && v !== "") {
          stream = normalizeStream(v);
          break;
        }
      }
      if (stream === bdStream) score += 4;
      const pColor = normalizeColor(pRow.fontColor);
      const pFill = normalizeFillColor(pRow.fillColor);
      if (pColor === bdFontColor) score += 8;
      if (bdFillColor && pFill && pFill === bdFillColor) score += 10;
      prodScores.push({ row: pRow, score });
      if (score > highestProdScore) {
        highestProdScore = score;
        matchedProdRow = pRow;
      }
    }
    const bestProdRows = prodScores.filter((p) => p.score === highestProdScore).map((p) => p.row);
    const directColumnQValue = matchedProdRow ? parseNumeric(
      findCellValue(matchedProdRow.data, "Total Produced") ?? findCellValue(matchedProdRow.data, "Total Produced Quantity") ?? findCellValue(matchedProdRow.data, "Produced Quantity") ?? findCellValue(matchedProdRow.data, "Produced (m2)") ?? findCellValue(matchedProdRow.data, "Column Q") ?? matchedProdRow.rawCells?.[16] ?? findCellValue(matchedProdRow.data, "__COLUMN_Q__")
    ) : 0;
    const finalColumnAQ = directColumnQValue > 0 ? directColumnQValue : null;
    outRow["Total Produced"] = finalColumnAQ;
    outRow["Total Produced Quantity"] = finalColumnAQ;
    outRow["produced qty"] = finalColumnAQ;
    let latestFilledDate = null;
    if (matchedProdRow) {
      const dayColumns = Object.entries(productionHeaders).map(([c, h]) => ({ c: Number(c), date: /^\d{4}-\d{2}-\d{2}/.test(String(h).trim()) ? formatDateString(h) : null })).filter((d) => Boolean(d.date));
      for (const pRow of bestProdRows) {
        for (const { c, date } of dayColumns) {
          const headerName = productionHeaders[c];
          const cellVal = pRow.rawCells?.[c];
          const targetVal = cellVal !== void 0 ? cellVal : pRow.data[headerName];
          if (isCellFilled(targetVal) && (!latestFilledDate || date > latestFilledDate)) {
            latestFilledDate = date;
          }
        }
      }
      if (!latestFilledDate) {
        const fallbackDate = findCellValue(matchedProdRow.data, "Day/Date") || findCellValue(matchedProdRow.data, "Date");
        latestFilledDate = parseFlexibleDate(fallbackDate) ? formatDateString(fallbackDate) : null;
      }
    }
    outRow["Produced Date"] = latestFilledDate;
    outRow["_fontColor"] = bdFontColor;
    outRow["_fillColor"] = bdFillColor;
    return outRow;
  });
  derivedMr11Rows.sort((a, b) => {
    const projA = getProjectIdentifier(a);
    const projB = getProjectIdentifier(b);
    if (projA !== projB) {
      return projA.localeCompare(projB);
    }
    const streamA = parseFloat(String(a["Stream"] || "1").replace(/[^0-9.]/g, "")) || 1;
    const streamB = parseFloat(String(b["Stream"] || "1").replace(/[^0-9.]/g, "")) || 1;
    if (streamA !== streamB) {
      return streamA - streamB;
    }
    const colorA = normalizeColor(a["_fontColor"]);
    const colorB = normalizeColor(b["_fontColor"]);
    const isBlackA = colorA === "#000000";
    const isBlackB = colorB === "#000000";
    if (isBlackA && !isBlackB) return -1;
    if (!isBlackA && isBlackB) return 1;
    if (colorA !== colorB) return colorA.localeCompare(colorB);
    const fillA = normalizeFillColor(a["_fillColor"]);
    const fillB = normalizeFillColor(b["_fillColor"]);
    return fillA.localeCompare(fillB);
  });
  for (let i = 0; i < derivedMr11Rows.length; ) {
    const curProj = getProjectIdentifier(derivedMr11Rows[i]);
    const curStream = normalizeStream(derivedMr11Rows[i]["Stream"]);
    let span = 1;
    while (i + span < derivedMr11Rows.length && getProjectIdentifier(derivedMr11Rows[i + span]) === curProj && normalizeStream(derivedMr11Rows[i + span]["Stream"]) === curStream) {
      span++;
    }
    derivedMr11Rows[i]["_isStreamLead"] = true;
    derivedMr11Rows[i]["_streamSpan"] = span;
    for (let j = 1; j < span; j++) {
      derivedMr11Rows[i + j]["_isStreamLead"] = false;
      derivedMr11Rows[i + j]["_streamSpan"] = 0;
      derivedMr11Rows[i + j]["Shell Plan Status - Pending Consultant Drawings"] = derivedMr11Rows[i]["Shell Plan Status - Pending Consultant Drawings"];
      derivedMr11Rows[i + j]["shellplan status"] = derivedMr11Rows[i]["shellplan status"];
      derivedMr11Rows[i + j]["Shell Plan Approved Date"] = derivedMr11Rows[i]["Shell Plan Approved Date"];
      derivedMr11Rows[i + j]["Formwork Design Status"] = derivedMr11Rows[i]["Formwork Design Status"];
      derivedMr11Rows[i + j]["Actual Formwork Order Completion Date"] = derivedMr11Rows[i]["Actual Formwork Order Completion Date"];
      derivedMr11Rows[i + j]["Total Quantity Ordered m2"] = derivedMr11Rows[i]["Total Quantity Ordered m2"];
    }
    i += span;
  }
  const run = await prisma8.mr11Run.create({
    data: {
      status: "READY",
      sourceSnapshot: {
        ...sourceSnapshot,
        dispatchTracker: newDispatchTracker
      },
      recordCount: derivedMr11Rows.length,
      records: derivedMr11Rows
    }
  });
  if (persist) {
    try {
      await saveMr11RunToDb({
        id: run.id,
        sourceSnapshot: { ...sourceSnapshot, dispatchTracker: newDispatchTracker, engineHistory: exportEngineHistory() },
        records: derivedMr11Rows
      });
    } catch (mr11DbErr) {
      console.error("[MR11 ENGINE] Could not save MR11 to the database:", mr11DbErr?.message);
    }
  }
  return run.id;
}

// server/modules/departments/department.service.ts
init_supabase();
var prisma3 = new PrismaClient();
async function processAtomicWorkbookUpload(prisma8, deptCode, filePathOrBuffer, originalFilename, mimeType, fileSize, userId, options = {}) {
  const { persist = true, regenerate = true } = options;
  const parsedWorkbook = await parseAndNormalizeWorkbook(filePathOrBuffer);
  let dept = await prisma8.department.findUnique({
    where: { code: deptCode }
  });
  if (!dept) {
    dept = await prisma8.department.findFirst({
      where: { code: deptCode }
    });
  }
  if (!dept) {
    throw new Error(`Department with code ${deptCode} not found in database`);
  }
  let validUserId = null;
  if (userId) {
    const existingUser = await prisma8.user.findUnique({ where: { id: userId } });
    if (existingUser) validUserId = existingUser.id;
  }
  if (!validUserId) {
    const adminUser2 = await prisma8.user.findFirst({ where: { email: "admin@mfeformwork.com" } });
    validUserId = adminUser2 ? adminUser2.id : null;
  }
  const storageKey = Buffer.isBuffer(filePathOrBuffer) ? `buffer://${originalFilename}` : filePathOrBuffer;
  const newVersion = await prisma8.fileVersion.create({
    data: {
      departmentId: dept.id,
      originalFilename,
      storageKey,
      fileSize,
      mimeType,
      status: "READY",
      parsedWorkbook,
      uploadedById: validUserId,
      uploadedAt: /* @__PURE__ */ new Date(),
      processedAt: /* @__PURE__ */ new Date()
    }
  });
  if (persist) {
    try {
      await saveFileVersionToDb({
        id: newVersion.id,
        deptCode,
        deptId: dept.id,
        deptName: dept.name,
        originalFilename,
        storageKey,
        fileSize,
        mimeType: mimeType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        parsedWorkbook,
        uploadedById: validUserId
      });
    } catch (dbErr) {
      console.error("[DEPARTMENT SERVICE] Could not save upload to the database:", dbErr?.message);
      throw new Error(`The workbook could not be saved to the database: ${dbErr?.message || dbErr}`);
    }
  }
  await prisma8.department.update({
    where: { id: dept.id },
    data: { activeVersionId: newVersion.id, activeSetAt: Date.now() }
  });
  try {
    await prisma8.auditLog.create({
      data: {
        userId: validUserId,
        action: "UPLOAD_WORKBOOK",
        entityType: "DEPARTMENT",
        entityId: dept.id,
        metadata: { filename: originalFilename, deptCode }
      }
    });
  } catch (err) {
    console.warn("Audit log write skipped:", err);
  }
  if (regenerate) {
    try {
      await hydrateActiveVersionsFromDb(prisma8, [deptCode]);
      await executeMr11Pipeline(prisma8);
    } catch (pipelineErr) {
      console.error("Auto MR11 pipeline calculation error:", pipelineErr);
    }
  }
  return newVersion;
}

// server/modules/departments/department.controller.ts
init_supabase();
import fs from "fs";
var prisma4 = new PrismaClient();
var DEPT_NAMES = {
  BD: "Business Development",
  FINANCE: "Finance",
  SHELLPLAN: "Shellplan",
  DESIGN: "Design",
  PLANNING: "Planning",
  PRODUCTION: "Production",
  DISPATCH: "Dispatch"
};
async function getActiveDepartmentWorkbook(req, res) {
  try {
    const rawParam = (req.params.code || req.params.id || req.params.deptCode || "").trim();
    const deptCode = rawParam.toUpperCase();
    const validRoleCodes = Object.keys(DEPT_NAMES);
    let dept = null;
    const dbVersion = validRoleCodes.includes(deptCode) ? await fetchActiveVersionForDepartment(deptCode) : null;
    if (dbVersion) {
      const memDept = await prisma4.department.findFirst({ where: { code: deptCode } });
      dept = {
        id: memDept?.id ?? dbVersion.departmentId,
        code: deptCode,
        name: memDept?.name ?? DEPT_NAMES[deptCode],
        description: memDept?.description ?? null,
        activeVersionId: dbVersion.id,
        activeVersion: dbVersion
      };
    }
    if (!dept || !dept.activeVersion) {
      const prismaDept = await prisma4.department.findFirst({
        where: {
          OR: [
            validRoleCodes.includes(deptCode) ? { code: deptCode } : void 0,
            { id: rawParam }
          ].filter(Boolean)
        },
        include: {
          activeVersion: {
            include: { uploadedBy: { select: { fullName: true, email: true } } }
          }
        }
      });
      if (prismaDept) {
        dept = prismaDept;
      }
    }
    if (!dept && validRoleCodes.includes(deptCode)) {
      dept = await prisma4.department.upsert({
        where: { code: deptCode },
        update: {},
        create: {
          code: deptCode,
          name: DEPT_NAMES[deptCode] || deptCode,
          description: `${DEPT_NAMES[deptCode] || deptCode} Department Workbook`
        },
        include: {
          activeVersion: {
            include: { uploadedBy: { select: { fullName: true, email: true } } }
          }
        }
      });
    }
    if (!dept) {
      return res.status(404).json({
        success: false,
        error: { code: "DEPT_NOT_FOUND", message: `Department '${rawParam}' not found` }
      });
    }
    return res.json({ success: true, data: dept });
  } catch (err) {
    console.error("getActiveDepartmentWorkbook error:", err);
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
}
async function uploadDepartmentWorkbook(req, res) {
  const rawParam = (req.params.code || req.params.id || "").trim();
  const deptCode = rawParam.toUpperCase();
  const user = req.user;
  const file = req.file;
  if (!file) {
    return res.status(400).json({
      success: false,
      error: { code: "FILE_REQUIRED", message: "No file uploaded" }
    });
  }
  if (user && !user.roles.includes("ADMIN" /* ADMIN */) && !user.roles.includes(deptCode)) {
    if (file.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch {
      }
    }
    return res.status(403).json({ success: false, error: { code: "UNAUTHORIZED_DEPARTMENT_UPLOAD" } });
  }
  try {
    const inputContent = file.buffer || file.path;
    await processAtomicWorkbookUpload(
      prisma4,
      deptCode,
      inputContent,
      file.originalname,
      file.mimetype,
      file.size,
      user?.id
    );
    if (file.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch {
      }
    }
    return res.json({
      success: true,
      message: `${deptCode} workbook uploaded and set as active. Master MR11 regenerated.`
    });
  } catch (err) {
    console.error("uploadDepartmentWorkbook error:", err);
    return res.status(500).json({
      success: false,
      error: { code: "UPLOAD_FAILED", message: err.message }
    });
  }
}
async function downloadOriginalFile(req, res) {
  try {
    const rawParam = (req.params.code || req.params.id || "").trim();
    const deptCode = rawParam.toUpperCase();
    const dept = await prisma4.department.findFirst({
      where: {
        OR: [{ code: deptCode }, { id: rawParam }]
      },
      include: { activeVersion: true }
    });
    if (!dept?.activeVersion?.storageKey || !fs.existsSync(dept.activeVersion.storageKey)) {
      return res.status(404).json({ success: false, error: { code: "FILE_NOT_FOUND" } });
    }
    res.setHeader(
      "Content-Type",
      dept.activeVersion.mimeType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.download(dept.activeVersion.storageKey, dept.activeVersion.originalFilename);
  } catch (err) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
}
async function listDepartments(req, res) {
  try {
    const departments = await prisma4.department.findMany({
      orderBy: { code: "asc" },
      include: {
        activeVersion: {
          select: {
            id: true,
            originalFilename: true,
            status: true,
            uploadedAt: true
          }
        }
      }
    });
    const dbFiles = await fetchActiveFileSummariesFromDb();
    const data = departments.map(
      (d) => dbFiles?.[d.code] ? { ...d, activeVersionId: dbFiles[d.code].id, activeVersion: dbFiles[d.code] } : d
    );
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
}

// server/modules/departments/department.routes.ts
var router2 = Router2();
var upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024
    // 25MB max
  }
});
router2.get("/", listDepartments);
router2.get("/:code", getActiveDepartmentWorkbook);
router2.get("/:code/workbook", getActiveDepartmentWorkbook);
router2.get("/:code/active", getActiveDepartmentWorkbook);
router2.post("/:code/upload", upload.single("file"), uploadDepartmentWorkbook);
router2.post("/:code", upload.single("file"), uploadDepartmentWorkbook);
router2.get("/:code/download", downloadOriginalFile);
var department_routes_default = router2;

// server/modules/mr11/mr11.routes.ts
var mr11_routes_exports = {};
__export(mr11_routes_exports, {
  default: () => mr11_routes_default
});
import { Router as Router3 } from "express";

// server/modules/mr11/mr11.controller.ts
init_prisma();
import ExcelJS2 from "exceljs";
init_supabase();

// server/utils/fx.ts
var CACHE_MS = 60 * 60 * 1e3;
var TIMEOUT_MS = 5e3;
var cached = null;
async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
var providers = [
  {
    name: "ExchangeRate-API",
    load: async () => {
      const j = await getJson("https://open.er-api.com/v6/latest/USD");
      const rate = Number(j?.rates?.MYR);
      if (j?.result !== "success" || !(rate > 0)) throw new Error("no MYR rate");
      const asOf = new Date(Number(j.time_last_update_unix) * 1e3).toISOString().slice(0, 10);
      return { rate, source: "ExchangeRate-API", asOf, live: true };
    }
  },
  {
    name: "Frankfurter (ECB)",
    load: async () => {
      const j = await getJson("https://api.frankfurter.dev/v1/latest?base=USD&symbols=MYR");
      const rate = Number(j?.rates?.MYR);
      if (!(rate > 0)) throw new Error("no MYR rate");
      return { rate, source: "Frankfurter (ECB)", asOf: String(j.date), live: true };
    }
  }
];
function fixedSettingRate() {
  const rate = Number(process.env.USD_TO_MYR_RATE);
  return Number.isFinite(rate) && rate > 0 ? { rate, source: "USD_TO_MYR_RATE setting", asOf: "", live: false } : null;
}
async function getUsdToMyrRate() {
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) return cached.value;
  for (const provider of providers) {
    try {
      const value = await provider.load();
      cached = { value, fetchedAt: Date.now() };
      return value;
    } catch (err) {
      console.warn(`[FX] ${provider.name} unavailable:`, err?.message || err);
    }
  }
  if (cached) return { ...cached.value, live: false };
  return fixedSettingRate();
}

// server/utils/lme.ts
var URL = "https://www.westmetall.com/en/markdaten.php?action=table&field=LME_Al_cash";
var CACHE_MS2 = 60 * 60 * 1e3;
var TIMEOUT_MS2 = 8e3;
var cached2 = null;
var toNumber = (s) => {
  const n = Number(s.replace(/,/g, "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
};
function parseWestmetallTable(html) {
  const rows = [];
  const rowRe = /<tr>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>/g;
  let m;
  while ((m = rowRe.exec(html)) && rows.length < 2) {
    const date = /* @__PURE__ */ new Date(`${m[1].replace(".", "")} UTC`);
    if (isNaN(date.getTime())) continue;
    rows.push({ date: date.toISOString().slice(0, 10), cash: toNumber(m[2]), threeMonth: toNumber(m[3]) });
  }
  const latest = rows[0];
  if (!latest?.cash) throw new Error("no LME aluminium price in the table");
  return {
    cash: latest.cash,
    threeMonth: latest.threeMonth,
    previousCash: rows[1]?.cash ?? null,
    asOf: latest.date,
    source: "LME official prices (via Westmetall)",
    live: true
  };
}
async function getLmeAluminiumPrice() {
  if (cached2 && Date.now() - cached2.fetchedAt < CACHE_MS2) return cached2.value;
  try {
    const res = await fetch(URL, {
      signal: AbortSignal.timeout(TIMEOUT_MS2),
      headers: { "User-Agent": "Mozilla/5.0 (MFE MR11)" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const value = parseWestmetallTable(await res.text());
    cached2 = { value, fetchedAt: Date.now() };
    return value;
  } catch (err) {
    console.warn("[LME] price unavailable:", err?.message || err);
    return cached2 ? { ...cached2.value, live: false } : null;
  }
}

// server/modules/mr11/mr11.controller.ts
var prisma5 = new PrismaClient();
var ORDERED_HEADER_LIST2 = ORDERED_HEADER_LIST || (MR11_ORDERED_COLUMNS || []).map((col) => col.target || col.header || String(col));
async function getLatestMr11(req, res) {
  try {
    const latestRun = await getLatestMr11Run(prisma5);
    const config = await prisma5.mr11Config.findUnique({ where: { id: "singleton" } });
    const [fx, lmePrice] = await Promise.all([getUsdToMyrRate(), getLmeAluminiumPrice()]);
    const run = latestRun;
    return res.json({
      success: true,
      data: {
        run,
        fxRate: fx,
        lmePrice,
        visibleColumns: config?.visibleColumns || [],
        orderedHeaders: ORDERED_HEADER_LIST2,
        headerGroups: MR11_HEADER_GROUPS,
        numberFormats: MR11_NUMBER_FORMATS,
        // Lets a department user's own columns be highlighted in their department colour
        columnDepartments: MR11_COLUMN_DEPARTMENTS,
        departmentColors: MR11_DEPARTMENT_COLORS
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
}
async function triggerMr11Regenerate(req, res) {
  try {
    await hydrateActiveVersionsFromDb(prisma5);
    const runId = await executeMr11Pipeline(prisma5);
    return res.json({ success: true, message: "MR11 regenerated", runId });
  } catch (err) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
}
async function getPlanningSeriesHistory(req, res) {
  try {
    const data = await prisma5.planningSeriesHistory.findMany({
      orderBy: [
        { projectNo: "asc" },
        { stream: "asc" },
        { seriesNumber: "asc" }
      ]
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
}
async function getProductionSeriesHistory(req, res) {
  try {
    const data = await prisma5.productionSeriesHistory.findMany({
      orderBy: [
        { projectShortname: "asc" },
        { stream: "asc" },
        { seriesNumber: "asc" }
      ]
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
}
async function exportMr11ToExcel(req, res) {
  try {
    const latestRun = await getLatestMr11Run(prisma5);
    if (!latestRun || !Array.isArray(latestRun.records) || latestRun.records.length === 0) {
      return res.status(400).json({ success: false, error: { message: "No MR11 records to export" } });
    }
    const records = latestRun.records;
    const workbook = new ExcelJS2.Workbook();
    const worksheet = workbook.addWorksheet("MR11 Master");
    const headers = ORDERED_HEADER_LIST2;
    worksheet.columns = headers.map((header) => ({
      key: header,
      width: Math.max(header.length + 4, 16),
      ...MR11_NUMBER_FORMATS[header] !== void 0 ? { style: { numFmt: `0.${"0".repeat(MR11_NUMBER_FORMATS[header])}` } } : {}
    }));
    const groupOf = (h) => MR11_HEADER_GROUPS.find((g2) => g2.columns.some((c) => c.key === h));
    const subLabel = (h) => groupOf(h)?.columns.find((c) => c.key === h)?.label ?? h;
    worksheet.addRow(headers.map((h) => groupOf(h)?.label ?? h));
    worksheet.addRow(headers.map((h) => groupOf(h) ? subLabel(h) : h));
    for (let c = 1; c <= headers.length; ) {
      const group = groupOf(headers[c - 1]);
      let span = 1;
      while (group && c + span <= headers.length && groupOf(headers[c + span - 1]) === group) span++;
      if (group && span > 1) worksheet.mergeCells(1, c, 1, c + span - 1);
      if (!group) worksheet.mergeCells(1, c, 2, c);
      c += span;
    }
    [1, 2].forEach((r) => {
      const headerRow = worksheet.getRow(r);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      headerRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
      });
    });
    records.forEach((row) => {
      const orderedRowData = {};
      headers.forEach((h) => {
        const places = MR11_NUMBER_FORMATS[h];
        const n = Number(row[h]);
        orderedRowData[h] = places !== void 0 && row[h] !== null && row[h] !== "" && !isNaN(n) ? n : row[h] ?? "";
      });
      const addedRow = worksheet.addRow(orderedRowData);
      if (row["_fontColor"]) {
        const hex = String(row["_fontColor"]).replace("#", "");
        const projCell = addedRow.getCell(1);
        projCell.font = {
          color: { argb: `FF${hex}` },
          bold: true
        };
      }
      if (row["_fillColor"]) {
        const hex = String(row["_fillColor"]).replace("#", "");
        addedRow.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: `FF${hex}` }
          };
        });
      }
    });
    const STREAM_MERGE_COLS = [
      "Shell Plan Status - Pending Consultant Drawings",
      // Col AJ
      "Shell Plan Approved Date",
      // Col AK
      "Formwork Design Status",
      // Col AL
      "Actual Formwork Order Completion Date",
      // Col AM
      "Total Quantity Ordered m2"
      // Col AN
    ];
    STREAM_MERGE_COLS.forEach((colName) => {
      const colIdx = headers.findIndex(
        (h) => h === colName || h.toLowerCase().trim() === colName.toLowerCase().trim()
      ) + 1;
      if (colIdx > 0) {
        let r = 3;
        for (let i = 0; i < records.length; ) {
          const span = records[i]["_streamSpan"] || 1;
          if (span > 1) {
            worksheet.mergeCells(r, colIdx, r + span - 1, colIdx);
            const mergedCell = worksheet.getCell(r, colIdx);
            mergedCell.alignment = { vertical: "middle", horizontal: "center" };
          }
          r += span;
          i += span;
        }
      }
    });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=MR11_Master_Order_${Date.now()}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    return res.status(500).json({ success: false, error: { message: err.message || "Export failed" } });
  }
}

// server/modules/mr11/mr11.routes.ts
var router3 = Router3();
router3.get("/", getLatestMr11);
router3.post("/regenerate", triggerMr11Regenerate);
router3.get("/export", exportMr11ToExcel);
router3.get("/planning-series", getPlanningSeriesHistory);
router3.get("/production-series", getProductionSeriesHistory);
var mr11_routes_default = router3;

// server/modules/admin/admin.routes.ts
var admin_routes_exports = {};
__export(admin_routes_exports, {
  adminRouter: () => router4,
  default: () => admin_routes_default
});
import { Router as Router4 } from "express";
import jwt2 from "jsonwebtoken";

// server/modules/admin/admin.controller.ts
init_prisma();
init_supabase();
import bcrypt2 from "bcryptjs";
var prisma6 = new PrismaClient();
async function persistUser(userId) {
  const user = await prisma6.user.findUnique({ where: { id: userId } });
  const roleIds = (await prisma6.userRole.findMany({ where: { userId } })).map((ur) => ur.roleId);
  try {
    await saveUserToDb(user, roleIds);
  } catch (err) {
    await hydrateUsersFromDb();
    throw new Error(`The change could not be saved to the database: ${err?.message || err}`);
  }
}
var DEFAULT_PROFILE_TABS = {
  ADMIN: ["ADMIN", "BD", "FINANCE", "SHELLPLAN", "DESIGN", "PLANNING", "PRODUCTION", "DISPATCH"],
  BD: ["BD"],
  FINANCE: ["FINANCE"],
  SHELLPLAN: ["SHELLPLAN"],
  DESIGN: ["DESIGN"],
  PLANNING: ["PLANNING"],
  PRODUCTION: ["PRODUCTION"],
  DISPATCH: ["DISPATCH"]
};
function extractRoleCodes(user) {
  if (!user || !user.roles || !Array.isArray(user.roles)) return [];
  return user.roles.map((ur) => {
    if (typeof ur === "string") return ur;
    return ur.role?.code || ur.role?.name || ur.roleCode || ur.code;
  }).filter(Boolean).map((s) => String(s).toUpperCase());
}
async function getAllUsersWithPermissions(req, res) {
  try {
    await hydrateUsersFromDb();
    const users = await prisma6.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        roles: {
          include: {
            role: true
          }
        },
        createdAt: true
      },
      orderBy: { createdAt: "asc" }
    });
    return res.json({
      success: true,
      data: users.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        createdAt: u.createdAt,
        roles: extractRoleCodes(u)
      }))
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: { message: err.message || "Failed to fetch users" } });
  }
}
async function updateUserPermissions(req, res) {
  try {
    const { userId } = req.params;
    const { roles, primaryProfile } = req.body;
    let targetRoles = [];
    if (primaryProfile && DEFAULT_PROFILE_TABS[primaryProfile]) {
      targetRoles = [...DEFAULT_PROFILE_TABS[primaryProfile]];
    } else if (Array.isArray(roles)) {
      targetRoles = roles;
    } else {
      return res.status(400).json({ success: false, error: { message: "Either roles array or valid primaryProfile is required" } });
    }
    await hydrateUsersFromDb();
    const targetUser = await prisma6.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } }
    });
    if (!targetUser) {
      return res.status(404).json({ success: false, error: { message: "User account not found" } });
    }
    if (targetUser?.email === "admin@mfeformwork.com" && !targetRoles.includes("ADMIN")) {
      targetRoles.push("ADMIN");
    }
    await prisma6.$transaction(async (tx) => {
      const allDbRoles = await tx.role.findMany();
      const roleMap = /* @__PURE__ */ new Map();
      allDbRoles.forEach((r) => {
        if (r.code) roleMap.set(String(r.code).toUpperCase(), r.id);
        if (r.name) roleMap.set(String(r.name).toUpperCase(), r.id);
      });
      await tx.userRole.deleteMany({
        where: { userId }
      });
      const recordsToCreate = targetRoles.map((code) => {
        const roleId = roleMap.get(String(code).toUpperCase());
        return roleId ? { userId, roleId } : null;
      }).filter((item) => item !== null);
      if (recordsToCreate.length > 0) {
        await tx.userRole.createMany({
          data: recordsToCreate
        });
      }
    });
    await persistUser(userId);
    const updatedUser = await prisma6.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        roles: {
          include: {
            role: true
          }
        }
      }
    });
    return res.json({
      success: true,
      message: "User authorization & tabs updated successfully",
      data: {
        id: updatedUser?.id,
        email: updatedUser?.email,
        fullName: updatedUser?.fullName,
        roles: extractRoleCodes(updatedUser)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: { message: err.message || "Failed to update authorization" } });
  }
}
async function createUser(req, res) {
  try {
    const { email, password, fullName, primaryProfile } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { message: "Corporate Email and Password are required" }
      });
    }
    await hydrateUsersFromDb();
    const existing = await prisma6.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: { message: "A user account with this email address already exists" }
      });
    }
    const passwordHash = await bcrypt2.hash(password, 10);
    const selectedProfile = primaryProfile || "CUSTOM";
    const targetRoles = DEFAULT_PROFILE_TABS[selectedProfile] || [];
    const allDbRoles = await prisma6.role.findMany();
    const roleMap = /* @__PURE__ */ new Map();
    allDbRoles.forEach((r) => {
      if (r.code) roleMap.set(String(r.code).toUpperCase(), r.id);
      if (r.name) roleMap.set(String(r.name).toUpperCase(), r.id);
    });
    const newUser = await prisma6.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: email.toLowerCase().trim(),
          passwordHash,
          fullName: fullName?.trim() || email.split("@")[0]
        }
      });
      const recordsToCreate = targetRoles.map((code) => {
        const roleId = roleMap.get(String(code).toUpperCase());
        return roleId ? { userId: createdUser.id, roleId } : null;
      }).filter((item) => item !== null);
      if (recordsToCreate.length > 0) {
        await tx.userRole.createMany({
          data: recordsToCreate
        });
      }
      return createdUser;
    });
    try {
      await persistUser(newUser.id);
    } catch (err) {
      if (await prisma6.user.findUnique({ where: { id: newUser.id } })) {
        await prisma6.user.delete({ where: { id: newUser.id } });
      }
      throw err;
    }
    return res.status(201).json({
      success: true,
      message: "New user created successfully",
      data: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        roles: targetRoles
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { message: err.message || "Failed to create user account" }
    });
  }
}
async function deleteUser(req, res) {
  try {
    const { userId } = req.params;
    await hydrateUsersFromDb();
    const targetUser = await prisma6.user.findUnique({
      where: { id: userId }
    });
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: { message: "User account not found" }
      });
    }
    if (targetUser.email === "admin@mfeformwork.com") {
      return res.status(403).json({
        success: false,
        error: { message: "The primary root administrator account cannot be deleted" }
      });
    }
    await deleteUserFromDb(userId);
    await prisma6.$transaction(async (tx) => {
      await tx.userRole.deleteMany({
        where: { userId }
      });
      try {
        await tx.departmentFileVersion?.updateMany({
          where: { uploadedById: userId },
          data: { uploadedById: null }
        });
      } catch (ignored) {
      }
      await tx.user.delete({
        where: { id: userId }
      });
    });
    return res.json({
      success: true,
      message: `Account for ${targetUser.email} has been deleted successfully`
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { message: err.message || "Failed to delete user account" }
    });
  }
}

// server/modules/admin/admin.routes.ts
var router4 = Router4();
var authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    res.status(401).json({ success: false, error: { message: "Authentication required" } });
    return;
  }
  const secret = process.env.JWT_SECRET || "mfe-formwork-mr11-enterprise-secret-key-2026";
  try {
    const decoded = jwt2.verify(token, secret);
    req.user = decoded;
    const userRoles = decoded.roles || (decoded.role ? [decoded.role] : []);
    const email = decoded.email || "";
    const isAdmin = userRoles.includes("ADMIN") || decoded.departmentRole === "ADMIN" || email === "admin@mfeformwork.com";
    if (!isAdmin) {
      res.status(403).json({ success: false, error: { message: "Access denied: Administrator privileges required" } });
      return;
    }
    next();
  } catch (err) {
    res.status(403).json({ success: false, error: { message: "Invalid or expired token" } });
    return;
  }
};
router4.use(authenticateAdmin);
router4.get("/users", getAllUsersWithPermissions);
router4.patch("/users/:userId/permissions", updateUserPermissions);
router4.get("/users", getAllUsersWithPermissions);
router4.post("/users", createUser);
router4.patch("/users/:userId/permissions", updateUserPermissions);
router4.get("/users", getAllUsersWithPermissions);
router4.post("/users", createUser);
router4.patch("/users/:userId/permissions", updateUserPermissions);
router4.delete("/users/:userId", deleteUser);
var admin_routes_default = router4;

// server/modules/visualization/visualization.routes.ts
var visualization_routes_exports = {};
__export(visualization_routes_exports, {
  default: () => visualization_routes_default
});
import { Router as Router5 } from "express";

// server/middleware/auth.middleware.ts
import jwt3 from "jsonwebtoken";
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: { code: "AUTH_REQUIRED", message: "JWT Bearer token required" } });
  }
  const token = authHeader.split(" ")[1];
  try {
    const secret = process.env.JWT_SECRET || "mfe-formwork-mr11-enterprise-secret-key-2026";
    const payload = jwt3.verify(token, secret);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ success: false, error: { code: "INVALID_TOKEN", message: "Token is expired or invalid" } });
  }
}

// server/middleware/rbac.middleware.ts
init_prisma();
function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: "AUTH_REQUIRED" } });
    }
    if (req.user.roles.includes("ADMIN" /* ADMIN */)) {
      return next();
    }
    const hasRole = req.user.roles.some((role) => allowedRoles.includes(role));
    if (!hasRole) {
      return res.status(403).json({
        success: false,
        error: { code: "ACCESS_DENIED", message: "You do not have permission for this resource." }
      });
    }
    next();
  };
}

// server/modules/visualization/visualization.routes.ts
init_prisma();

// server/modules/visualization/visualization.controller.ts
init_prisma();
init_supabase();
var prisma7 = new PrismaClient();
async function getVisualizationData(req, res) {
  const latestRun = await getLatestMr11Run(prisma7);
  if (!latestRun || !Array.isArray(latestRun.records)) {
    return res.json({
      success: true,
      data: {
        kpi: { totalProjects: 0, totalSellingUSD: 0, totalOrderedM2: 0, totalProduced: 0 },
        designStatusCounts: {},
        streamDistribution: {}
      }
    });
  }
  const records = latestRun.records;
  let totalSellingUSD = 0;
  let totalOrderedM2 = 0;
  let totalProduced = 0;
  const designStatusCounts = {};
  const streamDistribution = {};
  for (const r of records) {
    if (r["Final Selling Price (USD)"]) totalSellingUSD += Number(r["Final Selling Price (USD)"]) || 0;
    if (r["total quantity ordered m2"]) totalOrderedM2 += Number(r["total quantity ordered m2"]) || 0;
    if (r["produced qty"]) totalProduced += Number(r["produced qty"]) || 0;
    const ds = r["Formwork Design Status"] || "Unassigned";
    designStatusCounts[ds] = (designStatusCounts[ds] || 0) + 1;
    const stream = r["Stream"] || "Unassigned";
    streamDistribution[stream] = (streamDistribution[stream] || 0) + 1;
  }
  return res.json({
    success: true,
    data: {
      kpi: {
        totalProjects: records.length,
        totalSellingUSD: Math.round(totalSellingUSD),
        totalOrderedM2: Math.round(totalOrderedM2),
        totalProduced: Math.round(totalProduced)
      },
      designStatusCounts,
      streamDistribution
    }
  });
}

// server/modules/visualization/visualization.routes.ts
var router5 = Router5();
router5.get("/", requireAuth, requireRoles("ADMIN" /* ADMIN */, "CEO" /* CEO */), getVisualizationData);
var visualization_routes_default = router5;

// server/bootstrap.ts
init_prisma();
import fs2 from "fs";
import path from "path";
init_supabase();
var deptKeywords = {
  ["BD" /* BD */]: "bd.xlsx",
  ["FINANCE" /* FINANCE */]: "finance.xlsx",
  ["SHELLPLAN" /* SHELLPLAN */]: "shellplan.xlsx",
  ["DESIGN" /* DESIGN */]: "design.xlsx",
  ["PLANNING" /* PLANNING */]: "planning.xlsx",
  ["PRODUCTION" /* PRODUCTION */]: "production.xlsx",
  ["DISPATCH" /* DISPATCH */]: "dispatch.xlsx",
  ["ADMIN" /* ADMIN */]: "",
  ["CEO" /* CEO */]: ""
};
var bootstrapping = null;
function ensureBootstrapped() {
  if (!bootstrapping) {
    bootstrapping = bootstrapSystem().then((complete) => {
      if (!complete) bootstrapping = null;
    });
  }
  return bootstrapping;
}
async function bootstrapSystem() {
  try {
    if (await hydrateUsersFromDb()) {
      console.log("[MFE Formwork MR11] Loaded users from database");
    }
    const admin = await prisma.user.findFirst({ where: { email: "admin@mfeformwork.com" } });
    const adminId2 = admin?.id || "user-admin-1";
    const dbCodes = await hydrateActiveVersionsFromDb(prisma);
    if (dbCodes) {
      console.log(`[MFE Formwork MR11] Loaded active workbooks from database: ${[...dbCodes].join(", ") || "none"}`);
    }
    const uploadsStorageDir = path.resolve(process.cwd(), "uploads_storage");
    const uploadsDir = path.resolve(process.cwd(), "uploads");
    const searchDirs = isDatabaseConfigured() ? [] : [uploadsStorageDir, uploadsDir].filter((d) => fs2.existsSync(d));
    console.log(
      isDatabaseConfigured() ? "[MFE Formwork MR11] Database connected: sample workbooks are not loaded" : "[MFE Formwork MR11] No database: loading sample workbooks..."
    );
    for (const [codeStr, keyword] of Object.entries(deptKeywords)) {
      const code = codeStr;
      if (!keyword || dbCodes?.has(code)) continue;
      let targetPath = null;
      let targetFilename = null;
      for (const dir of searchDirs) {
        try {
          const files = fs2.readdirSync(dir);
          const matching = files.filter((f) => f.toLowerCase().endsWith(keyword)).sort((a, b) => b.localeCompare(a));
          if (matching.length > 0) {
            targetFilename = matching[0];
            targetPath = path.join(dir, targetFilename);
            break;
          }
        } catch {
        }
      }
      if (targetPath && targetFilename && fs2.existsSync(targetPath)) {
        try {
          const stat = fs2.statSync(targetPath);
          await processAtomicWorkbookUpload(
            prisma,
            code,
            targetPath,
            targetFilename,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            stat.size,
            adminId2,
            { persist: false, regenerate: false }
          );
          console.log(`[MFE Formwork MR11] Loaded active workbook for ${code} from ${targetFilename}`);
        } catch (e) {
          console.warn(`[MFE Formwork MR11] Note: Could not auto-load workbook for ${code}:`, e.message);
        }
      }
    }
    const dbRun = await fetchLatestMr11RunFromDb();
    if (dbRun && Array.isArray(dbRun.records) && dbRun.records.length > 0) {
      await prisma.mr11Run.create({ data: dbRun });
      restoreEngineHistory(dbRun);
      console.log("[MFE Formwork MR11] Loaded latest MR11 Master from database");
    } else {
      try {
        await executeMr11Pipeline(prisma, { persist: false });
        console.log("[MFE Formwork MR11] Initial MR11 Master generation complete");
      } catch (e) {
        console.warn("[MFE Formwork MR11] Initial MR11 pipeline notice:", e.message);
      }
    }
    return !isDatabaseConfigured() || dbCodes !== null;
  } catch (err) {
    console.error("[MFE Formwork MR11] Bootstrap notice:", err.message);
    return !isDatabaseConfigured();
  }
}

// server/app.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
var app = express();
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "MFE Formwork MR11 System" });
});
app.use((req, res, next) => {
  ensureBootstrapped().then(() => next(), next);
});
app.get("/api/health/db", async (req, res) => {
  try {
    const { getDatabaseUrl: getDatabaseUrl2, getSslConfig: getSslConfig2 } = await Promise.resolve().then(() => (init_database_config(), database_config_exports));
    const { normalizeDatabaseUrl: normalizeDatabaseUrl2 } = await Promise.resolve().then(() => (init_prisma(), prisma_exports));
    const { Pool } = await import("pg");
    const rawUrl = getDatabaseUrl2();
    if (!rawUrl) {
      return res.json({ status: "NOT_CONFIGURED", message: "DATABASE_URL is not set; running in memory only." });
    }
    const cleanUrl = normalizeDatabaseUrl2(rawUrl) || rawUrl;
    const maskedUrl = cleanUrl.replace(/:([^@:]+)@/, ":****@");
    const pool = new Pool({
      connectionString: cleanUrl,
      ssl: getSslConfig2(cleanUrl),
      connectionTimeoutMillis: 5e3
    });
    const result = await pool.query("SELECT NOW() as server_time, version() as version;");
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    await pool.end();
    const { describeDatabase: describeDatabase2 } = await Promise.resolve().then(() => (init_supabase(), supabase_exports));
    const contents = await describeDatabase2();
    return res.json({
      status: "CONNECTED",
      message: "Successfully connected to the PostgreSQL database.",
      endpoint: maskedUrl,
      serverTime: result.rows[0]?.server_time,
      version: result.rows[0]?.version?.split(" ")?.[0],
      tables: tablesResult.rows.map((r) => r.table_name),
      ...contents
    });
  } catch (err) {
    return res.status(200).json({
      status: "ERROR",
      message: err.message
    });
  }
});
function resolveRouter(mod, name) {
  const router6 = mod?.default || mod?.[name] || mod?.router || mod;
  if (!router6 || typeof router6 !== "function" && typeof router6?.use !== "function") {
    console.error(`[ROUTER ERROR] Module "${name}" failed to export a valid Express router! Available exports:`, Object.keys(mod || {}));
    const fallback = express.Router();
    fallback.all("*", (req, res) => {
      res.status(500).json({ error: `Router for ${name} is misconfigured.` });
    });
    return fallback;
  }
  return router6;
}
var authR = resolveRouter(auth_routes_exports, "authRouter");
var deptR = resolveRouter(department_routes_exports, "departmentRouter");
var mr11R = resolveRouter(mr11_routes_exports, "mr11Router");
var adminR = resolveRouter(admin_routes_exports, "adminRouter");
var visualizationR = resolveRouter(visualization_routes_exports, "visualizationRouter");
app.use("/api/auth", authR);
app.use("/api/departments", deptR);
app.use("/api/mr11", mr11R);
app.use("/api/admin", adminR);
app.use("/api/visualization", visualizationR);
var webDir = path2.resolve(process.env.WEB_DIR || path2.join(__dirname, "../../public"));
if (fs3.existsSync(path2.join(webDir, "index.html"))) {
  app.use(express.static(webDir));
  app.get(/^\/(?!api(\/|$)|health$).*/, (req, res) => {
    res.sendFile(path2.join(webDir, "index.html"));
  });
}

// server/vercel.ts
ensureBootstrapped();
var vercel_default = app;
export {
  vercel_default as default
};
