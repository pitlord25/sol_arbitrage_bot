const { Connection } = require("@solana/web3.js");
const { OrcaService } = require("./OrcaService.js");
const { RaydiumService } = require("./RaydiumService.js");
const { BN } = require("@coral-xyz/anchor");
const { MathUtil, SqrtPriceMath } = require("@raydium-io/raydium-sdk-v2");
const { MeteoraService } = require("./MeteoraService.js");

class TokenMonitor {
    constructor(interval = 5000, logger, db) {
        // Initialize timer interval
        this.interval = interval; // 5 seconds
        this.timer = null;
        this.logger = logger;
        this.mysqlDB = db;
        this.connection = new Connection(process.env.RPC_NODE);
        this.orcaService = new OrcaService(this.connection);
        this.raydiumService = new RaydiumService(this.connection)
        this.meteoraService = new MeteoraService(this.connection)
    }

    async initSDKs() {
        const promises = [
            this.raydiumService.initSdk(),
            this.orcaService.initSdk(),
            this.meteoraService.initSDK()
        ]
        await Promise.all(promises);
    }

    // Method to start the timer
    start() {
        if (this.timer) {
            this.logger.info('Timer is already running.');
            return;
        }
        this.timer = setInterval(() => {
            this.checkTokens();
        }, this.interval);
        this.logger.info('Monitoring started....');
    }

    // Method to stop the timer
    stop() {
        if (!this.timer) {
            this.logger.info('Timer is not running.');
            return;
        }
        clearInterval(this.timer);
        this.timer = null;
        this.logger.info('Monitoring stopped....');
    }

    findMaxDifference(a, b, c) {
        // Flatten all numbers into a single array while marking their source
        let allTokens = [];

        allTokens.push({ price: a['price'], source: 'a', token: a['token'] });

        if (Array.isArray(b)) {
            for (let obj of b) {
                allTokens.push({ price: obj.price, source: 'b', token: obj.token });
            }
        }

        if (Array.isArray(c)) {
            for (let obj of c) {
                allTokens.push({ price: obj.price, source: 'c', token: obj.token });
            }
        }

        // If there are less than 2 numbers, return null
        if (allTokens.length < 2) {
            return null;
        }
        
        // Sort numbers by their price
        let maxArbitrage = -Infinity;
        let result = null;

        // Iterate to find the maximum arbitrage with different sources
        for (let i = 0; i < allTokens.length; i++) {
            for (let j = 0; j < allTokens.length; j++) {
                if (i !== j && allTokens[i].source !== allTokens[j].source) {
                    // Calculate arbitrage effect
                    let arbitrageEffect = allTokens[j].price / allTokens[i].price;
                    if (arbitrageEffect > maxArbitrage) {
                        maxArbitrage = arbitrageEffect;
                        result = {
                            arbitrage_effect: arbitrageEffect,
                            From: {
                                address : allTokens[i].token,
                                source : allTokens[i].source
                            },
                            To: {
                                address : allTokens[j].token,
                                source : allTokens[j].source
                            }
                        };
                    }
                }
            }
        }

        return result;
    }


    // Method to check tokens (placeholder for actual logic)
    async checkTokens() {
        this.logger.info('Checking tokens...');
        const tokenList = (await this.mysqlDB.readTokens()).results;

        var ammPoolList = []
        var clmmPoolList = []
        var whirlPoolList = []
        var dlmmPoolList = []
        var decimals = {}
        for (let i = 0; i < tokenList.length; ++i) {
            const token = tokenList[i]
            if (JSON.parse(token['raydiumAmm']).length > 0)
                ammPoolList = ammPoolList.concat(JSON.parse(token['raydiumAmm']))
            if (JSON.parse(token['raydiumCLMM']).length > 0)
                clmmPoolList = clmmPoolList.concat(JSON.parse(token['raydiumCLMM']))
            if (JSON.parse(token['orcaWhirlpool']).length > 0)
                whirlPoolList = whirlPoolList.concat(JSON.parse(token['orcaWhirlpool']))
            if (JSON.parse(token['meteoraDLMM']).length > 0)
                dlmmPoolList = dlmmPoolList.concat(JSON.parse(token['meteoraDLMM']))

            decimals[token['tokens']] = token['decimals']
        }

        const promises = [
            // this.raydiumService.getRaydiumAmmPools(ammPoolList),
            // this.raydiumService.getRaydiumClmmPools(clmmPoolList),
            // this.orcaService.getOrcaPoolInfoList(whirlPoolList),
            this.meteoraService.getMeteoraPoolInfoList(dlmmPoolList)
        ]
        // const [ammPoolInfoList, clmmPoolInfoList, orcaPoolInfoList, dlmmPoolInfoList] = await Promise.all(promises)
        const [temp] = await Promise.all(promises)
        console.log(await temp.getActiveBin())
        return
        let poolPrices = {}

        Object.keys(ammPoolInfoList).forEach(key => {
            if (ammPoolInfoList[key].baseMint.toString() == 'So11111111111111111111111111111111111111112')
                poolPrices[key] = parseFloat(ammPoolInfoList[key].poolPrice)
            else
                poolPrices[key] = 1 / parseFloat(ammPoolInfoList[key].poolPrice)
        })
        // return

        Object.keys(clmmPoolInfoList).forEach(key => {
            poolPrices[key] = clmmPoolInfoList[key].currentPrice
        })

        orcaPoolInfoList.forEach(value => {
            const poolData = value.data
            // console.log(value)
            let liquidity = poolData.liquidity.toString()
            if(value.tokenAInfo.mint.toString() == 'So11111111111111111111111111111111111111112' && value.tokenVaultAInfo.amount < 7 * (10 ** 9)) {
                poolPrices[value.address.toString()] = -Infinity
                return
            }
            if (value.tokenBInfo.mint.toString() == 'So11111111111111111111111111111111111111112' && value.tokenVaultBInfo.amount < 7 * (10 ** 9)) {
                poolPrices[value.address.toString()] = -Infinity
            }
            let price = SqrtPriceMath.sqrtPriceX64ToPrice(poolData.sqrtPrice, value.tokenAInfo.decimals, value.tokenBInfo.decimals).toNumber()
            console.log(value.address.toString(), liquidity, price, value.tokenVaultAInfo.amount, value.tokenVaultBInfo.amount)
            // if(liquidity / price < 70)
            poolPrices[value.address.toString()] = price
        })

        console.log(dlmmPoolInfoList);

        // console.log(ammPoolInfoList, clmmPoolInfoList, orcaPoolInfoList)
        // return

        let targetTokenAndPool = {
            arbitrage_effect : -Infinity
        }

        tokenList.forEach(token => {
            let tokenContract = token['tokens']
            let ammPool = JSON.parse(token['raydiumAmm'])
            let clmmPools = JSON.parse(token['raydiumCLMM'])
            let whirlPools = JSON.parse(token['orcaWhirlpool'])

            let ammPrice = {
                price: poolPrices[ammPool],
                token: ammPool
            }
            let clmmPrices = [], whirlPrices = []
            clmmPools.forEach(clmm => {
                clmmPrices.push({
                    token: clmm,
                    price: poolPrices[clmm]
                })
            })
            whirlPools.forEach(whirl => {
                if(poolPrices[whirl] < 0)
                    return
                whirlPrices.push({
                    token: whirl,
                    price: poolPrices[whirl]
                })
            })

            // console.log(`token: ${tokenContract}, AMM : ${ammPrice}, CLMM Prices: ${clmmPrices}, WHIRL prices: ${whirlPrices}`)
            let diff = this.findMaxDifference(ammPrice, clmmPrices, whirlPrices)

            if (diff != null && diff.arbitrage_effect > targetTokenAndPool.arbitrage_effect) {
                targetTokenAndPool = diff
                targetTokenAndPool['token'] = tokenContract
            }
            // console.log(diff)
        })
        console.log(`Result: ${JSON.stringify(targetTokenAndPool)}`)
        return
        // Implement your token-checking logic here
    }
}

// To stop the timer later
// monitor.stop();


// const getPoolInfo = async (tokenContract) => {
//     if (tokenContract.length == 0)
//         return

//     // const poolInfoList = []
//     for (let i = 0; i < tokenContract.length; ++i) {
//         const mint = tokenContract[i]
//         const promises = [
//             RaydiumService.getRaydiumAmmPoolInfo(mint),
//             RaydiumService.getRaydiumAmmPoolInfo(mint),
//             OrcaService.fetch_orca_pool_info_by_token(mint)
//         ]
//         const poolInfoList = await Promise.all(promises);
//         console.log(poolInfoList)
//     }
// }

module.exports = {
    TokenMonitor
}