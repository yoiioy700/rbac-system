import { Program, AnchorProvider, Idl } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import rbacIdl from "../idl/rbac_system.json";

// We'll use the dynamically imported IDL
export const IDL = rbacIdl as Idl;

// Our Program ID on Localnet / Devnet
// Adjust this to match your actual deployed ID if needed
export const PROGRAM_ID = new PublicKey("826VeESV6R1DQnt5dELnGHx7j3xewoCRYX3nN4gJ9p2T");

// Helper to get the program instance
export const getProgram = (provider: AnchorProvider) => {
    return new Program(IDL, provider) as any;
};

// Permission Bitmasks
export const PERMISSIONS = {
    READ: 1 << 0,
    CREATE: 1 << 1,
    UPDATE: 1 << 2,
    DELETE: 1 << 3,
    ADMIN: 1 << 4,
};

// PDA derivations
export const getRbacStatePDA = () => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("rbac_state")],
        PROGRAM_ID
    )[0];
};

export const getRolePDA = (roleName: string) => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("role"), Buffer.from(roleName)],
        PROGRAM_ID
    )[0];
};

export const getUserRolePDA = (userWallet: PublicKey, roleName: string) => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("user_role"), userWallet.toBuffer(), Buffer.from(roleName)],
        PROGRAM_ID
    )[0];
};
