const {
    Connection, PublicKey
} = require('@solana/web3.js');
const { ORCA_WHIRLPOOL_PROGRAM_ID, ORCA_WHIRLPOOLS_CONFIG, ParsableWhirlpool } = require("@orca-so/whirlpools-sdk");
const { WSOLMint, publicKey } = require('@raydium-io/raydium-sdk-v2');

const ISOTOPE_TICK_SPACINGS = [1, 2, 4, 8, 16, 32, 64, 96, 128, 256, 512, 32896];

const fetch_orca_pool_info_by_token = async (mint) => {
    const connection = new Connection("https://mainnet.helius-rpc.com/?api-key=9d648f64-99af-453d-8a10-59ef5c2e6c2e", "confirmed");

    try {
        const otherToken = new PublicKey(mint);
        const whirlpoolAccountSize = 653
        const whirlpoolsConfigOffset = 8;
        const tokenMintAOffset = 101;
        const tokenMintBOffset = 181;

        const promises = [connection.getProgramAccounts(
            ORCA_WHIRLPOOL_PROGRAM_ID,
            {
                filters: [
                    // filter by size
                    { dataSize: whirlpoolAccountSize },
                    // filter by whirlpoolsConfig
                    { memcmp: { offset: whirlpoolsConfigOffset, bytes: ORCA_WHIRLPOOLS_CONFIG.toBase58() } },
                    // filter by mint
                    { memcmp: { offset: tokenMintAOffset, bytes: WSOLMint.toBase58() } },
                    { memcmp: { offset: tokenMintBOffset, bytes: otherToken.toBase58() } },
                ]
            }
        ), connection.getProgramAccounts(
            ORCA_WHIRLPOOL_PROGRAM_ID,
            {
                filters: [
                    // filter by size
                    { dataSize: whirlpoolAccountSize },
                    // filter by whirlpoolsConfig
                    { memcmp: { offset: whirlpoolsConfigOffset, bytes: ORCA_WHIRLPOOLS_CONFIG.toBase58() } },
                    // filter by mint
                    { memcmp: { offset: tokenMintBOffset, bytes: WSOLMint.toBase58() } },
                    { memcmp: { offset: tokenMintAOffset, bytes: otherToken.toBase58() } },
                ]
            }
        )];
        const whirlpools = await Promise.all(promises)
        var whirlPoolList = []
        for (const { pubkey, account } of whirlpools) {
            const whirlpoolData = ParsableWhirlpool.parse(pubkey, account);
            whirlPoolList.push(whirlpoolData)
        }
        return whirlPoolList;
    } catch (error) {
        console.error("Error:", error);
    }
}
module.exports = {
    fetch_orca_pool_info_by_token
}
// const main = async () => {
//     const connection = new Connection("https://mainnet.helius-rpc.com/?api-key=9d648f64-99af-453d-8a10-59ef5c2e6c2e", "confirmed");

//     try {
//         console.time("runtime")
//         console.log("WSOLMint:", WSOLMint);
//         console.log("WSOLMint PublicKey:", new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v").toString());

//         const otherToken = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
//         const whirlpoolAccountSize = 653
//         const whirlpoolsConfigOffset = 8;
//         const tokenMintAOffset = 101;
//         const tokenMintBOffset = 181;

//         const whirlpools = await connection.getProgramAccounts(
//             ORCA_WHIRLPOOL_PROGRAM_ID,
//             {
//                 filters: [
//                     // filter by size
//                     { dataSize: whirlpoolAccountSize },
//                     // filter by whirlpoolsConfig
//                     { memcmp: { offset: whirlpoolsConfigOffset, bytes: ORCA_WHIRLPOOLS_CONFIG.toBase58() } },
//                     // filter by mint
//                     { memcmp: { offset: tokenMintAOffset, bytes: WSOLMint.toBase58() } },
//                     { memcmp: { offset: tokenMintBOffset, bytes: otherToken.toBase58() } },
//                 ]
//             }
//         );
//         for (const { pubkey, account } of whirlpools) {
//             const whirlpoolData = ParsableWhirlpool.parse(pubkey, account);
//             console.log(
//                 "whirlpools with SAMO",
//                 `address=${pubkey.toBase58()}`,
//                 `A=${whirlpoolData.tokenMintA.toBase58()}`,
//                 `B=${whirlpoolData.tokenMintB.toBase58()}`,
//                 `tickSpacing=${whirlpoolData.tickSpacing}`
//             );
//         }
//         console.timeEnd("runtime")
//         // console.log("Other Token PublicKey:", otherToken.toString());

//         // const poolAddress = PDAUtil.getWhirlpool(ORCA_WHIRLPOOL_PROGRAM_ID, ORCA_WHIRLPOOLS_CONFIG, WSOLMint, otherToken, 2).publicKey;
//         // console.log("Pool Address:", poolAddress.toBase58());

//         // // console.log(await client.getPool(new PublicKey("6wcKna6ME71YqCkX9GcN8t8GN2QFyEXpA1Subfzk15Uo")))

//         // // const fetcher = ctx.fetcher;

//         // const pool = await client.getPool(poolAddress);
//         // // const pool = await client.getPool(new PublicKey("EJs4o2w8tEUMbGRKVxhVbUoCY6XP2VoLe2a2REZzwpPA"));
//         // console.log("Pool:", pool);
//     } catch (error) {
//         console.error("Error:", error);
//     }
// };

// main();
