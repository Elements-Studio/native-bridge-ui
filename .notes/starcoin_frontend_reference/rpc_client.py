"""
Pure HTTP RPC client for Starcoin.

Supports transaction building, signing, and submission without starcoin CLI.
"""

import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import requests
from rich.console import Console

from .transaction import (
    TransactionBuilder,
    TransactionPayload,
    serialize_address_arg,
    serialize_bytes_arg,
    serialize_u8_arg,
    serialize_u64_arg,
    serialize_address_vector_arg,
    serialize_u64_vector_arg,
)

console = Console()


@dataclass
class TxResult:
    """Transaction result."""
    success: bool
    tx_hash: Optional[str] = None
    status: Optional[str] = None
    error: Optional[str] = None
    gas_used: Optional[int] = None


class StarcoinRpcClient:
    """Pure RPC client for Starcoin."""

    def __init__(self, rpc_url: str, timeout: int = 120, max_retries: int = 3):
        self.rpc_url = rpc_url
        self.timeout = timeout
        self.max_retries = max_retries
        self._request_id = 0

    def _rpc_call(self, method: str, params: List[Any]) -> Any:
        """Make a JSON-RPC call with retry logic for transient errors."""
        self._request_id += 1
        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
            "id": self._request_id,
        }
        
        last_error = None
        for attempt in range(self.max_retries):
            try:
                response = requests.post(
                    self.rpc_url,
                    json=payload,
                    timeout=self.timeout,
                    headers={"Content-Type": "application/json"},
                )
                response.raise_for_status()
                data = response.json()
                
                if "error" in data and data["error"]:
                    raise Exception(f"RPC error: {data['error']}")
                
                return data.get("result")
            except requests.exceptions.RequestException as e:
                last_error = e
                # Retry on 503 Service Unavailable or connection errors
                if hasattr(e, 'response') and e.response is not None and e.response.status_code == 503:
                    import time
                    time.sleep(2 * (attempt + 1))  # Exponential backoff
                    continue
                # Also retry on connection errors
                if 'connection' in str(e).lower() or 'timeout' in str(e).lower():
                    import time
                    time.sleep(2 * (attempt + 1))
                    continue
                raise Exception(f"RPC request failed: {e}")
        
        raise Exception(f"RPC request failed after {self.max_retries} retries: {last_error}")

    def get_chain_id(self) -> int:
        """Get chain ID."""
        info = self._rpc_call("chain.id", [])
        return info.get("id", 0)

    def get_chain_info(self) -> Dict:
        """Get chain info."""
        return self._rpc_call("chain.info", [])

    def get_node_info(self) -> Dict:
        """Get node info."""
        return self._rpc_call("node.info", [])

    def get_sequence_number(self, address: str) -> int:
        """Get account sequence number."""
        # Try txpool first
        try:
            result = self._rpc_call("txpool.next_sequence_number", [address])
            if result is not None:
                return int(result)
        except Exception:
            pass
        
        # Fallback to account resource
        resource = self.get_resource(
            address,
            "0x00000000000000000000000000000001::Account::Account"
        )
        if resource:
            return int(resource.get("json", {}).get("sequence_number", 0))
        return 0

    def dev_get_coin(self, address: str, amount: int) -> None:
        """Mint coins to address (dev network only)."""
        # starcoin dev get-coin -v <amount> <address>
        # RPC: dev.get_coin(address, amount)
        # Note: amount is in nanoSTC
        self._rpc_call("dev.get_coin", [address, amount])

    def get_resource(self, address: str, resource_type: str) -> Optional[Dict]:
        """Get resource from account."""
        result = self._rpc_call(
            "state.get_resource",
            [address, resource_type, {"decode": True}]
        )
        return result

    def get_balance(self, address: str) -> int:
        """Get STC balance in nano STC."""
        resource = self.get_resource(
            address,
            "0x00000000000000000000000000000001::Account::Balance<0x00000000000000000000000000000001::STC::STC>"
        )
        if resource:
            try:
                token = resource.get("json", {}).get("token", {})
                return int(token.get("value", 0))
            except (KeyError, TypeError):
                pass
        return 0

    def has_module(self, address: str, module_name: str) -> bool:
        """Check if module exists."""
        result = self._rpc_call("state.get_code", [f"{address}::{module_name}"])
        return result is not None and len(result.get("code", "")) > 0

    def has_resource(self, address: str, resource_type: str) -> bool:
        """Check if resource exists."""
        result = self.get_resource(address, resource_type)
        return result is not None

    def is_bridge_initialized(self, bridge_address: str) -> bool:
        """Check if bridge is initialized."""
        return self.has_resource(
            bridge_address,
            f"{bridge_address}::Bridge::Bridge"
        )

    def get_bridge_resource_json(self, bridge_address: str) -> Optional[Dict[str, Any]]:
        """Return decoded Bridge::Bridge resource json, if present."""
        res = self.get_resource(bridge_address, f"{bridge_address}::Bridge::Bridge")
        if not res:
            return None
        json_val = res.get("json")
        if isinstance(json_val, dict):
            return json_val
        return None

    def get_committee_members(self, bridge_address: str) -> List[Dict[str, Any]]:
        """Return committee members list from Bridge resource.

        The Move struct stores members as SimpleMap, which decodes to:
        {"data": [{"key": ..., "value": ...}, ...]}
        """
        bridge_json = self.get_bridge_resource_json(bridge_address)
        if not bridge_json:
            return []
        inner = bridge_json.get("inner")
        if not isinstance(inner, dict):
            return []
        committee = inner.get("committee")
        if not isinstance(committee, dict):
            return []
        members = committee.get("members")
        if not isinstance(members, dict):
            return []
        data = members.get("data")
        if not isinstance(data, list):
            return []
        return [x for x in data if isinstance(x, dict)]

    def is_committee_created(self, bridge_address: str) -> bool:
        """Committee is considered created once members map is non-empty."""
        return len(self.get_committee_members(bridge_address)) > 0

    def get_registered_token_ids(self, bridge_address: str) -> List[int]:
        """Return registered token IDs from treasury.id_token_type_map."""
        bridge_json = self.get_bridge_resource_json(bridge_address)
        if not bridge_json:
            return []
        inner = bridge_json.get("inner")
        if not isinstance(inner, dict):
            return []
        treasury = inner.get("treasury")
        if not isinstance(treasury, dict):
            return []
        id_map = treasury.get("id_token_type_map")
        if not isinstance(id_map, dict):
            return []
        data = id_map.get("data")
        if not isinstance(data, list):
            return []
        ids: List[int] = []
        for item in data:
            if not isinstance(item, dict):
                continue
            key = item.get("key")
            if isinstance(key, int):
                ids.append(key)
            elif isinstance(key, str) and key.isdigit():
                ids.append(int(key))
        return ids

    def submit_transaction(self, signed_txn_hex: str) -> str:
        """Submit a signed transaction."""
        result = self._rpc_call("txpool.submit_hex_transaction", [signed_txn_hex])
        return result

    def get_transaction_info(self, tx_hash: str) -> Optional[Dict]:
        """Get transaction info."""
        return self._rpc_call("chain.get_transaction_info", [tx_hash])

    def get_transaction(self, tx_hash: str) -> Optional[Dict]:
        """Get full transaction data including block_number."""
        return self._rpc_call("chain.get_transaction", [tx_hash])

    def wait_for_transaction(
        self,
        tx_hash: str,
        timeout: int = 120,
        poll_interval: float = 2.0,
    ) -> TxResult:
        """Wait for transaction confirmation."""
        start = time.time()
        
        while time.time() - start < timeout:
            try:
                info = self.get_transaction_info(tx_hash)
                if info:
                    status = info.get("status", "Unknown")
                    if status == "Executed":
                        return TxResult(
                            success=True,
                            tx_hash=tx_hash,
                            status=status,
                            gas_used=info.get("gas_used"),
                        )
                    elif status not in ("Pending", None):
                        return TxResult(
                            success=False,
                            tx_hash=tx_hash,
                            status=status,
                            error=f"Transaction failed: {status}",
                        )
            except Exception as e:
                console.print(f"[dim]Waiting... {e}[/dim]")
            
            time.sleep(poll_interval)
        
        return TxResult(
            success=False,
            tx_hash=tx_hash,
            error=f"Transaction not confirmed within {timeout}s",
        )


class BridgeTransactionBuilder:
    """Build bridge-specific transactions."""

    def __init__(
        self,
        rpc_client: StarcoinRpcClient,
        private_key: bytes,
        chain_id: int,
    ):
        self.rpc = rpc_client
        self.tx_builder = TransactionBuilder(private_key, chain_id)
        self.sender = self.tx_builder.sender_address

    def _get_sequence_number(self) -> int:
        """Get next sequence number for sender."""
        return self.rpc.get_sequence_number(self.sender)

    def _submit_and_wait(
        self,
        module_address: str,
        module_name: str,
        function_name: str,
        args: List[bytes],
        type_args: Optional[List[bytes]] = None,
    ) -> TxResult:
        """Build, sign, submit, and wait for transaction."""
        seq = self._get_sequence_number()
        
        signed_txn = self.tx_builder.build_and_sign(
            module_address=module_address,
            module_name=module_name,
            function_name=function_name,
            sequence_number=seq,
            type_args=type_args,
            args=args,
            expiration_timestamp_secs=self._compute_expiration_secs(),
        )
        
        tx_hex = signed_txn.to_hex()
        console.print(f"[dim]Submitting tx (seq={seq})...[/dim]")
        
        try:
            tx_hash = self.rpc.submit_transaction(tx_hex)
            console.print(f"[dim]Tx hash: {tx_hash}[/dim]")
            return self.rpc.wait_for_transaction(tx_hash)
        except Exception as e:
            return TxResult(success=False, error=str(e))

    def _compute_expiration_secs(self, ttl_secs: int = 3600) -> int:
        """Compute expiration timestamp.

        Starcoin nodes often use an internal `now_seconds` clock (especially in dev/dummy
        consensus). Using local unix time can lead to TRANSACTION_EXPIRED.
        """
        try:
            node_info = self.rpc.get_node_info()
            now_seconds = node_info.get("now_seconds")
            if isinstance(now_seconds, int):
                return int(now_seconds) + ttl_secs
        except Exception:
            pass

        import time

        return int(time.time()) + ttl_secs

    def initialize_bridge(self, bridge_address: str, chain_id: int) -> TxResult:
        """Call Bridge::initialize_bridge."""
        return self._submit_and_wait(
            module_address=bridge_address,
            module_name="Bridge",
            function_name="initialize_bridge",
            args=[serialize_u8_arg(chain_id)],
        )

    def add_allowed_registrant(
        self, bridge_address: str, validator_address: str
    ) -> TxResult:
        """Call Bridge::add_allowed_registrant."""
        return self._submit_and_wait(
            module_address=bridge_address,
            module_name="Bridge",
            function_name="add_allowed_registrant",
            args=[serialize_address_arg(validator_address)],
        )

    def register_committee_member_for_address(
        self,
        bridge_address: str,
        validator_address: str,
        public_key: bytes,
        url: str,
    ) -> TxResult:
        """Call Bridge::register_committee_member_for_address."""
        return self._submit_and_wait(
            module_address=bridge_address,
            module_name="Bridge",
            function_name="register_committee_member_for_address",
            args=[
                serialize_address_arg(validator_address),
                serialize_bytes_arg(public_key),
                serialize_bytes_arg(url.encode("utf-8")),
            ],
        )

    def create_committee(
        self,
        bridge_address: str,
        validator_address: str,
        voting_power: int,
        min_stake_percentage: int,
        epoch: int,
    ) -> TxResult:
        """Call Bridge::create_committee (single validator)."""
        return self._submit_and_wait(
            module_address=bridge_address,
            module_name="Bridge",
            function_name="create_committee",
            args=[
                serialize_address_arg(validator_address),
                serialize_u64_arg(voting_power),
                serialize_u64_arg(min_stake_percentage),
                serialize_u64_arg(epoch),
            ],
        )

    def create_committee_multi(
        self,
        bridge_address: str,
        validator_addresses: List[str],
        voting_powers: List[int],
        min_stake_percentage: int,
        epoch: int,
    ) -> TxResult:
        """Call Bridge::create_committee_multi (multiple validators)."""
        return self._submit_and_wait(
            module_address=bridge_address,
            module_name="Bridge",
            function_name="create_committee_multi",
            args=[
                serialize_address_vector_arg(validator_addresses),
                serialize_u64_vector_arg(voting_powers),
                serialize_u64_arg(min_stake_percentage),
                serialize_u64_arg(epoch),
            ],
        )

    def setup_eth_token(self, bridge_address: str) -> TxResult:
        """Call Bridge::setup_eth_token."""
        return self._submit_and_wait(
            module_address=bridge_address,
            module_name="Bridge",
            function_name="setup_eth_token",
            args=[],
        )

    def setup_btc_token(self, bridge_address: str) -> TxResult:
        """Call Bridge::setup_btc_token."""
        return self._submit_and_wait(
            module_address=bridge_address,
            module_name="Bridge",
            function_name="setup_btc_token",
            args=[],
        )

    def setup_usdc_token(self, bridge_address: str) -> TxResult:
        """Call Bridge::setup_usdc_token."""
        return self._submit_and_wait(
            module_address=bridge_address,
            module_name="Bridge",
            function_name="setup_usdc_token",
            args=[],
        )

    def setup_usdt_token(self, bridge_address: str) -> TxResult:
        """Call Bridge::setup_usdt_token."""
        return self._submit_and_wait(
            module_address=bridge_address,
            module_name="Bridge",
            function_name="setup_usdt_token",
            args=[],
        )

    def create_committee_four(
        self,
        bridge_address: str,
        members: List[tuple],  # List of (pubkey_bytes, voting_power, url)
    ) -> TxResult:
        """Call Bridge::create_committee_four - one transaction for full committee setup.
        
        Contract signature:
        create_committee_four(
            bridge_admin: signer,
            pubkey1: vector<u8>, power1: u64, url1: vector<u8>,
            pubkey2: vector<u8>, power2: u64, url2: vector<u8>,
            pubkey3: vector<u8>, power3: u64, url3: vector<u8>,
            pubkey4: vector<u8>, power4: u64, url4: vector<u8>,
        )
        
        Args:
            bridge_address: Bridge contract address
            members: List of 4 tuples (pubkey_bytes, voting_power, url)
        """
        if len(members) != 4:
            return TxResult(success=False, error=f"Expected 4 members, got {len(members)}")
        
        # Arguments: pubkey1, power1, url1, pubkey2, power2, url2, ...
        args = []
        for pubkey, power, url in members:
            args.extend([
                serialize_bytes_arg(pubkey),
                serialize_u64_arg(power),
                serialize_bytes_arg(url.encode("utf-8") if isinstance(url, str) else url),
            ])
        
        return self._submit_and_wait(
            module_address=bridge_address,
            module_name="Bridge",
            function_name="create_committee_four",
            args=args,
        )
