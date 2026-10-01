var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var prisma_exports = {};
__export(prisma_exports, {
  FileVersionStatus: () => FileVersionStatus,
  MockPrismaClient: () => MockPrismaClient,
  Mr11Status: () => Mr11Status,
  PrismaClient: () => PrismaClient,
  RoleCode: () => RoleCode,
  default: () => prisma_default,
  prisma: () => prisma
});
module.exports = __toCommonJS(prisma_exports);
var import_crypto = __toESM(require("crypto"), 1);
var RoleCode = /* @__PURE__ */ ((RoleCode2) => {
  RoleCode2["ADMIN"] = "ADMIN";
  RoleCode2["CEO"] = "CEO";
  RoleCode2["BD"] = "BD";
  RoleCode2["FINANCE"] = "FINANCE";
  RoleCode2["SHELLPLAN"] = "SHELLPLAN";
  RoleCode2["DESIGN"] = "DESIGN";
  RoleCode2["PLANNING"] = "PLANNING";
  RoleCode2["PRODUCTION"] = "PRODUCTION";
  RoleCode2["DISPATCH"] = "DISPATCH";
  return RoleCode2;
})(RoleCode || {});
var Mr11Status = /* @__PURE__ */ ((Mr11Status2) => {
  Mr11Status2["EMPTY"] = "EMPTY";
  Mr11Status2["PARTIAL"] = "PARTIAL";
  Mr11Status2["READY"] = "READY";
  Mr11Status2["FAILED"] = "FAILED";
  return Mr11Status2;
})(Mr11Status || {});
var FileVersionStatus = /* @__PURE__ */ ((FileVersionStatus2) => {
  FileVersionStatus2["UPLOADING"] = "UPLOADING";
  FileVersionStatus2["PROCESSING"] = "PROCESSING";
  FileVersionStatus2["READY"] = "READY";
  FileVersionStatus2["FAILED"] = "FAILED";
  return FileVersionStatus2;
})(FileVersionStatus || {});
function hashPassword(password) {
  const salt = import_crypto.default.randomBytes(16).toString("hex");
  const hash = import_crypto.default.pbkdf2Sync(password, salt, 1e3, 64, "sha512").toString("hex");
  return `pbkdf2$${salt}$${hash}`;
}
const store = {
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
const INITIAL_ROLES = [
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
const INITIAL_DEPTS = [
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
const adminId = "user-admin-1";
const adminEmail = "admin@mfeformwork.com";
const adminUser = {
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
store.mr11Config.set("singleton", {
  id: "singleton",
  visibleColumns: [],
  updatedAt: /* @__PURE__ */ new Date()
});
function matchesWhere(item, where) {
  if (!where || typeof where !== "object") return true;
  if (Array.isArray(where.OR)) {
    return where.OR.some((clause) => matchesWhere(item, clause));
  }
  for (const [key, val] of Object.entries(where)) {
    if (val === void 0) continue;
    if (key === "email" && typeof val === "string") {
      if (String(item.email || "").toLowerCase() !== val.toLowerCase()) return false;
    } else if (typeof val === "object" && val !== null) {
      if (val.in && Array.isArray(val.in)) {
        if (!val.in.includes(item[key])) return false;
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
class MockPrismaClient {
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
        if (store.mr11Runs.length === 0) return null;
        if (args.orderBy?.generatedAt === "desc") {
          return { ...store.mr11Runs[store.mr11Runs.length - 1] };
        }
        return { ...store.mr11Runs[0] };
      },
      findMany: async () => [...store.mr11Runs],
      create: async (args) => {
        const run = {
          id: args.data.id || `run-${Date.now()}`,
          generatedAt: /* @__PURE__ */ new Date(),
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
      findMany: async () => Array.from(store.planningProjectQuantityTrackers.values()),
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
}
const PrismaClient = MockPrismaClient;
const prisma = new MockPrismaClient();
var prisma_default = prisma;
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PrismaClient: MockPrismaClient,
    MockPrismaClient,
    prisma,
    RoleCode,
    Mr11Status,
    FileVersionStatus,
    default: prisma
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  FileVersionStatus,
  MockPrismaClient,
  Mr11Status,
  PrismaClient,
  RoleCode,
  prisma
});
module.exports = __toCommonJS(prisma_exports);
