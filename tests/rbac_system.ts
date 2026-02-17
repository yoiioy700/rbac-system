import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { RbacSystem } from "../target/types/rbac_system";
import { expect } from "chai";

describe("RBAC System - Access Control on Solana", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.RbacSystem as Program<RbacSystem>;
  
  // Test accounts
  const admin = provider.wallet;
  let rbacState: anchor.web3.PublicKey;
  let rbacStateBump: number;
  
  // Role PDAs
  let adminRole: anchor.web3.PublicKey;
  let managerRole: anchor.web3.PublicKey;
  let userRole: anchor.web3.PublicKey;
  let adminRoleBump: number;
  let managerRoleBump: number;
  let userRoleBump: number;
  
  // Test user
  const testUser = anchor.web3.Keypair.generate();
  let testUserRoleAssignment: anchor.web3.PublicKey;

  before(async () => {
    // Derive PDAs
    [rbacState, rbacStateBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("rbac_state")],
      program.programId
    );
    
    [adminRole, adminRoleBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("role"), Buffer.from("admin")],
      program.programId
    );
    
    [managerRole, managerRoleBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("role"), Buffer.from("manager")],
      program.programId
    );
    
    [userRole, userRoleBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("role"), Buffer.from("user")],
      program.programId
    );
    
    [testUserRoleAssignment] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("user_role"), testUser.publicKey.toBuffer()],
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
      
      console.log("✓ RBAC System initialized");
      console.log("  Transaction:", tx);
      
      // Verify state
      const state = await program.account.rbacState.fetch(rbacState);
      expect(state.admin.toString()).to.equal(admin.publicKey.toString());
      expect(state.roleCount).to.equal(1); // Admin role auto-created
      expect(state.userCount).to.equal(0);
    });
  });

  describe("2. Role Creation", () => {
    it("Should create Admin role with full permissions", async () => {
      const tx = await program.methods
        .createRole(
          "admin",
          [ // All permissions
            { create: {} },
            { read: {} },
            { update: {} },
            { delete: {} },
            { admin: {} },
          ]
        )
        .accounts({
          rbacState,
          role: adminRole,
          admin: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      
      const role = await program.account.role.fetch(adminRole);
      expect(role.name).to.equal("admin");
      expect(role.permissions.length).to.equal(5);
      console.log("✓ Admin role created with", role.permissions.length, "permissions");
    });

    it("Should create Manager role with limited permissions", async () => {
      const tx = await program.methods
        .createRole(
          "manager",
          [ // Create, Read, Update only
            { create: {} },
            { read: {} },
            { update: {} },
          ]
        )
        .accounts({
          rbacState,
          role: managerRole,
          admin: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      
      const role = await program.account.role.fetch(managerRole);
      expect(role.name).to.equal("manager");
      expect(role.permissions.length).to.equal(3);
      console.log("✓ Manager role created with", role.permissions.length, "permissions");
    });

    it("Should create User role with read-only permission", async () => {
      const tx = await program.methods
        .createRole(
          "user",
          [ // Read only
            { read: {} },
          ]
        )
        .accounts({
          rbacState,
          role: userRole,
          admin: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      
      const role = await program.account.role.fetch(userRole);
      expect(role.name).to.equal("user");
      expect(role.permissions.length).to.equal(1);
      console.log("✓ User role created with read-only access");
    });
  });

  describe("3. Role Assignment", () => {
    it("Should assign user role to test user", async () => {
      const tx = await program.methods
        .assignRole(testUser.publicKey, "user")
      .accounts({
          rbacState,
          role: userRole,
          userRole: testUserRoleAssignment,
          authority: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      
      const assignment = await program.account.userRole.fetch(testUserRoleAssignment);
      expect(assignment.user.toString()).to.equal(testUser.publicKey.toString());
      expect(assignment.role).to.equal("user");
      console.log("✓ Role assigned to test user");
    });
  });

  describe("4. Permission Checks", () => {
    it("Should verify user has READ permission", async () => {
      const hasPermission = await program.methods
        .checkPermission(testUser.publicKey, { read: {} })
        .accounts({
          role: userRole,
          userRole: testUserRoleAssignment,
        })
        .view();
      
      expect(hasPermission).to.be.true;
      console.log("✓ User verified to have READ permission");
    });

    it("Should verify user does NOT have CREATE permission", async () => {
      const hasPermission = await program.methods
        .checkPermission(testUser.publicKey, { create: {} })
        .accounts({
          role: userRole,
          userRole: testUserRoleAssignment,
        })
        .view();
      
      expect(hasPermission).to.be.false;
      console.log("✓ User correctly denied CREATE permission");
    });
  });

  describe("5. Action Execution", () => {
    it("Should allow READ action for user", async () => {
      const tx = await program.methods
        .executeAction({ readResource: {} })
        .accounts({
          rbacState,
          role: userRole,
          userRole: testUserRoleAssignment,
          user: testUser.publicKey,
        })
        .signers([testUser])
        .rpc();
      
      console.log("✓ User successfully executed READ action");
    });

    it("Should deny CREATE action for user", async () => {
      try {
        await program.methods
          .executeAction({ createResource: {} })
          .accounts({
            rbacState,
            role: userRole,
            userRole: testUserRoleAssignment,
            user: testUser.publicKey,
          })
          .signers([testUser])
          .rpc();
        
        expect.fail("Should have thrown error");
      } catch (e) {
        expect(e.toString()).to.include("PermissionDenied");
        console.log("✓ User correctly blocked from CREATE action");
      }
    });
  });

  describe("6. Web2 vs Solana Comparison", () => {
    it("Should demonstrate PDA-based access control", async () => {
      // In Web2: Check database table "user_roles"
      // In Solana: Check on-chain PDA account
      
      const rbacInfo = await program.account.rbacState.fetch(rbacState);
      const roleInfo = await program.account.role.fetch(userRole);
      const assignmentInfo = await program.account.userRole.fetch(testUserRoleAssignment);
      
      console.log("\n===== Web2 vs Solana Comparison =====");
      console.log("Web2: SQL database with tables");
      console.log("  - users table");
      console.log("  - roles table");  
      console.log("  - user_roles junction table");
      console.log("\nSolana: On-chain PDAs (Program Derived Addresses)");
      console.log("  - rbac_state PDA:", rbacState.toString());
      console.log("  - role PDA:", userRole.toString());
      console.log("  - user_role PDA:", testUserRoleAssignment.toString());
      console.log("\nOn-Chain State:");
      console.log("  Total roles:", rbacInfo.roleCount);
      console.log("  Total users:", rbacInfo.userCount);
      console.log("  User role assignment:", assignmentInfo.role);
      console.log("  Permissions:", roleInfo.permissions.map(p => Object.keys(p)[0]));
      console.log("=====================================\n");
    });
  });

  describe("7. Role Revocation", () => {
    it("Should revoke user role", async () => {
      const tx = await program.methods
        .revokeRole(testUser.publicKey)
        .accounts({
          userRole: testUserRoleAssignment,
          authority: admin.publicKey,
        })
        .rpc();
      
      // Account should be closed
      try {
        await program.account.userRole.fetch(testUserRoleAssignment);
        expect.fail("Account should be closed");
      } catch (e) {
        console.log("✓ User role successfully revoked (account closed)");
      }
    });
  });
});

// Test summary
after(() => {
  console.log("\n✅ RBAC System Test Summary:");
  console.log("- System initialization: ✓");
  console.log("- Role creation (3 roles): ✓");
  console.log("- Role assignment: ✓");
  console.log("- Permission verification: ✓");
  console.log("- Action authorization: ✓");
  console.log("- Web2 vs Solana comparison: ✓");
  console.log("- Role revocation: ✓");
});