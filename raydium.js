const {
    Raydium, WSOLMint, MARKET_STATE_LAYOUT_V3
} = require('@raydium-io/raydium-sdk-v2')
const bs58 = require('bs58');
const {
    Connection, Keypair, PublicKey
} = require('@solana/web3.js')
require('dotenv').config()

const getRaydiumAmmPoolInfo = async (mint) => {
    const url = `https://api-v3.raydium.io/pools/info/mint?mint1=${mint}&mint2=${WSOLMint}&poolType=standard&poolSortField=default&sortType=desc&pageSize=1000&page=1`;
    const rawPoolInfo = await (await fetch(url)).json();

    return rawPoolInfo['data']['data'];

}
const getRaydiumCpmmPoolInfo = async (mint) => {
    const url = `https://api-v3.raydium.io/pools/info/mint?mint1=${mint}&mint2=${WSOLMint}&poolType=concentrated&poolSortField=default&sortType=desc&pageSize=1000&page=1`;
    const rawPoolInfo = await (await fetch(url)).json();

    return rawPoolInfo['data']['data'];

}

module.exports = {
    getRaydiumAmmPoolInfo,
    getRaydiumCpmmPoolInfo
}