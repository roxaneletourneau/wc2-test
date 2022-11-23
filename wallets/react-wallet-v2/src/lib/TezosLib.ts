import { InMemorySigner } from '@taquito/signer';

export default class TezosLib {
  secret: string
  tezosSigner: InMemorySigner

  constructor(secretKey: string) {
    this.secret = secretKey
    this.tezosSigner = new InMemorySigner(secretKey)
  }

  public async getAddress() {
    return await this.tezosSigner.publicKeyHash()
  }

  public getSecretKey() {
    return this.secret;
  }

  public async signMessage(request: {
    method: string;
    params: any;
  }) {
    const sign = await this.tezosSigner.sign(request.params.expression)
    return {signature: sign.prefixSig};
  }

}