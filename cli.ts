import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

// Basic connection setup to Solana Devnet
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

// We use a dummy keypair here for demonstration purposes.
// In a real scenario, you'd load via NodeWallet or fs.readFileSync("~/.config/solana/id.json")
const dummyKeypair = Keypair.generate();
const wallet = new anchor.Wallet(dummyKeypair);
const provider = new anchor.AnchorProvider(connection, wallet, { preflightCommitment: "confirmed" });
anchor.setProvider(provider);

// Replace with your generated Program ID when deployed
const PROGRAM_ID = new PublicKey("11111111111111111111111111111111");

async function main() {
    console.log("📡 Connecting to Solana Devnet...");
    console.log(`🔧 Using Program ID: ${PROGRAM_ID.toBase58()}`);
    console.log(`💼 Using Dummy Wallet: ${wallet.publicKey.toBase58()}`);

    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log("\n❌ No command provided.");
        console.log("Usage: npx ts-node cli.ts <command> [args]");
        console.log("\nCommands:");
        console.log("  create-role <name>                          - Create a new RBAC role");
        console.log("  assign-role <user-pubkey> <role-name>       - Assign a role to a user");
        return;
    }

    const command = args[0];

    try {
        if (command === "create-role") {
            const roleName = args[1];
            if (!roleName) throw new Error("Missing role name. Example: create-role admin");
            
            console.log(`\n⏳ Creating role '${roleName}' on Devnet...`);
            // Mock Tx. Real Tx: await program.methods.createRole(roleName).rpc();
            const dummyTx = `tx_${Math.random().toString(36).substring(2, 15)}`;
            console.log(`✅ Role '${roleName}' created successfully!`);
            console.log(`🔗 Transaction View: https://explorer.solana.com/tx/${dummyTx}?cluster=devnet`);

        } else if (command === "assign-role") {
            const userPubkey = args[1];
            const roleName = args[2];
            
            if (!userPubkey || !roleName) {
                throw new Error("Missing arguments. Example: assign-role <user-pubkey> admin");
            }
            
            // Validate pubkey
            new PublicKey(userPubkey);

            console.log(`\n⏳ Assigning role '${roleName}' to user ${userPubkey}...`);
            // Mock Tx. Real Tx: await program.methods.assignRole(new PublicKey(userPubkey), roleName).rpc();
            const dummyTx = `tx_${Math.random().toString(36).substring(2, 15)}`;
            console.log(`✅ Role assigned successfully!`);
            console.log(`🔗 Transaction View: https://explorer.solana.com/tx/${dummyTx}?cluster=devnet`);
            
        } else {
            console.log(`\n❌ Unknown command: ${command}`);
            console.log("Valid commands: create-role, assign-role");
        }
    } catch (err: any) {
        console.error(`\n❌ Error: ${err.message}`);
    }
}

main();