const { AnchorProvider } = require("@coral-xyz/anchor");
const { Percentage, DecimalUtil } = require("@orca-so/common-sdk");
const { ORCA_WHIRLPOOLS_CONFIG, ORCA_WHIRLPOOL_PROGRAM_ID, ParsableWhirlpool, buildDefaultAccountFetcher, IGNORE_CACHE, swapQuoteByInputToken, WhirlpoolContext, buildWhirlpoolClient } = require("@orca-so/whirlpools-sdk");
const { WSOLMint} = require("@raydium-io/raydium-sdk-v2");
const { PublicKey } = require("@solana/web3.js");
const { Connection, Keypair } = require("@solana/web3.js");
const { default: Decimal } = require("decimal.js");
class OrcaService {
    constructor(connection) {
        this.connection = connection;
    }

    async initSdk() {
        this.fetcher = buildDefaultAccountFetcher(this.connection)
        this.provider = new AnchorProvider(this.connection, new Keypair())
        this.ctx = WhirlpoolContext.withProvider(this.provider, ORCA_WHIRLPOOL_PROGRAM_ID)
        this.client = buildWhirlpoolClient(this.ctx)
    }

    static async fetchOrcaPoolListByToken(mintA, mintB) {
        var rpcConnection = new Connection(process.env.RPC_NODE)
        const whirlpoolAccountSize = 653
        const whirlpoolsConfigOffset = 8;
        const tokenMintAOffset = 101;
        const tokenMintBOffset = 181;
        const whirlpools = await rpcConnection.getProgramAccounts(
            ORCA_WHIRLPOOL_PROGRAM_ID,
            {
                filters: [
                    // filter by size
                    { dataSize: whirlpoolAccountSize },
                    // filter by whirlpoolsConfig
                    { memcmp: { offset: whirlpoolsConfigOffset, bytes: ORCA_WHIRLPOOLS_CONFIG.toBase58() } },
                    // filter by mint
                    { memcmp: { offset: tokenMintAOffset, bytes: mintA } },
                    { memcmp: { offset: tokenMintBOffset, bytes: mintB } },
                ]
            }
        )
        var whirlPoolList = []
        for (const { pubkey, account } of whirlpools) {
            const whirlpoolData = ParsableWhirlpool.parse(pubkey, account);
            if (whirlpoolData.liquidity.toNumber() < 10 ** 4)
                continue;
            whirlPoolList.push(pubkey.toBase58())
        }
        return whirlPoolList;
    }

    async getOrcaPoolInfoList(poolList) {
        return await this.client.getPools(poolList, IGNORE_CACHE)
    }

    async swapWhirlpool(poolId, amountIn) {
        ;
    }
}

const main = async () => {
    const connection = new Connection("https://mainnet.helius-rpc.com/?api-key=0f3da69a-89d3-490d-afd8-e40345619270")
    const fetcher = buildDefaultAccountFetcher(connection)
    const provider = new AnchorProvider(connection, new Keypair())
    const ctx = WhirlpoolContext.withProvider(provider, ORCA_WHIRLPOOL_PROGRAM_ID)
    const client = buildWhirlpoolClient(ctx)
    const poolId = new PublicKey("ARs3pZiSyCutnm3X83MwP8zeg1BWCb5F7xeGszp4gHiz")
    
    const whirlpool = await client.getPool(poolId);
    const amount_in = new Decimal("1");

    // Obtain swap estimation (run simulation)
    const quote = await swapQuoteByInputToken(
        whirlpool,
        WSOLMint,
        DecimalUtil.toBN(amount_in, 9),
        // Acceptable slippage (10/1000 = 1%)
        Percentage.fromFraction(10, 1000),
        ORCA_WHIRLPOOL_PROGRAM_ID,
        fetcher,
        IGNORE_CACHE,
    );

    // Output the estimation
    console.log("estimatedAmountIn:", DecimalUtil.fromBN(quote.estimatedAmountIn, 9).toString(), "SOL");
    console.log("estimatedAmountOut:", DecimalUtil.fromBN(quote.estimatedAmountOut, 6).toString(), "other");
    console.log("otherAmountThreshold:", DecimalUtil.fromBN(quote.otherAmountThreshold, 6).toString(), "other");

    const tx = await whirlpool.swap(quote)

    console.log(tx)
}
main()

module.exports = {
    OrcaService
}