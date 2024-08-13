const { WSOLMint } = require('@raydium-io/raydium-sdk-v2');

const fetch_meteora_dlmm_by_token = async (mintA, mintB) => {
    console.time("runtime")
    const meteora_api_url = "https://amm.meteora.ag/pools/"
    const rawData = await ((await fetch(meteora_api_url)).text());

    var pattern = new RegExp(`({"pool_address"((?!pool_address).)*((${mintA}","*${mintB})|(${mintB}","*${mintA}))((?!pool_address).)*)((,{"pool_address")|(\\]))`);
    console.timeEnd("runtime")

    var matches = rawData.match(pattern);

    const poolInfo = JSON.parse(matches[1])
    console.log(poolInfo)
    console.timeEnd("runtime")
}
fetch_meteora_dlmm_by_token(WSOLMint, "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")