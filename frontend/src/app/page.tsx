"use client";

import React, { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AnchorProvider, BN, web3 } from "@coral-xyz/anchor";
import {
  getProgram,
  getRbacStatePDA,
  getRolePDA,
  getUserRolePDA,
  PERMISSIONS,
} from "../utils/anchor";
import {
  Shield,
  Plus,
  Key,
  Clock,
  ShieldCheck,
  XCircle,
  Trash2,
  Loader2,
  Zap,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { PermissionBadge } from "../components/PermissionBadge";

// ─── Helpers ───────────────────────────────────────────────────────────────

function GlassCard({
  title,
  icon,
  accentColor = "purple",
  children,
}: {
  title: string;
  icon: React.ReactNode;
  accentColor?: "purple" | "cyan" | "emerald" | "rose";
  children: React.ReactNode;
}) {
  const accentMap = {
    purple: {
      border: "hover:border-violet-500/40 hover:shadow-[0_0_24px_rgba(139,92,246,0.15)]",
      bar: "from-transparent via-violet-500/40 to-transparent",
    },
    cyan: {
      border: "hover:border-cyan-500/40 hover:shadow-[0_0_24px_rgba(34,211,238,0.15)]",
      bar: "from-transparent via-cyan-500/40 to-transparent",
    },
    emerald: {
      border: "hover:border-emerald-500/40 hover:shadow-[0_0_24px_rgba(52,211,153,0.15)]",
      bar: "from-transparent via-emerald-500/40 to-transparent",
    },
    rose: {
      border: "hover:border-rose-500/40 hover:shadow-[0_0_24px_rgba(244,63,94,0.15)]",
      bar: "from-transparent via-rose-500/40 to-transparent",
    },
  };

  const { border, bar } = accentMap[accentColor];

  return (
    <div
      className={`relative rounded-2xl overflow-hidden bg-slate-900/50 border border-white/[0.07] backdrop-blur-xl shadow-2xl transition-all duration-300 ${border}`}
    >
      {/* Top accent line */}
      <div className={`absolute top-0 left-0 w-full h-px bg-gradient-to-r ${bar}`} />

      {/* Card header */}
      <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-white/[0.05]">
        <div className="p-2 rounded-xl bg-white/5 border border-white/[0.07]">
          {icon}
        </div>
        <h3 className="font-semibold text-slate-100 text-base tracking-wide">
          {title}
        </h3>
      </div>

      <div className="p-6">{children}</div>
    </div>
  );
}

function Spinner() {
  return <Loader2 className="w-4 h-4 animate-spin" />;
}

function InputField({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5 tracking-wide uppercase">
        {label}
      </label>
      <input
        {...props}
        className={`w-full bg-slate-950/70 border border-white/[0.08] rounded-xl px-4 py-2.5 text-slate-200 placeholder:text-slate-600 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-all duration-200 text-sm ${props.className ?? ""}`}
      />
    </div>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────

export default function Dashboard() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [initLoading, setInitLoading] = useState(false);

  useEffect(() => {
    if (!wallet.publicKey) return;
    const checkInit = async () => {
      const provider = new AnchorProvider(connection, wallet as any, {});
      const program = getProgram(provider) as any;
      try {
        await program.account.rbacState.fetch(getRbacStatePDA());
        setIsInitialized(true);
      } catch {
        setIsInitialized(false);
      }
    };
    checkInit();
  }, [wallet.publicKey, connection]);

  const handleInit = async () => {
    if (!wallet.publicKey) return;
    setInitLoading(true);
    const toastId = toast.loading("Initializing RBAC system on-chain...");
    try {
      const provider = new AnchorProvider(connection, wallet as any, {});
      const program = getProgram(provider);
      await program.methods
        .initialize()
        .accounts({
          rbacState: getRbacStatePDA(),
          admin: wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();
      setIsInitialized(true);
      toast.success("RBAC system initialized!", { id: toastId });
    } catch (err: any) {
      console.error("Init failed", err);
      toast.error("Initialization failed: " + (err.message ?? "Unknown error"), { id: toastId });
    } finally {
      setInitLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen text-slate-200 pb-24 z-10">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-slate-950/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-600 shadow-lg shadow-violet-500/20">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold gradient-text tracking-tight">
              Solana RBAC
            </h1>
            <p className="text-[10px] text-slate-500 font-medium tracking-widest uppercase">
              On-chain Access Control
            </p>
          </div>
        </div>
        <WalletMultiButton className="!bg-violet-600/80 hover:!bg-violet-600 !border !border-violet-500/30 !transition-all !rounded-xl !h-10 !text-sm !font-semibold !shadow-lg !shadow-violet-500/20" />
      </nav>

      <main className="max-w-5xl mx-auto mt-10 px-4 sm:px-6">
        {!wallet.connected ? (
          /* ── Disconnected State ── */
          <div className="flex flex-col items-center justify-center py-36 text-center animate-fade-in-up">
            <div className="relative mb-8">
              <div className="absolute inset-0 rounded-full bg-violet-500/20 blur-2xl scale-150" />
              <div className="relative w-24 h-24 rounded-2xl bg-slate-900 border border-white/[0.08] flex items-center justify-center">
                <Shield className="w-12 h-12 text-violet-400" strokeWidth={1.5} />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-slate-100 mb-3">
              Connect Your Wallet
            </h2>
            <p className="max-w-sm text-slate-400 leading-relaxed text-sm">
              Connect your Solana wallet to manage roles, assign permissions, and
              verify zero-trust access control directly on-chain.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs text-slate-600">
              <Zap className="w-3 h-3" />
              <span>Powered by Anchor Framework · Solana Devnet</span>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in-up">
            {/* ── Status Bar ── */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/40 border border-white/[0.07] backdrop-blur-sm">
              <div>
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-0.5">
                  Connected Wallet
                </p>
                <p className="font-mono text-sm text-slate-300">
                  {wallet.publicKey?.toBase58().slice(0, 8)}…
                  {wallet.publicKey?.toBase58().slice(-6)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-0.5">
                  System Status
                </p>
                {isInitialized === null ? (
                  <span className="text-slate-500 flex items-center gap-1.5 justify-end text-sm">
                    <Spinner /> Checking...
                  </span>
                ) : isInitialized ? (
                  <span className="flex items-center gap-2 justify-end text-emerald-400 text-sm font-medium">
                    <span className="w-2 h-2 rounded-full animate-neon-dot" />
                    Initialized
                  </span>
                ) : (
                  <button
                    onClick={handleInit}
                    disabled={initLoading}
                    className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                  >
                    {initLoading ? <Spinner /> : <Zap className="w-3.5 h-3.5" />}
                    Initialize System
                  </button>
                )}
              </div>
            </div>

            {/* ── Cards Grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT */}
              <div className="space-y-6">
                <CreateRoleCard />
                <AssignRoleCard />
              </div>

              {/* RIGHT */}
              <div className="space-y-6">
                <CheckPermissionCard />
                <RevokeRoleCard />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Create Role ─────────────────────────────────────────────────────────────

function CreateRoleCard() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [roleName, setRoleName] = useState("");
  const [perms, setPerms] = useState<Record<string, boolean>>({
    READ: false,
    CREATE: false,
    UPDATE: false,
    DELETE: false,
    ADMIN: false,
  });
  const [loading, setLoading] = useState(false);

  const PERM_META: Record<string, { emoji: string; color: string }> = {
    READ:   { emoji: "👁️",  color: "emerald" },
    CREATE: { emoji: "✏️",  color: "blue"    },
    UPDATE: { emoji: "🔄",  color: "amber"   },
    DELETE: { emoji: "🗑️",  color: "rose"    },
    ADMIN:  { emoji: "👑",  color: "violet"  },
  };

  const togglePerm = (p: string) =>
    setPerms((prev) => ({ ...prev, [p]: !prev[p] }));

  const computeBitmask = () => {
    let mask = 0;
    if (perms.READ)   mask |= PERMISSIONS.READ;
    if (perms.CREATE) mask |= PERMISSIONS.CREATE;
    if (perms.UPDATE) mask |= PERMISSIONS.UPDATE;
    if (perms.DELETE) mask |= PERMISSIONS.DELETE;
    if (perms.ADMIN)  mask |= PERMISSIONS.ADMIN;
    return mask;
  };

  const currentMask = computeBitmask();

  const handleCreate = async () => {
    if (!wallet.publicKey || !roleName) return;
    setLoading(true);
    const toastId = toast.loading(`Creating role "${roleName}"...`);
    try {
      const provider = new AnchorProvider(connection, wallet as any, {});
      const program = getProgram(provider);
      await program.methods
        .createRole(roleName, currentMask)
        .accounts({
          rbacState: getRbacStatePDA(),
          role: getRolePDA(roleName),
          admin: wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();
      toast.success(`Role "${roleName}" created! Permissions: ${currentMask}`, { id: toastId });
      setRoleName("");
      setPerms({ READ: false, CREATE: false, UPDATE: false, DELETE: false, ADMIN: false });
    } catch (err: any) {
      console.error(err);
      toast.error("Create role failed: " + (err.message ?? "Unknown error"), { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassCard
      title="Create Role"
      icon={<Plus className="w-4 h-4 text-violet-400" />}
      accentColor="purple"
    >
      <div className="space-y-5">
        <InputField
          label="Role Name"
          placeholder="e.g., content_manager"
          value={roleName}
          onChange={(e) => setRoleName(e.target.value)}
          maxLength={32}
        />

        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-widest">
              Permissions
            </label>
            <span className="px-2 py-1 bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-lg text-xs font-mono">
              MASK: {currentMask}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.keys(perms).map((p) => {
              const meta = PERM_META[p];
              return (
                <button
                  key={p}
                  onClick={() => togglePerm(p)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-sm font-medium transition-all duration-200 ${
                    perms[p]
                      ? "bg-violet-500/10 border-violet-500/40 text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                      : "bg-slate-900/60 border-white/[0.06] text-slate-500 hover:border-white/20 hover:text-slate-400"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${
                      perms[p]
                        ? "bg-violet-500 border-violet-500"
                        : "border-slate-700"
                    }`}
                  >
                    {perms[p] && (
                      <svg
                        className="w-2.5 h-2.5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <span>{meta.emoji}</span>
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={loading || !roleName || currentMask === 0}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-semibold shadow-lg shadow-violet-500/20 transition-all duration-200 text-white text-sm"
        >
          {loading ? <><Spinner /> Processing...</> : "Submit Transaction"}
        </button>
      </div>
    </GlassCard>
  );
}

// ─── Assign Role ─────────────────────────────────────────────────────────────

function AssignRoleCard() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [targetUser, setTargetUser] = useState("");
  const [roleName, setRoleName] = useState("");
  const [expiryHours, setExpiryHours] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAssign = async () => {
    if (!wallet.publicKey || !targetUser || !roleName) return;
    setLoading(true);
    const toastId = toast.loading(`Assigning role "${roleName}"...`);
    try {
      const provider = new AnchorProvider(connection, wallet as any, {});
      const program = getProgram(provider);

      let expiresAt = null;
      if (expiryHours) {
        const now = Math.floor(Date.now() / 1000);
        expiresAt = new BN(now + parseFloat(expiryHours) * 3600);
      }

      const targetPubkey = new web3.PublicKey(targetUser);

      await program.methods
        .assignRole(targetPubkey, roleName, expiresAt)
        .accounts({
          rbacState: getRbacStatePDA(),
          role: getRolePDA(roleName),
          userRole: getUserRolePDA(targetPubkey, roleName),
          authority: wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      toast.success(
        `Role "${roleName}" assigned to ${targetUser.slice(0, 8)}...`,
        { id: toastId }
      );
      setTargetUser("");
      setRoleName("");
      setExpiryHours("");
    } catch (err: any) {
      console.error(err);
      toast.error("Assign role failed: " + (err.message ?? "Unknown error"), { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassCard
      title="Assign Role to User"
      icon={<Key className="w-4 h-4 text-cyan-400" />}
      accentColor="cyan"
    >
      <div className="space-y-4">
        <InputField
          label="User Public Key"
          placeholder="Solana wallet address..."
          value={targetUser}
          onChange={(e) => setTargetUser(e.target.value)}
          className="font-mono text-xs"
        />

        <div className="grid grid-cols-2 gap-3">
          <InputField
            label="Role Name"
            placeholder="e.g., admin"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
          />
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 tracking-wide uppercase flex items-center gap-1">
              <Clock className="w-3 h-3" /> Expiry (hrs)
            </label>
            <input
              type="number"
              className="w-full bg-slate-950/70 border border-white/[0.08] rounded-xl px-4 py-2.5 text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all text-sm"
              placeholder="Optional"
              value={expiryHours}
              onChange={(e) => setExpiryHours(e.target.value)}
            />
          </div>
        </div>

        <button
          onClick={handleAssign}
          disabled={loading || !targetUser || !roleName}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-semibold shadow-lg shadow-cyan-500/20 transition-all duration-200 text-white text-sm"
        >
          {loading ? <><Spinner /> Processing...</> : "Assign Role"}
        </button>
      </div>
    </GlassCard>
  );
}

// ─── Check Permission ────────────────────────────────────────────────────────

function CheckPermissionCard() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [targetUser, setTargetUser] = useState("");
  const [roleName, setRoleName] = useState("");
  const [requiredPerm, setRequiredPerm] = useState<string>("READ");
  const [result, setResult] = useState<boolean | null>(null);
  const [rolePermissions, setRolePermissions] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCheck = async () => {
    if (!wallet.publicKey || !targetUser || !roleName) return;
    setLoading(true);
    setResult(null);
    setRolePermissions(null);
    const toastId = toast.loading("Simulating CPI permission check...");
    try {
      const provider = new AnchorProvider(connection, wallet as any, {});
      const program = getProgram(provider) as any;
      const targetPubkey = new web3.PublicKey(targetUser);

      const permValue = (PERMISSIONS as any)[requiredPerm];

      const hasPerm = await program.methods
        .checkPermission(permValue)
        .accounts({
          role: getRolePDA(roleName),
          userRole: getUserRolePDA(targetPubkey, roleName),
        })
        .view();

      // Also fetch the role account to display permission badges
      try {
        const roleAccount = await program.account.role.fetch(getRolePDA(roleName));
        setRolePermissions(roleAccount.permissions);
      } catch {
        // ok if fails
      }

      setResult(hasPerm);
      hasPerm
        ? toast.success("Access Granted ✅", { id: toastId })
        : toast.error("Access Denied ❌", { id: toastId });
    } catch (err: any) {
      console.error(err);
      setResult(false);
      toast.error("Check failed: " + (err.message ?? "Account not found"), { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassCard
      title="Permission Simulator (CPI Oracle)"
      icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
      accentColor="emerald"
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500 leading-relaxed">
          Simulates how an external dApp calls our RBAC program via CPI to
          verify if a user holds the required active bitmask permission.
        </p>

        <InputField
          label="User Public Key"
          placeholder="User's Solana address..."
          value={targetUser}
          onChange={(e) => setTargetUser(e.target.value)}
          className="font-mono text-xs"
        />

        <div className="grid grid-cols-2 gap-3">
          <InputField
            label="Context Role"
            placeholder="e.g., admin"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
          />
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-widest">
              Action Required
            </label>
            <select
              className="w-full bg-slate-950/70 border border-white/[0.08] rounded-xl px-4 py-2.5 text-slate-200 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
              value={requiredPerm}
              onChange={(e) => setRequiredPerm(e.target.value)}
            >
              {Object.keys(PERMISSIONS).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleCheck}
          disabled={loading || !targetUser || !roleName}
          className="w-full flex items-center justify-center gap-2 py-2.5 border border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-semibold transition-all duration-200 text-sm"
        >
          {loading ? <><Spinner /> Simulating...</> : "Run Permission Check"}
        </button>

        {/* Result */}
        {result !== null && (
          <div
            className={`mt-2 p-4 rounded-xl border flex flex-col gap-3 animate-fade-in-up ${
              result
                ? "bg-emerald-500/5 border-emerald-500/20"
                : "bg-rose-500/5 border-rose-500/20"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-full flex-shrink-0 ${
                  result
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-rose-500/15 text-rose-400"
                }`}
              >
                {result ? (
                  <ShieldCheck className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
              </div>
              <div>
                <h4
                  className={`font-bold text-sm ${
                    result ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {result ? "Access Granted" : "Access Denied"}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {result
                    ? "Role exists, holds correct bitmask, and has not expired."
                    : "Role missing, lacks required permission, or expiry has passed."}
                </p>
              </div>
            </div>
            {/* Permission Badges */}
            {rolePermissions !== null && (
              <div className="border-t border-white/[0.05] pt-3">
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-2">
                  Role Permissions
                </p>
                <PermissionBadge permissions={rolePermissions} />
              </div>
            )}
          </div>
        )}
      </div>
    </GlassCard>
  );
}

// ─── Revoke Role ─────────────────────────────────────────────────────────────

function RevokeRoleCard() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [targetUser, setTargetUser] = useState("");
  const [roleName, setRoleName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRevoke = async () => {
    if (!wallet.publicKey || !targetUser || !roleName) return;
    setLoading(true);
    const toastId = toast.loading(`Revoking role "${roleName}"...`);
    try {
      const provider = new AnchorProvider(connection, wallet as any, {});
      const program = getProgram(provider);
      const targetPubkey = new web3.PublicKey(targetUser);

      await program.methods
        .revokeRole(roleName)
        .accounts({
          rbacState: getRbacStatePDA(),
          userRole: getUserRolePDA(targetPubkey, roleName),
          authority: wallet.publicKey,
        })
        .rpc();

      toast.success(
        `Role "${roleName}" revoked from ${targetUser.slice(0, 8)}... Rent returned.`,
        { id: toastId }
      );
      setTargetUser("");
      setRoleName("");
    } catch (err: any) {
      console.error(err);
      toast.error("Revoke failed: " + (err.message ?? "Unknown error"), { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassCard
      title="Revoke Role"
      icon={<Trash2 className="w-4 h-4 text-rose-400" />}
      accentColor="rose"
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500 leading-relaxed">
          Closes the UserRole PDA on-chain and returns the rent SOL to the admin.
          This permanently removes the user's access for this role.
        </p>

        <InputField
          label="User Public Key"
          placeholder="User's Solana address..."
          value={targetUser}
          onChange={(e) => setTargetUser(e.target.value)}
          className="font-mono text-xs"
        />

        <InputField
          label="Role Name"
          placeholder="e.g., admin"
          value={roleName}
          onChange={(e) => setRoleName(e.target.value)}
        />

        <button
          onClick={handleRevoke}
          disabled={loading || !targetUser || !roleName}
          className="w-full flex items-center justify-center gap-2 py-2.5 border border-rose-500/40 hover:bg-rose-500/10 text-rose-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-semibold transition-all duration-200 text-sm"
        >
          {loading ? (
            <>
              <Spinner /> Revoking...
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4" /> Revoke Role
            </>
          )}
        </button>
      </div>
    </GlassCard>
  );
}
