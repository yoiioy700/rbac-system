import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs";

// Load the local default keypair from the filesystem
const keypairPath = require('os').homedir() + '/.config/solana/id.json';
const secretKey = new Uint8Array(JSON.parse(fs.readFileSync(keypairPath, 'utf8')));
const adminKeypair = Keypair.fromSecretKey(secretKey);

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const wallet = new anchor.Wallet(adminKeypair);
const provider = new anchor.AnchorProvider(connection, wallet, { preflightCommitment: "confirmed" });
anchor.setProvider(provider);

// Using the deployed Devnet Program ID
const PROGRAM_ID = new PublicKey("826VeESV6R1DQnt5dELnGHx7j3xewoCRYX3nN4gJ9p2T");

// Grab the IDL
const idl = JSON.parse(fs.readFileSync('./frontend/src/idl/rbac_system.json', 'utf8'));
const program = new anchor.Program(idl, provider);

function getRbacStatePDA() {
    return PublicKey.findProgramAddressSync([Buffer.from("rbac_state")], PROGRAM_ID)[0];
}

function getRolePDA(roleName: string) {
    return PublicKey.findProgramAddressSync([Buffer.from("role"), Buffer.from(roleName)], PROGRAM_ID)[0];
}

function getUserRolePDA(user: PublicKey, roleName: string) {
    return PublicKey.findProgramAddressSync([Buffer.from("user_role"), user.toBuffer(), Buffer.from(roleName)], PROGRAM_ID)[0];
}

async function main() {
    console.log("📡 Connecting to Solana Devnet...");
    console.log(`🔧 Using Program ID: ${PROGRAM_ID.toBase58()}`);
    console.log(`💼 Using Admin Wallet: ${wallet.publicKey.toBase58()}`);

    const args = process.argv.slice(2);
    const command = args[0];

    try {
        if (command === "initialize") {
            console.log(`\n⏳ Initializing RBAC State on Devnet...`);
            const tx = await program.methods.initialize()
                .accountsPartial({
                    rbacState: getRbacStatePDA(),
                    admin: wallet.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc();
            
            console.log(`✅ System Initialized!`);
            console.log(`🔗 Transaction View: https://explorer.solana.com/tx/${tx}?cluster=devnet`);

        } else if (command === "create-role") {
            const roleName = args[1];
            if (!roleName) throw new Error("Missing role name.");
            
            console.log(`\n⏳ Creating role '${roleName}' on Devnet...`);
            const tx = await program.methods.createRole(roleName, 7) // 7 = ALL perms for test
                .accountsPartial({
                    rbacState: getRbacStatePDA(),
                    role: getRolePDA(roleName),
                    admin: wallet.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc();
            
            console.log(`✅ Role '${roleName}' created successfully!`);
            console.log(`🔗 Transaction View: https://explorer.solana.com/tx/${tx}?cluster=devnet`);

        } else if (command === "assign-role") {
            const userPubkey = args[1];
            const roleName = args[2];
            if (!userPubkey || !roleName) throw new Error("Missing arguments.");
            const targetUser = new PublicKey(userPubkey);

            console.log(`\n⏳ Assigning role '${roleName}' to user ${userPubkey}...`);
            const tx = await program.methods.assignRole(targetUser, roleName, null)
                .accountsPartial({
                    rbacState: getRbacStatePDA(),
                    role: getRolePDA(roleName),
                    userRole: getUserRolePDA(targetUser, roleName),
                    authority: wallet.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc();

            console.log(`✅ Role assigned successfully!`);
            console.log(`🔗 Transaction View: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
        }
    } catch (err: any) {
        console.error(`\n❌ Error:`, err);
    }
}

main();
