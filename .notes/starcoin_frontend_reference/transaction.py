"""
Starcoin transaction building and signing via pure Python.

Implements BCS serialization and Ed25519 signing for Starcoin transactions.
"""

import hashlib
import struct
from dataclasses import dataclass
from typing import List, Optional, Union, Any

from nacl.signing import SigningKey


# BCS serialization helpers
def bcs_serialize_u8(value: int) -> bytes:
    return struct.pack("<B", value)


def bcs_serialize_u16(value: int) -> bytes:
    return struct.pack("<H", value)


def bcs_serialize_u32(value: int) -> bytes:
    return struct.pack("<I", value)


def bcs_serialize_u64(value: int) -> bytes:
    return struct.pack("<Q", value)


def bcs_serialize_u128(value: int) -> bytes:
    return struct.pack("<QQ", value & 0xFFFFFFFFFFFFFFFF, value >> 64)


def bcs_serialize_uleb128(value: int) -> bytes:
    """Serialize unsigned LEB128 (used for sequence length)."""
    result = bytearray()
    while value >= 0x80:
        result.append((value & 0x7F) | 0x80)
        value >>= 7
    result.append(value)
    return bytes(result)


def bcs_serialize_bytes(data: bytes) -> bytes:
    """Serialize bytes with length prefix."""
    return bcs_serialize_uleb128(len(data)) + data


def bcs_serialize_string(s: str) -> bytes:
    """Serialize string as UTF-8 bytes with length prefix."""
    encoded = s.encode("utf-8")
    return bcs_serialize_uleb128(len(encoded)) + encoded


def bcs_serialize_address(address: str) -> bytes:
    """Serialize a Starcoin address (16 bytes)."""
    addr = address.lower()
    if addr.startswith("0x"):
        addr = addr[2:]
    # Pad to 32 hex chars (16 bytes)
    addr = addr.zfill(32)
    return bytes.fromhex(addr)


def bcs_serialize_sequence(items: List[bytes]) -> bytes:
    """Serialize a sequence of already-serialized items."""
    result = bcs_serialize_uleb128(len(items))
    for item in items:
        result += item
    return result


@dataclass
class ModuleId:
    """Move module identifier."""
    address: str  # 16-byte address as hex
    name: str     # Module name

    def serialize(self) -> bytes:
        return bcs_serialize_address(self.address) + bcs_serialize_string(self.name)


@dataclass
class StructTag:
    """Move struct tag."""
    address: str
    module: str
    name: str
    type_params: List["TypeTag"]

    def serialize(self) -> bytes:
        res = bcs_serialize_address(self.address)
        res += bcs_serialize_string(self.module)
        res += bcs_serialize_string(self.name)
        res += bcs_serialize_sequence([t.serialize() for t in self.type_params])
        return res

    @staticmethod
    def from_string(s: str) -> "StructTag":
        """Parse simple struct tag string (no generics supported in this simple parser yet)."""
        parts = s.split("::")
        if len(parts) != 3:
            raise ValueError(f"Invalid struct tag string: {s}")
        return StructTag(parts[0], parts[1], parts[2], [])


class TypeTag:
    """Move type tag."""
    BOOL = 0
    U8 = 1
    U64 = 2
    U128 = 3
    ADDRESS = 4
    SIGNER = 5
    VECTOR = 6
    STRUCT = 7
    U16 = 8
    U32 = 9
    U256 = 10

    @staticmethod
    def struct_from_string(s: str) -> "TypeTag":
        return TypeTag.struct(StructTag.from_string(s))

    def __init__(self, variant: int, value: Any = None):
        self.variant = variant
        self.value = value

    def serialize(self) -> bytes:
        res = bcs_serialize_uleb128(self.variant)
        if self.variant == self.VECTOR:
            res += self.value.serialize()
        elif self.variant == self.STRUCT:
            res += self.value.serialize()
        return res

    @staticmethod
    def bool(): return TypeTag(TypeTag.BOOL)
    @staticmethod
    def u8(): return TypeTag(TypeTag.U8)
    @staticmethod
    def u64(): return TypeTag(TypeTag.U64)
    @staticmethod
    def u128(): return TypeTag(TypeTag.U128)
    @staticmethod
    def address(): return TypeTag(TypeTag.ADDRESS)
    @staticmethod
    def signer(): return TypeTag(TypeTag.SIGNER)
    @staticmethod
    def vector(inner: "TypeTag"): return TypeTag(TypeTag.VECTOR, inner)
    @staticmethod
    def struct(st: StructTag): return TypeTag(TypeTag.STRUCT, st)


@dataclass
class ScriptFunction:
    """Move script function call."""
    module: ModuleId
    function: str
    type_args: List[TypeTag]  # Changed from List[bytes] to List[TypeTag]
    args: List[bytes]       # Pre-serialized arguments

    def serialize(self) -> bytes:
        result = self.module.serialize()
        result += bcs_serialize_string(self.function)
        result += bcs_serialize_sequence([t.serialize() for t in self.type_args])
        result += bcs_serialize_sequence([bcs_serialize_bytes(arg) for arg in self.args])
        return result


@dataclass
class TransactionPayload:
    """Transaction payload (ScriptFunction or Package)."""
    payload_type: int  # 1 = Package, 2 = ScriptFunction
    data: bytes

    @classmethod
    def script_function(cls, sf: ScriptFunction) -> "TransactionPayload":
        return cls(payload_type=2, data=sf.serialize())

    @classmethod
    def package(cls, package_blob: bytes) -> "TransactionPayload":
        """Create a Package payload from blob file content.
        
        The blob file is already BCS-serialized Package data.
        We just need to wrap it with the payload type.
        """
        return cls(payload_type=1, data=package_blob)

    def serialize(self) -> bytes:
        return bcs_serialize_u8(self.payload_type) + self.data


@dataclass
class RawUserTransaction:
    """Raw unsigned transaction."""
    sender: str                        # 16-byte address
    sequence_number: int               # u64
    payload: TransactionPayload
    max_gas_amount: int                # u64
    gas_unit_price: int                # u64
    gas_token_code: str                # Token code string
    expiration_timestamp_secs: int     # u64
    chain_id: int                      # u8

    def serialize(self) -> bytes:
        result = bcs_serialize_address(self.sender)
        result += bcs_serialize_u64(self.sequence_number)
        result += self.payload.serialize()
        result += bcs_serialize_u64(self.max_gas_amount)
        result += bcs_serialize_u64(self.gas_unit_price)
        result += bcs_serialize_string(self.gas_token_code)
        result += bcs_serialize_u64(self.expiration_timestamp_secs)
        result += bcs_serialize_u8(self.chain_id)
        return result

    def signing_message(self) -> bytes:
        """Get the message to sign (with domain prefix)."""
        # Starcoin uses SHA3-256 of "STARCOIN::RawUserTransaction" as prefix
        prefix = hashlib.sha3_256(b"STARCOIN::RawUserTransaction").digest()
        return prefix + self.serialize()


@dataclass 
class Ed25519Signature:
    """Ed25519 signature."""
    signature: bytes  # 64 bytes

    def serialize(self) -> bytes:
        return bcs_serialize_bytes(self.signature)


@dataclass
class Ed25519PublicKey:
    """Ed25519 public key."""
    key: bytes  # 32 bytes

    def serialize(self) -> bytes:
        return bcs_serialize_bytes(self.key)


@dataclass
class TransactionAuthenticator:
    """Transaction authenticator."""
    auth_type: int  # 0 = Ed25519
    public_key: Ed25519PublicKey
    signature: Ed25519Signature

    def serialize(self) -> bytes:
        result = bcs_serialize_u8(self.auth_type)
        result += self.public_key.serialize()
        result += self.signature.serialize()
        return result


@dataclass
class SignedUserTransaction:
    """Signed transaction ready for submission."""
    raw_txn: RawUserTransaction
    authenticator: TransactionAuthenticator

    def serialize(self) -> bytes:
        return self.raw_txn.serialize() + self.authenticator.serialize()

    def to_hex(self) -> str:
        """Get hex string for RPC submission."""
        return "0x" + self.serialize().hex()


class TransactionBuilder:
    """Build and sign Starcoin transactions."""

    def __init__(self, private_key: bytes, chain_id: int):
        """
        Initialize with Ed25519 private key and chain ID.
        
        Args:
            private_key: 32-byte Ed25519 private key
            chain_id: Starcoin chain ID (253=halley, 254=dev, etc.)
        """
        self.signing_key = SigningKey(private_key)
        self.public_key = bytes(self.signing_key.verify_key)
        self.chain_id = chain_id
        
        # Derive sender address
        auth_key = hashlib.sha3_256(self.public_key + b'\x00').digest()
        self.sender_address = "0x" + auth_key[16:32].hex()

    def build_script_function_payload(
        self,
        module_address: str,
        module_name: str,
        function_name: str,
        type_args: Optional[List[TypeTag]] = None,
        args: Optional[List[bytes]] = None,
    ) -> TransactionPayload:
        """Build a script function transaction payload."""
        module = ModuleId(address=module_address, name=module_name)
        sf = ScriptFunction(
            module=module,
            function=function_name,
            type_args=type_args or [],
            args=args or [],
        )
        return TransactionPayload.script_function(sf)

    def build_raw_transaction(
        self,
        payload: TransactionPayload,
        sequence_number: int,
        max_gas_amount: int = 10000000,
        gas_unit_price: int = 1,
        expiration_timestamp_secs: Optional[int] = None,
    ) -> RawUserTransaction:
        """Build a raw (unsigned) transaction."""
        import time
        
        if expiration_timestamp_secs is None:
            expiration_timestamp_secs = int(time.time()) + 3600  # 1 hour from now
        
        return RawUserTransaction(
            sender=self.sender_address,
            sequence_number=sequence_number,
            payload=payload,
            max_gas_amount=max_gas_amount,
            gas_unit_price=gas_unit_price,
            gas_token_code="0x1::STC::STC",
            expiration_timestamp_secs=expiration_timestamp_secs,
            chain_id=self.chain_id,
        )

    def sign_transaction(self, raw_txn: RawUserTransaction) -> SignedUserTransaction:
        """Sign a raw transaction."""
        message = raw_txn.signing_message()
        signed = self.signing_key.sign(message)
        signature = signed.signature  # 64 bytes
        
        authenticator = TransactionAuthenticator(
            auth_type=0,  # Ed25519
            public_key=Ed25519PublicKey(key=self.public_key),
            signature=Ed25519Signature(signature=signature),
        )
        
        return SignedUserTransaction(raw_txn=raw_txn, authenticator=authenticator)

    def build_and_sign(
        self,
        module_address: str,
        module_name: str,
        function_name: str,
        sequence_number: int,
        type_args: Optional[List[TypeTag]] = None,
        args: Optional[List[bytes]] = None,
        max_gas_amount: int = 10000000,
        gas_unit_price: int = 1,
        expiration_timestamp_secs: Optional[int] = None,
    ) -> SignedUserTransaction:
        """Build and sign a script function transaction."""
        payload = self.build_script_function_payload(
            module_address, module_name, function_name, type_args, args
        )
        raw_txn = self.build_raw_transaction(
            payload,
            sequence_number,
            max_gas_amount,
            gas_unit_price,
            expiration_timestamp_secs=expiration_timestamp_secs,
        )
        return self.sign_transaction(raw_txn)
    
    def deploy_package(
        self,
        rpc_client,
        package_blob: bytes,
        sequence_number: int,
        expiration_timestamp_secs: Optional[int] = None,
    ) -> dict:
        """
        Deploy a Move package.
        
        Args:
            rpc_client: StarcoinRpcClient instance
            package_blob: BCS-serialized Package bytes
            sequence_number: Account sequence number
            
        Returns:
            dict with success, tx_hash, error fields
        """
        # Create package payload
        payload = TransactionPayload.package(package_blob)
        
        # Build raw transaction with higher gas for package deployment
        raw_txn = self.build_raw_transaction(
            payload=payload,
            sequence_number=sequence_number,
            max_gas_amount=40000000,  # Higher gas for deployment
            gas_unit_price=1,
            expiration_timestamp_secs=expiration_timestamp_secs,
        )
        
        # Sign transaction
        signed_txn = self.sign_transaction(raw_txn)
        
        # Serialize and send
        signed_txn_hex = signed_txn.serialize().hex()
        
        try:
            tx_hash = rpc_client.submit_transaction(signed_txn_hex)
            return {"success": True, "tx_hash": tx_hash, "error": None}
        except Exception as e:
            return {"success": False, "tx_hash": None, "error": str(e)}


# Argument serialization helpers
def serialize_u8_arg(value: int) -> bytes:
    """Serialize u8 argument."""
    return bcs_serialize_u8(value)


def serialize_u64_arg(value: int) -> bytes:
    """Serialize u64 argument."""
    return bcs_serialize_u64(value)


def serialize_u128_arg(value: int) -> bytes:
    """Serialize u128 argument."""
    return bcs_serialize_u128(value)


def serialize_address_arg(address: str) -> bytes:
    """Serialize address argument."""
    return bcs_serialize_address(address)


def serialize_bytes_arg(data: bytes) -> bytes:
    """Serialize vector<u8> argument."""
    return bcs_serialize_bytes(data)


def serialize_string_arg(s: str) -> bytes:
    """Serialize string (as vector<u8>) argument."""
    return bcs_serialize_bytes(s.encode("utf-8"))


def serialize_address_vector_arg(addresses: List[str]) -> bytes:
    """Serialize vector<address> argument."""
    result = bcs_serialize_uleb128(len(addresses))
    for addr in addresses:
        result += bcs_serialize_address(addr)
    return result


def serialize_u64_vector_arg(values: List[int]) -> bytes:
    """Serialize vector<u64> argument."""
    result = bcs_serialize_uleb128(len(values))
    for v in values:
        result += bcs_serialize_u64(v)
    return result
