const { WSOLMint } = require("@raydium-io/raydium-sdk-v2");
const { PublicKey } = require("@solana/web3.js");
// const { DLMM } = require('@meteora-ag/dlmm')
// import DLMM from "@meteora-ag/dlmm";
// const DLMM = require('@meteora-ag/dlmm')

class MeteoraService {
    constructor(connection) {
        this.connection = connection;
    }

    async initSDK() {
    }

    static async fetchMeteoraDlmmPoolAddressByToken(mint) {
        const url = `https://dlmm-api.meteora.ag/pair/group_pair/${mint}-${WSOLMint.toBase58()}`;
        const rawPoolInfo = await (await fetch(url)).json();

        return rawPoolInfo;
    }

    async getMeteoraPoolInfoList(pools) {
        const { default: DLMM } = await import("@meteora-ag/dlmm");
        const pubkeyArray = pools.map(keyString => new PublicKey(keyString));
        
        return await DLMM.default.createMultiple(this.connection, pubkeyArray)
    }

    static filterPool(poolList) {
        var filteredPoolList = []
        poolList.forEach(pool => {
            if (parseFloat(pool.liquidity) < 10 ** 4)
                return;
            filteredPoolList.push(pool['address'])
        });
        return filteredPoolList;
    }
}

module.exports = {
    MeteoraService
}