import { BigNumber, utils } from "ethers";
import { createContext, ReactNode, useContext, useState } from "react";
import * as encoding from "@walletconnect/encoding";
import { TypedDataField } from "@ethersproject/abstract-signer";
import { Transaction as EthTransaction } from "@ethereumjs/tx";
import {
  formatDirectSignDoc,
  stringifySignDocValues,
  verifyAminoSignature,
  verifyDirectSignature,
} from "cosmos-wallet";
import bs58 from "bs58";
import { verifyMessageSignature } from "solana-wallet";
import {
  clusterApiUrl,
  Connection,
  Keypair,
  SystemProgram,
  Transaction as SolanaTransaction,
} from "@solana/web3.js";

import {
  eip712,
  formatTestTransaction,
  getLocalStorageTestnetFlag,
} from "../helpers";
import { useWalletConnectClient } from "./ClientContext";
import {
  DEFAULT_COSMOS_METHODS,
  DEFAULT_EIP155_METHODS,
  DEFAULT_SOLANA_METHODS,
  DEFAULT_POLKADOT_METHODS,
  DEFAULT_NEAR_METHODS,
  DEFAULT_TEZOS_METHODS,
} from "../constants";
import { useChainData } from "./ChainDataContext";
import { signatureVerify, cryptoWaitReady } from "@polkadot/util-crypto";

/**
 * Types
 */
interface IFormattedRpcResponse {
  method?: string;
  address?: string;
  valid: boolean;
  result: string;
}

type TRpcRequestCallback = (chainId: string, address: string) => Promise<void>;

interface IContext {
  ping: () => Promise<void>;
  ethereumRpc: {
    testSendTransaction: TRpcRequestCallback;
    testSignTransaction: TRpcRequestCallback;
    testEthSign: TRpcRequestCallback;
    testSignPersonalMessage: TRpcRequestCallback;
    testSignTypedData: TRpcRequestCallback;
  };
  cosmosRpc: {
    testSignDirect: TRpcRequestCallback;
    testSignAmino: TRpcRequestCallback;
  };
  solanaRpc: {
    testSignMessage: TRpcRequestCallback;
    testSignTransaction: TRpcRequestCallback;
  };
  polkadotRpc: {
    testSignMessage: TRpcRequestCallback;
    testSignTransaction: TRpcRequestCallback;
  };
  nearRpc: {
    testSignAndSendTransaction: TRpcRequestCallback;
    testSignAndSendTransactions: TRpcRequestCallback;
  };
  tezosRpc: {
    testSignMessage: TRpcRequestCallback;
  };
  rpcResult?: IFormattedRpcResponse | null;
  isRpcRequestPending: boolean;
  isTestnet: boolean;
  setIsTestnet: (isTestnet: boolean) => void;
}

/**
 * Context
 */
export const JsonRpcContext = createContext<IContext>({} as IContext);

/**
 * Provider
 */
export function JsonRpcContextProvider({
  children,
}: {
  children: ReactNode | ReactNode[];
}) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<IFormattedRpcResponse | null>();
  const [isTestnet, setIsTestnet] = useState(getLocalStorageTestnetFlag());

  const { client, session, accounts, balances, solanaPublicKeys } =
    useWalletConnectClient();

  const { chainData } = useChainData();

  const _createJsonRpcRequestHandler =
    (
      rpcRequest: (
        chainId: string,
        address: string
      ) => Promise<IFormattedRpcResponse>
    ) =>
    async (chainId: string, address: string) => {
      if (typeof client === "undefined") {
        throw new Error("WalletConnect is not initialized");
      }
      if (typeof session === "undefined") {
        throw new Error("Session is not connected");
      }

      try {
        setPending(true);
        const result = await rpcRequest(chainId, address);
        setResult(result);
      } catch (err: any) {
        console.error("RPC request failed: ", err);
        setResult({
          address,
          valid: false,
          result: err?.message ?? err,
        });
      } finally {
        setPending(false);
      }
    };

  const _verifyEip155MessageSignature = (
    message: string,
    signature: string,
    address: string
  ) =>
    utils.verifyMessage(message, signature).toLowerCase() ===
    address.toLowerCase();

  const ping = async () => {
    if (typeof client === "undefined") {
      throw new Error("WalletConnect is not initialized");
    }
    if (typeof session === "undefined") {
      throw new Error("Session is not connected");
    }

    try {
      setPending(true);

      let valid = false;

      try {
        await client.ping({ topic: session.topic });
        valid = true;
      } catch (e) {
        valid = false;
      }

      // display result
      setResult({
        method: "ping",
        valid,
        result: valid ? "Ping succeeded" : "Ping failed",
      });
    } catch (e) {
      console.error(e);
      setResult(null);
    } finally {
      setPending(false);
    }
  };

  // -------- ETHEREUM/EIP155 RPC METHODS --------

  const ethereumRpc = {
    testSendTransaction: _createJsonRpcRequestHandler(
      async (chainId: string, address: string) => {
        const caipAccountAddress = `${chainId}:${address}`;
        const account = accounts.find(
          (account) => account === caipAccountAddress
        );
        if (account === undefined)
          throw new Error(`Account for ${caipAccountAddress} not found`);

        const tx = await formatTestTransaction(account);

        const balance = BigNumber.from(balances[account][0].balance || "0");
        if (balance.lt(BigNumber.from(tx.gasPrice).mul(tx.gasLimit))) {
          return {
            method: DEFAULT_EIP155_METHODS.ETH_SEND_TRANSACTION,
            address,
            valid: false,
            result: "Insufficient funds for intrinsic transaction cost",
          };
        }

        const result = await client!.request<string>({
          topic: session!.topic,
          chainId,
          request: {
            method: DEFAULT_EIP155_METHODS.ETH_SEND_TRANSACTION,
            params: [tx],
          },
        });

        // format displayed result
        return {
          method: DEFAULT_EIP155_METHODS.ETH_SEND_TRANSACTION,
          address,
          valid: true,
          result,
        };
      }
    ),
    testSignTransaction: _createJsonRpcRequestHandler(
      async (chainId: string, address: string) => {
        const caipAccountAddress = `${chainId}:${address}`;
        const account = accounts.find(
          (account) => account === caipAccountAddress
        );
        if (account === undefined)
          throw new Error(`Account for ${caipAccountAddress} not found`);

        const tx = await formatTestTransaction(account);

        const signedTx = await client!.request<string>({
          topic: session!.topic,
          chainId,
          request: {
            method: DEFAULT_EIP155_METHODS.ETH_SIGN_TRANSACTION,
            params: [tx],
          },
        });

        const valid = EthTransaction.fromSerializedTx(
          signedTx as any
        ).verifySignature();

        return {
          method: DEFAULT_EIP155_METHODS.ETH_SIGN_TRANSACTION,
          address,
          valid,
          result: signedTx,
        };
      }
    ),
    testSignPersonalMessage: _createJsonRpcRequestHandler(
      async (chainId: string, address: string) => {
        // test message
        const message = `My email is john@doe.com - ${Date.now()}`;

        // encode message (hex)
        const hexMsg = encoding.utf8ToHex(message, true);

        // personal_sign params
        const params = [hexMsg, address];

        // send message
        const signature = await client!.request<string>({
          topic: session!.topic,
          chainId,
          request: {
            method: DEFAULT_EIP155_METHODS.PERSONAL_SIGN,
            params,
          },
        });

        //  split chainId
        const [namespace, reference] = chainId.split(":");

        const targetChainData = chainData[namespace][reference];

        if (typeof targetChainData === "undefined") {
          throw new Error(`Missing chain data for chainId: ${chainId}`);
        }

        const valid = _verifyEip155MessageSignature(
          message,
          signature,
          address
        );

        // format displayed result
        return {
          method: DEFAULT_EIP155_METHODS.PERSONAL_SIGN,
          address,
          valid,
          result: signature,
        };
      }
    ),
    testEthSign: _createJsonRpcRequestHandler(
      async (chainId: string, address: string) => {
        // test message
        const message = `My email is john@doe.com - ${Date.now()}`;
        // encode message (hex)
        const hexMsg = encoding.utf8ToHex(message, true);
        // eth_sign params
        const params = [address, hexMsg];

        // send message
        const signature = await client!.request<string>({
          topic: session!.topic,
          chainId,
          request: {
            method: DEFAULT_EIP155_METHODS.ETH_SIGN,
            params,
          },
        });

        //  split chainId
        const [namespace, reference] = chainId.split(":");

        const targetChainData = chainData[namespace][reference];

        if (typeof targetChainData === "undefined") {
          throw new Error(`Missing chain data for chainId: ${chainId}`);
        }

        const valid = _verifyEip155MessageSignature(
          message,
          signature,
          address
        );

        // format displayed result
        return {
          method: DEFAULT_EIP155_METHODS.ETH_SIGN + " (standard)",
          address,
          valid,
          result: signature,
        };
      }
    ),
    testSignTypedData: _createJsonRpcRequestHandler(
      async (chainId: string, address: string) => {
        const message = JSON.stringify(eip712.example);

        // eth_signTypedData params
        const params = [address, message];

        // send message
        const signature = await client!.request<string>({
          topic: session!.topic,
          chainId,
          request: {
            method: DEFAULT_EIP155_METHODS.ETH_SIGN_TYPED_DATA,
            params,
          },
        });

        // Separate `EIP712Domain` type from remaining types to verify, otherwise `ethers.utils.verifyTypedData`
        // will throw due to "unused" `EIP712Domain` type.
        // See: https://github.com/ethers-io/ethers.js/issues/687#issuecomment-714069471
        const {
          EIP712Domain,
          ...nonDomainTypes
        }: Record<string, TypedDataField[]> = eip712.example.types;

        const valid =
          utils
            .verifyTypedData(
              eip712.example.domain,
              nonDomainTypes,
              eip712.example.message,
              signature
            )
            .toLowerCase() === address.toLowerCase();

        return {
          method: DEFAULT_EIP155_METHODS.ETH_SIGN_TYPED_DATA,
          address,
          valid,
          result: signature,
        };
      }
    ),
  };

  // -------- COSMOS RPC METHODS --------

  const cosmosRpc = {
    testSignDirect: _createJsonRpcRequestHandler(
      async (chainId: string, address: string) => {
        // test direct sign doc inputs
        const inputs = {
          fee: [{ amount: "2000", denom: "ucosm" }],
          pubkey: "AgSEjOuOr991QlHCORRmdE5ahVKeyBrmtgoYepCpQGOW",
          gasLimit: 200000,
          accountNumber: 1,
          sequence: 1,
          bodyBytes:
            "0a90010a1c2f636f736d6f732e62616e6b2e763162657461312e4d736753656e6412700a2d636f736d6f7331706b707472653766646b6c366766727a6c65736a6a766878686c63337234676d6d6b38727336122d636f736d6f7331717970717870713971637273737a673270767871367273307a716733797963356c7a763778751a100a0575636f736d120731323334353637",
          authInfoBytes:
            "0a500a460a1f2f636f736d6f732e63727970746f2e736563703235366b312e5075624b657912230a21034f04181eeba35391b858633a765c4a0c189697b40d216354d50890d350c7029012040a020801180112130a0d0a0575636f736d12043230303010c09a0c",
        };

        // split chainId
        const [namespace, reference] = chainId.split(":");

        // format sign doc
        const signDoc = formatDirectSignDoc(
          inputs.fee,
          inputs.pubkey,
          inputs.gasLimit,
          inputs.accountNumber,
          inputs.sequence,
          inputs.bodyBytes,
          reference
        );

        // cosmos_signDirect params
        const params = {
          signerAddress: address,
          signDoc: stringifySignDocValues(signDoc),
        };

        // send message
        const result = await client!.request<{ signature: string }>({
          topic: session!.topic,
          chainId,
          request: {
            method: DEFAULT_COSMOS_METHODS.COSMOS_SIGN_DIRECT,
            params,
          },
        });

        const targetChainData = chainData[namespace][reference];

        if (typeof targetChainData === "undefined") {
          throw new Error(`Missing chain data for chainId: ${chainId}`);
        }

        const valid = await verifyDirectSignature(
          address,
          result.signature,
          signDoc
        );

        // format displayed result
        return {
          method: DEFAULT_COSMOS_METHODS.COSMOS_SIGN_DIRECT,
          address,
          valid,
          result: result.signature,
        };
      }
    ),
    testSignAmino: _createJsonRpcRequestHandler(
      async (chainId: string, address: string) => {
        // split chainId
        const [namespace, reference] = chainId.split(":");

        // test amino sign doc
        const signDoc = {
          msgs: [],
          fee: { amount: [], gas: "23" },
          chain_id: "foochain",
          memo: "hello, world",
          account_number: "7",
          sequence: "54",
        };

        // cosmos_signAmino params
        const params = { signerAddress: address, signDoc };

        // send message
        const result = await client!.request<{ signature: string }>({
          topic: session!.topic,
          chainId,
          request: {
            method: DEFAULT_COSMOS_METHODS.COSMOS_SIGN_AMINO,
            params,
          },
        });

        const targetChainData = chainData[namespace][reference];

        if (typeof targetChainData === "undefined") {
          throw new Error(`Missing chain data for chainId: ${chainId}`);
        }

        const valid = await verifyAminoSignature(
          address,
          result.signature,
          signDoc
        );

        // format displayed result
        return {
          method: DEFAULT_COSMOS_METHODS.COSMOS_SIGN_AMINO,
          address,
          valid,
          result: result.signature,
        };
      }
    ),
  };

  // -------- SOLANA RPC METHODS --------

  const solanaRpc = {
    testSignTransaction: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        if (!solanaPublicKeys) {
          throw new Error("Could not find Solana PublicKeys.");
        }

        const senderPublicKey = solanaPublicKeys[address];

        const connection = new Connection(
          clusterApiUrl(isTestnet ? "testnet" : "mainnet-beta")
        );

        // Using deprecated `getRecentBlockhash` over `getLatestBlockhash` here, since `mainnet-beta`
        // cluster only seems to support `connection.getRecentBlockhash` currently.
        const { blockhash } = await connection.getRecentBlockhash();

        const transaction = new SolanaTransaction({
          feePayer: senderPublicKey,
          recentBlockhash: blockhash,
        }).add(
          SystemProgram.transfer({
            fromPubkey: senderPublicKey,
            toPubkey: Keypair.generate().publicKey,
            lamports: 1,
          })
        );

        try {
          const result = await client!.request<{ signature: string }>({
            chainId,
            topic: session!.topic,
            request: {
              method: DEFAULT_SOLANA_METHODS.SOL_SIGN_TRANSACTION,
              params: {
                feePayer: transaction.feePayer!.toBase58(),
                recentBlockhash: transaction.recentBlockhash,
                instructions: transaction.instructions.map((i) => ({
                  programId: i.programId.toBase58(),
                  data: bs58.encode(i.data),
                  keys: i.keys.map((k) => ({
                    isSigner: k.isSigner,
                    isWritable: k.isWritable,
                    pubkey: k.pubkey.toBase58(),
                  })),
                })),
              },
            },
          });

          // We only need `Buffer.from` here to satisfy the `Buffer` param type for `addSignature`.
          // The resulting `UInt8Array` is equivalent to just `bs58.decode(...)`.
          transaction.addSignature(
            senderPublicKey,
            Buffer.from(bs58.decode(result.signature))
          );

          const valid = transaction.verifySignatures();

          return {
            method: DEFAULT_SOLANA_METHODS.SOL_SIGN_TRANSACTION,
            address,
            valid,
            result: result.signature,
          };
        } catch (error: any) {
          throw new Error(error);
        }
      }
    ),
    testSignMessage: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        if (!solanaPublicKeys) {
          throw new Error("Could not find Solana PublicKeys.");
        }

        const senderPublicKey = solanaPublicKeys[address];

        // Encode message to `UInt8Array` first via `TextEncoder` so we can pass it to `bs58.encode`.
        const message = bs58.encode(
          new TextEncoder().encode(
            `This is an example message to be signed - ${Date.now()}`
          )
        );

        try {
          const result = await client!.request<{ signature: string }>({
            chainId,
            topic: session!.topic,
            request: {
              method: DEFAULT_SOLANA_METHODS.SOL_SIGN_MESSAGE,
              params: {
                pubkey: senderPublicKey.toBase58(),
                message,
              },
            },
          });

          const valid = verifyMessageSignature(
            senderPublicKey.toBase58(),
            result.signature,
            message
          );

          return {
            method: DEFAULT_SOLANA_METHODS.SOL_SIGN_MESSAGE,
            address,
            valid,
            result: result.signature,
          };
        } catch (error: any) {
          throw new Error(error);
        }
      }
    ),
  };
  // -------- POLKADOT RPC METHODS --------

  const polkadotRpc = {
    testSignTransaction: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        // Below example is a scale encoded payload for system.remark("this is a test wallet-connect remark") transaction.
        // decode url: https://polkadot.js.org/apps/?rpc=wss%3A%2F%2Frpc.polkadot.io#/extrinsics/decode/0x00019074686973206973206120746573742077616c6c65742d636f6e6e6563742072656d61726b
        const transactionPayload =
          "0x00019074686973206973206120746573742077616c6c65742d636f6e6e6563742072656d61726b05010000222400000d00000091b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3dc1f37ce7899cf20f63f5ea343f33e9e7b229c7e245049c2a7afc236861fc8b4";
        try {
          const result = await client!.request<{
            payload: string;
            signature: string;
          }>({
            chainId,
            topic: session!.topic,
            request: {
              method: DEFAULT_POLKADOT_METHODS.POLKADOT_SIGN_TRANSACTION,
              params: {
                address,
                transactionPayload,
              },
            },
          });

          // sr25519 signatures need to wait for WASM to load
          await cryptoWaitReady();
          const { isValid: valid } = signatureVerify(
            transactionPayload,
            result.signature,
            address
          );

          return {
            method: DEFAULT_POLKADOT_METHODS.POLKADOT_SIGN_TRANSACTION,
            address,
            valid,
            result: result.signature,
          };
        } catch (error: any) {
          throw new Error(error);
        }
      }
    ),
    testSignMessage: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        const message = `This is an example message to be signed - ${Date.now()}`;

        try {
          const result = await client!.request<{ signature: string }>({
            chainId,
            topic: session!.topic,
            request: {
              method: DEFAULT_POLKADOT_METHODS.POLKADOT_SIGN_MESSAGE,
              params: {
                address,
                message,
              },
            },
          });

          // sr25519 signatures need to wait for WASM to load
          await cryptoWaitReady();
          const { isValid: valid } = signatureVerify(
            message,
            result.signature,
            address
          );

          return {
            method: DEFAULT_POLKADOT_METHODS.POLKADOT_SIGN_MESSAGE,
            address,
            valid,
            result: result.signature,
          };
        } catch (error: any) {
          throw new Error(error);
        }
      }
    ),
  };

  // -------- NEAR RPC METHODS --------

  const nearRpc = {
    testSignAndSendTransaction: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        const method = DEFAULT_NEAR_METHODS.NEAR_SIGN_AND_SEND_TRANSACTION;
        const result = await client!.request({
          topic: session!.topic,
          chainId,
          request: {
            method,
            params: {
              transaction: {
                signerId: address,
                receiverId: "guest-book.testnet",
                actions: [
                  {
                    type: "FunctionCall",
                    params: {
                      methodName: "addMessage",
                      args: { text: "Hello from Wallet Connect!" },
                      gas: "30000000000000",
                      deposit: "0",
                    },
                  },
                ],
              },
            },
          },
        });

        return {
          method,
          address,
          valid: true,
          result: JSON.stringify((result as any).transaction),
        };
      }
    ),
    testSignAndSendTransactions: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        const method = DEFAULT_NEAR_METHODS.NEAR_SIGN_AND_SEND_TRANSACTIONS;
        const result = await client!.request({
          topic: session!.topic,
          chainId,
          request: {
            method,
            params: {
              transactions: [
                {
                  signerId: address,
                  receiverId: "guest-book.testnet",
                  actions: [
                    {
                      type: "FunctionCall",
                      params: {
                        methodName: "addMessage",
                        args: { text: "Hello from Wallet Connect! (1/2)" },
                        gas: "30000000000000",
                        deposit: "0",
                      },
                    },
                  ],
                },
                {
                  signerId: address,
                  receiverId: "guest-book.testnet",
                  actions: [
                    {
                      type: "FunctionCall",
                      params: {
                        methodName: "addMessage",
                        args: { text: "Hello from Wallet Connect! (2/2)" },
                        gas: "30000000000000",
                        deposit: "0",
                      },
                    },
                  ],
                },
              ],
            },
          },
        });

        return {
          method,
          address,
          valid: true,
          result: JSON.stringify(
            (result as any).map((r: any) => r.transaction)
          ),
        };
      }
    ),
  };

// -------- TEZOS RPC METHODS --------

const tezosRpc = {
  testSignMessage: _createJsonRpcRequestHandler(
    async (
      chainId: string,
      address: string
    ): Promise<IFormattedRpcResponse> => {
      const message = `05000000`;
      console.log('message to sign', message)
      console.log('address', address)
      try {
        const result = await client!.request<{ signature: string }>({
          chainId,
          topic: session!.topic,
          request: {
            method: DEFAULT_TEZOS_METHODS.TEZOS_SIGN_MESSAGE,
            params: {
              account: address,
              expression: message,
            },
          },
        });
        console.log('result signed message', result)

        return {
          method: DEFAULT_TEZOS_METHODS.TEZOS_SIGN_MESSAGE,
          address,
          valid: true, //TODO
          result: result.signature,
        };
      } catch (error: any) {
        throw new Error(error);
      }
    }
  ),
};

  return (
    <JsonRpcContext.Provider
      value={{
        ping,
        ethereumRpc,
        cosmosRpc,
        solanaRpc,
        polkadotRpc,
        nearRpc,
        tezosRpc,
        rpcResult: result,
        isRpcRequestPending: pending,
        isTestnet,
        setIsTestnet,
      }}
    >
      {children}
    </JsonRpcContext.Provider>
  );
}

export function useJsonRpc() {
  const context = useContext(JsonRpcContext);
  if (context === undefined) {
    throw new Error("useJsonRpc must be used within a JsonRpcContextProvider");
  }
  return context;
}