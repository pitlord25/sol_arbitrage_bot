const { BN } = require("@coral-xyz/anchor");
const { WSOLMint, Raydium, TxVersion } = require("@raydium-io/raydium-sdk-v2");
const { NATIVE_MINT } = require("@solana/spl-token");
const { Keypair, Connection, Transaction, VersionedMessage } = require("@solana/web3.js");
const { default: Decimal } = require("decimal.js");

class RaydiumService {
    constructor(connection) {
        this.connection = connection;
    }

    async initSdk() {
        this.raydium = await Raydium.load({
            owner: new Keypair(),
            connection: this.connection,
            cluster: 'mainnet',
            blockhashCommitment: 'finalized',
            disableFeatureCheck: true,
            disableLoadToken: false
        })
    }

    static async fetchRaydiumAmmPoolAddressByToken(mint) {
        const url = `https://api-v3.raydium.io/pools/info/mint?mint1=${mint}&mint2=${WSOLMint}&poolType=standard&poolSortField=default&sortType=desc&pageSize=1000&page=1`;
        const rawPoolInfo = await (await fetch(url)).json();

        return rawPoolInfo['data']['data'];
    }

    static async fetchRaydiumCpmmPoolAddressByToken(mint) {
        const url = `https://api-v3.raydium.io/pools/info/mint?mint1=${mint}&mint2=${WSOLMint}&poolType=concentrated&poolSortField=default&sortType=desc&pageSize=1000&page=1`;
        const rawPoolInfo = await (await fetch(url)).json();

        return rawPoolInfo['data']['data'];

    }

    static filterPool(poolList) {
        var filteredPoolList = []
        poolList.forEach(pool => {
            if (pool.tvl < 10 ** 4)
                return;
            filteredPoolList.push(pool['id'])
        });
        return filteredPoolList;
    }

    async getRaydiumAmmPools(poolList) {
        const rawPool = await this.raydium.liquidity.getRpcPoolInfos(poolList,
            {
                batchRequest: true
            })
        return rawPool
    }

    async getRaydiumClmmPools(poolList) {
        const rawPool = await this.raydium.clmm.getRpcClmmPoolInfos({
            poolIds: poolList,
            config: {
                batchRequest: true
            }
        })
        return rawPool
    }

    async swapTokenInAmm(poolId, secretKey, amountIn) {
        const direction = false;
        const txVersion = TxVersion.LEGACY

        const rpcData = await raydium.liquidity.getRpcPoolInfo(poolId)
        const poolKeys = await raydium.liquidity.getAmmPoolKeys(poolId)
        const data = await raydium.api.fetchPoolById({ ids: poolId })
        let poolInfo = data[0]

        const [baseReserve, quoteReserve, status] = [rpcData.baseReserve, rpcData.quoteReserve, rpcData.status.toNumber()]

        const [mintIn, mintOut] = direction ? [poolInfo.mintA, poolInfo.mintB] : [poolInfo.mintB, poolInfo.mintA]

        const out = raydium.liquidity.computeAmountOut({
            poolInfo: {
                ...poolInfo,
                baseReserve,
                quoteReserve,
                status,
                version: 4,
            },
            amountIn: new BN(amountIn),
            mintIn: mintIn.address,
            mintOut: mintOut.address,
            slippage: 0.01, // range: 1 ~ 0.0001, means 100% ~ 0.01%
        })

        console.log(
            `computed swap ${new Decimal(amountIn)
                .div(10 ** mintIn.decimals)
                .toDecimalPlaces(mintIn.decimals)
                .toString()} ${mintIn.symbol || mintIn.address} to ${new Decimal(out.amountOut.toString())
                    .div(10 ** mintOut.decimals)
                    .toDecimalPlaces(mintOut.decimals)
                    .toString()} ${mintOut.symbol || mintOut.address}, minimum amount out ${new Decimal(out.minAmountOut.toString())
                        .div(10 ** mintOut.decimals)
                        .toDecimalPlaces(mintOut.decimals)} ${mintOut.symbol || mintOut.address}`
        )

        const { transaction } = await raydium.liquidity.swap({
            poolInfo,
            poolKeys,
            amountIn: new BN(amountIn),
            amountOut: out.minAmountOut, // out.amountOut means amount 'without' slippage
            fixedSide: 'in',
            inputMint: mintIn.address,
            txVersion,

            // optional: set up token account
            // config: {
            //   inputUseSolBalance: true, // default: true, if you want to use existed wsol token account to pay token in, pass false
            //   outputUseSolBalance: true, // default: true, if you want to use existed wsol token account to receive token out, pass false
            //   associatedOnly: true, // default: true, if you want to use ata only, pass true
            // },

            // optional: set up priority fee here
            // computeBudgetConfig: {
            //   units: 600000,
            //   microLamports: 100000000,
            // },
        })

        console.log(transaction)
    }
}

const main = async () => {
    const raydium = await Raydium.load({
        owner: new Keypair(),
        connection: new Connection("https://mainnet.helius-rpc.com/?api-key=9d648f64-99af-453d-8a10-59ef5c2e6c2e"),
        cluster: 'mainnet',
        blockhashCommitment: 'finalized',
        disableFeatureCheck: true,
        disableLoadToken: false
    })

    const amountIn = 10 ** 8;

    const poolId = "2ATRAfZsYJnUsPMqKhy47SQ5jKDtPBKXBeLfP7w6w3o1"
    const inputMint = NATIVE_MINT.toBase58();
    const direction = false;
    const txVersion = TxVersion.LEGACY

    const rpcData = await raydium.liquidity.getRpcPoolInfo(poolId)
    const poolKeys = await raydium.liquidity.getAmmPoolKeys(poolId)
    const data = await raydium.api.fetchPoolById({ ids: poolId })
    let poolInfo = data[0]

    const [baseReserve, quoteReserve, status] = [rpcData.baseReserve, rpcData.quoteReserve, rpcData.status.toNumber()]

    const [mintIn, mintOut] = direction ? [poolInfo.mintA, poolInfo.mintB] : [poolInfo.mintB, poolInfo.mintA]

    const out = raydium.liquidity.computeAmountOut({
        poolInfo: {
            ...poolInfo,
            baseReserve,
            quoteReserve,
            status,
            version: 4,
        },
        amountIn: new BN(amountIn),
        mintIn: mintIn.address,
        mintOut: mintOut.address,
        slippage: 0.01, // range: 1 ~ 0.0001, means 100% ~ 0.01%
    })

    console.log(
        `computed swap ${new Decimal(amountIn)
            .div(10 ** mintIn.decimals)
            .toDecimalPlaces(mintIn.decimals)
            .toString()} ${mintIn.symbol || mintIn.address} to ${new Decimal(out.amountOut.toString())
                .div(10 ** mintOut.decimals)
                .toDecimalPlaces(mintOut.decimals)
                .toString()} ${mintOut.symbol || mintOut.address}, minimum amount out ${new Decimal(out.minAmountOut.toString())
                    .div(10 ** mintOut.decimals)
                    .toDecimalPlaces(mintOut.decimals)} ${mintOut.symbol || mintOut.address}`
    )

    const { transaction } = await raydium.liquidity.swap({
        poolInfo,
        poolKeys,
        amountIn: new BN(amountIn),
        amountOut: out.minAmountOut, // out.amountOut means amount 'without' slippage
        fixedSide: 'in',
        inputMint: mintIn.address,
        txVersion,

        // optional: set up token account
        // config: {
        //   inputUseSolBalance: true, // default: true, if you want to use existed wsol token account to pay token in, pass false
        //   outputUseSolBalance: true, // default: true, if you want to use existed wsol token account to receive token out, pass false
        //   associatedOnly: true, // default: true, if you want to use ata only, pass true
        // },

        // optional: set up priority fee here
        // computeBudgetConfig: {
        //   units: 600000,
        //   microLamports: 100000000,
        // },
    })

    console.log(transaction)

    // const { txId } = await execute({ sendAndConfirm: true })
}

main()
module.exports = {
    RaydiumService
}