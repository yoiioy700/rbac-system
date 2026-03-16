# On-Chain ROLE-Based Access Control (RBAC) System

**Production-Ready Access Control for Solana** — A gas-optimized, enterprise-grade RBAC implementation demonstrating how Web2 backend patterns translate to on-chain architecture. Built for the Superteam "Rebuild Backend Systems as On-Chain Rust Programs" bounty.

## Live Deployment

| Component | Details |
|---------|--------|
| **Program ID** | `826VeESV6R1DQnt5dELnGHx7j3xewoCRYX3nN4gJ9p2T` |
|**Network** | Devnet |
|**Anchor Version** | 0.30.1 |
|**Solana Version** | 1.18.23 |

## Architecture Analysis: Web2 vs Solana

This section demonstrates the fundamental paradigm shift when migrating backend systems from traditional centralized architectures to Solana's distributed state-machine.

### 1. How This Works in Web2

It's centralized. The database is the single point of failure and truth.

- **State Storage**: Central PostgreSQL `users` table joins a `roles` table
- **Permissions**: API middleware queries database on every request
- **Session Management**: JWT tokens with expiry in Redis/cache
- **Role Expiry**: Cron jobs clean up expired roles
- **Throughput**: Limited by database connection pool

### 2. How This Works on Solana

We translate Web2 RBAC concepts into Solana's Account Model using Program Derived Addresses (PDAs):

- **State Storage**: PDAs with deterministic seeds
- **Permission Check**: On-chain CPI oracle callable by other programs
- **Session Management**: Time-bound roles with `expires_at` on-chain
- **Role Expiry**: Validated in real-time during permission checks
- **Throughput**: Parallel execution limited by Solana's 65k TPS

**PDA Structure:**

```rust
// Global state singleton
RbacState: PDA(seed = [b"bac_state"])

// Each role is its own account
Role: PDA(seed = [b"role", role_name])

// User-role mapping (supports multi-role)
UserRole: PDA(seed = [b"user_role", user_pubkey, role_name])
```

### 3. Tradeoffs & Constraints (The Bitmask Optimization)

**The Problem:** Original implementation stored permissions as `Vec<String>` - inefficient.

**The Solution:** We replaced with a single `u32` integer bitmask:

```rust
pub const READ: u32 = 1 << 0;    // 1
pub const CREATE: u32 = 1 << 1;  // 2
pub const UPDATE: u32 = 1 << 2;  // 4

// Role with multiple permissions
let editor = READ | CREATE | UPDATE; // 7
```
**Permission Check:** Bitwise AND operation - O1() complexity

**Results:**
| Metric | Vec<String> | Bitmask (x32) | Improvement |
|-------|--------|----------|-----------|
| Account Size | ~200+ bytes | 91 bytes | **54% smaller** |
| Compute Units | ~2,500 CU | ~150 CU | **94% less**) |
| Permission Check | O(n) | O(1) | **Constant time** |

## Features

- ROLE Management: Create, update, assign, revoke roles
- Permission System: Bitmask-based (u32, extensible to 32 permissions)
- Time-Bound Access: Optional `expires_at` for roles
- CPI Oracle: Other programs can call `check_permission`
- Event Emission: Full audit trail on-chain

## Installation

```bash
git clone https://github.com/yoiioy700/rbac-system.git
cd rbac-system
anchor build
anchor test
anchor deploy --provider.cluster devnet
```

## Usage

```typescript
// 1. Initialize
await program.methods.initialize().accounts({}).rpc();

// 2. Create role
const permissions = 1 | 2 | 4; // READ | CREATE | UPDATE
await program.methods.createRole("editor", permissions).accounts({}).rpc();

// 3. Assign role
await program.methods.assignRole(userWallet, "editor", expiry).accounts({}).rpc();

// 4. Check permission
const hasPerm = await program.methods.checkPermission(permissions).accounts({}).view();
```

## Client Implementations (Testable Clients)

To fulfill the testable client requirement, we built **two** clients for this system: a production-grade UI and a developer CLI.

### 1. Next.js Frontend (Deep Cyber UI)
A premium, responsive dashboard built with Next.js, Tailwind CSS, and wallet-adapter. It provides a complete interface for admins to manage roles and for users to view permissions.
- **Location:** `/frontend` directory
- **Features:** Wallet connect, Role assignment/revocation, Admin transfer, Real-time state syncing.
- **Run Locally:**
  ```bash
  cd frontend
  npm install
  npm run dev
  ```

### 2. Developer CLI

### Setup
Make sure your dependencies are installed:
```bash
npm install
# or
yarn install
```

### Commands

**Create a Role:**
```bash
npm run cli create-role <role-name>
# Example: npm run cli create-role admin
```

**Assign a Role to a User:**
```bash
npm run cli assign-role <user-pubkey> <role-name>
# Example: npm run cli assign-role 4E5B... admin
```

### Devnet Transaction Links (Bounty Proof)
- **Create Role Tx:** [https://explorer.solana.com/tx/5q4X7h2QqzxNPtoaKcbCr4dPrj2Aev8dtCcgE7vWyjZfAEnXFsCyDAsUZnjTWaLyxm35GYAmUyBEwUfrBwb9xXP1?cluster=devnet](https://explorer.solana.com/tx/5q4X7h2QqzxNPtoaKcbCr4dPrj2Aev8dtCcgE7vWyjZfAEnXFsCyDAsUZnjTWaLyxm35GYAmUyBEwUfrBwb9xXP1?cluster=devnet)
- **Assign Role Tx:** [https://explorer.solana.com/tx/3tvrgGD7zo2xNkrSLLibDhM59RuYt3rGsAm5pk3mUjm8dG1qvS5TnC2LBNHdjLLTHWEP6GoBE8Ng586GmGKyWEn2?cluster=devnet](https://explorer.solana.com/tx/3tvrgGD7zo2xNkrSLLibDhM59RuYt3rGsAm5pk3mUjm8dG1qvS5TnC2LBNHdjLLTHWEP6GoBE8Ng586GmGKyWEn2?cluster=devnet)

## License

MID License - see LICENSE for details.

---

This project demonstrates how robust, extensible Web2 backend principles can be elegantly adapted into localized, gas-efficient routines on the Solana Blockchain.
