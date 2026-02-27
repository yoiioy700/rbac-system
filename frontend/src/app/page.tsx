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
import { Shield, Plus, Key, Clock, ShieldCheck, XCircle } from "lucide-react";

export default function Dashboard() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [adminPubkey, setAdminPubkey] = useState<string>("");

  useEffect(() => {
    if (!wallet.publicKey) return;

    const checkInit = async () => {
      const provider = new AnchorProvider(connection, wallet as any, {});
      const program = getProgram(provider) as any;
      try {
        const state = await program.account.rbacState.fetch(getRbacStatePDA());
        setIsInitialized(true);
        setAdminPubkey(state.admin.toString());
      } catch (e) {
        setIsInitialized(false);
      }
    };
    checkInit();
  }, [wallet.publicKey, connection]);

  const handleInit = async () => {
    if (!wallet.publicKey) return;
    const provider = new AnchorProvider(connection, wallet as any, {});
    const program = getProgram(provider);

    try {
      await program.methods
        .initialize()
        .accounts({
          rbacState: getRbacStatePDA(),
          admin: wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();
      setIsInitialized(true);
      setAdminPubkey(wallet.publicKey.toString());
    } catch (err) {
      console.error("Init failed", err);
      alert("Initialization Failed");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-indigo-500/30 font-sans pb-20">
      {/* Navbar */}
      <nav className="flex items-center justify-between p-6 px-8 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              Solana RBAC
            </h1>
            <p className="text-xs text-slate-500 font-medium">On-chain Access Control</p>
          </div>
        </div>
        <WalletMultiButton className="!bg-indigo-600 hover:!bg-indigo-500 !transition-all !rounded-xl !h-11" />
      </nav>

      <main className="max-w-6xl mx-auto mt-10 px-6">
        {!wallet.connected ? (
          <div className="flex flex-col items-center justify-center py-32 text-center text-slate-400">
            <Shield className="w-20 h-20 mb-6 text-slate-700 mx-auto" strokeWidth={1} />
            <h2 className="text-2xl font-semibold text-slate-300 mb-2">Wallet Disconnected</h2>
            <p className="max-w-md">Connect your Solana wallet to manage roles, assign permissions, and verify zero-trust access control directly on-chain.</p>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Context Notice */}
            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Connected Wallet</p>
                <p className="font-mono text-slate-200">{wallet.publicKey?.toBase58()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-400">System Status</p>
                {isInitialized === null ? (
                  <span className="text-slate-500">Checking...</span>
                ) : isInitialized ? (
                  <span className="text-emerald-400 font-medium flex items-center gap-2 justify-end">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Initialized
                  </span>
                ) : (
                  <button
                    onClick={handleInit}
                    className="mt-1 px-4 py-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg text-sm font-medium transition-all"
                  >
                    Initialize System
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column */}
              <div className="space-y-8">
                <CreateRoleCard />
                <AssignRoleCard />
              </div>

              {/* Right Column */}
              <div className="space-y-8">
                <CheckPermissionCard />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ------ Components ------

function GlassCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/60 rounded-2xl overflow-hidden shadow-2xl relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
      <div className="p-6 border-b border-slate-800/40 bg-slate-900/20 flex items-center gap-3">
        {icon}
        <h3 className="font-semibold text-lg text-slate-200">{title}</h3>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

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

  const togglePerm = (p: string) => setPerms((prev) => ({ ...prev, [p]: !prev[p] }));

  const computeBitmask = () => {
    let mask = 0;
    if (perms.READ) mask |= PERMISSIONS.READ;
    if (perms.CREATE) mask |= PERMISSIONS.CREATE;
    if (perms.UPDATE) mask |= PERMISSIONS.UPDATE;
    if (perms.DELETE) mask |= PERMISSIONS.DELETE;
    if (perms.ADMIN) mask |= PERMISSIONS.ADMIN;
    return mask;
  };

  const currentMask = computeBitmask();

  const handleCreate = async () => {
    if (!wallet.publicKey || !roleName) return;
    setLoading(true);
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
      alert("Role created successfully!");
      setRoleName("");
    } catch (err: any) {
      console.error(err);
      alert("Failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassCard title="Create Role" icon={<Plus className="w-5 h-5 text-indigo-400" />}>
      <div className="space-y-5">
        <div>
          <label className="block text-sm text-slate-400 mb-1.5">Role Name</label>
          <input
            type="text"
            className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-4 py-2.5 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
            placeholder="e.g., content_manager"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
          />
        </div>

        <div>
          <div className="flex justify-between items-end mb-3">
            <label className="block text-sm text-slate-400">Permission Bitmask</label>
            <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded text-xs font-mono">
              MASK: {currentMask}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.keys(perms).map((p) => (
              <button
                key={p}
                onClick={() => togglePerm(p)}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition-all ${perms[p] ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-300" : "bg-slate-900/50 border-slate-800 text-slate-500 hover:bg-slate-800"
                  }`}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${perms[p] ? "bg-indigo-500 border-indigo-500" : "border-slate-700"}`}>
                  {perms[p] && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                {p}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={loading || !roleName || currentMask === 0}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium shadow-lg shadow-indigo-500/20 transition-all text-white"
        >
          {loading ? "Processing..." : "Submit Transaction"}
        </button>
      </div>
    </GlassCard>
  );
}

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

      alert(`Role '${roleName}' assigned to ${targetUser.slice(0, 6)}... successfully!`);
      setTargetUser("");
      setRoleName("");
      setExpiryHours("");
    } catch (err: any) {
      console.error(err);
      alert("Failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassCard title="Assign Role to User" icon={<Key className="w-5 h-5 text-cyan-400" />}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1.5">User Public Key</label>
          <input
            type="text"
            className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-4 py-2.5 outline-none focus:border-cyan-500/50 transition-all font-mono text-sm"
            placeholder="Solana address..."
            value={targetUser}
            onChange={(e) => setTargetUser(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Role Name</label>
            <input
              type="text"
              className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-4 py-2.5 outline-none focus:border-cyan-500/50 transition-all"
              placeholder="e.g., admin"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Expiry (Hours)
            </label>
            <input
              type="number"
              className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-4 py-2.5 outline-none focus:border-cyan-500/50 transition-all"
              placeholder="Optional"
              value={expiryHours}
              onChange={(e) => setExpiryHours(e.target.value)}
            />
          </div>
        </div>

        <button
          onClick={handleAssign}
          disabled={loading || !targetUser || !roleName}
          className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium shadow-lg shadow-cyan-500/20 transition-all text-white mt-2"
        >
          {loading ? "Processing..." : "Assign Role"}
        </button>
      </div>
    </GlassCard>
  );
}

function CheckPermissionCard() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [targetUser, setTargetUser] = useState("");
  const [roleName, setRoleName] = useState("");
  const [requiredPerm, setRequiredPerm] = useState<string>("READ");
  const [result, setResult] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCheck = async () => {
    if (!wallet.publicKey || !targetUser || !roleName) return;
    setLoading(true);
    setResult(null);
    try {
      const provider = new AnchorProvider(connection, wallet as any, {});
      const program = getProgram(provider);
      const targetPubkey = new web3.PublicKey(targetUser);

      const permValue = (PERMISSIONS as any)[requiredPerm];

      // Using .view() ensures we simulate the CPI call without a transaction
      const hasPerm = await program.methods
        .checkPermission(permValue)
        .accounts({
          role: getRolePDA(roleName),
          userRole: getUserRolePDA(targetPubkey, roleName),
        })
        .view();

      setResult(hasPerm);
    } catch (err: any) {
      console.error(err);
      // If the account doesn't exist, it will throw, which technically means false.
      setResult(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassCard title="Permission Simulator (CPI Oracle)" icon={<ShieldCheck className="w-5 h-5 text-emerald-400" />}>
      <div className="space-y-4">
        <p className="text-sm text-slate-400 leading-relaxed mb-4">
          This simulates how another dApp (like an Escrow) would query our RBAC program via CPI to verify if a user holds the required active bitmask permission.
        </p>

        <div>
          <label className="block text-sm text-slate-400 mb-1.5">User Public Key</label>
          <input
            type="text"
            className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-4 py-2.5 outline-none focus:border-emerald-500/50 transition-all font-mono text-sm"
            placeholder="User's Solana address..."
            value={targetUser}
            onChange={(e) => setTargetUser(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Context Role</label>
            <input
              type="text"
              className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-4 py-2.5 outline-none focus:border-emerald-500/50 transition-all"
              placeholder="e.g., admin"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Action Required</label>
            <select
              className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-4 py-2.5 outline-none focus:border-emerald-500/50 transition-all text-slate-200"
              value={requiredPerm}
              onChange={(e) => setRequiredPerm(e.target.value)}
            >
              {Object.keys(PERMISSIONS).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleCheck}
          disabled={loading || !targetUser || !roleName}
          className="w-full py-2.5 border border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-all mt-2"
        >
          {loading ? "Simulating CPI Call..." : "Run Permission Check"}
        </button>

        {/* Result Indicator */}
        {result !== null && (
          <div className={`mt-4 p-4 rounded-xl border flex items-start gap-4 ${result ? "bg-emerald-500/10 border-emerald-500/30" : "bg-rose-500/10 border-rose-500/30"
            }`}>
            <div className={`p-2 rounded-full mt-0.5 ${result ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
              {result ? <ShieldCheck className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
            </div>
            <div>
              <h4 className={`font-bold ${result ? "text-emerald-400" : "text-rose-400"}`}>
                {result ? "Access Granted" : "Access Denied"}
              </h4>
              <p className="text-sm text-slate-400 mt-1">
                {result
                  ? "The role exists, holds the correct bitmask permission, and has not yet expired."
                  : "Either the role does not exist, lacks the required permission, or the Expiry timestamp has passed."}
              </p>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
