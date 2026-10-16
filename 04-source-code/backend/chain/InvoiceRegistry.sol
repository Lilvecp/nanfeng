// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title NanFeng invoice registry (r3-06)
/// @notice One entry per invoice. A financier registers the invoice's fingerprint before it pays out;
///         registering the same fingerprint again reverts, so whoever checks this registry cannot
///         finance an invoice that someone else already financed.
/// @dev The fingerprint is keccak256 of the invoice's identity (issuer tax id, document type, folio),
///      computed off-chain by `backend/app/registry.py`. Only the hash goes on-chain: no amounts,
///      customers or names. Entries are permanent; the registry is an append-only record.
contract InvoiceRegistry {
    struct Entry {
        address registrar;   // wallet that registered the invoice
        uint64 registeredAt; // block timestamp
        bytes32 financing;   // short label, e.g. "LEN-FACTOR:factoring"
    }

    mapping(bytes32 => Entry) private entries;

    event InvoiceRegistered(bytes32 indexed fingerprint, address indexed registrar, bytes32 financing);

    error AlreadyRegistered(bytes32 fingerprint, address registrar, uint64 registeredAt, bytes32 financing);

    function register(bytes32 fingerprint, bytes32 financing) external {
        Entry storage e = entries[fingerprint];
        if (e.registeredAt != 0) revert AlreadyRegistered(fingerprint, e.registrar, e.registeredAt, e.financing);
        entries[fingerprint] = Entry(msg.sender, uint64(block.timestamp), financing);
        emit InvoiceRegistered(fingerprint, msg.sender, financing);
    }

    function lookup(bytes32 fingerprint)
        external
        view
        returns (bool registered, address registrar, uint64 registeredAt, bytes32 financing)
    {
        Entry storage e = entries[fingerprint];
        return (e.registeredAt != 0, e.registrar, e.registeredAt, e.financing);
    }
}
