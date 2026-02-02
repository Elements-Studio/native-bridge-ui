"""
Frontend simulation: Collect signatures from validators and submit claim transactions.

This module simulates frontend behavior in the new validator-only architecture:
1. Poll indexer for finalized transactions
2. Collect signatures from multiple validators (达到 quorum)
3. Submit approve+claim transactions to target chain
"""

from __future__ import annotations

import base64
import json
import time
from dataclasses import dataclass
from typing import List, Optional, Dict, Any, Tuple

import requests
from eth_account import Account
from eth_abi import encode
from rich.console import Console
from web3 import Web3
from web3.types import TxReceipt

console = Console()

# Default timeout constants - can be overridden by callers
DEFAULT_TX_TIMEOUT = 300  # seconds - increased for testnet support


# Chain ID mappings (from frontend.md)
CHAIN_ID_MAP = {
    "StarcoinMainnet": 0,
    "StarcoinTestnet": 1,
    "StarcoinCustom": 2,
    "EthMainnet": 10,
    "EthSepolia": 11,
    "EthCustom": 12,
}


@dataclass
class ValidatorSignature:
    """Signature from a validator"""
    validator_url: str
    signature_hex: str  # 65 bytes: r(32) + s(32) + v(1)
    bridge_action: Dict[str, Any]  # The signed BridgeAction data


@dataclass
class SignatureCollection:
    """Collection of signatures達到 quorum"""
    signatures: List[ValidatorSignature]
    total_stake: int
    quorum_reached: bool


def collect_signatures_stc_to_eth(
    validator_urls: List[str],
    tx_digest: str,
    event_index: int = 0,
    quorum_stake: int = 2,
    timeout_per_validator: int = 5,
    validator_stakes: Optional[Dict[str, int]] = None,
) -> SignatureCollection:
    """
    Collect signatures from validators for Starcoin → ETH transfer.
    
    Args:
        validator_urls: List of validator HTTP endpoints
        tx_digest: Starcoin transaction digest (hex)
        event_index: Event index in transaction (usually 0)
        quorum_stake: Minimum stake required (default 2 for any 2 validators)
        timeout_per_validator: HTTP timeout for each validator request
        validator_stakes: Optional dict mapping validator URL to stake amount
        
    Returns:
        SignatureCollection with signatures and quorum status
    """
    console.print(f"[cyan]Collecting signatures for Starcoin TX {tx_digest[:16]}...[/cyan]")
    
    signatures: List[ValidatorSignature] = []
    total_stake = 0
    
    # Default stake per validator (1 for 4-member committee with one admin at 5001)
    default_stake = 1
    
    # Remove 0x prefix if present
    if tx_digest.startswith("0x"):
        tx_digest = tx_digest[2:]
    
    for validator_url in validator_urls:
        try:
            # Request signature from validator
            url = f"{validator_url}/sign/bridge_tx/starcoin/eth/{tx_digest}/{event_index}"
            console.print(f"  [dim]GET {url}[/dim]")
            
            response = requests.get(url, timeout=timeout_per_validator)
            
            # Print response for debugging
            console.print(f"  [dim]Response [{response.status_code}]: {response.text[:500]}{'...' if len(response.text) > 500 else ''}[/dim]")
            
            if response.status_code == 200:
                data = response.json()
                sig_hex = data.get("auth_signature", {}).get("signature", "")
                bridge_action = data.get("data", {})
                
                if sig_hex and bridge_action:
                    signatures.append(ValidatorSignature(
                        validator_url=validator_url,
                        signature_hex=sig_hex,
                        bridge_action=bridge_action,
                    ))
                    # Get stake from config if provided, otherwise use default
                    stake = default_stake
                    if validator_stakes and validator_url in validator_stakes:
                        stake = validator_stakes[validator_url]
                    total_stake += stake
                    console.print(f"    ✓ Got signature (total stake: {total_stake})")
                    
                    if total_stake >= quorum_stake:
                        console.print(f"[green]✓ Quorum reached ({total_stake}/{quorum_stake})[/green]")
                        break
                else:
                    console.print(f"    ✗ Invalid response format")
            elif response.status_code == 400:
                error = response.json().get("error", "")
                if "TxNotFinalized" in error:
                    console.print(f"    ⏳ TX not finalized yet")
                else:
                    console.print(f"    ✗ Error: {error}")
            else:
                console.print(f"    ✗ HTTP {response.status_code}: {response.text[:100]}")
                
        except requests.Timeout:
            console.print(f"    ✗ Timeout")
        except Exception as e:
            console.print(f"    ✗ Exception: {e}")
    
    quorum_reached = total_stake >= quorum_stake
    
    if not quorum_reached:
        console.print(f"[yellow]⚠ Quorum not reached: {total_stake}/{quorum_stake}[/yellow]")
    
    return SignatureCollection(
        signatures=signatures,
        total_stake=total_stake,
        quorum_reached=quorum_reached,
    )


def collect_signatures_eth_to_stc(
    validator_urls: List[str],
    tx_hash: str,
    event_index: int = 0,
    quorum_stake: int = 2,
    timeout_per_validator: int = 5,
    validator_stakes: Optional[Dict[str, int]] = None,
    default_stake: int = 1,
) -> SignatureCollection:
    """
    Collect signatures from validators for ETH → Starcoin transfer.
    
    Args:
        validator_urls: List of validator HTTP endpoints
        tx_hash: Ethereum transaction hash (hex)
        event_index: Event index in transaction (usually 0)
        quorum_stake: Minimum stake required (default 2 for any 2 validators)
        timeout_per_validator: HTTP timeout for each validator request
        validator_stakes: Optional mapping of validator URL to voting power
        default_stake: Default stake per validator if not in validator_stakes
        
    Returns:
        SignatureCollection with signatures and quorum status
    """
    console.print(f"[cyan]Collecting signatures for ETH TX {tx_hash[:16]}...[/cyan]")
    
    signatures: List[ValidatorSignature] = []
    total_stake = 0
    
    # Remove 0x prefix if present
    if tx_hash.startswith("0x"):
        tx_hash = tx_hash[2:]
    
    for validator_url in validator_urls:
        try:
            # Request signature from validator
            url = f"{validator_url}/sign/bridge_tx/eth/starcoin/{tx_hash}/{event_index}"
            console.print(f"  [dim]GET {url}[/dim]")
            
            response = requests.get(url, timeout=timeout_per_validator)
            
            # Print response for debugging
            console.print(f"  [dim]Response [{response.status_code}]: {response.text[:500]}{'...' if len(response.text) > 500 else ''}[/dim]")
            
            if response.status_code == 200:
                data = response.json()
                sig_hex = data.get("auth_signature", {}).get("signature", "")
                bridge_action = data.get("data", {})
                
                if sig_hex and bridge_action:
                    signatures.append(ValidatorSignature(
                        validator_url=validator_url,
                        signature_hex=sig_hex,
                        bridge_action=bridge_action,
                    ))
                    # Use actual stake from config if provided
                    stake = default_stake
                    if validator_stakes and validator_url in validator_stakes:
                        stake = validator_stakes[validator_url]
                    total_stake += stake
                    console.print(f"    ✓ Got signature (stake: {stake}, total: {total_stake})")
                    
                    if total_stake >= quorum_stake:
                        console.print(f"[green]✓ Quorum reached ({total_stake}/{quorum_stake})[/green]")
                        break
                else:
                    console.print(f"    ✗ Invalid response format")
            elif response.status_code == 400:
                error = response.json().get("error", "")
                if "TxNotFinalized" in error:
                    console.print(f"    ⏳ TX not finalized yet")
                else:
                    console.print(f"    ✗ Error: {error}")
            else:
                console.print(f"    ✗ HTTP {response.status_code}: {response.text[:100]}")
                
        except requests.Timeout:
            console.print(f"    ✗ Timeout")
        except Exception as e:
            console.print(f"    ✗ Exception: {e}")
    
    quorum_reached = total_stake >= quorum_stake
    
    if not quorum_reached:
        console.print(f"[yellow]⚠ Quorum not reached: {total_stake}/{quorum_stake}[/yellow]")
    
    return SignatureCollection(
        signatures=signatures,
        total_stake=total_stake,
        quorum_reached=quorum_reached,
    )


def _parse_starcoin_to_eth_action(bridge_action: Dict[str, Any]) -> Tuple[int, bytes, int, int, bytes]:
    """
    Parse StarcoinToEthBridgeAction JSON into payload components.
    
    Returns:
        (nonce, starcoin_address_bytes, target_chain_id, token_id, amount)
    """
    action = bridge_action.get("StarcoinToEthBridgeAction", {})
    event = action.get("starcoin_bridge_event", {})
    
    nonce = int(event.get("nonce", 0))
    
    # Parse Starcoin address (16 bytes)
    stc_addr_hex = event.get("starcoin_bridge_address", "")
    if stc_addr_hex.startswith("0x"):
        stc_addr_hex = stc_addr_hex[2:]
    starcoin_address_bytes = bytes.fromhex(stc_addr_hex.zfill(32))  # Pad to 32 bytes
    
    # Parse target chain ID
    eth_chain_id_str = event.get("eth_chain_id", "EthCustom")
    target_chain_id = CHAIN_ID_MAP.get(eth_chain_id_str, 12)
    
    token_id = int(event.get("token_id", 0))
    amount = int(event.get("amount_starcoin_bridge_adjusted", 0))
    
    return nonce, starcoin_address_bytes, target_chain_id, token_id, amount


def submit_eth_claim_with_signatures(
    w3: Web3,
    bridge_address: str,
    eth_account: Account,
    signature_collection: SignatureCollection,
) -> TxReceipt:
    """
    Submit claim transaction to Ethereum using collected signatures.
    
    This calls `transferBridgedTokensWithSignatures` which internally:
    1. Verifies signatures达到 quorum
    2. Executes approve (marks transfer as approved on-chain)
    3. Executes claim (transfers tokens to recipient)
    
    Args:
        w3: Web3 instance
        bridge_address: Bridge contract address on Ethereum
        eth_account: Account to submit transaction
        signature_collection: Collected validator signatures
        
    Returns:
        Transaction receipt
    """
    if not signature_collection.quorum_reached:
        raise ValueError("Cannot submit: quorum not reached")
    
    console.print(f"[cyan]Constructing Ethereum claim transaction...[/cyan]")
    
    # Extract bridge action data from first signature (all should be identical)
    bridge_action = signature_collection.signatures[0].bridge_action
    
    # Parse action to get payload components
    nonce, stc_address_bytes, target_chain_id, token_id, amount = _parse_starcoin_to_eth_action(bridge_action)
    
    # Get source chain ID from action
    action = bridge_action.get("StarcoinToEthBridgeAction", {})
    event = action.get("starcoin_bridge_event", {})
    source_chain_str = event.get("starcoin_bridge_chain_id", "StarcoinCustom")
    source_chain_id = CHAIN_ID_MAP.get(source_chain_str, 2)
    
    # Get recipient address from event
    eth_addr_hex = event.get("eth_address", "")
    if eth_addr_hex.startswith("0x"):
        eth_addr_hex = eth_addr_hex[2:]
    recipient_bytes = bytes.fromhex(eth_addr_hex.zfill(40))  # 20 bytes
    
    # Construct payload: abi.encodePacked format per Rust bridge encoding.rs
    # Format: senderAddressLength(1) + senderAddress(16) + targetChain(1) + 
    #         recipientAddressLength(1) + recipientAddress(20) + tokenID(1) + amount(8)
    # Note: Starcoin address is 16 bytes, not 32 bytes! (per Rust encoding.rs line 571)
    sender_address_length = 16  # Starcoin uses 16 bytes
    recipient_address_length = 20  # ETH address
    
    # Starcoin address should be exactly 16 bytes
    if len(stc_address_bytes) != 16:
        console.print(f"[yellow]Warning: Starcoin address is {len(stc_address_bytes)} bytes, expected 16[/yellow]")
    
    # Build payload as packed bytes (matching bridge encoding.rs)
    payload = bytes([sender_address_length]) + \
              stc_address_bytes + \
              bytes([target_chain_id]) + \
              bytes([recipient_address_length]) + \
              recipient_bytes + \
              bytes([token_id]) + \
              amount.to_bytes(8, byteorder='big')  # uint64
    
    console.print(f"  Nonce: {nonce}")
    console.print(f"  Source chain: {source_chain_id}")
    console.print(f"  Target chain: {target_chain_id}")
    console.print(f"  Token ID: {token_id}")
    console.print(f"  Amount: {amount}")
    
    # Construct BridgeUtils.Message struct
    # struct Message {
    #     uint8 messageType;
    #     uint8 version;
    #     uint64 nonce;
    #     uint8 chainID;
    #     bytes payload;
    # }
    MESSAGE_TYPE_TOKEN_TRANSFER = 0
    MESSAGE_VERSION = 1
    
    # Encode message struct (not packed, regular abi encoding for struct)
    message_tuple = (
        MESSAGE_TYPE_TOKEN_TRANSFER,  # messageType
        MESSAGE_VERSION,              # version
        nonce,                        # nonce (uint64)
        source_chain_id,             # chainID (source chain)
        payload                       # payload (bytes)
    )
    
    # Convert signatures from base64 to bytes
    signature_bytes_list = []
    for sig in signature_collection.signatures:
        sig_base64 = sig.signature_hex
        if sig_base64.startswith("0x"):
            # Already hex encoded
            sig_bytes = bytes.fromhex(sig_base64[2:])
        else:
            # Base64 encoded
            sig_bytes = base64.b64decode(sig_base64)
        
        # Signature should be 65 bytes (r=32, s=32, v=1)
        if len(sig_bytes) != 65:
            console.print(f"[yellow]Warning: signature length is {len(sig_bytes)}, expected 65[/yellow]")
        
        signature_bytes_list.append(sig_bytes)
    
    console.print(f"  Prepared {len(signature_bytes_list)} signatures")
    
    # Load bridge contract ABI
    bridge_abi = [
        {
            "inputs": [
                {"name": "signatures", "type": "bytes[]"},
                {
                    "components": [
                        {"name": "messageType", "type": "uint8"},
                        {"name": "version", "type": "uint8"},
                        {"name": "nonce", "type": "uint64"},
                        {"name": "chainID", "type": "uint8"},
                        {"name": "payload", "type": "bytes"}
                    ],
                    "name": "message",
                    "type": "tuple"
                }
            ],
            "name": "transferBridgedTokensWithSignatures",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }
    ]
    
    bridge = w3.eth.contract(address=Web3.to_checksum_address(bridge_address), abi=bridge_abi)
    
    # Build transaction
    console.print(f"[cyan]Submitting claim to Ethereum bridge {bridge_address[:10]}...[/cyan]")
    
    nonce_tx = w3.eth.get_transaction_count(eth_account.address)
    tx = bridge.functions.transferBridgedTokensWithSignatures(
        signature_bytes_list,
        message_tuple
    ).build_transaction({
        "from": eth_account.address,
        "nonce": nonce_tx,
        "gas": 500000,
        "gasPrice": w3.eth.gas_price,
    })
    
    # Sign and send
    signed = eth_account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    console.print(f"  TX hash: {tx_hash.hex()}")
    
    # Wait for receipt
    console.print("  Waiting for confirmation...")
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=DEFAULT_TX_TIMEOUT)
    
    if receipt.get("status") == 1:
        console.print(f"[green]✓ Claim transaction successful[/green]")
    else:
        console.print(f"[red]✗ Claim transaction failed[/red]")
        raise RuntimeError(f"Claim transaction reverted: {tx_hash.hex()}")
    
    return receipt


def _parse_eth_to_stc_action(bridge_action: Dict[str, Any]) -> Tuple[int, int, bytes, int, bytes, int, int]:
    """
    Parse EthToStarcoinBridgeAction JSON into payload components.
    
    Returns:
        (source_chain_id, nonce, sender_address_bytes, target_chain_id, 
         target_address_bytes, token_id, amount)
    """
    action = bridge_action.get("EthToStarcoinBridgeAction", {})
    event = action.get("eth_bridge_event", {})
    
    # Extract fields from event
    source_chain_str = event.get("eth_chain_id", "EthCustom")
    source_chain_id = CHAIN_ID_MAP.get(source_chain_str, 12)
    
    nonce = int(event.get("nonce", 0))
    
    # Sender address (ETH = 20 bytes)
    sender_hex = event.get("eth_address", "")
    if sender_hex.startswith("0x"):
        sender_hex = sender_hex[2:]
    sender_address_bytes = bytes.fromhex(sender_hex.zfill(40))  # 20 bytes
    
    # Target chain
    target_chain_str = event.get("starcoin_bridge_chain_id", "StarcoinCustom")
    target_chain_id = CHAIN_ID_MAP.get(target_chain_str, 2)
    
    # Target address (Starcoin = 16 bytes)
    stc_addr_hex = event.get("starcoin_bridge_address", "")
    if stc_addr_hex.startswith("0x"):
        stc_addr_hex = stc_addr_hex[2:]
    # Starcoin address is exactly 16 bytes = 32 hex chars, no padding
    target_address_bytes = bytes.fromhex(stc_addr_hex)
    
    token_id = int(event.get("token_id", 0))
    amount = int(event.get("starcoin_bridge_adjusted_amount", 0))
    
    return (source_chain_id, nonce, sender_address_bytes, target_chain_id, 
            target_address_bytes, token_id, amount)


def submit_stc_claim_with_signatures(
    stc_rpc_client,
    stc_txn_builder,
    bridge_address: str,
    signature_collection: "SignatureCollection",
) -> str:
    """
    Submit approve + claim transaction to Starcoin using collected signatures.
    
    This calls:
    1. `approve_bridge_token_transfer_three` - register signatures
    2. `claim_bridge_<token>` - transfer tokens to recipient
    
    Args:
        stc_rpc_client: StarcoinRpcClient instance
        stc_txn_builder: TransactionBuilder instance (with signer key)
        bridge_address: Bridge contract address on Starcoin
        signature_collection: Collected validator signatures
        
    Returns:
        Transaction hash of claim transaction
    """
    from .starcoin.transaction import serialize_u8_arg, serialize_u64_arg, serialize_bytes_arg
    
    if not signature_collection.quorum_reached:
        raise ValueError("Cannot submit: quorum not reached")
    
    console.print(f"[cyan]Constructing Starcoin claim transactions...[/cyan]")
    
    # Extract bridge action data from first signature
    bridge_action = signature_collection.signatures[0].bridge_action
    
    # Parse action
    (source_chain_id, nonce, sender_address_bytes, target_chain_id, 
     target_address_bytes, token_id, amount) = _parse_eth_to_stc_action(bridge_action)
    
    console.print(f"  Source chain: {source_chain_id}")
    console.print(f"  Nonce: {nonce}")
    console.print(f"  Target chain: {target_chain_id}")
    console.print(f"  Token ID: {token_id}")
    console.print(f"  Amount: {amount}")
    console.print(f"  Sender address ({len(sender_address_bytes)}B): {sender_address_bytes.hex()}")
    console.print(f"  Target address ({len(target_address_bytes)}B): {target_address_bytes.hex()}")
    
    # Convert signatures from base64 to bytes
    signature_bytes_list = []
    for i, sig in enumerate(signature_collection.signatures):
        sig_base64 = sig.signature_hex
        if sig_base64.startswith("0x"):
            sig_bytes = bytes.fromhex(sig_base64[2:])
        else:
            sig_bytes = base64.b64decode(sig_base64)
        signature_bytes_list.append(sig_bytes)
        v_byte = sig_bytes[64] if len(sig_bytes) > 64 else 'N/A'
        console.print(f"  Sig{i+1} ({len(sig_bytes)}B) v={v_byte} full={sig_bytes.hex()}")
    
    console.print(f"  Prepared {len(signature_bytes_list)} signatures")
    
    # Get chain info for expiration
    chain_info = stc_rpc_client.get_chain_info()
    block_timestamp_ms = int(chain_info["head"]["timestamp"])
    expiration_secs = (block_timestamp_ms // 1000) + 3600
    
    # Step 1: Call approve_bridge_token_transfer_* based on signature count
    console.print("[cyan]Step 1: Approve with signatures...[/cyan]")
    
    seq = stc_rpc_client.get_sequence_number(stc_txn_builder.sender_address)
    
    # Base args for all approve functions
    base_args = [
        serialize_u8_arg(source_chain_id),
        serialize_u64_arg(nonce),
        serialize_bytes_arg(sender_address_bytes),
        serialize_u8_arg(target_chain_id),
        serialize_bytes_arg(target_address_bytes),
        serialize_u8_arg(token_id),
        serialize_u64_arg(amount),
    ]
    
    # Choose function based on signature count
    sig_count = len(signature_bytes_list)
    if sig_count >= 3:
        func_name = "approve_bridge_token_transfer_three"
        approve_args = base_args + [
            serialize_bytes_arg(signature_bytes_list[0]),
            serialize_bytes_arg(signature_bytes_list[1]),
            serialize_bytes_arg(signature_bytes_list[2]),
        ]
    elif sig_count == 2:
        func_name = "approve_bridge_token_transfer_two"
        approve_args = base_args + [
            serialize_bytes_arg(signature_bytes_list[0]),
            serialize_bytes_arg(signature_bytes_list[1]),
        ]
    elif sig_count == 1:
        func_name = "approve_bridge_token_transfer_single"
        approve_args = base_args + [
            serialize_bytes_arg(signature_bytes_list[0]),
        ]
    else:
        raise ValueError("Need at least one signature")
    
    console.print(f"  Using function: {func_name}")
    
    signed_approve = stc_txn_builder.build_and_sign(
        module_address=bridge_address,
        module_name="Bridge",
        function_name=func_name,
        sequence_number=seq,
        type_args=[],
        args=approve_args,
        expiration_timestamp_secs=expiration_secs,
    )
    
    tx_hash_approve = stc_rpc_client.submit_transaction(signed_approve.to_hex())
    console.print(f"  Approve TX: {tx_hash_approve}")
    
    result = stc_rpc_client.wait_for_transaction(tx_hash_approve, timeout=DEFAULT_TX_TIMEOUT)
    if not result.success:
        raise RuntimeError(f"Approve transaction failed: {result.error}")
    console.print("[green]✓ Approve transaction successful[/green]")
    
    # Step 2: Call claim_bridge_<token>
    console.print("[cyan]Step 2: Claim tokens...[/cyan]")
    
    # Map token_id to function name
    token_map = {1: "btc", 2: "eth", 3: "usdc", 4: "usdt"}
    token_name = token_map.get(token_id, "usdt")
    claim_func = f"claim_bridge_{token_name}"
    
    seq = stc_rpc_client.get_sequence_number(stc_txn_builder.sender_address)
    
    # Get fresh timestamp for claim
    chain_info = stc_rpc_client.get_chain_info()
    clock_timestamp_ms = int(chain_info["head"]["timestamp"])
    
    # claim_bridge_<token>(clock_timestamp_ms, source_chain, bridge_seq_num)
    claim_args = [
        serialize_u64_arg(clock_timestamp_ms),
        serialize_u8_arg(source_chain_id),
        serialize_u64_arg(nonce),
    ]
    
    signed_claim = stc_txn_builder.build_and_sign(
        module_address=bridge_address,
        module_name="Bridge",
        function_name=claim_func,
        sequence_number=seq,
        type_args=[],
        args=claim_args,
        expiration_timestamp_secs=expiration_secs,
    )
    
    tx_hash_claim = stc_rpc_client.submit_transaction(signed_claim.to_hex())
    console.print(f"  Claim TX: {tx_hash_claim}")
    
    result = stc_rpc_client.wait_for_transaction(tx_hash_claim, timeout=DEFAULT_TX_TIMEOUT)
    if not result.success:
        raise RuntimeError(f"Claim transaction failed: {result.error}")
    console.print("[green]✓ Claim transaction successful[/green]")
    
    return tx_hash_claim


def wait_for_tx_finalized_with_polling(
    source_chain: str,
    tx_id: str,
    poll_interval_secs: int = 3,
    max_wait_secs: int = 300,
) -> bool:
    """
    Poll until transaction is finalized (can be signed by validators).
    
    In production, this would query indexer API or chain RPC.
    For now, simple time-based wait.
    
    Args:
        source_chain: "starcoin" or "eth"
        tx_id: Transaction hash/digest
        poll_interval_secs: Seconds between polls
        max_wait_secs: Maximum wait time
        
    Returns:
        True if finalized, False if timeout
    """
    console.print(f"[cyan]Waiting for {source_chain} TX {tx_id[:16]}... to finalize[/cyan]")
    
    elapsed = 0
    while elapsed < max_wait_secs:
        # In production: query indexer GET /transfers/:chain_id/:nonce
        # Check is_finalized field
        
        # For local testing: assume finalized after 10 seconds
        if elapsed >= 10:
            console.print("[green]✓ Transaction finalized[/green]")
            return True
        
        time.sleep(poll_interval_secs)
        elapsed += poll_interval_secs
        console.print(f"  Still waiting... ({elapsed}s)")
    
    console.print("[red]✗ Timeout waiting for finalization[/red]")
    return False
