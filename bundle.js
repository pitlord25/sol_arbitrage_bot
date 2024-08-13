const { AnchorProvider } = require("@coral-xyz/anchor");
const { Raydium, TxVersion, WSOLMint } = require("@raydium-io/raydium-sdk-v2");
const { Connection, sendAndConfirmTransaction } = require("@solana/web3.js");
const { Keypair, PublicKey } = require("@solana/web3.js");
const bs58 = require("bs58")
const { BN, Wallet } = require('@coral-xyz/anchor');
const { default: Decimal } = require("decimal.js");
const { buildDefaultAccountFetcher, buildWhirlpoolClient, WhirlpoolContext, swapQuoteByInputToken, ORCA_WHIRLPOOL_PROGRAM_ID, IGNORE_CACHE } = require("@orca-so/whirlpools-sdk");
const { Percentage, DecimalUtil } = require("@orca-so/common-sdk");
const { Transaction } = require("@solana/web3.js");

const main = async () => {
    const connection = new Connection("https://mainnet.helius-rpc.com/?api-key=0f3da69a-89d3-490d-afd8-e40345619270")
    const signer = Keypair.fromSecretKey(Uint8Array.from(bs58.default.decode("4xSy1SGKFunpiTnVXvJa1VBoyncGhHBc6EuWL1JkQb2gAyBmwgCFGkdqvNmBeCAtt9MwAXTDMfWezHCupax3bvJX")))
    const raydium = await Raydium.load({
        owner: signer,
        connection: connection,
        cluster: 'mainnet',
        blockhashCommitment: 'finalized',
        disableFeatureCheck: true,
        disableLoadToken: false
    })

    const amountIn = 10 ** 7;

    const poolId = "AB1eu2L1Jr3nfEft85AuD2zGksUbam1Kr8MR3uM2sjwt"
    // const inputMint = NATIVE_MINT.toBase58();
    const direction = true;
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
        slippage: 0.1, // range: 1 ~ 0.0001, means 100% ~ 0.01%
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

    const { transaction,builder } = await raydium.liquidity.swap({
        poolInfo,
        poolKeys,
        amountIn: new BN(amountIn),
        amountOut: out.amountOut, // out.amountOut means amount 'without' slippage
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

    // console.log(transaction)

    // const { txId } = await execute({ sendAndConfirm: true })

    //------------- For Orca ----------------//
    const fetcher = buildDefaultAccountFetcher(connection)
    const provider = new AnchorProvider(connection, new Wallet(signer))
    const ctx = WhirlpoolContext.withProvider(provider, ORCA_WHIRLPOOL_PROGRAM_ID)
    const client = buildWhirlpoolClient(ctx)
    const orcaPool = new PublicKey("5DGhcY7QKci7BhpAqboHYT3weVPcyNAwUVN8JYCL8viT")
    
    const whirlpool = await client.getPool(orcaPool);
    // const amount_in = new Decimal(out.amountOut.toString());
    // console.log(mintOut.address, amount_in)

    // Obtain swap estimation (run simulation)
    const quote = await swapQuoteByInputToken(
        whirlpool,
        mintOut.address,
        out.amountOut,
        // Acceptable slippage (10/1000 = 1%)
        Percentage.fromFraction(10, 1000),
        ORCA_WHIRLPOOL_PROGRAM_ID,
        fetcher,
        IGNORE_CACHE,
    );

    // Output the estimation
    console.log("estimatedAmountIn:", DecimalUtil.fromBN(quote.estimatedAmountIn, 6).toString(), "SOL");
    console.log("estimatedAmountOut:", DecimalUtil.fromBN(quote.estimatedAmountOut, 9).toString(), "other");
    console.log("otherAmountThreshold:", DecimalUtil.fromBN(quote.otherAmountThreshold, 9).toString(), "other");

    // console.log(whirlpool.)
    const orcaBuilder = await (await whirlpool.swap(quote, signer.publicKey)).build({
        maxSupportedTransactionVersion : 'legacy'
    })
    console.log(orcaBuilder.transaction)

    const bundledTransaction = new Transaction()
    builder.allInstructions.forEach((instruction, i) => {
        bundledTransaction.add(instruction)
        if (!instruction.programId) {
            // throw new Error(`Transaction instruction index ${i} has undefined program id`);
            console.log('error in ' + i)
        }
    });

    console.log(bundledTransaction)

    const signature = await sendAndConfirmTransaction(connection, bundledTransaction, [signer])
    console.log(signature)

    // console.log(tx)
}

main()