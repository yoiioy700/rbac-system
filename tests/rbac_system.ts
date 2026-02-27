import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { RbacSystem } from "../target/types/rbac_system";
import { expect } from "chai";

// Permission Bitmasks
const PERM_READ = 1 << 0;   // 1
const PERM_CREATE = 1 << 1; // 2
const PERM_UPDATE = 1 << 2; // 4
const PERM_DELETE = 1 << 3; // 8
const PERM_ADMIN = 1 << 4;  // 16

describe("RBAC System - Access Control on Solana", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.RbacSystem as Program<RbacSystem>;

  // Test accounts
  const admin = provider.wallet;
  let rbacState: anchor.web3.PublicKey;

  // Role PDAs
  let adminRole: anchor.web3.PublicKey;
  let managerRole: anchor.web3.PublicKey;
  let userRole: anchor.web3.PublicKey;

  // Test user
  const testUser = anchor.web3.Keypair.generate();
  let testUserRoleA: anchor.web3.PublicKey;
  let testUserRoleB: anchor.web3.PublicKey;

  before(async () => {
    // Derive PDAs
    [rbacState] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("rbac_state")],
      program.programId
    );

    [adminRole] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("role"), Buffer.from("admin")],
      program.programId
    );

    [managerRole] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("role"), Buffer.from("manager")],
      program.programId
    );

    [userRole] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("role"), Buffer.from("user")],
      program.programId
    );

    [testUserRoleA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("user_role"), testUser.publicKey.toBuffer(), Buffer.from("admin")],
      program.programId
    );

    [testUserRoleB] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("user_role"), testUser.publicKey.toBuffer(), Buffer.from("user")],
      program.programId
    );

    // Fund test user
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(testUser.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL)
    );
  });

  describe("1. System Initialization", () => {
    it("Should initialize RBAC system with admin", async () => {
      const tx = await program.methods
        .initialize()
        .accounts({
          rbacState,
          admin: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const state = await program.account.rbacState.fetch(rbacState);
      expect(state.admin.toString()).to.equal(admin.publicKey.toString());
    });
  });

  describe("2. Role Creation (Bitmask Permissions)", () => {
    it("Should create Admin role with full permissions", async () => {
      const allPerms = PERM_READ | PERM_CREATE | PERM_UPDATE | PERM_DELETE | PERM_ADMIN; // 31
      await program.methods
        .createRole("admin", allPerms)
        .accounts({
          rbacState,
          role: adminRole,
          admin: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const role = await program.account.role.fetch(adminRole);
      expect(role.permissions).to.equal(allPerms);
    });

    it("Should create User role with read-only permission", async () => {
      await program.methods
        .createRole("user", PERM_READ) // 1
        .accounts({
          rbacState,
          role: userRole,
          admin: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const role = await program.account.role.fetch(userRole);
      expect(role.permissions).to.equal(PERM_READ);
    });
  });

  describe("3. Multi-Role Assignment and Time-bounds", () => {
    it("Should assign multiple roles to the same user", async () => {
      // Assign Admin (No expiry)
      await program.methods
        .assignRole(testUser.publicKey, "admin", null)
        .accounts({
          rbacState,
          role: adminRole,
          userRole: testUserRoleA,
          authority: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      // Assign User (Expires in 2 seconds)
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = new anchor.BN(now + 2);

      await program.methods
        .assignRole(testUser.publicKey, "user", expiresAt)
        .accounts({
          rbacState,
          role: userRole,
          userRole: testUserRoleB,
          authority: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const assignmentA = await program.account.userRole.fetch(testUserRoleA);
      const assignmentB = await program.account.userRole.fetch(testUserRoleB);

      expect(assignmentA.role).to.equal("admin");
      expect(assignmentB.role).to.equal("user");
      expect(assignmentB.expiresAt).to.not.be.null;
    });
  });

  describe("4. Bitwise Validation and Expiry", () => {
    it("Should allow Admin to have CREATE permission", async () => {
      const hasPermission = await program.methods
        .checkPermission(PERM_CREATE)
        .accounts({
          role: adminRole,
          userRole: testUserRoleA,
        })
        .view();

      expect(hasPermission).to.be.true;
    });

    it("Should deny User Role from UPDATE permission", async () => {
      const hasPermission = await program.methods
        .checkPermission(PERM_UPDATE)
        .accounts({
          role: userRole,
          userRole: testUserRoleB,
        })
        .view();

      expect(hasPermission).to.be.false;
    });

    it("Should fail permission check after role expires", async () => {
      // Wait for 3 seconds to let the role expire
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const hasPermission = await program.methods
        .checkPermission(PERM_READ) // Should normally be true for User Role
        .accounts({
          role: userRole,
          userRole: testUserRoleB,
        })
        .view();

      expect(hasPermission).to.be.false;
    });
  });

  describe("5. Role Revocation", () => {
    it("Should revoke admin role from user", async () => {
      await program.methods
        .revokeRole("admin")
        .accounts({
          rbacState,
          userRole: testUserRoleA,
          authority: admin.publicKey,
        })
        .rpc();

      try {
        await program.account.userRole.fetch(testUserRoleA);
        expect.fail("Account should be closed");
      } catch (e) {
        // Expected
      }
    });
  });
});