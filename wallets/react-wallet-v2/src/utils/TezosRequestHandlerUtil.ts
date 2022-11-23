import { TEZOS_SIGNING_METHODS } from '@/data/TEZOSData'
import { getWalletAddressFromParams } from '@/utils/HelperUtil'
import { formatJsonRpcError, formatJsonRpcResult } from '@json-rpc-tools/utils'
import { SignClientTypes } from '@walletconnect/types'
import { getSdkError } from '@walletconnect/utils'
import { tezosAddresses, tezosWallets } from './TezosWalletUtils'

export async function approveTezosRequest(
  requestEvent: SignClientTypes.EventArguments['session_request']
) {
  const { params, id } = requestEvent
  const { request } = params
  const wallet = tezosWallets[getWalletAddressFromParams(tezosAddresses, params)]

  switch (request.method) {
    case TEZOS_SIGNING_METHODS.TEZOS_SIGN_MESSAGE:
      const signedMessage = await wallet.signMessage(request)
      return formatJsonRpcResult(id, signedMessage)

    default:
      throw new Error(getSdkError('INVALID_METHOD').message)
  }
}

export function rejectTezosRequest(request: SignClientTypes.EventArguments['session_request']) {
  const { id } = request

  return formatJsonRpcError(id, getSdkError('USER_REJECTED_METHODS').message)
}
