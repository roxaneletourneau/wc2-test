import { JsonRpcRequest } from "@walletconnect/jsonrpc-utils";
import { ChainsMap } from "caip-api";

import {
  NamespaceMetadata,
  ChainMetadata,
  ChainRequestRender,
} from "../helpers";

export const TezosMetadata: NamespaceMetadata = {
  ghostnet: {
    logo: "/assets/tezos-xtz-logo.png",
    rgb: "47, 31, 53",
  },
  limanet: {
    logo: "/assets/tezos-xtz-logo.png",
    rgb: "27, 31, 53",
  },
};

// TODO: add `tezos` namespace to `caip-api` package to avoid manual specification here.
export const TezosChainData: ChainsMap = {
  ghostnet: {
    name: "Tezos Ghostnet",
    id: "tezos:ghostnet",
    rpc: ["https://ghostnet.ecadinfra.com/"],
    slip44: 397,
    testnet: true,
  },
  limanet: {
    name: "Tezos Limanet",
    id: "tezos:limanet",
    rpc: ["https://limanet.ecadinfra.com/"],
    slip44: 397,
    testnet: true,
  },
};

export function getChainMetadata(chainId: string): ChainMetadata {
  const reference = chainId.split(":")[1];
  const metadata = TezosMetadata[reference];
  if (typeof metadata === "undefined") {
    throw new Error(`No chain metadata found for chainId: ${chainId}`);
  }
  return metadata;
}

export function getChainRequestRender(
  request: JsonRpcRequest
): ChainRequestRender[] {
    console.log('Request is', request)
  let params = [{ label: "Method", value: request.method }];

  switch (request.method) {
    default:
      params = [
        ...params,
        {
          label: "params",
          value: JSON.stringify(request.params, null, "\t"),
        },
      ];
      break;
  }
  return params;
}
