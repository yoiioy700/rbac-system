const fs = require('fs');
const crypto = require('crypto');

function getSighash(nameSpace, name) {
    const preimage = `${nameSpace}:${name}`;
    const hash = crypto.createHash('sha256').update(preimage).digest();
    return Array.from(hash.slice(0, 8));
}

function getInstructionDiscriminator(name) {
    return getSighash('global', name);
}

function getAccountDiscriminator(name) {
    return getSighash('account', name);
}

const idl = {
    "address": "826VeESV6R1DQnt5dELnGHx7j3xewoCRYX3nN4gJ9p2T",
    "metadata": { "name": "rbac_system", "version": "0.1.0", "spec": "0.1.0" },
    "instructions": [
        {
            "name": "initialize",
            "discriminator": getInstructionDiscriminator("initialize"),
            "accounts": [
                { "name": "rbacState", "writable": true, "signer": false },
                { "name": "admin", "writable": true, "signer": true },
                { "name": "systemProgram", "writable": false, "signer": false }
            ],
            "args": []
        },
        {
            "name": "createRole",
            "discriminator": getInstructionDiscriminator("create_role"),
            "accounts": [
                { "name": "rbacState", "writable": true, "signer": false },
                { "name": "role", "writable": true, "signer": false },
                { "name": "admin", "writable": true, "signer": true },
                { "name": "systemProgram", "writable": false, "signer": false }
            ],
            "args": [
                { "name": "roleName", "type": "string" },
                { "name": "permissions", "type": "u32" }
            ]
        },
        {
            "name": "assignRole",
            "discriminator": getInstructionDiscriminator("assign_role"),
            "accounts": [
                { "name": "rbacState", "writable": true, "signer": false },
                { "name": "role", "writable": false, "signer": false },
                { "name": "userRole", "writable": true, "signer": false },
                { "name": "authority", "writable": true, "signer": true },
                { "name": "systemProgram", "writable": false, "signer": false }
            ],
            "args": [
                { "name": "user", "type": "pubkey" },
                { "name": "roleName", "type": "string" },
                { "name": "expiresAt", "type": { "option": "i64" } }
            ]
        },
        {
            "name": "checkPermission",
            "discriminator": getInstructionDiscriminator("check_permission"),
            "accounts": [
                { "name": "role", "writable": false, "signer": false },
                { "name": "userRole", "writable": false, "signer": false }
            ],
            "args": [
                { "name": "requiredPermission", "type": "u32" }
            ],
            "returns": "bool"
        },
        {
            "name": "revokeRole",
            "discriminator": getInstructionDiscriminator("revoke_role"),
            "accounts": [
                { "name": "rbacState", "writable": true, "signer": false },
                { "name": "userRole", "writable": true, "signer": false },
                { "name": "authority", "writable": true, "signer": true }
            ],
            "args": [
                { "name": "roleName", "type": "string" }
            ]
        }
    ],
    "accounts": [
        {
            "name": "RbacState",
            "discriminator": getAccountDiscriminator("RbacState")
        },
        {
            "name": "Role",
            "discriminator": getAccountDiscriminator("Role")
        },
        {
            "name": "UserRole",
            "discriminator": getAccountDiscriminator("UserRole")
        }
    ],
    "types": [
        {
            "name": "RbacState",
            "type": {
                "kind": "struct",
                "fields": [
                    { "name": "admin", "type": "pubkey" },
                    { "name": "userCount", "type": "u64" },
                    { "name": "bump", "type": "u8" }
                ]
            }
        },
        {
            "name": "Role",
            "type": {
                "kind": "struct",
                "fields": [
                    { "name": "name", "type": "string" },
                    { "name": "permissions", "type": "u32" },
                    { "name": "bump", "type": "u8" }
                ]
            }
        },
        {
            "name": "UserRole",
            "type": {
                "kind": "struct",
                "fields": [
                    { "name": "user", "type": "pubkey" },
                    { "name": "role", "type": "string" },
                    { "name": "assignedAt", "type": "i64" },
                    { "name": "expiresAt", "type": { "option": "i64" } },
                    { "name": "assignedBy", "type": "pubkey" },
                    { "name": "bump", "type": "u8" }
                ]
            }
        }
    ]
};

fs.mkdirSync('target/idl', { recursive: true });
fs.writeFileSync('target/idl/rbac_system.json', JSON.stringify(idl, null, 2));
console.log('IDL generated at target/idl/rbac_system.json');
